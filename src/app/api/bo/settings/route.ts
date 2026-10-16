import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";

const ALLOWED = new Set(["usd_lbp_rate", "food_cost_threshold", "price_adjust_pct", "bar_cost_threshold", "lbp_rounding", "display_currency"]);
const TABLES = {
  ingredient_categories: "bo_ingredient_categories",
  menu_categories: "bo_menu_categories",
  suppliers: "bo_suppliers",
} as const;
type Section = keyof typeof TABLES;

function getTable(section: unknown): string | null {
  return typeof section === "string" && Object.prototype.hasOwnProperty.call(TABLES, section) ? TABLES[section as Section] : null;
}
function dbError(error: any) {
  if (error?.code === "23503") return NextResponse.json({ error: "Cannot delete this entry because existing ingredients or recipes use it. Move those items to another category or supplier first." }, { status: 409 });
  if (error?.code === "23505") return NextResponse.json({ error: "An entry with this name already exists." }, { status: 409 });
  return NextResponse.json({ error: error?.message || "Database operation failed." }, { status: 500 });
}

export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;
  const [settings, categories, menuCategories, suppliers] = await Promise.all([
    supabase.from("bo_settings").select("key,value").order("key"),
    supabase.from("bo_ingredient_categories").select("id,name,sort").order("sort").order("name"),
    supabase.from("bo_menu_categories").select("id,name,sort").order("sort").order("name"),
    supabase.from("bo_suppliers").select("id,name").order("name"),
  ]);
  const failure = settings.error || categories.error || menuCategories.error || suppliers.error;
  if (failure) return dbError(failure);
  return NextResponse.json({
    settings: Object.fromEntries((settings.data ?? []).map((row: any) => [row.key, row.value])),
    ingredient_categories: categories.data ?? [], menu_categories: menuCategories.data ?? [], suppliers: suppliers.data ?? [],
  });
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!body?.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) return NextResponse.json({ error: "A settings object is required." }, { status: 400 });
  const rows = Object.entries(body.settings).filter(([key]) => ALLOWED.has(key)).map(([key, value]) => ({ key, value: String(value ?? ""), updated_at: new Date().toISOString() }));
  if (rows.length) {
    const { error: writeError } = await supabase.from("bo_settings").upsert(rows, { onConflict: "key" });
    if (writeError) return dbError(writeError);
    if (Object.prototype.hasOwnProperty.call(body.settings, "usd_lbp_rate")) {
      // History failure must not turn a successfully saved exchange rate into a false save failure.
      const { error: historyError } = await supabase.from("bo_exchange_rate_history").insert({ rate: String(body.settings.usd_lbp_rate), note: "BO Settings update" });
      if (historyError) console.error("BO exchange rate history:", historyError.message);
    }
  }
  return NextResponse.json({ saved: rows.length });
}

export async function POST(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const table = getTable(body?.section);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!table || !name || name.length > 160) return NextResponse.json({ error: "Select a valid list and enter a name (1–160 characters)." }, { status: 400 });
  const { data, error: writeError } = await supabase.from(table).insert({ name }).select("id,name").single();
  if (writeError) return dbError(writeError);
  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const table = getTable(body?.section);
  const id = Number(body?.id);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!table || !Number.isSafeInteger(id) || id <= 0 || !name || name.length > 160) return NextResponse.json({ error: "Invalid list item or name." }, { status: 400 });
  const { data, error: writeError } = await supabase.from(table).update({ name }).eq("id", id).select("id,name").maybeSingle();
  if (writeError) return dbError(writeError);
  if (!data) return NextResponse.json({ error: "Entry not found or update not permitted." }, { status: 404 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const table = getTable(body?.section);
  const id = Number(body?.id);
  if (!table || !Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid list item." }, { status: 400 });
  const { data, error: writeError } = await supabase.from(table).delete().eq("id", id).select("id").maybeSingle();
  if (writeError) return dbError(writeError);
  if (!data) return NextResponse.json({ error: "Entry not found or deletion not permitted." }, { status: 404 });
  return NextResponse.json({ ok: true, deleted_id: id });
}
