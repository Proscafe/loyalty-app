import { NextResponse } from "next/server";
import { requireBoAdminDb, boError, numberOrNull } from "@/lib/bo/api";
import { createBoEngine, loadBoSnapshot } from "@/lib/bo/costing";

function validPositive(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export async function GET() {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const snapshot = await loadBoSnapshot(auth.admin);
    const engine = createBoEngine(snapshot);
    const { data: references, error: referenceError } = await auth.admin
      .from("bo_recipe_lines").select("utility_id").not("utility_id", "is", null);
    if (referenceError) throw referenceError;
    const uses: Record<string, number> = {};
    for (const line of references ?? []) {
      const id = String(line.utility_id);
      uses[id] = (uses[id] ?? 0) + 1;
    }
    return NextResponse.json({
      rate: engine.rate,
      utilities: snapshot.utilities.map((row: any) => ({
        ...row,
        usage_count: uses[String(row.id)] ?? 0,
        cost_per_use_lbp: engine.utilityCost(Number(row.id)),
      })),
    });
  } catch (error) { return boError(error, "Unable to load utilities."); }
}


// Add a newly created utility to each distinct existing menu recipe once.
// Production (prep/sauce) recipes are deliberately excluded.
async function addUtilityToMenuRecipes(admin: any, utilityId: number, utilityName: string) {
  const recipeIds = new Set<number>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("bo_menu_items")
      .select("recipe_id").not("recipe_id", "is", null)
      .order("id").range(offset, offset + 499);
    if (error) throw error;
    for (const row of data ?? []) {
      const id = Number(row.recipe_id);
      if (Number.isSafeInteger(id) && id > 0) recipeIds.add(id);
    }
    if ((data ?? []).length < 500) break;
  }
  if (!recipeIds.size) return 0;

  const existing = new Set<number>();
  // Fetch all existing lines for this utility without the default 1,000-row cap.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("bo_recipe_lines")
      .select("recipe_id").eq("utility_id", utilityId)
      .order("id").range(offset, offset + 499);
    if (error) throw error;
    for (const row of data ?? []) existing.add(Number(row.recipe_id));
    if ((data ?? []).length < 500) break;
  }
  const missing = [...recipeIds].filter(id => !existing.has(id));
  let added = 0;
  for (let i = 0; i < missing.length; i += 100) {
    const rows = missing.slice(i, i + 100).map(recipeId => ({
      recipe_id: recipeId,
      section: "utility",
      sort: 999999,
      label: utilityName,
      line_type: "utility",
      utility_id: utilityId,
      qty: 1,
      factor: 1,
      sub_basis: "unit",
      in_yield: false,
      fixed_currency: "LBP",
    }));
    const { error } = await admin.from("bo_recipe_lines").insert(rows);
    if (error) throw new Error(`Utility created, but only ${added}/${missing.length} menu recipe rows were added: ${error.message}`);
    added += rows.length;
  }
  return added;
}

async function saveUtility(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const body = await request.json();
    const id = numberOrNull(body?.id);
    const name = String(body?.name ?? "").trim();
    const baseAmount = validPositive(body?.base_amount);
    const divisor = validPositive(body?.divisor);
    if (!name) return NextResponse.json({ error: "Utility name is required." }, { status: 400 });
    if (baseAmount === null) return NextResponse.json({ error: "Base Amount must be greater than zero." }, { status: 400 });
    if (divisor === null) return NextResponse.json({ error: "Allocations must be greater than zero." }, { status: 400 });
    const payload = {
      name,
      mode: "pool",
      ingredient_id: null,
      ingredient_rate: null,
      base_amount: baseAmount,
      divisor,
      base_currency: body?.base_currency === "LBP" ? "LBP" : "USD",
      unit_label: "per allocation",
      notes: String(body?.notes ?? "").trim() || null,
    };
    if (id) {
      const { data, error } = await auth.admin.from("bo_utilities")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Utility not found." }, { status: 404 });
      return NextResponse.json({ ok: true, utility: data });
    }
    const { data, error } = await auth.admin.from("bo_utilities")
      .insert(payload).select("*").single();
    if (error) throw error;
    const addedToRecipes = await addUtilityToMenuRecipes(auth.admin, Number(data.id), name);
    return NextResponse.json({ ok: true, utility: data, added_to_menu_recipes: addedToRecipes });
  } catch (error) { return boError(error, "Unable to save utility."); }
}

export async function POST(request: Request) { return saveUtility(request); }
export async function PUT(request: Request) { return saveUtility(request); }
export async function PATCH(request: Request) { return saveUtility(request); }

export async function DELETE(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid utility ID." }, { status: 400 });
    const { data: existing, error: lookupError } = await auth.admin.from("bo_utilities")
      .select("id,name").eq("id", id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return NextResponse.json({ error: "Utility not found." }, { status: 404 });
    const { count, error: countError } = await auth.admin.from("bo_recipe_lines")
      .select("id", { count: "exact", head: true }).eq("utility_id", id);
    if (countError) throw countError;
    const { data, error } = await auth.admin.from("bo_utilities")
      .delete().eq("id", id).select("id").maybeSingle();
    if (error) {
      if (error.code === "23503") return NextResponse.json({
        error: `Cannot delete this utility: ${count ?? 0} recipe line(s) still reference it. Run the supplied cascade migration if you want confirmed deletes to remove those lines too.`,
      }, { status: 409 });
      throw error;
    }
    if (!data) return NextResponse.json({ error: "Utility was not deleted." }, { status: 404 });
    return NextResponse.json({ ok: true, deleted: id, affected_recipe_lines: count ?? 0 });
  } catch (error) { return boError(error, "Unable to delete utility."); }
}
