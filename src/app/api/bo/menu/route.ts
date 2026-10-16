import { NextResponse } from "next/server";
import { requireBoAdminDb, boError, numberOrNull } from "@/lib/bo/api";
import { createBoEngine, loadBoSnapshot } from "@/lib/bo/costing";

export async function GET() {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const snapshot = await loadBoSnapshot(auth.admin);
    const engine = createBoEngine(snapshot);
    return NextResponse.json({
      items: snapshot.menuItems.map((row: any) => engine.menuCost(row)),
      recipes: snapshot.recipes.filter((row: any) => row.kind === "menu").map((row: any) => ({ id: row.id, name: row.name, menu_category_id: row.menu_category_id })),
      categories: snapshot.menuCategories,
      cover_sections: snapshot.coverSections,
      usd_lbp_rate: engine.rate,
      threshold: engine.threshold,
    });
  } catch (error) { return boError(error, "Unable to load menu."); }
}

async function saveMenuItem(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const body = await request.json();
    const id = numberOrNull(body?.id);
    const name = String(body?.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Menu item name is required." }, { status: 400 });

    const payload = {
      name,
      menu_category_id: numberOrNull(body?.menu_category_id),
      cover_section_id: numberOrNull(body?.cover_section_id),
      recipe_id: numberOrNull(body?.recipe_id),
      recipe_factor: numberOrNull(body?.recipe_factor) ?? 1,
      sp_usd: numberOrNull(body?.sp_usd),
      active: body?.active !== false,
    };

    if (id) {
      const { data, error } = await auth.admin.from("bo_menu_items").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Menu item not found." }, { status: 404 });
      return NextResponse.json({ ok: true, item: data });
    }

    const { data, error } = await auth.admin.from("bo_menu_items").insert(payload).select("*").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, item: data });
  } catch (error) { return boError(error, "Unable to save menu item."); }
}

export async function POST(request: Request) { return saveMenuItem(request); }
export async function PUT(request: Request) { return saveMenuItem(request); }
export async function PATCH(request: Request) { return saveMenuItem(request); }

export async function DELETE(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    const { error } = await auth.admin.from("bo_menu_items").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true, deleted: id });
  } catch (error) { return boError(error, "Unable to delete menu item."); }
}
