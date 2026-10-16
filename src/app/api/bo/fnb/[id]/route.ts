import { NextResponse } from "next/server";
import { boError, numberOrNull, requireBoAdminDb } from "@/lib/bo/api";

async function save(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    const body = await request.json();
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid ingredient id." }, { status: 400 });
    const name = String(body?.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Ingredient name is required." }, { status: 400 });

    let supplierId = numberOrNull(body?.supplier_id);
    const newSupplier = String(body?.new_supplier ?? "").trim();
    if (newSupplier) {
      const { data: existing } = await auth.admin.from("bo_suppliers").select("id").ilike("name", newSupplier).limit(1).maybeSingle();
      if (existing?.id) supplierId = Number(existing.id);
      else {
        const { data, error } = await auth.admin.from("bo_suppliers").insert({ name: newSupplier }).select("id").single();
        if (error) throw error;
        supplierId = Number(data.id);
      }
    }

    const { data, error } = await auth.admin.from("bo_ingredients").update({
      name,
      category_id: numberOrNull(body?.category_id),
      purchase_unit: String(body?.purchase_unit ?? "").trim() || null,
      purchase_qty: numberOrNull(body?.purchase_qty),
      price: numberOrNull(body?.price),
      price_currency: body?.price_currency === "LBP" ? "LBP" : "USD",
      supplier_id: supplierId,
      brand: String(body?.brand ?? "").trim() || null,
      pack_size: numberOrNull(body?.pack_size),
      consumption_unit: String(body?.consumption_unit ?? "").trim() || null,
      notes: String(body?.notes ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Ingredient not found." }, { status: 404 });
    return NextResponse.json({ ok: true, ingredient: data });
  } catch (error) { return boError(error, "Unable to save ingredient."); }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) { return save(request, context); }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return save(request, context); }

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    const { error } = await auth.admin.from("bo_ingredients").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true, deleted: id });
  } catch (error) { return boError(error, "Unable to delete ingredient."); }
}
