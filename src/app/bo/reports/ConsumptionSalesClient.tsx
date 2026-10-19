"use client";

import { useEffect, useState } from "react";

type Item = { id: number; pos_name: string; menu_name: string | null; pos_group: string; status: string; quantity: number; sales_lbp: number; vat_lbp: number; gross_sales_lbp: number; cost_lbp: number | null; profit_lbp: number | null; menu_price_lbp: number | null; pos_price_incl_vat_lbp: number | null; price_difference_lbp: number | null; price_alert: boolean; cost_missing: boolean };
type Report = { history: { id: number; period_start: string; period_end: string; source_name: string; created_at: string }[]; selected: { id: number; period_start: string; period_end: string; source_name: string } | null; rate: number; vat_assumption: string; rows: Item[]; totals: { rows: number; sales_lbp: number; vat_lbp: number; gross_sales_lbp: number; covered_sales_lbp: number; uncovered_sales_lbp: number; cost_lbp: number; gross_profit_covered_lbp: number; gross_margin_covered: number | null; confirmed: number; costable: number; alerts: number; unmatched: number } };

export function ConsumptionSalesClient() {
  const [report, setReport] = useState<Report | null>(null);
  const [reportId, setReportId] = useState("");
  const [currency, setCurrency] = useState<"LBP" | "USD">("LBP");
  const [tab, setTab] = useState<"all" | "alerts" | "unmatched">("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    fetch(`/api/bo/reports/consumption${reportId ? `?import_id=${encodeURIComponent(reportId)}` : ""}`, { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`); return j as Report; })
      .then(j => { if (active) setReport(j); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Report load failed"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reportId]);
  const money = (value: number | null) => value == null ? "—" : currency === "USD"
    ? report && report.rate > 0 ? `$${(value / report.rate).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : "Rate unavailable"
    : `${Math.round(value).toLocaleString("en-US")} LBP`;
  const records = (report?.rows ?? []).filter(r =>
    (tab === "all" || (tab === "alerts" ? r.price_alert : r.status !== "confirmed" || r.cost_lbp === null)) &&
    `${r.pos_name} ${r.menu_name ?? ""} ${r.pos_group}`.toLowerCase().includes(search.toLowerCase()));
  const total = report?.totals;
  const cards: [string, string][] = [
    ["POS sales (before VAT)", money(total?.sales_lbp ?? null)],
    ["VAT at 11%", money(total?.vat_lbp ?? null)],
    ["Sales including VAT", money(total?.gross_sales_lbp ?? null)],
    ["Known recipe cost", money(total?.cost_lbp ?? null)],
    ["Gross profit · covered sales only", money(total?.gross_profit_covered_lbp ?? null)],
    ["Covered gross margin", total?.gross_margin_covered == null ? "—" : `${(total.gross_margin_covered * 100).toFixed(1)}%`],
  ];
  return <section className="mt-8 space-y-4 text-[#25206f]">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">CONSUMPTION & SALES — TEST REPORT</h2><p className="mt-1 text-xs text-black/60">PRO'S SARL · Main branch only · saved POS imports</p></div>
      <div className="inline-flex overflow-hidden rounded-xl border border-[#25206f]"><button className={`px-4 py-2 text-xs font-bold ${currency === "LBP" ? "bg-[#25206f] text-white" : "bg-white"}`} onClick={() => setCurrency("LBP")}>LBP</button><button className={`px-4 py-2 text-xs font-bold ${currency === "USD" ? "bg-[#25206f] text-white" : "bg-white"}`} onClick={() => setCurrency("USD")}>USD</button></div></div>
    <div className="rounded-xl border border-[#dbd9ef] bg-[#f6f5ff] p-3 text-xs leading-5"><strong>VAT test assumption:</strong> {report?.vat_assumption ?? "POS sales before VAT; verify source amounts."} Exchange rate is read from existing Menu Pricing settings. This report does not modify menu prices or mappings.</div>
    {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 border border-black/10"><label htmlFor="pos-history" className="text-xs font-black">UPLOAD HISTORY / REPORT PERIOD</label><select id="pos-history" value={reportId || String(report?.selected?.id ?? "")} onChange={e => setReportId(e.target.value)} className="min-w-[260px] rounded-xl border p-2 text-xs">{(report?.history ?? []).map(x => <option key={x.id} value={x.id}>{x.period_start} → {x.period_end} · {x.source_name}</option>)}</select><span className="text-xs text-black/50">{report?.history.length ?? 0} imported reports · {loading ? "Loading…" : "Ready"}</span></div>
    {!report?.selected && !loading ? <div className="rounded-xl border bg-white p-5 text-sm text-black/60">No Main-branch POS import found. Import the September report from POS Mapping first.</div> : null}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{cards.map(([label,value]) => <div key={label} className="rounded-2xl border border-black/10 bg-white p-4"><div className="text-[11px] font-semibold text-black/50">{label}</div><div className="mt-2 text-lg font-black break-words">{value}</div></div>)}</div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{total?.uncovered_sales_lbp ? `Uncovered POS sales: ${money(total.uncovered_sales_lbp)} — no recipe cost has been assumed.` : "All imported sales with recipe costs are covered."} {total?.alerts ?? 0} potential price discrepancies. These can also reflect discounts, free items or POS-report price bases.</div>
    <div className="rounded-2xl border border-black/10 bg-white p-4"><div className="flex flex-wrap gap-2 items-center justify-between"><div className="flex gap-2">{(["all", "alerts", "unmatched"] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab === t ? "bg-[#25206f] text-white" : "bg-[#f4f4f9]"}`}>{t === "all" ? "All items" : t === "alerts" ? `Price alerts (${total?.alerts ?? 0})` : `Uncovered (${total?.unmatched ?? 0})`}</button>)}</div><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search POS item or recipe…" className="rounded-lg border px-3 py-2 text-xs" /></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="text-black/50"><tr>{["POS ITEM / BO MATCH", "QTY", "NET SALES", "RECIPE COST", "GROSS PROFIT", "POS UNIT +VAT", "MENU PRICE", "CHECK"].map(h => <th key={h} className="border-b px-2 py-3">{h}</th>)}</tr></thead><tbody>{records.map(r => <tr key={r.id} className="border-b border-black/5 hover:bg-gray-100"><td className="px-2 py-3"><strong>{r.pos_name}</strong><div className="text-[10px] text-black/50">{r.menu_name ?? `${r.status} · not costed`}</div></td><td className="px-2">{r.quantity}</td><td className="px-2">{money(r.sales_lbp)}</td><td className="px-2">{money(r.cost_lbp)}</td><td className="px-2">{money(r.profit_lbp)}</td><td className="px-2">{money(r.pos_price_incl_vat_lbp)}</td><td className="px-2">{money(r.menu_price_lbp)}</td><td className={`px-2 font-bold ${r.price_alert ? "text-amber-700" : "text-black/50"}`}>{r.price_alert ? "Review price" : r.menu_price_lbp == null ? "Unmapped" : "OK"}</td></tr>)}</tbody></table>{!records.length && <p className="p-5 text-sm text-black/50">No items match this filter.</p>}</div></div>
    <p className="text-xs leading-5 text-black/50">Theoretical item-level recipe costs use your current saved costing engine. Ingredient-by-ingredient quantities, historical ingredient prices, and uploading arbitrary new POS PDFs require a later verified integration; this test does not claim those capabilities.</p>
  </section>;
}
