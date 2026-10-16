import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";
import { createBoEngine, loadBoSnapshot } from "@/lib/bo/costing";

function n(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

async function sourceLabel(supabase: any, line: any) {
  if (line?.line_type === "ingredient") {
    const id = n(line?.ingredient_id);
    if (!id) return null;
    const { data } = await supabase
      .from("bo_ingredients")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    return data?.name ?? null;
  }

  if (line?.line_type === "recipe") {
    const id = n(line?.sub_recipe_id);
    if (!id) return null;
    const { data } = await supabase
      .from("bo_recipes")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    return data?.name ?? null;
  }

  if (line?.line_type === "utility") {
    const id = n(line?.utility_id);
    if (!id) return null;
    const { data } = await supabase
      .from("bo_utilities")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    return data?.name ?? null;
  }

  if (line?.line_type === "fixed") {
    return String(line?.label ?? "FIXED COST").trim() || "FIXED COST";
  }

  return String(line?.label ?? "").trim() || "UNRESOLVED";
}

function validLine(line: any) {
  if (line?.line_type === "ingredient") return n(line?.ingredient_id) !== null;
  if (line?.line_type === "recipe") return n(line?.sub_recipe_id) !== null;
  if (line?.line_type === "utility") return n(line?.utility_id) !== null;
  if (line?.line_type === "fixed") return n(line?.fixed_price) !== null;
  return false;
}

async function buildRows(supabase: any, recipeId: number, lines: any[]) {
  const valid = lines.filter(validLine);
  const rows = [];

  for (let index = 0; index < valid.length; index++) {
    const line = valid[index];
    const label = await sourceLabel(supabase, line);

    rows.push({
      recipe_id: recipeId,
      section: ["primary", "secondary", "utility"].includes(line?.section)
        ? line.section
        : "main",
      sort: index,
      label: label || "ITEM",
      line_type: ["ingredient", "recipe", "utility", "fixed", "unresolved"].includes(
        line?.line_type,
      )
        ? line.line_type
        : "unresolved",
      ingredient_id: line?.line_type === "ingredient" ? n(line?.ingredient_id) : null,
      sub_recipe_id: line?.line_type === "recipe" ? n(line?.sub_recipe_id) : null,
      sub_basis: line?.sub_basis === "batch" ? "batch" : "unit",
      utility_id: line?.line_type === "utility" ? n(line?.utility_id) : null,
      qty: n(line?.qty),
      factor: n(line?.factor) ?? 1,
      fixed_price: line?.line_type === "fixed" ? n(line?.fixed_price) : null,
      fixed_currency: line?.fixed_currency === "USD" ? "USD" : "LBP",
      in_yield: line?.in_yield === false ? false : true,
      note: String(line?.note ?? "").trim() || null,
    });
  }

  return rows;
}

export async function GET(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const snapshot = await loadBoSnapshot(supabase);
    const engine = createBoEngine(snapshot);

    const recipes = snapshot.recipes
      .filter((row: any) => !kind || row.kind === kind)
      .map((row: any) => {
        const costing = engine.recipeCost(Number(row.id));
        const costByLineId = new Map<number, any>(
          (costing.lines ?? []).map((line: any) => [Number(line.id), line]),
        );

        const lines = snapshot.recipeLines
          .filter((line: any) => Number(line.recipe_id) === Number(row.id))
          .map((line: any) => {
            const costLine = costByLineId.get(Number(line.id));

            return {
              ...line,
              sourceName: costLine?.sourceName ?? line.label ?? null,
              sourceUnit: costLine?.sourceUnit ?? null,
              sourceKind: costLine?.sourceKind ?? line.line_type,
              sourceCost: costLine?.sourceCost ?? null,
              lineCost: costLine?.lineCost ?? null,
            };
          });

        return { ...row, costing, lines };
      });

    return NextResponse.json({
      recipes,
      ingredients: snapshot.ingredients.map((row: any) => ({
        id: row.id,
        name: row.name,
        purchase_unit: row.purchase_unit,
        consumption_unit: row.consumption_unit,
        unit_cost_lbp: engine.ingredientPrice(Number(row.id)),
      })),
      utilities: snapshot.utilities.map((row: any) => ({
        id: row.id,
        name: row.name,
        unit_label: row.unit_label,
        unit_cost_lbp: engine.utilityCost(Number(row.id)),
      })),
      all_recipes: snapshot.recipes.map((row: any) => {
        const costing = engine.recipeCost(Number(row.id));

        return {
          id: row.id,
          name: row.name,
          kind: row.kind,
          yield_unit: row.yield_unit,
          unit_cost_lbp: costing.unitCost,
          batch_cost_lbp: costing.batchCost,
        };
      }),
      menu_categories: snapshot.menuCategories,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to load recipes." },
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
    return NextResponse.json({ error: "Recipe name is required." }, { status: 400 });
  }

  const kind = ["sauce", "prep", "menu"].includes(body?.kind)
    ? body.kind
    : "prep";

  const { data: recipe, error: insertError } = await supabase
    .from("bo_recipes")
    .insert({
      kind,
      name,
      menu_category_id: n(body?.menu_category_id),
      yield_qty: n(body?.yield_qty),
      yield_mode: body?.yield_mode === "sum_qty" ? "sum_qty" : "fixed",
      yield_unit: String(body?.yield_unit ?? "").trim() || null,
      waste_pct: n(body?.waste_pct) ?? 0,
      portion_qty: n(body?.portion_qty),
      portion_price_lbp: n(body?.portion_price_lbp),
      sheet_sale_price_lbp: n(body?.sheet_sale_price_lbp),
      notes: String(body?.notes ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const rows = await buildRows(supabase, Number(recipe.id), body?.lines ?? []);

  if (rows.length) {
    const { error: linesError } = await supabase
      .from("bo_recipe_lines")
      .insert(rows);

    if (linesError) {
      await supabase.from("bo_recipes").delete().eq("id", recipe.id);

      return NextResponse.json(
        { error: `Recipe lines were not saved: ${linesError.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ id: recipe.id });
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const body = await request.json();
  const id = Number(body?.id);
  const name = String(body?.name ?? "").trim();

  if (!Number.isInteger(id) || id <= 0 || !name) {
    return NextResponse.json({ error: "Invalid recipe." }, { status: 400 });
  }

  const rows = await buildRows(supabase, id, body?.lines ?? []);

  const { error: updateError } = await supabase
    .from("bo_recipes")
    .update({
      name,
      kind: ["sauce", "prep", "menu"].includes(body?.kind) ? body.kind : "prep",
      menu_category_id: n(body?.menu_category_id),
      yield_qty: n(body?.yield_qty),
      yield_mode: body?.yield_mode === "sum_qty" ? "sum_qty" : "fixed",
      yield_unit: String(body?.yield_unit ?? "").trim() || null,
      waste_pct: n(body?.waste_pct) ?? 0,
      portion_qty: n(body?.portion_qty),
      portion_price_lbp: n(body?.portion_price_lbp),
      sheet_sale_price_lbp: n(body?.sheet_sale_price_lbp),
      notes: String(body?.notes ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("bo_recipe_lines")
    .delete()
    .eq("recipe_id", id);

  if (deleteError) {
    return NextResponse.json(
      { error: `Old recipe lines could not be replaced: ${deleteError.message}` },
      { status: 500 },
    );
  }

  if (rows.length) {
    const { error: linesError } = await supabase
      .from("bo_recipe_lines")
      .insert(rows);

    if (linesError) {
      return NextResponse.json(
        { error: `Recipe header saved, but recipe lines failed: ${linesError.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ id, saved_lines: rows.length });
}

export async function DELETE(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));

  const { error: deleteError } = await supabase
    .from("bo_recipes")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          deleteError.code === "23503"
            ? "This recipe is used by another recipe or menu item."
            : deleteError.message,
      },
      { status: deleteError.code === "23503" ? 409 : 500 },
    );
  }

  return NextResponse.json({ deleted: id });
}
