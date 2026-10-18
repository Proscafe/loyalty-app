"use client";

import { downloadAllMenuRecipesPdf } from "./downloadAllMenuRecipesPdf";

type Row = Record<string, any>;
export type ProductionReportData = { recipes: Row[]; ingredients: Row[]; utilities: Row[]; all_recipes: Row[]; rate: number };

/** Same styled A4 recipe-card design as individual recipe PDF; all production recipes combined. */
export async function downloadAllProductionPdf(data: ProductionReportData, includePrices: boolean): Promise<void> {
  await downloadAllMenuRecipesPdf({
    recipes: data.recipes ?? [],
    all_recipes: data.all_recipes ?? data.recipes ?? [],
    ingredients: data.ingredients ?? [],
    utilities: data.utilities ?? [],
    items: [],
    rate: Number(data.rate) || 0,
  }, includePrices, "production");
}
