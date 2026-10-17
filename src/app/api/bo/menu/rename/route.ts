import { NextResponse } from "next/server";
import { boError, requireBoAdminDb } from "@/lib/bo/api";

// Rename a menu item without rewriting or validating its ingredient lines.
export async function POST(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const body = await request.json();
    const id = Number(body?.id);
    const name = String(body?.name ?? "").trim();
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Valid menu item ID required." }, { status: 400 });
    }
    if (!name || name.length > 250) {
      return NextResponse.json({ error: "Enter a dish name of at most 250 characters." }, { status: 400 });
    }
    const admin = auth.admin;
    const { data: original, error: lookupError } = await admin.from("bo_menu_items")
      .select("id,recipe_id,name").eq("id", id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!original) return NextResponse.json({ error: "Menu item not found." }, { status: 404 });

    const { data: item, error: updateError } = await admin.from("bo_menu_items")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id).select("id,name,recipe_id").maybeSingle();
    if (updateError) throw updateError;
    if (!item) throw new Error("Unable to save menu item name.");

    // A recipe can be linked to multiple menu items. Only rename the recipe
    // when the current menu item is its sole user, to avoid altering other dishes.
    let recipeRenamed = false;
    if (original.recipe_id) {
      const { data: links, error: linksError } = await admin.from("bo_menu_items")
        .select("id").eq("recipe_id", original.recipe_id).limit(2);
      if (linksError) throw linksError;
      if ((links ?? []).length === 1 && Number(links?.[0]?.id) === id) {
        const { error: recipeError } = await admin.from("bo_recipes")
          .update({ name, updated_at: new Date().toISOString() })
          .eq("id", original.recipe_id);
        if (recipeError) {
          return NextResponse.json({
            error: "Menu item name saved, but the linked recipe name could not be updated. Refresh before retrying.",
            partial: true,
          }, { status: 409 });
        }
        recipeRenamed = true;
      }
    }
    return NextResponse.json({ ok: true, item, recipeRenamed });
  } catch (error) {
    return boError(error, "Unable to rename menu item.");
  }
}
