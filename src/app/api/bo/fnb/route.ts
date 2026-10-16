import { NextResponse } from "next/server";
import { requireBoAdminDb, boError, numberOrNull } from "@/lib/bo/api";

export async function GET() {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;

  try {
    const admin = auth.admin;
    const [ingredientsResult, categoriesResult, suppliersResult, settingsResult] = await Promise.all([
      admin.from("bo_ingredients").select("*").order("sort").order("id"),
      admin.from("bo_ingredient_categories").select("*").order("sort").order("id"),
      admin.from("bo_suppliers").select("*").order("name"),
      admin.from("bo_settings").select("key,value"),
    ]);

    if (ingredientsResult.error) throw ingredientsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (suppliersResult.error) throw suppliersResult.error;
    if (settingsResult.error) throw settingsResult.error;

    const settings = Object.fromEntries((settingsResult.data ?? []).map((row: any) => [row.key, row.value]));
    const rate = Number(settings.usd_lbp_rate ?? 90000) || 90000;
    const categoryMap = new Map((categoriesResult.data ?? []).map((row: any) => [Number(row.id), row.name]));
    const supplierMap = new Map((suppliersResult.data ?? []).map((row: any) => [Number(row.id), row.name]));

    const ingredients = (ingredientsResult.data ?? []).map((row: any) => {
      const price = numberOrNull(row.price);
      const priceLbp = price === null ? null : row.price_currency === "LBP" ? price : price * rate;
      const packSize = numberOrNull(row.pack_size);
      const purchaseQty = numberOrNull(row.purchase_qty);
      let costPerConsumptionUnit: number | null = priceLbp;
      if (priceLbp !== null && packSize && packSize > 0) costPerConsumptionUnit = priceLbp / packSize;
      else if (priceLbp !== null && purchaseQty && purchaseQty > 0) costPerConsumptionUnit = priceLbp / purchaseQty;

      return {
        ...row,
        category_name: categoryMap.get(Number(row.category_id)) ?? null,
        supplier_name: supplierMap.get(Number(row.supplier_id)) ?? null,
        price_usd: price === null ? null : row.price_currency === "USD" ? price : price / rate,
        price_lbp: priceLbp,
        cost_per_consumption_unit: costPerConsumptionUnit,
      };
    });

    return NextResponse.json({ ingredients, categories: categoriesResult.data ?? [], suppliers: suppliersResult.data ?? [], usd_lbp_rate: rate });
  } catch (error) {
    return boError(error, "Unable to load F&B.");
  }
}

export async function POST(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error;

  try {
    const admin = auth.admin;
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Ingredient name is required." }, { status: 400 });

    let supplierId = numberOrNull(body?.supplier_id);
    const newSupplier = String(body?.new_supplier ?? "").trim();

    if (newSupplier) {
      const { data: existing } = await admin.from("bo_suppliers").select("id").ilike("name", newSupplier).limit(1).maybeSingle();
      if (existing?.id) supplierId = Number(existing.id);
      else {
        const { data: created, error: supplierError } = await admin.from("bo_suppliers").insert({ name: newSupplier }).select("id").single();
        if (supplierError) throw supplierError;
        supplierId = Number(created.id);
      }
    }

    const { data, error } = await admin.from("bo_ingredients").insert({
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
    }).select("*").single();

    if (error) throw error;
    return NextResponse.json({ ok: true, ingredient: data });
  } catch (error) {
    return boError(error, "Unable to add ingredient.");
  }
}
