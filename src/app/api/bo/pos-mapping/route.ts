import { NextResponse } from "next/server";
import { requireBoAdminDb } from "@/lib/bo/api";
import seed from "@/lib/bo/posMainSep2026.json";

type MappingStatus = "pending" | "confirmed" | "skipped" | "excluded" | "modifier";
const statuses = new Set<MappingStatus>(["pending", "confirmed", "skipped", "excluded", "modifier"]);
const posKey = (division: string, group: string, name: string) => JSON.stringify([division.trim(), group.trim(), name.trim()]);
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
async function allRows(db: any, table: string, columns: string) {
  const result: any[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db.from(table).select(columns).order("id", { ascending: true }).range(start, start + 499);
    if (error) throw error;
    result.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }
  return result;
}
export async function GET() {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const db = auth.admin;
    const [imports, mappings, menu] = await Promise.all([
      allRows(db, "bo_pos_imports", "id,branch,period_start,period_end,source_name,created_at"),
      allRows(db, "bo_pos_mappings", "id,pos_key,pos_name,pos_division,pos_group,status,menu_item_id,notes,updated_at"),
      allRows(db, "bo_menu_items", "id,name,recipe_id,menu_category_id,active"),
    ]);
    const latest = [...imports].reverse().find((r: any) => r.branch === "PRO'S SARL");
    const rows = latest ? await allRowsForImport(db, latest.id) : [];
    return NextResponse.json({ imports, current_import: latest ?? null, mappings, rows, menu });
  } catch (err) { return fail(err instanceof Error ? err.message : "Unable to load POS mapping.", 500); }
}
async function allRowsForImport(db: any, importId: number) {
  const result: any[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db.from("bo_pos_import_rows").select("id,import_id,pos_key,quantity,amount_lbp,pdf_page").eq("import_id", importId).order("id").range(start, start + 499);
    if (error) throw error;
    result.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }
  return result;
}
export async function POST(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  let body: any;
  try { body = await request.json(); } catch { return fail("Invalid JSON."); }
  const db = auth.admin;
  if (body?.action === "review") {
    const pos_key = String(body.pos_key ?? "");
    const status = body.status as MappingStatus;
    if (!pos_key || !statuses.has(status)) return fail("Invalid item or status.");
    const menu_item_id = status === "confirmed" || status === "modifier" ? Number(body.menu_item_id) : null;
    if (status === "confirmed" && (!Number.isSafeInteger(menu_item_id) || !menu_item_id || menu_item_id < 1)) return fail("Choose a BO menu item before confirming.");
    if (menu_item_id && !Number.isSafeInteger(menu_item_id)) return fail("Invalid BO menu item.");
    if (menu_item_id) {
      const { data: item, error: itemError } = await db.from("bo_menu_items").select("id").eq("id", menu_item_id).maybeSingle();
      if (itemError || !item) return fail("That BO menu item no longer exists.", 404);
    }
    const { data: existing, error: readError } = await db.from("bo_pos_mappings").select("id").eq("pos_key", pos_key).maybeSingle();
    if (readError) return fail(readError.message, 500);
    if (!existing) return fail("POS item not found. Import the main branch report first.", 404);
    const { error } = await db.from("bo_pos_mappings").update({ status, menu_item_id: menu_item_id || null, notes: String(body.notes ?? "").slice(0, 2000), reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("pos_key", pos_key);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true });
  }
  if (body?.action !== "import_main_september") return fail("Unknown operation.");
  try {
    const { data: imported, error: importError } = await db.from("bo_pos_imports")
      .upsert({ branch: "PRO'S SARL", period_start: "2026-09-01", period_end: "2026-09-30", source_name: "REP_S_00001 (6).pdf" }, { onConflict: "branch,period_start,period_end,source_name" })
      .select("id").single();
    if (importError) throw importError;
    // Insert missing mappings only. Never overwrite a reviewed decision on re-import.
    const existing = await allRows(db, "bo_pos_mappings", "id,pos_key");
    const known = new Set(existing.map((x: any) => x.pos_key));
    const newMappings = seed.filter(r => !known.has(posKey(r.division, r.group, r.name))).map(r => ({
      pos_key: posKey(r.division, r.group, r.name), pos_name: r.name, pos_division: r.division, pos_group: r.group, status: "pending",
    }));
    for (let i = 0; i < newMappings.length; i += 200) {
      const { error } = await db.from("bo_pos_mappings").insert(newMappings.slice(i, i + 200));
      if (error && error.code !== "23505") throw error;
    }
    const inputRows = seed.map(r => ({ import_id: imported.id, pos_key: posKey(r.division, r.group, r.name), quantity: r.qty, amount_lbp: r.amount_lbp, pdf_page: r.page }));
    for (let i = 0; i < inputRows.length; i += 200) {
      const { error } = await db.from("bo_pos_import_rows").upsert(inputRows.slice(i, i + 200), { onConflict: "import_id,pos_key" });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, imported: inputRows.length, branch: "PRO'S SARL", period: "2026-09" });
  } catch (err) { return fail(err instanceof Error ? err.message : "Import failed.", 500); }
}
