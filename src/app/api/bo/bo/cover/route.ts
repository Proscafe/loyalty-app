import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireBoAdminApi } from "@/lib/bo/auth";
import { createBoEngine, loadBoSnapshot } from "@/lib/bo/costing";

// Comparison prices are stored behind RLS. Use the service role only AFTER
// requireBoAdminApi has authorized the caller as master_admin.
function comparisonDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Compare Price database configuration missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment."
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function databaseError(context: string, value: unknown): Error {
  if (value && typeof value === "object") {
    const e = value as { message?: string; code?: string; details?: string; hint?: string };
    const parts = [e.message, e.code && `code ${e.code}`, e.details, e.hint].filter(Boolean);
    if (parts.length) return new Error(`${context}: ${parts.join(" | ")}`);
  }
  return new Error(`${context}: ${value instanceof Error ? value.message : String(value)}`);
}

export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  try {
    const snapshot = await loadBoSnapshot(supabase);
    const engine = createBoEngine(snapshot);

    // Menu Pricing shares the exact Menu Categories managed in Settings and Recipes.
    // Legacy cover_section_id must not determine the displayed category.
    const knownCategoryIds = new Set(snapshot.menuCategories.map((category: any) => String(category.id)));
    const visibleMenuItems = snapshot.menuItems.filter((item: any) => item.active !== false);
    const sections = [...snapshot.menuCategories]
      .sort((a: any, b: any) => String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base", numeric: true }))
      .map((category: any) => ({
      ...category,
      items: visibleMenuItems
        .filter((item: any) => String(item.menu_category_id) === String(category.id))
        .sort((a: any, b: any) => String(a.name ?? "").localeCompare(String(b.name ?? "")))
        .map((item: any) => engine.menuCost(item)),
    }));

    const unsectioned = visibleMenuItems
      .filter((item: any) => !item.menu_category_id || !knownCategoryIds.has(String(item.menu_category_id)))
      .map((item: any) => engine.menuCost(item));

    // A flag belongs to a saved recipe line; expose it for Menu Pricing.
    const flaggedRecipeIds = new Set(
      snapshot.recipeLines
        .filter((line: any) => line.needs_review === true)
        .map((line: any) => Number(line.recipe_id)),
    );
    sections.forEach((section: any) => {
      section.items = section.items.map((item: any) => ({
        ...item, needs_review: flaggedRecipeIds.has(Number(item.recipe_id)),
      }));
    });
    unsectioned.forEach((item: any) => {
      item.needs_review = flaggedRecipeIds.has(Number(item.recipe_id));
    });

    const { data: storedComparisons, error: compareError } = await comparisonDb()
      .from("bo_menu_price_comparisons")
      .select("menu_item_id, compare_sp_usd");
    if (compareError) throw databaseError("Unable to load saved Compare Prices", compareError);
    const comparisons = Object.fromEntries((storedComparisons || []).map((row: any) => [String(row.menu_item_id), row.compare_sp_usd]));

    return NextResponse.json({
      comparisons,
      sections,
      unsectioned,
      rate: engine.rate,
      threshold: engine.threshold,
      adjustment: engine.adjustment,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to load Cover." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const body = await request.json();
  const id = Number(body?.id);
  const spUsd =
    body?.sp_usd === null || body?.sp_usd === "" ? null : Number(body?.sp_usd);

  if (!Number.isInteger(id) || id <= 0 || (spUsd !== null && (!Number.isFinite(spUsd) || spUsd < 0))) {
    return NextResponse.json({ error: "Invalid Cover row." }, { status: 400 });
  }

  const { data: old } = await supabase
    .from("bo_menu_items")
    .select("sp_usd")
    .eq("id", id)
    .maybeSingle();

  const { data: updated, error: updateError } = await supabase
    .from("bo_menu_items")
    .update({
      sp_usd: spUsd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, sp_usd")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated) return NextResponse.json({ error: "Menu item was not updated." }, { status: 404 });

  if (old && Number(old.sp_usd ?? 0) !== Number(spUsd ?? 0)) {
    await supabase.from("bo_menu_price_history").insert({
      menu_item_id: id,
      old_sp_usd: old.sp_usd,
      new_sp_usd: spUsd,
    });
  }

  return NextResponse.json({ id, sp_usd: spUsd });
}

// Comparisons are stored separately from real selling prices.
export async function PATCH(request: Request) {
  const { error } = await requireBoAdminApi();
  if (error) return error;
  try {
    const body = await request.json();
    const id = Number(body?.id);
    const price = body?.compare_sp_usd === null || body?.compare_sp_usd === "" ? null : Number(body?.compare_sp_usd);
    if (!Number.isInteger(id) || id <= 0 || (price !== null && (!Number.isFinite(price) || price < 0)))
      return NextResponse.json({ error: "Invalid comparison price." }, { status: 400 });
    const db = comparisonDb();
    if (price === null) {
      const { error: deleteError } = await db.from("bo_menu_price_comparisons")
        .delete().eq("menu_item_id", id);
      if (deleteError) throw databaseError("Unable to clear comparison", deleteError);
    } else {
      const { data: stored, error: writeError } = await db.from("bo_menu_price_comparisons")
        .upsert({ menu_item_id: id, compare_sp_usd: price }, { onConflict: "menu_item_id" })
        .select("menu_item_id, compare_sp_usd").single();
      if (writeError) throw databaseError("Unable to save comparison", writeError);
      if (!stored || Number(stored.compare_sp_usd) !== price) {
        throw new Error("Compare Price verification failed: database did not return the saved value.");
      }
    }
    return NextResponse.json({ ok: true, id, compare_sp_usd: price });
  } catch (e) {
    return NextResponse.json({ error: databaseError("Comparison save failed", e).message }, { status: 500 });
  }
}

export async function DELETE() {
  const { error } = await requireBoAdminApi();
  if (error) return error;
  try {
    const { error: deleteError } = await comparisonDb().from("bo_menu_price_comparisons")
      .delete().gt("menu_item_id", 0);
    if (deleteError) throw databaseError("Unable to reset comparisons", deleteError);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: databaseError("Reset failed", e).message }, { status: 500 });
  }
}
