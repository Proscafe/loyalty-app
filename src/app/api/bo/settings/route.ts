import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";

const ALLOWED = new Set([
  "usd_lbp_rate",
  "food_cost_threshold",
  "price_adjust_pct",
  "bar_cost_threshold",
  "lbp_rounding",
  "display_currency",
]);

export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const [settings, categories, menuCategories, coverSections, suppliers] =
    await Promise.all([
      supabase.from("bo_settings").select("key,value").order("key"),
      supabase.from("bo_ingredient_categories").select("id,name,sort").order("sort").order("name"),
      supabase.from("bo_menu_categories").select("id,name,sort").order("sort").order("name"),
      supabase.from("bo_cover_sections").select("id,name,sort").order("sort").order("name"),
      supabase.from("bo_suppliers").select("id,name").order("name"),
    ]);

  const firstError =
    settings.error ||
    categories.error ||
    menuCategories.error ||
    coverSections.error ||
    suppliers.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: Object.fromEntries((settings.data ?? []).map((row: any) => [row.key, row.value])),
    ingredient_categories: categories.data ?? [],
    menu_categories: menuCategories.data ?? [],
    cover_sections: coverSections.data ?? [],
    suppliers: suppliers.data ?? [],
  });
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const body = await request.json();
  const updates = body?.settings;

  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "settings object is required." }, { status: 400 });
  }

  const rows = Object.entries(updates)
    .filter(([key]) => ALLOWED.has(key))
    .map(([key, value]) => ({
      key,
      value: String(value ?? ""),
      updated_at: new Date().toISOString(),
    }));

  if (rows.length) {
    const { error: updateError } = await supabase
      .from("bo_settings")
      .upsert(rows, { onConflict: "key" });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (Object.prototype.hasOwnProperty.call(updates, "usd_lbp_rate")) {
      await supabase.from("bo_exchange_rate_history").insert({
        rate: String(updates.usd_lbp_rate),
        note: "BO Settings update",
      });
    }
  }

  return NextResponse.json({ saved: rows.length });
}
