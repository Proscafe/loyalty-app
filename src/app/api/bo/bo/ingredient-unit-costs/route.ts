import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";

// Ingredient purchase price / pack quantity, returned in LBP per consumption unit.
// Uses the same admin authentication as the other BO API routes.
export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;
  try {
    const [ingredients, settings] = await Promise.all([
      supabase.from("bo_ingredients").select("id,price,price_currency,pack_size,purchase_qty"),
      supabase.from("bo_settings").select("key,value").eq("key", "usd_lbp_rate").maybeSingle(),
    ]);
    if (ingredients.error) throw ingredients.error;
    if (settings.error) throw settings.error;
    const rate = Number(settings.data?.value ?? 90000);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid exchange rate in BO settings.");
    const costs: Record<string, number> = {};
    for (const row of ingredients.data ?? []) {
      if (row.price == null || row.price === "") continue;
      const price = Number(row.price);
      if (!Number.isFinite(price)) continue;
      const pack = Number(row.pack_size);
      const purchaseQty = Number(row.purchase_qty);
      const divisor = pack > 0 ? pack : purchaseQty > 0 ? purchaseQty : 1;
      costs[String(row.id)] = (row.price_currency === "LBP" ? price : price * rate) / divisor;
    }
    return NextResponse.json({ costs });
  } catch (e: unknown) {
    const message = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
