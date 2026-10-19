import { NextResponse } from "next/server";
import { requireBoAdminDb } from "@/lib/bo/api";
import { createBoEngine, loadBoSnapshot } from "@/lib/bo/costing";

export const dynamic = "force-dynamic";
const MAIN = "PRO'S SARL";
const VAT = 0.11;
const number = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;

async function pages(db: any, table: string, columns: string, importId?: number) {
  const result: any[] = [];
  for (let start = 0; ; start += 500) {
    let query = db.from(table).select(columns);
    if (importId !== undefined) query = query.eq("import_id", importId);
    const { data, error } = await query.order("id", { ascending: true }).range(start, start + 499);
    if (error) throw error;
    result.push(...(data ?? []));
    if ((data ?? []).length < 500) return result;
  }
}

export async function GET(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = auth.admin;
    const [imports, mappings, snapshot] = await Promise.all([
      pages(db, "bo_pos_imports", "id,branch,period_start,period_end,source_name,created_at"),
      pages(db, "bo_pos_mappings", "id,pos_key,pos_name,pos_division,pos_group,status,menu_item_id"),
      loadBoSnapshot(db),
    ]);
    const history = imports.filter((x: any) => x.branch === MAIN).sort((a: any, b: any) => String(b.period_start).localeCompare(String(a.period_start)) || number(b.id) - number(a.id));
    const parameter = new URL(request.url).searchParams.get("import_id");
    const selected = parameter ? history.find((x: any) => String(x.id) === parameter) : history[0];
    if (parameter && !selected) return NextResponse.json({ error: "Main-branch report not found." }, { status: 404 });
    const engine = createBoEngine(snapshot);
    const rate = number(engine.rate);
    const menu = new Map(snapshot.menuItems.map((m: any) => [number(m.id), { ...m, ...engine.menuCost(m) }]));
    const mappingByKey = new Map(mappings.map((m: any) => [m.pos_key, m]));
    const rawRows = selected ? await pages(db, "bo_pos_import_rows", "id,import_id,pos_key,quantity,amount_lbp,pdf_page", number(selected.id)) : [];
    const rows = rawRows.map((r: any) => {
      const mapping: any = mappingByKey.get(r.pos_key);
      const linked: any = mapping?.status === "confirmed" ? menu.get(number(mapping.menu_item_id)) : undefined;
      const quantity = number(r.quantity);
      const sales = number(r.amount_lbp);
      const costPerUnit = linked?.cost_lbp == null ? null : number(linked.cost_lbp);
      const cost = costPerUnit === null ? null : costPerUnit * quantity;
      const menuPrice = linked?.sp_lbp == null ? null : number(linked.sp_lbp);
      // TEST ASSUMPTION: uploaded POS sales are before VAT, and Menu Pricing prices include VAT.
      const posPriceWithVat = quantity > 0 ? (sales / quantity) * (1 + VAT) : null;
      const difference = menuPrice !== null && posPriceWithVat !== null ? posPriceWithVat - menuPrice : null;
      const flagged = difference !== null && Math.abs(difference) > Math.max(100, menuPrice! * 0.01);
      return {
        id: r.id, pos_name: mapping?.pos_name ?? r.pos_key, pos_group: mapping?.pos_group ?? "",
        status: mapping?.status ?? "pending", menu_name: linked?.name ?? null,
        quantity, sales_lbp: sales, vat_lbp: sales * VAT, gross_sales_lbp: sales * (1 + VAT),
        cost_lbp: cost, profit_lbp: cost === null ? null : sales - cost,
        menu_price_lbp: menuPrice, pos_price_incl_vat_lbp: posPriceWithVat,
        price_difference_lbp: difference, price_alert: flagged, pdf_page: r.pdf_page,
        cost_missing: linked != null && cost === null,
      };
    });
    const sum = (test: (x: any) => boolean, field: string) => rows.filter(test).reduce((s: number, r: any) => s + number(r[field]), 0);
    const costable = (r: any) => r.status === "confirmed" && r.cost_lbp !== null;
    const coveredSales = sum(costable, "sales_lbp");
    const costs = sum(costable, "cost_lbp");
    const totalSales = sum(() => true, "sales_lbp");
    return NextResponse.json({ history, selected: selected ?? null, rate, vat_rate: VAT,
      vat_assumption: "Test basis: imported POS amounts exclude 11% VAT; Menu Pricing prices include VAT. Verify against POS totals before relying on margin figures.",
      rows,
      totals: { rows: rows.length, quantity: sum(() => true, "quantity"), sales_lbp: totalSales,
        vat_lbp: totalSales * VAT, gross_sales_lbp: totalSales * (1 + VAT), covered_sales_lbp: coveredSales,
        uncovered_sales_lbp: totalSales - coveredSales, cost_lbp: costs,
        gross_profit_covered_lbp: coveredSales - costs,
        gross_margin_covered: coveredSales > 0 ? (coveredSales - costs) / coveredSales : null,
        confirmed: rows.filter((r: any) => r.status === "confirmed").length,
        costable: rows.filter(costable).length, alerts: rows.filter((r: any) => r.price_alert).length,
        unmatched: rows.filter((r: any) => !costable(r)).length },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to calculate consumption report." }, { status: 500 });
  }
}
