import { persistBoRecipeLines } from "@/lib/bo/persistRecipeLines";
import { NextResponse } from "next/server";
import { requireBoAdminDb, boError, numberOrNull } from "@/lib/bo/api";
import { createBoEngine, loadBoSnapshot } from "@/lib/bo/costing";

function validLine(line: any) {
  const idFor = (value: any) => {
    const id = numberOrNull(value);
    return id !== null && Number.isInteger(id) && id > 0;
  };
  if (line?.line_type === "ingredient") return idFor(line.ingredient_id);
  if (line?.line_type === "recipe") return idFor(line.sub_recipe_id);
  if (line?.line_type === "utility") return idFor(line.utility_id);
  if (line?.line_type === "fixed") return numberOrNull(line.fixed_price) !== null;
  return false;
}

function requireValidLines(incoming: any) {
  if (!Array.isArray(incoming)) throw new Error("Recipe lines were not provided as a list.");
  incoming.forEach((line: any, index: number) => {
    if (!validLine(line)) {
      const kind = line?.line_type === "ingredient" ? "ingredient" : line?.line_type === "recipe" ? "prep / sauce" : line?.line_type === "utility" ? "utility" : line?.line_type === "fixed" ? "fixed cost" : "source";
      throw new Error(`Row ${index + 1}: Choose a valid ${kind} from the dropdown before saving.`);
    }
  });
  return incoming.map((line: any) => ({ ...line }));
}

async function sourceLabel(admin: any, line: any) {
  if (line.line_type === "ingredient") {
    const { data } = await admin.from("bo_ingredients").select("name").eq("id", Number(line.ingredient_id)).maybeSingle();
    return data?.name ?? "Ingredient";
  }
  if (line.line_type === "recipe") {
    const { data } = await admin.from("bo_recipes").select("name").eq("id", Number(line.sub_recipe_id)).maybeSingle();
    return data?.name ?? "Prep / Sauce";
  }
  if (line.line_type === "utility") {
    const { data } = await admin.from("bo_utilities").select("name").eq("id", Number(line.utility_id)).maybeSingle();
    return data?.name ?? "Utility";
  }
  return "Fixed Cost";
}

async function buildRows(admin: any, recipeId: number, incoming: any[]) {
  const lines = requireValidLines(incoming);
  // Save only explicitly selected rows. Removed utilities must stay removed.

  const rows: any[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    rows.push({
      recipe_id: recipeId,
      section: ["primary", "secondary", "utility"].includes(line?.section) ? line.section : "main",
      sort: index,
      label: await sourceLabel(admin, line),
      line_type: line.line_type,
      ingredient_id: line.line_type === "ingredient" ? numberOrNull(line.ingredient_id) : null,
      sub_recipe_id: line.line_type === "recipe" ? numberOrNull(line.sub_recipe_id) : null,
      sub_basis: line.sub_basis === "batch" ? "batch" : "unit",
      sub_cost_basis: line.line_type === "recipe" ? "ingredients" : "full",
      utility_id: line.line_type === "utility" ? numberOrNull(line.utility_id) : null,
      qty: numberOrNull(line.qty) ?? 0,
      factor: numberOrNull(line.factor) ?? 1,
      fixed_price: line.line_type === "fixed" ? numberOrNull(line.fixed_price) : null,
      fixed_currency: line.fixed_currency === "USD" ? "USD" : "LBP",
      in_yield: line.in_yield === false ? false : true,
      note: String(line.note ?? "").trim() || null,
      needs_review: line.needs_review === true,
    });
  }
  return rows;
}

