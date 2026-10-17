import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";

export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;
  const queries = [
    supabase.from("bo_menu_items").select("id", { count: "exact", head: true }),
    supabase.from("bo_menu_items").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("bo_ingredients").select("id", { count: "exact", head: true }),
    supabase.from("bo_recipes").select("id", { count: "exact", head: true }).in("kind", ["prep", "sauce"]),
    supabase.from("bo_menu_categories").select("id", { count: "exact", head: true }),
    supabase.from("bo_recipe_lines").select("id", { count: "exact", head: true }).eq("needs_review", true),
  ];
  const results = await Promise.all(queries);
  const failed = results.find((result: any) => result.error);
  if (failed?.error) {
    console.error("BO home stats error", failed.error);
    return NextResponse.json({ error: failed.error.message || "Unable to load dashboard statistics." }, { status: 500 });
  }
  const [menuItems, visibleMenuItems, ingredients, production, categories, reviewLines] = results.map((result: any) => result.count ?? 0);
  return NextResponse.json({ menuItems, visibleMenuItems, hiddenMenuItems: Math.max(0, menuItems - visibleMenuItems), ingredients, production, categories, reviewLines }, { headers: { "Cache-Control": "no-store" } });
}
