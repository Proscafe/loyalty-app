import { NextResponse } from "next/server";
import { boError, numberOrNull, requireBoAdminDb } from "@/lib/bo/api";

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

async function labelFor(admin: any, line: any) {
  const table = line.line_type === "ingredient" ? "bo_ingredients" : line.line_type === "recipe" ? "bo_recipes" : line.line_type === "utility" ? "bo_utilities" : null;
  const id = line.line_type === "ingredient" ? line.ingredient_id : line.line_type === "recipe" ? line.sub_recipe_id : line.line_type === "utility" ? line.utility_id : null;
  if (!table) return "Fixed Cost";
  const { data } = await admin.from(table).select("name").eq("id", Number(id)).maybeSingle();
  return data?.name ?? "Item";
}

async function buildRows(admin: any, recipeId: number, incoming: any[]) {
  const lines = requireValidLines(incoming);
  // Save only explicitly selected rows. Removed utilities must stay removed.

  const rows: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    rows.push({
      recipe_id: recipeId,
      section: ["primary", "secondary", "utility"].includes(line.section) ? line.section : "main",
      sort: i,
      label: await labelFor(admin, line),
      line_type: line.line_type,
      ingredient_id: line.line_type === "ingredient" ? numberOrNull(line.ingredient_id) : null,
      sub_recipe_id: line.line_type === "recipe" ? numberOrNull(line.sub_recipe_id) : null,
      sub_basis: line.sub_basis === "batch" ? "batch" : "unit",
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

export async function POST(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const admin = auth.admin;
    const body = await request.json();
    const item = body?.item ?? {};
    const recipe = body?.recipe ?? null;
    const menuId = numberOrNull(item.id);
    if (!menuId) return NextResponse.json({ error: "Menu item id is required." }, { status: 400 });

    let recipeId = numberOrNull(item.recipe_id);
    if (recipe) {
      recipeId = numberOrNull(recipe.id) ?? recipeId;
      if (!recipeId) return NextResponse.json({ error: "Recipe id is required." }, { status: 400 });
      const name = String(recipe.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "Recipe name is required." }, { status: 400 });

      const { data: savedRecipe, error: recipeError } = await admin.from("bo_recipes").update({
        name,
        kind: ["sauce", "prep", "menu"].includes(recipe.kind) ? recipe.kind : "menu",
        menu_category_id: numberOrNull(recipe.menu_category_id),
        yield_qty: numberOrNull(recipe.yield_qty),
        yield_mode: recipe.yield_mode === "sum_qty" ? "sum_qty" : "fixed",
        yield_unit: String(recipe.yield_unit ?? "").trim() || null,
        waste_pct: numberOrNull(recipe.waste_pct) ?? 0,
        notes: String(recipe.notes ?? "").trim() || null,
        updated_at: new Date().toISOString(),
      }).eq("id", recipeId).select("id").maybeSingle();
      if (recipeError) throw recipeError;
      if (!savedRecipe) throw new Error("Recipe not found.");

      const rows = await buildRows(admin, recipeId, recipe.lines);
      const { data: oldLines, error: oldError } = await admin.from("bo_recipe_lines").select("*").eq("recipe_id", recipeId).order("sort").order("id");
      if (oldError) throw oldError;
      const { error: deleteError } = await admin.from("bo_recipe_lines").delete().eq("recipe_id", recipeId);
      if (deleteError) throw deleteError;
      if (rows.length) {
        const { error: insertError } = await admin.from("bo_recipe_lines").insert(rows);
        if (insertError) {
          if ((oldLines ?? []).length) {
            const restore = (oldLines ?? []).map(({ id: _id, ...line }: any) => line);
            await admin.from("bo_recipe_lines").insert(restore);
          }
          throw new Error(`Recipe items were not saved: ${insertError.message}`);
        }
      }
      const { data: verify, error: verifyError } = await admin.from("bo_recipe_lines").select("id").eq("recipe_id", recipeId);
      if (verifyError) throw verifyError;
      if ((verify ?? []).length !== rows.length) throw new Error(`Recipe save verification failed: ${verify?.length ?? 0}/${rows.length} rows.`);
    }

    const name = String(item.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Menu item name is required." }, { status: 400 });

    const { data: savedItem, error: itemError } = await admin.from("bo_menu_items").update({
      name,
      menu_category_id: numberOrNull(item.menu_category_id),
      cover_section_id: numberOrNull(item.cover_section_id),
      recipe_id: recipeId,
      recipe_factor: numberOrNull(item.recipe_factor) ?? 1,
      sp_usd: numberOrNull(item.sp_usd),
      active: item.active !== false,
      updated_at: new Date().toISOString(),
    }).eq("id", menuId).select("*").maybeSingle();
    if (itemError) throw itemError;
    if (!savedItem) throw new Error("Menu item not found.");

    return NextResponse.json({ ok: true, item: savedItem, recipe_id: recipeId });
  } catch (error) {
    return boError(error, "Unable to save menu item.");
  }
}
