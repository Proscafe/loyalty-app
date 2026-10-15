import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";
import { createBoEngine, loadBoSnapshot } from "@/lib/bo/costing";

function n(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  try {
    const snapshot = await loadBoSnapshot(supabase);
    const engine = createBoEngine(snapshot);

    return NextResponse.json({
      items: snapshot.menuItems.map((row: any) => engine.menuCost(row)),
      recipes: snapshot.recipes
        .filter((row: any) => row.kind === "menu")
        .map((row: any) => ({ id: row.id, name: row.name, menu_category_id: row.menu_category_id })),
      categories: snapshot.menuCategories,
      cover_sections: snapshot.coverSections,
      usd_lbp_rate: engine.rate,
      threshold: engine.threshold,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to load menu costing." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const body = await request.json();
  const name = String(body?.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Menu item name is required." }, { status: 400 });
  }

  const { data, error: insertError } = await supabase
    .from("bo_menu_items")
    .insert({
      name,
      menu_category_id: n(body?.menu_category_id),
      cover_section_id: n(body?.cover_section_id),
      cover_sort: n(body?.cover_sort),
      recipe_id: n(body?.recipe_id),
      recipe_factor: n(body?.recipe_factor) ?? 1,
      sp_usd: n(body?.sp_usd),
      reference_cost_note: String(body?.reference_cost_note ?? "").trim() || null,
      active: body?.active === false ? false : true,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const body = await request.json();
  const id = Number(body?.id);
  const name = String(body?.name ?? "").trim();

  if (!Number.isInteger(id) || id <= 0 || !name) {
    return NextResponse.json({ error: "Invalid menu item." }, { status: 400 });
  }

  const { data: old } = await supabase
    .from("bo_menu_items")
    .select("sp_usd")
    .eq("id", id)
    .maybeSingle();

  const row = {
    name,
    menu_category_id: n(body?.menu_category_id),
    cover_section_id: n(body?.cover_section_id),
    cover_sort: n(body?.cover_sort),
    recipe_id: n(body?.recipe_id),
    recipe_factor: n(body?.recipe_factor) ?? 1,
    sp_usd: n(body?.sp_usd),
    reference_cost_note: String(body?.reference_cost_note ?? "").trim() || null,
    active: body?.active === false ? false : true,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("bo_menu_items")
    .update(row)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (old && Number(old.sp_usd ?? 0) !== Number(row.sp_usd ?? 0)) {
    await supabase.from("bo_menu_price_history").insert({
      menu_item_id: id,
      old_sp_usd: old.sp_usd,
      new_sp_usd: row.sp_usd,
    });
  }

  return NextResponse.json({ id });
}

export async function DELETE(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));

  const { error: deleteError } = await supabase
    .from("bo_menu_items")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: id });
}
