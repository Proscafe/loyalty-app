type AnyRow = Record<string, any>;

export type BoSnapshot = {
  settings: Record<string, string>;
  ingredients: AnyRow[];
  utilities: AnyRow[];
  utilityCountLines: AnyRow[];
  recipes: AnyRow[];
  recipeLines: AnyRow[];
  menuItems: AnyRow[];
  menuCategories: AnyRow[];
  coverSections: AnyRow[];
};

function n(value: unknown, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function nullable(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

// Load large recipe-line tables in pages; keep the original queries for all other tables.
async function readRecipeLines(supabase: any): Promise<AnyRow[]> {
  const rows: AnyRow[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const result = await supabase.from("bo_recipe_lines").select("*")
      .order("sort").order("id").range(offset, offset + size - 1);
    if (result.error) throw new Error(`bo_recipe_lines: ${result.error.message}`);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

export async function loadBoSnapshot(supabase: any): Promise<BoSnapshot> {
  const [settingsResult, ingredientResult, utilityResult, utilityLinesResult,
    recipeResult, recipeLines, menuResult, menuCategoriesResult, coverSectionsResult] = await Promise.all([
    supabase.from("bo_settings").select("key,value"),
    supabase.from("bo_ingredients").select("*").order("sort").order("id"),
    supabase.from("bo_utilities").select("*").order("sort").order("id"),
    supabase.from("bo_utility_count_lines").select("*").order("sort").order("id"),
    supabase.from("bo_recipes").select("*").order("sort").order("id"),
    readRecipeLines(supabase),
    supabase.from("bo_menu_items").select("*").order("sort").order("id"),
    supabase.from("bo_menu_categories").select("*").order("sort").order("id"),
    supabase.from("bo_cover_sections").select("*").order("sort").order("id"),
  ]);
  const named = [
    ["bo_settings", settingsResult], ["bo_ingredients", ingredientResult],
    ["bo_utilities", utilityResult], ["bo_utility_count_lines", utilityLinesResult],
    ["bo_recipes", recipeResult], ["bo_menu_items", menuResult],
    ["bo_menu_categories", menuCategoriesResult], ["bo_cover_sections", coverSectionsResult],
  ] as const;
  for (const [name, result] of named) {
    if (result.error) throw new Error(`${name}: ${result.error.message}`);
  }
  const settings = Object.fromEntries(
    (settingsResult.data ?? []).map((row: AnyRow) => [row.key, String(row.value)]),
  );
  return {
    settings,
    ingredients: ingredientResult.data ?? [],
    utilities: utilityResult.data ?? [],
    utilityCountLines: utilityLinesResult.data ?? [],
    recipes: recipeResult.data ?? [],
    recipeLines,
    menuItems: menuResult.data ?? [],
    menuCategories: menuCategoriesResult.data ?? [],
    coverSections: coverSectionsResult.data ?? [],
  };
}

export function createBoEngine(snapshot: BoSnapshot) {
  const configuredRate = n(snapshot.settings.usd_lbp_rate, 90000);
  const rate = configuredRate > 0 ? configuredRate : 90000;
  const threshold = n(snapshot.settings.food_cost_threshold, 0.4);
  const adjustment = n(snapshot.settings.price_adjust_pct, 0.1);

  const ingredients = new Map(snapshot.ingredients.map((row) => [Number(row.id), row]));
  const utilities = new Map(snapshot.utilities.map((row) => [Number(row.id), row]));
  const recipes = new Map(snapshot.recipes.map((row) => [Number(row.id), row]));
  const linesByRecipe = new Map<number, AnyRow[]>();
  const countLinesByUtility = new Map<number, AnyRow[]>();

  for (const line of snapshot.recipeLines) {
    const id = Number(line.recipe_id);
    linesByRecipe.set(id, [...(linesByRecipe.get(id) ?? []), line]);
  }

  for (const line of snapshot.utilityCountLines) {
    const id = Number(line.utility_id);
    countLinesByUtility.set(id, [...(countLinesByUtility.get(id) ?? []), line]);
  }

  // Price is the purchase PACK price. Use the same unit-cost formula as
  // /api/bo/fnb so Recipes, Production and Menu Pricing agree.
  function ingredientPrice(id: number | null | undefined) {
    if (!id) return null;
    const row = ingredients.get(Number(id));
    const price = nullable(row?.price);
    if (price === null) return null;
    const priceLbp = row?.price_currency === "LBP" ? price : price * rate;
    const packSize = nullable(row?.pack_size);
    const purchaseQty = nullable(row?.purchase_qty);
    const divisor = packSize !== null && packSize > 0 ? packSize
      : purchaseQty !== null && purchaseQty > 0 ? purchaseQty : 1;
    return priceLbp / divisor;
  }

  function utilityCost(id: number | null | undefined) {
    if (!id) return null;
    const row = utilities.get(Number(id));
    if (!row) return null;

    if (row.mode === "ingredient") {
      const p = ingredientPrice(row.ingredient_id);
      const share = nullable(row.ingredient_rate);
      if (p === null || share === null) return null;
      return p * share;
    }

    const divisor = nullable(row.divisor);
    if (divisor === null || divisor <= 0) return null;

    const countLines = countLinesByUtility.get(Number(id)) ?? [];
    let pool: number | null = null;

    if (countLines.length) {
      pool = countLines.reduce((sum, line) => {
        const unitPrice = nullable(line.unit_price);
        const qty = nullable(line.qty);
        if (unitPrice === null || qty === null) return sum;
        return sum + unitPrice * qty;
      }, 0);

      if (row.base_currency !== "LBP") pool *= rate;
    } else {
      const base = nullable(row.base_amount);
      if (base === null) return null;
      pool = row.base_currency === "LBP" ? base : base * rate;
    }

    return pool / divisor;
  }

  const recipeMemo = new Map<number, any>();

  function recipeCost(id: number, stack: number[] = []): any {
    if (recipeMemo.has(id) && stack.length === 0) return recipeMemo.get(id);

    if (stack.includes(id)) {
      return {
        id,
        batchCost: null,
        unitCost: null,
        usableYield: null,
        partial: true,
        issues: [`Circular recipe: ${[...stack, id].join(" → ")}`],
        lines: [],
      };
    }

    const recipe = recipes.get(id);

    if (!recipe) {
      return {
        id,
        batchCost: null,
        unitCost: null,
        usableYield: null,
        partial: true,
        issues: ["Recipe not found"],
        lines: [],
      };
    }

    let batchCost = 0;
    let partial = false;
    const issues: string[] = [];
    const outputLines: any[] = [];
    const nextStack = [...stack, id];

    for (const line of linesByRecipe.get(id) ?? []) {
      const qty = nullable(line.qty);
      let sourceCost: number | null = null;
      let sourceName = line.label || "Line";
      let sourceUnit: string | null = null;
      let sourceKind = line.line_type;

      if (qty === null) {
        partial = true;
        issues.push(`${line.label || "Line"}: missing quantity`);
      }

      if (line.line_type === "ingredient") {
        const source = ingredients.get(Number(line.ingredient_id));
        sourceCost = ingredientPrice(line.ingredient_id);
        sourceName = source?.name || line.label || "Ingredient";
        sourceUnit = source?.consumption_unit || source?.purchase_unit || null;
      } else if (line.line_type === "utility") {
        const source = utilities.get(Number(line.utility_id));
        sourceCost = utilityCost(line.utility_id);
        sourceName = source?.name || line.label || "Utility";
        sourceUnit = source?.unit_label || null;
      } else if (line.line_type === "fixed") {
        const fixed = nullable(line.fixed_price);
        sourceCost =
          fixed === null
            ? null
            : line.fixed_currency === "USD"
              ? fixed * rate
              : fixed;
        sourceName = line.label || "Fixed cost";
        sourceUnit = line.fixed_currency || "LBP";
      } else if (line.line_type === "recipe") {
        const source = recipes.get(Number(line.sub_recipe_id));
        const sub = recipeCost(Number(line.sub_recipe_id), nextStack);
        sourceCost = line.sub_basis === "batch" ? sub.batchCost : sub.unitCost;
        sourceName = source?.name || line.label || "Sub-recipe";
        sourceUnit = source?.yield_unit || null;
        sourceKind = source?.kind || "recipe";

        if (sub.partial) partial = true;
      } else {
        partial = true;
        issues.push(`${line.label || "Line"}: unresolved source`);
      }

      const lineCost =
        qty === null || sourceCost === null ? null : qty * sourceCost;

      if (sourceCost === null) {
        partial = true;
        issues.push(`${line.label || "Line"}: missing source cost`);
      }

      if (lineCost !== null) batchCost += lineCost;

      outputLines.push({
        ...line,
        sourceName,
        sourceUnit,
        sourceKind,
        sourceCost,
        lineCost,
      });
    }

    let yieldQty = nullable(recipe.yield_qty);

    if (recipe.yield_mode === "sum_qty") {
      yieldQty = (linesByRecipe.get(id) ?? []).reduce((sum, line) => {
        if (!line.in_yield) return sum;
        const qty = nullable(line.qty);
        return sum + (qty ?? 0);
      }, 0);
    }

    const waste = Math.min(0.99, Math.max(0, n(recipe.waste_pct, 0)));
    const usableYield =
      yieldQty !== null && yieldQty > 0 ? yieldQty * (1 - waste) : null;

    if (usableYield === null || usableYield <= 0) {
      partial = true;
      issues.push("Missing or zero recipe yield");
    }

    const unitCost =
      usableYield && usableYield > 0 ? batchCost / usableYield : null;

    const result = {
      id,
      name: recipe.name,
      kind: recipe.kind,
      batchCost,
      unitCost,
      usableYield,
      yieldUnit: recipe.yield_unit ?? null,
      partial,
      issues,
      lines: outputLines,
    };

    if (stack.length === 0) recipeMemo.set(id, result);

    return result;
  }

  function menuCost(item: AnyRow) {
    const spUsd = nullable(item.sp_usd);
    const spLbp = spUsd === null ? null : spUsd * rate;
    const recipe = item.recipe_id ? recipeCost(Number(item.recipe_id)) : null;
    const cost =
      recipe?.unitCost === null || recipe?.unitCost === undefined
        ? null
        : recipe.unitCost;

    const foodCostPct =
      cost !== null && spLbp !== null && spLbp > 0 ? cost / spLbp : null;

    const grossProfit =
      cost !== null && spLbp !== null ? spLbp - cost : null;

    const margin =
      grossProfit !== null && spLbp !== null && spLbp > 0
        ? grossProfit / spLbp
        : null;

    const currentPrice =
      spLbp === null ? null : spLbp * (1 + adjustment);

    return {
      ...item,
      recipe,
      cost_lbp: cost,
      sp_lbp: spLbp,
      food_cost_pct: foodCostPct,
      gross_profit_lbp: grossProfit,
      margin_pct: margin,
      current_price_lbp: currentPrice,
      over_threshold: foodCostPct !== null ? foodCostPct > threshold : false,
    };
  }

  return {
    rate,
    threshold,
    adjustment,
    ingredientPrice,
    utilityCost,
    recipeCost,
    menuCost,
  };
}
