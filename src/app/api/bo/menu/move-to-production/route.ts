import { NextResponse } from "next/server";
import { boError, requireBoAdminDb } from "@/lib/bo/api";

// Promote an existing menu recipe into the Prep/Sauce library without
// recreating its lines, costs, or review flags.
export async function POST(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const body = await request.json();
    const menuItemId = Number(body?.menu_item_id);
    const kind = body?.kind;
    if (!Number.isSafeInteger(menuItemId) || menuItemId <= 0 || (kind !== "prep" && kind !== "sauce")) {
      return NextResponse.json({ error: "Choose a valid recipe and destination." }, { status: 400 });
    }
    const admin = auth.admin;
    const { data: item, error: itemError } = await admin.from("bo_menu_items")
      .select("id,name,recipe_id").eq("id", menuItemId).maybeSingle();
    if (itemError) throw itemError;
    if (!item) return NextResponse.json({ error: "Menu item not found." }, { status: 404 });
    const recipeId = Number(item.recipe_id);
    if (!Number.isSafeInteger(recipeId) || recipeId <= 0) {
      return NextResponse.json({ error: "This menu item has no linked recipe to move. Create and save its recipe first." }, { status: 409 });
    }
    const { data: recipe, error: recipeError } = await admin.from("bo_recipes")
      .select("id,kind").eq("id", recipeId).maybeSingle();
    if (recipeError) throw recipeError;
    if (!recipe || recipe.kind !== "menu") {
      return NextResponse.json({ error: "Only menu recipes can be moved from this page." }, { status: 409 });
    }
    const { data: linkedItems, error: linkError } = await admin.from("bo_menu_items")
      .select("id").eq("recipe_id", recipeId).limit(2);
    if (linkError) throw linkError;
    if ((linkedItems ?? []).length !== 1 || Number(linkedItems?.[0]?.id) !== menuItemId) {
      return NextResponse.json({ error: "This recipe is shared by multiple menu items. Unlink the other menu items before moving it." }, { status: 409 });
    }
    // First make the existing recipe available in production. On a failure to
    // delete the menu item, restore its original kind to avoid an inconsistent UI.
    const { data: moved, error: moveError } = await admin.from("bo_recipes")
      .update({ kind, updated_at: new Date().toISOString() })
      .eq("id", recipeId).eq("kind", "menu").select("id").maybeSingle();
    if (moveError) throw moveError;
    if (!moved) return NextResponse.json({ error: "Recipe was changed by another user. Refresh and retry." }, { status: 409 });
    const { data: removed, error: removeError } = await admin.from("bo_menu_items")
      .delete().eq("id", menuItemId).eq("recipe_id", recipeId).select("id").maybeSingle();
    if (removeError || !removed) {
      const { error: rollbackError } = await admin.from("bo_recipes")
        .update({ kind: "menu", updated_at: new Date().toISOString() })
        .eq("id", recipeId).eq("kind", kind);
      if (rollbackError) {
        return NextResponse.json({ error: "Could not remove menu item, and rollback failed. Refresh before taking further action." }, { status: 500 });
      }
      return NextResponse.json({ error: removeError?.message || "Menu item was not removed; recipe move was reversed." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, recipe_id: recipeId, destination: kind });
  } catch (error) { return boError(error, "Unable to move recipe to production."); }
}
