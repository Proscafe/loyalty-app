import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";
import { createBoEngine, loadBoSnapshot } from "@/lib/bo/costing";

export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  try {
    const snapshot = await loadBoSnapshot(supabase);
    const engine = createBoEngine(snapshot);
    const menu = snapshot.menuItems
      .filter((row: any) => row.active !== false)
      .map((row: any) => engine.menuCost(row));

    const categoryMap = new Map(snapshot.menuCategories.map((row: any) => [Number(row.id), row.name]));
    const grouped = new Map<string, any[]>();

    for (const item of menu) {
      const name = categoryMap.get(Number(item.menu_category_id)) || "UNCATEGORISED";
      grouped.set(name, [...(grouped.get(name) ?? []), item]);
    }

    const byCategory = Array.from(grouped.entries()).map(([name, items]) => {
      const priced = items.filter((item) => item.cost_lbp !== null && item.sp_lbp !== null && item.sp_lbp > 0);
      const cost = priced.reduce((sum, item) => sum + Number(item.cost_lbp ?? 0), 0);
      const sales = priced.reduce((sum, item) => sum + Number(item.sp_lbp ?? 0), 0);

      return {
        name,
        items: items.length,
        priced: priced.length,
        weighted_food_cost_pct: sales > 0 ? cost / sales : null,
        over: priced.filter((item) => item.over_threshold).length,
      };
    });

    const highestFoodCost = [...menu]
      .filter((item) => item.food_cost_pct !== null)
      .sort((a, b) => Number(b.food_cost_pct) - Number(a.food_cost_pct))
      .slice(0, 15);

    const lowestProfit = [...menu]
      .filter((item) => item.gross_profit_lbp !== null)
      .sort((a, b) => Number(a.gross_profit_lbp) - Number(b.gross_profit_lbp))
      .slice(0, 15);

    const { data: issues } = await supabase
      .from("bo_validation_issues")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    return NextResponse.json({
      by_category: byCategory,
      highest_food_cost: highestFoodCost,
      lowest_profit: lowestProfit,
      issues: issues ?? [],
      totals: {
        menu_items: menu.length,
        ingredients: snapshot.ingredients.length,
        recipes: snapshot.recipes.length,
        utilities: snapshot.utilities.length,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to load reports." },
      { status: 500 },
    );
  }
}
