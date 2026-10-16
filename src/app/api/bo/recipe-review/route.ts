import { NextResponse } from "next/server";
import { requireBoAdminDb } from "@/lib/bo/api";

// A GET health check distinguishes a missing Next.js route from a stale recipe-line ID.
export async function GET() {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, route: "recipe-review", methods: ["GET", "PATCH"] });
}

export async function PATCH(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const lineId = Number(body.line_id);
    const recipeId = Number(body.recipe_id);
    const value = body.needs_review;
    if (!Number.isSafeInteger(lineId) || lineId <= 0 || !Number.isSafeInteger(recipeId) || recipeId <= 0 || typeof value !== "boolean") {
      return NextResponse.json({ error: "Invalid review request: line_id, recipe_id and boolean needs_review are required." }, { status: 400 });
    }

    const db = auth.admin;
    const { data: existing, error: lookupError } = await db
      .from("bo_recipe_lines")
      .select("id, recipe_id")
      .eq("id", lineId)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
    if (!existing) {
      return NextResponse.json({ error: "This recipe line no longer exists. Reload Recipes and try again.", code: "STALE_LINE_ID" }, { status: 409 });
    }
    if (Number(existing.recipe_id) !== recipeId) {
      return NextResponse.json({ error: "This line now belongs to a different recipe. Reload Recipes and try again.", code: "RECIPE_ID_MISMATCH" }, { status: 409 });
    }

    const { data: updated, error: updateError } = await db
      .from("bo_recipe_lines")
      .update({ needs_review: value })
      .eq("id", lineId)
      .eq("recipe_id", recipeId)
      .select("id, recipe_id, needs_review")
      .maybeSingle();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "The line changed before it could be updated. Reload Recipes.", code: "STALE_LINE_ID" }, { status: 409 });
    return NextResponse.json({ ok: true, line: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update review flag." }, { status: 500 });
  }
}