export async function GET(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const params = new URL(request.url).searchParams;
    const directId = params.get("id");
    if (directId !== null) {
      const recipeId = Number(directId);
      if (!Number.isSafeInteger(recipeId) || recipeId <= 0) {
        return NextResponse.json({ error: "Invalid recipe ID." }, { status: 400 });
      }
      const { data: recipe, error: recipeError } = await auth.admin
        .from("bo_recipes").select("id").eq("id", recipeId).maybeSingle();
      if (recipeError) throw recipeError;
      if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
      const lines: any[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await auth.admin.from("bo_recipe_lines")
          .select("*").eq("recipe_id", recipeId).order("sort").order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        lines.push(...(data ?? []));
        if ((data ?? []).length < 500) break;
      }
      return NextResponse.json({ ok: true, recipe_id: recipeId, lines });
    }
    const kind = params.get("kind");
    const snapshot = await loadBoSnapshot(auth.admin);
    // Refresh all recipe lines with pagination to avoid the default PostgREST
    // 1,000-row cap. Otherwise edited rows beyond that cap disappear on reload.
    const completeLines: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await auth.admin.from("bo_recipe_lines")
        .select("*").order("id").range(offset, offset + 499);
      if (error) throw error;
      completeLines.push(...(data ?? []));
      if ((data ?? []).length < 500) break;
    }
    snapshot.recipeLines = completeLines;
    const engine = createBoEngine(snapshot);
    // Menu item names are user-facing; a copied/renamed menu item can have a
    // legacy bo_recipes.name. Only alias unambiguous one-to-one menu links.
    const linkedMenuNames = new Map<number, string[]>();
    for (const item of snapshot.menuItems) {
      const linkedId = Number(item.recipe_id);
      if (!linkedId || !String(item.name ?? "").trim()) continue;
      linkedMenuNames.set(linkedId, [...(linkedMenuNames.get(linkedId) ?? []), String(item.name).trim()]);
    }
    const displayName = (recipe: any) => {
      const names = linkedMenuNames.get(Number(recipe.id)) ?? [];
      return names.length === 1 ? names[0] : recipe.name;
    };

    const recipes = snapshot.recipes.filter((row: any) => !kind || row.kind === kind).map((row: any) => {
      const costing = engine.recipeCost(Number(row.id));
      const costMap = new Map<number, any>((costing.lines ?? []).map((line: any) => [Number(line.id), line]));
      const stored = snapshot.recipeLines.filter((line: any) => Number(line.recipe_id) === Number(row.id)).map((line: any) => {
        const c = costMap.get(Number(line.id));
        return { ...line, sourceName: c?.sourceName ?? line.label ?? null, sourceUnit: c?.sourceUnit ?? null, sourceKind: c?.sourceKind ?? line.line_type, sourceCost: c?.sourceCost ?? null, lineCost: c?.lineCost ?? null };
      });
      return { ...row, display_name: displayName(row), costing, lines: stored };
    });

    return NextResponse.json({
      rate: engine.rate,
      recipes,
      ingredients: snapshot.ingredients.map((row: any) => ({ id: row.id, name: row.name, purchase_unit: row.purchase_unit, consumption_unit: row.consumption_unit, unit_cost_lbp: engine.ingredientPrice(Number(row.id)) })),
      utilities: snapshot.utilities.map((row: any) => ({ id: row.id, name: row.name, unit_label: row.unit_label, unit_cost_lbp: engine.utilityCost(Number(row.id)) })),
      all_recipes: snapshot.recipes.map((row: any) => { const c = engine.recipeCost(Number(row.id)); return { id: row.id, name: displayName(row), recipe_name: row.name, kind: row.kind, yield_unit: row.yield_unit, unit_cost_lbp: c.unitCost, batch_cost_lbp: c.batchCost, ingredient_unit_cost_lbp: c.ingredientUnitCost, ingredient_batch_cost_lbp: c.ingredientBatchCost, usable_yield: c.usableYield, costing: { ingredientUnitCost: c.ingredientUnitCost, ingredientBatchCost: c.ingredientBatchCost, partial: c.partial, issues: c.issues } }; }),
      menu_categories: snapshot.menuCategories,
    });
  } catch (error) { return boError(error, "Unable to load recipes."); }
}

async function saveRecipe(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const admin = auth.admin;
    const body = await request.json();
    const id = numberOrNull(body?.id);
    const name = String(body?.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Recipe name is required." }, { status: 400 });

    const payload = {
      name,
      kind: ["sauce", "prep", "menu"].includes(body?.kind) ? body.kind : "prep",
      menu_category_id: numberOrNull(body?.menu_category_id),
      yield_qty: numberOrNull(body?.yield_qty),
      yield_mode: body?.yield_mode === "sum_qty" ? "sum_qty" : "fixed",
      yield_unit: String(body?.yield_unit ?? "").trim() || null,
      waste_pct: numberOrNull(body?.waste_pct) ?? 0,
      portion_qty: numberOrNull(body?.portion_qty),
      portion_price_lbp: numberOrNull(body?.portion_price_lbp),
      sheet_sale_price_lbp: numberOrNull(body?.sheet_sale_price_lbp),
      notes: String(body?.notes ?? "").trim() || null,
    };

    let recipeId = id;
    if (recipeId) {
      const { data, error } = await admin.from("bo_recipes").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", recipeId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
    } else {
      const { data, error } = await admin.from("bo_recipes").insert(payload).select("id").single();
      if (error) throw error;
      recipeId = Number(data.id);
    }

    if (!recipeId) throw new Error("Recipe id was not created.");
    const rows = await buildRows(admin, recipeId, body?.lines);
    await persistBoRecipeLines(admin, recipeId, body?.lines, rows);

    return NextResponse.json({ ok: true, id: recipeId, saved_lines: rows.length });
  } catch (error) { return boError(error, "Unable to save recipe."); }
}

export async function POST(request: Request) { return saveRecipe(request); }
export async function PUT(request: Request) { return saveRecipe(request); }
export async function PATCH(request: Request) { return saveRecipe(request); }

export async function DELETE(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    const { error } = await auth.admin.from("bo_recipes").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true, deleted: id });
  } catch (error) { return boError(error, "Unable to delete recipe."); }
}
