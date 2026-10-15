import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";

function n(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const [{ data: rateRow }, ingredients, categories, suppliers] = await Promise.all([
    supabase.from("bo_settings").select("value").eq("key", "usd_lbp_rate").maybeSingle(),
    supabase.from("bo_ingredients").select("*,bo_ingredient_categories(name),bo_suppliers(name)").order("sort").order("id"),
    supabase.from("bo_ingredient_categories").select("id,name,sort").order("sort").order("name"),
    supabase.from("bo_suppliers").select("id,name").order("name"),
  ]);

  if (ingredients.error || categories.error || suppliers.error) {
    return NextResponse.json(
      { error: ingredients.error?.message || categories.error?.message || suppliers.error?.message },
      { status: 500 },
    );
  }

  const rate = Number(rateRow?.value ?? 90000) || 90000;
  const rows = (ingredients.data ?? []).map((row: any) => {
    const price = n(row.price);
    const qty = n(row.purchase_qty);
    const pack = n(row.pack_size);
    const currency = row.price_currency === "LBP" ? "LBP" : "USD";
    const priceLbp = price === null ? null : currency === "LBP" ? price : price * rate;
    const priceUsd = price === null ? null : currency === "USD" ? price : price / rate;

    return {
      ...row,
      category_name: row.bo_ingredient_categories?.name ?? null,
      supplier_name: row.bo_suppliers?.name ?? null,
      price_lbp: priceLbp,
      price_usd: priceUsd,
      total_price_lbp: priceLbp === null ? null : priceLbp * (qty ?? 1),
      cost_per_consumption_unit:
        priceLbp === null || pack === null || pack <= 0 ? null : priceLbp / pack,
    };
  });

  return NextResponse.json({
    ingredients: rows,
    categories: categories.data ?? [],
    suppliers: suppliers.data ?? [],
    usd_lbp_rate: rate,
  });
}

export async function POST(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const body = await request.json();
  const name = String(body?.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Item name is required." }, { status: 400 });
  }

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
  };

  const { data, error: insertError } = await supabase
    .from("bo_ingredients")
    .insert(row)
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase.from("bo_ingredient_price_history").insert({
    ingredient_id: data.id,
    old_price: null,
    new_price: row.price,
    currency: row.price_currency,
    source: "created",
  });

  return NextResponse.json({ id: data.id });
}
