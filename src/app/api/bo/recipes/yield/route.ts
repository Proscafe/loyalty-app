import { NextResponse } from "next/server";
import { requireBoAdminDb } from "@/lib/bo/api";

// Dedicated yield update: does not revalidate or rewrite existing recipe lines.
export async function PATCH(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const body = await request.json();
    const id = Number(body?.id);
    const yieldQty = Number(body?.yield_qty);
    const yieldUnit = String(body?.yield_unit ?? "").trim().toUpperCase();
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(yieldQty) || yieldQty <= 0) {
      return NextResponse.json({ error: "A valid recipe and positive Total Yield are required." }, { status: 400 });
    }
    if (!yieldUnit || yieldUnit.length > 20) {
      return NextResponse.json({ error: "Choose a valid yield unit." }, { status: 400 });
    }
    const { data, error } = await auth.admin.from("bo_recipes")
      .update({ yield_qty: yieldQty, yield_unit: yieldUnit, yield_mode: "fixed" })
      .eq("id", id)
      .in("kind", ["prep", "sauce"])
      .select("id,yield_qty,yield_unit,yield_mode")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Preparation or sauce not found." }, { status: 404 });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save yield." }, { status: 500 });
  }
}
