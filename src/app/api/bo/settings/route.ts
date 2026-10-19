import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";

const ALLOWED = new Set(["usd_lbp_rate", "food_cost_threshold", "price_adjust_pct", "bar_cost_threshold", "lbp_rounding", "usd_rounding", "display_currency"]);
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

// Read every page, not just Supabase's default first 1,000 rows.
// Menu categories use Settings-managed sort order. Other lists stay alphabetical.
async function readAll(supabase: any, table: string, columns: string) {
  const rows: any[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from(table)
      .select(columns).order(table === "bo_settings" ? "key" : "id", { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }
  return table === "bo_menu_categories"
    ? rows.sort((a, b) => (Number(a.sort ?? 0) - Number(b.sort ?? 0)) || (Number(a.id) - Number(b.id)))
    : rows.sort((a, b) => String(a.name ?? a.key ?? "").localeCompare(String(b.name ?? b.key ?? ""), undefined, { sensitivity: "base", numeric: true }));
}

export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;
  try {
    const [settings, ingredientCategories, menuCategories, suppliers] = await Promise.all([
      readAll(supabase, "bo_settings", "key,value"),
      readAll(supabase, "bo_ingredient_categories", "id,name,sort"),
      readAll(supabase, "bo_menu_categories", "id,name,sort,family"),
      readAll(supabase, "bo_suppliers", "id,name"),
    ]);
    return NextResponse.json({
      settings: Object.fromEntries(settings.map((row: any) => [row.key, row.value])),
      ingredient_categories: ingredientCategories, menu_categories: menuCategories, suppliers,
    });
  } catch (e) {
    return dbError(e);
  }
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
  if (body?.action === "inspect_delete" || body?.action === "transfer_delete") return performCategoryTransfer(supabase, body);
  if (body?.action === "reorder_menu_category") return reorderMenuCategory(supabase, body);
  const table = getTable(body?.section);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!table || !name || name.length > 160) return NextResponse.json({ error: "Select a valid list and enter a name (1–160 characters)." }, { status: 400 });
  const family = body?.family;
  if (table === "bo_menu_categories" && !["Food", "Beverage", "Hooka"].includes(family))
    return NextResponse.json({ error: "Choose Food, Beverage or Hooka before adding a menu category." }, { status: 400 });
  const values = table === "bo_menu_categories" ? { name, family } : { name };
  const { data, error: writeError } = await supabase.from(table).insert(values).select(table === "bo_menu_categories" ? "id,name,family" : "id,name").single();
  if (writeError) return dbError(writeError);
  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}

// Settings owns the display order for Menu Pricing and Recipes.
// Re-numbering is idempotent and also normalizes old duplicate sort values.
async function reorderMenuCategory(supabase: any, body: any) {
  const id = Number(body?.id);
  const direction = body?.direction;
  if (!Number.isSafeInteger(id) || id <= 0 || (direction !== "up" && direction !== "down")) {
    return NextResponse.json({ error: "Invalid category or move direction." }, { status: 400 });
  }
  try {
    const categories = await readAll(supabase, "bo_menu_categories", "id,name,sort,family");
    const index = categories.findIndex((row: any) => Number(row.id) === id);
    if (index < 0) return NextResponse.json({ error: "Category not found." }, { status: 404 });
    const other = index + (direction === "up" ? -1 : 1);
    if (other < 0 || other >= categories.length) return NextResponse.json({ error: "Category is already at the end of the list." }, { status: 400 });
    [categories[index], categories[other]] = [categories[other], categories[index]];
    for (let i = 0; i < categories.length; i++) {
      if (Number(categories[i].sort) === (i + 1) * 10) continue;
      const { error } = await supabase.from("bo_menu_categories")
        .update({ sort: (i + 1) * 10 }).eq("id", categories[i].id);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, menu_categories: await readAll(supabase, "bo_menu_categories", "id,name,sort,family") });
  } catch (e) {
    return NextResponse.json({ error: `Could not save category order: ${e instanceof Error ? e.message : String(e)}. Refresh Settings before retrying.` }, { status: 500 });
  }
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
  const { data, error: writeError } = await supabase.from(table).update({ name }).eq("id", id).select(table === "bo_menu_categories" ? "id,name,family" : "id,name").maybeSingle();
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

// Category transfer is performed before deletion. The original category is
// retained if any referenced row cannot be reassigned or verified.
const REFERENCES: Record<string, { table: string; column: string; label: string }[]> = {
  ingredient_categories: [{ table: "bo_ingredients", column: "category_id", label: "ingredients" }],
  menu_categories: [
    { table: "bo_menu_items", column: "menu_category_id", label: "menu items" },
    { table: "bo_recipes", column: "menu_category_id", label: "recipes" },
  ],
};

async function dependencyCounts(supabase: any, section: string, id: number) {
  const counts: Record<string, number> = {};
  for (const ref of REFERENCES[section] ?? []) {
    const result = await supabase.from(ref.table).select("id", { count: "exact", head: true }).eq(ref.column, id);
    if (result.error) throw result.error;
    counts[ref.label] = result.count ?? 0;
  }
  return counts;
}

async function performCategoryTransfer(supabase: any, body: any) {
  const section = body?.section;
  const table = getTable(section);
  const id = Number(body?.id);
  if (!table || !Number.isSafeInteger(id) || id <= 0 || !REFERENCES[section])
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  try {
    const { data: source, error: sourceError } = await supabase.from(table).select("id,name").eq("id", id).maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return NextResponse.json({ error: "Category not found." }, { status: 404 });
    const counts = await dependencyCounts(supabase, section, id);
    if (body?.action === "inspect_delete") return NextResponse.json({ ok: true, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
    if (body?.action !== "transfer_delete") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const destId = Number(body?.destination_id);
    if (total > 0) {
      if (!Number.isSafeInteger(destId) || destId <= 0 || destId === id)
        return NextResponse.json({ error: "Select a different destination category before deleting." }, { status: 400 });
      const { data: dest, error: destError } = await supabase.from(table).select("id,name").eq("id", destId).maybeSingle();
      if (destError) throw destError;
      if (!dest) return NextResponse.json({ error: "Destination category no longer exists." }, { status: 400 });
      for (const ref of REFERENCES[section]) {
        const result = await supabase.from(ref.table).update({ [ref.column]: destId }).eq(ref.column, id);
        if (result.error) throw new Error(`Unable to transfer ${ref.label}: ${result.error.message}. The source category has NOT been deleted. Some earlier groups may already have moved.`);
      }
      const remaining = await dependencyCounts(supabase, section, id);
      if (Object.values(remaining).some(value => value > 0))
        return NextResponse.json({ error: "Some items still reference this category. It has NOT been deleted; please retry or check permissions.", remaining }, { status: 409 });
    }
    const { data: deleted, error: deleteError } = await supabase.from(table).delete().eq("id", id).select("id").maybeSingle();
    if (deleteError) throw new Error(`Category could not be deleted: ${deleteError.message}. Previously transferred items remain in their destination category.`);
    if (!deleted) return NextResponse.json({ error: "Deletion was not confirmed. Refresh Settings before retrying." }, { status: 409 });
    return NextResponse.json({ ok: true, deleted_id: id, moved: counts, total });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Category transfer failed." }, { status: 500 });
  }
}
