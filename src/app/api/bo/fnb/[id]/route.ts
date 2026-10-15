import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";

function n(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const { id: rawId } = await params;
  const id = Number(rawId);
  const body = await request.json();
  const name = String(body?.name ?? "").trim();

  if (!Number.isInteger(id) || id <= 0 || !name) {
    return NextResponse.json({ error: "Invalid ingredient." }, { status: 400 });
  }

  const { data: old } = await supabase
    .from("bo_ingredients")
    .select("price,price_currency")
    .eq("id", id)
    .maybeSingle();

  let supplierId = n(body?.supplier_id);
  const newSupplier = String(body?.new_supplier ?? "").trim();

  if (newSupplier) {
    const { data: existing } = await supabase
      .from("bo_suppliers")
      .select("id")
      .ilike("name", newSupplier)
      .maybeSingle();

    if (existing?.id) {
      supplierId = Number(existing.id);
    } else {
      const { data: added, error: supplierError } = await supabase
        .from("bo_suppliers")
        .insert({ name: newSupplier })
        .select("id")
        .single();

      if (supplierError) {
        return NextResponse.json({ error: supplierError.message }, { status: 500 });
      }

      supplierId = Number(added.id);
    }
  }

  const row = {
    category_id: n(body?.category_id),
    name,
    purchase_unit: String(body?.purchase_unit ?? "").trim() || null,
    purchase_qty: n(body?.purchase_qty),
    price: n(body?.price),
    price_currency: body?.price_currency === "LBP" ? "LBP" : "USD",
    supplier_id: supplierId,
    brand: String(body?.brand ?? "").trim() || null,
    pack_size: n(body?.pack_size),
    consumption_unit: String(body?.consumption_unit ?? "").trim() || null,
    notes: String(body?.notes ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("bo_ingredients")
    .update(row)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (
    old &&
    (Number(old.price ?? 0) !== Number(row.price ?? 0) ||
      old.price_currency !== row.price_currency)
  ) {
    await supabase.from("bo_ingredient_price_history").insert({
      ingredient_id: id,
      old_price: old.price,
      new_price: row.price,
      currency: row.price_currency,
      source: "edited",
    });
  }

  return NextResponse.json({ id });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const { id: rawId } = await params;
  const id = Number(rawId);

  const { error: deleteError } = await supabase
    .from("bo_ingredients")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          deleteError.code === "23503"
            ? "This ingredient is used by a recipe or utility and cannot be deleted."
            : deleteError.message,
      },
      { status: deleteError.code === "23503" ? 409 : 500 },
    );
  }

  return NextResponse.json({ deleted: id });
}
