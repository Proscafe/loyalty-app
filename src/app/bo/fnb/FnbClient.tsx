"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BOFrame } from "../BOFrame";
import { moneyLbp, moneyUsd } from "../format";
import { downloadIngredientsXlsx } from "./downloadIngredientsXlsx";

type Row = Record<string, any>;
type Currency = "USD" | "LBP";
type SortField = "name" | "purchase_unit" | "price_usd" | "price_lbp" | "supplier_name" | "brand" | "pack_size" | "cost_per_consumption_unit";
type DetailFilter = "all" | "supplier" | "brand" | "missing";
const EMPTY = { name: "", category_id: "", purchase_unit: "", purchase_qty: "", price: "", price_currency: "USD", supplier_id: "", new_supplier: "", brand: "", pack_size: "", consumption_unit: "", notes: "" };
const inputClass = "w-full min-w-[86px] rounded-md border border-black/20 bg-white px-2 py-1 text-right text-[11px] font-semibold text-black outline-none focus:border-black disabled:opacity-50";

async function parseResponse(response: Response) {
  const text = await response.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { throw new Error(`Server returned invalid JSON (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(body?.error || `Request failed (HTTP ${response.status}).`);
  return body;
}

function InlinePrice({ value, currency, disabled, onSave }: { value: number | null; currency: Currency; disabled: boolean; onSave: (price: string) => Promise<boolean> }) {
  const format = (n: number | null) => n === null || n === undefined ? "" : currency === "LBP" ? String(Math.round(n)) : String(Number(Number(n).toFixed(4)));
  const [draft, setDraft] = useState(format(value));
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!busy) setDraft(format(value)); }, [value, busy]);
  async function commit() {
    if (busy || draft.trim() === format(value)) return;
    const cleaned = draft.trim().replace(/,/g, "");
    const n = cleaned === "" ? null : Number(cleaned);
    if (n !== null && (!Number.isFinite(n) || n < 0)) { setDraft(format(value)); return; }
    setBusy(true);
    try { if (!(await onSave(n === null ? "" : String(n)))) setDraft(format(value)); }
    finally { setBusy(false); }
  }
  return <input aria-label={`Price ${currency}`} inputMode="decimal" className={inputClass} value={draft} disabled={disabled || busy} onChange={e => setDraft(e.target.value)} onBlur={() => void commit()} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(format(value)); e.currentTarget.blur(); } }} />;
}

export function FnbClient() {
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [detailFilter, setDetailFilter] = useState<DetailFilter>("all");
  const [detailValue, setDetailValue] = useState("");
  const [viewCurrency, setViewCurrency] = useState<Currency>("USD");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<any>({ ...EMPTY });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingPrice, setSavingPrice] = useState<number | null>(null);
  const rate = Number(data?.usd_lbp_rate) || 0;

  async function load(clearError = true) {
    if (clearError) setError("");
    try { const json = await parseResponse(await fetch("/api/bo/fnb", { cache: "no-store" })); setData(json); return json; }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load ingredients."); return null; }
  }
  useEffect(() => { void load(); }, []);

  const brands = useMemo<string[]>(() => Array.from(new Set<string>((data?.ingredients || []).map((r: Row) => String(r.brand || "").trim()).filter(Boolean))).sort(), [data]);
  const filtered = useMemo<Row[]>(() => (data?.ingredients || []).filter((row: Row) => {
    const q = search.trim().toLowerCase();
    if (q && ![row.name, row.category_name, row.supplier_name, row.brand, row.purchase_unit].join(" ").toLowerCase().includes(q)) return false;
    if (category && String(row.category_id ?? "") !== category) return false;
    if (detailFilter === "supplier" && detailValue && String(row.supplier_id ?? "") !== detailValue) return false;
    if (detailFilter === "brand" && detailValue && String(row.brand ?? "") !== detailValue) return false;
    if (detailFilter === "missing" && row.price !== null && row.price !== undefined && Number(row.price) > 0) return false;
    return true;
  }), [data, search, category, detailFilter, detailValue]);
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of filtered) { const name = row.category_name || "UNCATEGORISED"; map.set(name, [...(map.get(name) || []), row]); }
    return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([name, rows]) => ({ name, rows: rows.sort((a,b) => {
      const av = a[sortField], bv = b[sortField];
      if (av == null || av === "") return bv == null || bv === "" ? 0 : 1;
      if (bv == null || bv === "") return -1;
      const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" }) : Number(av) - Number(bv);
      return sortDirection === "asc" ? cmp : -cmp;
    }) }));
  }, [filtered, sortField, sortDirection]);
  const allCollapsed = grouped.length > 0 && grouped.every(g => collapsed[g.name]);
  function changeSort(field: SortField) { if (sortField === field) setSortDirection(v => v === "asc" ? "desc" : "asc"); else { setSortField(field); setSortDirection("asc"); } }
  function header(field: SortField, label: string) { return <button type="button" onClick={() => changeSort(field)} className="inline-flex w-full items-center justify-end gap-1 whitespace-nowrap text-right hover:text-black" aria-label={`Sort by ${label}`}>{label} <span aria-hidden="true">{sortField === field ? sortDirection === "asc" ? "▲" : "▼" : "↕"}</span></button>; }
  function resetFilters() { setSearch(""); setCategory(""); setDetailFilter("all"); setDetailValue(""); }
  function exportExcel() {
    const costDivider = viewCurrency === "USD" ? rate : 1;
    const rows: (string | number | null)[][] = [];
    for (const group of grouped) {
      for (const row of group.rows) {
        const numberOrNull = (v: unknown): number | null => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
        const cost = numberOrNull(row.cost_per_consumption_unit);
        rows.push([
          group.name, String(row.name ?? ""), String(row.purchase_unit ?? ""),
          numberOrNull(row.price_usd), numberOrNull(row.price_lbp),
          String(row.supplier_name ?? ""), String(row.brand ?? ""),
          row.pack_size == null || row.pack_size === "" ? "" : `${row.pack_size} ${row.consumption_unit || ""}`.trim(),
          cost === null || costDivider <= 0 ? null : Number((cost / costDivider).toFixed(viewCurrency === "USD" ? 4 : 0)),
        ]);
      }
    }
    downloadIngredientsXlsx(rows, viewCurrency);
  }

  function startAdd() { setEditing(null); setDraft({ ...EMPTY }); setOpen(true); }
  function startEdit(row: Row) { setEditing(row); setDraft({ name: row.name ?? "", category_id: row.category_id ? String(row.category_id) : "", purchase_unit: row.purchase_unit ?? "", purchase_qty: row.purchase_qty ?? "", price: row.price ?? "", price_currency: row.price_currency ?? "USD", supplier_id: row.supplier_id ? String(row.supplier_id) : "", new_supplier: "", brand: row.brand ?? "", pack_size: row.pack_size ?? "", consumption_unit: row.consumption_unit ?? "", notes: row.notes ?? "" }); setOpen(true); }

  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await parseResponse(await fetch(editing ? `/api/bo/fnb/${editing.id}` : "/api/bo/fnb", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, category_id: draft.category_id || null, supplier_id: draft.supplier_id || null, purchase_qty: draft.purchase_qty || null, price: draft.price === "" ? null : draft.price, pack_size: draft.pack_size || null }) }));
      const refreshed = await load(false);
      if (refreshed) setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save ingredient."); }
    finally { setBusy(false); }
  }
  async function remove(row: Row) { if (!confirm(`Delete "${row.name}"?`)) return; try { await parseResponse(await fetch(`/api/bo/fnb/${row.id}`, { method: "DELETE" })); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete ingredient."); } }

  async function saveInlinePrice(row: Row, currency: Currency, value: string): Promise<boolean> {
    if (savingPrice !== null) return false;
    const n = value === "" ? null : Number(value);
    if (n !== null && (!Number.isFinite(n) || n < 0)) { setError("Price must be zero or greater."); return false; }
    if (currency === "LBP" && rate <= 0) { setError("Set a valid USD/LBP exchange rate in Settings first."); return false; }
    setSavingPrice(Number(row.id)); setError("");
    try {
      // Preserve the other ingredient fields: the existing PUT route expects a full ingredient record.
      const payload = { name: row.name, category_id: row.category_id, purchase_unit: row.purchase_unit, purchase_qty: row.purchase_qty, price: n, price_currency: currency, supplier_id: row.supplier_id, brand: row.brand, pack_size: row.pack_size, consumption_unit: row.consumption_unit, notes: row.notes };
      await parseResponse(await fetch(`/api/bo/fnb/${row.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      const latest = await load(false);
      if (!latest) return false;
      const saved = (latest.ingredients || []).find((x: Row) => Number(x.id) === Number(row.id));
      if (!saved || saved.price_currency !== currency || (n === null ? saved.price !== null : Math.abs(Number(saved.price) - n) > 0.0001)) throw new Error(`Price for ${row.name} could not be verified after saving.`);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save ingredient price."); return false; }
    finally { setSavingPrice(null); }
  }

  return <BOFrame active="/bo/fnb" title="INGREDIENTS" subtitle={`${data?.ingredients?.length ?? 0} ingredients · Exchange rate ${rate.toLocaleString()} LBP/USD`} actions={<button onClick={startAdd} className="rounded-[10px] bg-black px-4 py-3 text-[11px] font-black uppercase text-white hover:bg-black/80">ADD INGREDIENT</button>}>
    {error && <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800">{error}</div>}
    <section className="mb-3 rounded-xl border border-black/10 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search ingredients" value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH INGREDIENTS" className="min-w-[175px] flex-1 rounded-md border border-black/15 px-3 py-2 text-[12px] font-semibold" />
        <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className="min-w-[150px] flex-1 rounded-md border border-black/15 px-3 py-2 text-[11px] font-bold"><option value="">ALL CATEGORIES</option>{(data?.categories || []).map((r: Row) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select aria-label="Extra filter" value={detailFilter} onChange={e => { setDetailFilter(e.target.value as DetailFilter); setDetailValue(""); }} className="rounded-md border border-black/15 px-3 py-2 text-[11px] font-bold"><option value="all">ALL DETAILS</option><option value="supplier">SUPPLIER</option><option value="brand">BRAND</option><option value="missing">MISSING PRICE</option></select>
        {detailFilter === "supplier" && <select aria-label="Supplier" value={detailValue} onChange={e => setDetailValue(e.target.value)} className="min-w-[145px] rounded-md border border-black/15 px-3 py-2 text-[11px]"><option value="">ALL SUPPLIERS</option>{(data?.suppliers || []).map((r: Row) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
        {detailFilter === "brand" && <select aria-label="Brand" value={detailValue} onChange={e => setDetailValue(e.target.value)} className="min-w-[145px] rounded-md border border-black/15 px-3 py-2 text-[11px]"><option value="">ALL BRANDS</option>{brands.map(b => <option key={b} value={b}>{b}</option>)}</select>}
        <div className="inline-flex overflow-hidden rounded-md border border-black/20" role="group" aria-label="Cost display currency">{(["USD", "LBP"] as const).map(c => <button key={c} type="button" aria-pressed={viewCurrency === c} onClick={() => setViewCurrency(c)} className={`px-3 py-2 text-[11px] font-bold ${viewCurrency === c ? "bg-black text-white" : "bg-white text-black"}`}>{c}</button>)}</div>
        <button type="button" onClick={exportExcel} disabled={!data || grouped.length === 0} title="Download filtered ingredients as Excel (.xlsx)" aria-label="Download ingredients as Excel" className="inline-flex items-center gap-1 rounded-md border border-black/15 bg-white px-3 py-2 text-[11px] font-bold hover:bg-gray-100 disabled:opacity-40"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4 16v4h16v-4"/></svg> EXCEL</button>
        <button type="button" onClick={resetFilters} className="rounded-md border border-black/15 px-3 py-2 text-[11px] font-bold">RESET FILTERS</button>
        <button type="button" title={allCollapsed ? "Expand all" : "Collapse all"} aria-label={allCollapsed ? "Expand all" : "Collapse all"} onClick={() => setCollapsed(Object.fromEntries(grouped.map(g => [g.name, !allCollapsed])))} className="rounded-md border border-black/15 px-3 py-2 text-[14px] font-bold">{allCollapsed ? "⊞" : "⊟"}</button>
      </div>
    </section>
    <div className="space-y-3">{grouped.map(({ name, rows }) => <section key={name} className="overflow-hidden rounded-xl border border-black/15 bg-white">
      <button type="button" aria-expanded={!collapsed[name]} onClick={() => setCollapsed(prev => ({ ...prev, [name]: !prev[name] }))} className="flex w-full items-center justify-between border-b border-black/10 bg-[#f2f2f2] px-3 py-2 text-left text-[12px] font-bold uppercase"><span>{name} <span className="font-normal text-black/50">({rows.length})</span></span><span>{collapsed[name] ? "+" : "−"}</span></button>
      {!collapsed[name] && <div className="overflow-x-auto"><table className="w-full min-w-[1030px] border-collapse text-left text-[11px]">
        <thead className="bg-[#ebebeb] text-[10px] font-bold uppercase text-black/65"><tr>
          <th className="px-3 py-2"><button type="button" onClick={() => changeSort("name")} className="whitespace-nowrap">ITEMS {sortField === "name" ? sortDirection === "asc" ? "▲" : "▼" : "↕"}</button></th>
          <th className="px-2 py-2">{header("purchase_unit", "UNIT")}</th>
          <th className="px-2 py-2">{header("price_usd", "PRICE USD")}</th>
          <th className="px-2 py-2">{header("price_lbp", "PRICE LBP")}</th>
          <th className="px-2 py-2">{header("supplier_name", "SUPPLIER")}</th>
          <th className="px-2 py-2">{header("brand", "BRAND")}</th>
          <th className="px-2 py-2">{header("pack_size", "PACK")}</th>
          <th className="px-2 py-2">{header("cost_per_consumption_unit", "COST / UNIT")}</th>
          <th className="px-3 py-2 text-right">ACTION</th>
        </tr></thead><tbody>{rows.map((row: Row) => <tr key={row.id} className="border-t border-black/[0.07] hover:bg-black/[0.02]">
          <td className="px-3 py-1.5 font-bold">{row.name}</td>
          <td className="px-2 py-1.5">{row.purchase_unit || "—"}</td>
          <td className="w-[112px] px-2 py-1"><InlinePrice key={`${row.id}-usd`} currency="USD" value={row.price_usd} disabled={savingPrice !== null} onSave={v => saveInlinePrice(row, "USD", v)} /></td>
          <td className="w-[135px] px-2 py-1"><InlinePrice key={`${row.id}-lbp`} currency="LBP" value={row.price_lbp} disabled={savingPrice !== null} onSave={v => saveInlinePrice(row, "LBP", v)} /></td>
          <td className="px-2 py-1.5">{row.supplier_name || "—"}</td>
          <td className="px-2 py-1.5">{row.brand || "—"}</td>
          <td className="px-2 py-1.5 text-right">{row.pack_size ? `${row.pack_size} ${row.consumption_unit || ""}` : "—"}</td>
          <td className="px-2 py-1.5 text-right font-bold tabular-nums">{row.cost_per_consumption_unit == null ? "—" : viewCurrency === "LBP" ? moneyLbp(row.cost_per_consumption_unit) : rate > 0 ? moneyUsd(Number(row.cost_per_consumption_unit) / rate) : "—"}</td>
          <td className="px-3 py-1"><div className="flex justify-end gap-1"><button type="button" onClick={() => startEdit(row)} className="rounded border border-black/15 px-2 py-1.5 text-[10px] font-bold">EDIT</button><button type="button" onClick={() => void remove(row)} className="rounded border border-black/15 px-2 py-1.5 text-[10px] font-bold">DELETE</button></div></td>
        </tr>)}</tbody></table></div>}
    </section>)}{data && grouped.length === 0 && <div className="rounded-xl border border-black/10 bg-white p-5 text-center text-sm">No ingredients match your filters.</div>}</div>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[20px] border border-black/10 bg-white p-5 shadow-2xl">
            <h2 className="text-[22px] font-black uppercase">{editing ? "EDIT INGREDIENT" : "ADD INGREDIENT"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input required placeholder="ITEM NAME" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="sm:col-span-2 rounded-[9px] border border-black/15 px-3 py-3" />
              <select value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3"><option value="">CATEGORY</option>{(data?.categories ?? []).map((x: Row) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <input placeholder="PURCHASE UNIT" value={draft.purchase_unit} onChange={(e) => setDraft({ ...draft, purchase_unit: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3" />
              <input placeholder="ORDER QTY" value={draft.purchase_qty} onChange={(e) => setDraft({ ...draft, purchase_qty: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3" />
              <div className="flex gap-2">
                <input placeholder="PRICE" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="min-w-0 flex-1 rounded-[9px] border border-black/15 px-3 py-3" />
                <select value={draft.price_currency} onChange={(e) => setDraft({ ...draft, price_currency: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3"><option>USD</option><option>LBP</option></select>
              </div>
              <select value={draft.supplier_id} onChange={(e) => setDraft({ ...draft, supplier_id: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3"><option value="">SUPPLIER</option>{(data?.suppliers ?? []).map((x: Row) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <input placeholder="OR NEW SUPPLIER" value={draft.new_supplier} onChange={(e) => setDraft({ ...draft, new_supplier: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3" />
              <input placeholder="BRAND" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3" />
              <input placeholder="PACK CONTENT" value={draft.pack_size} onChange={(e) => setDraft({ ...draft, pack_size: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3" />
              <select value={draft.consumption_unit} onChange={(e) => setDraft({ ...draft, consumption_unit: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3"><option value="">MEASURED IN</option><option>KG</option><option>G</option><option>L</option><option>ML</option><option>PCS</option><option>POR</option><option>CUP</option></select>
              <textarea placeholder="NOTES" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="sm:col-span-2 rounded-[9px] border border-black/15 px-3 py-3" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-[9px] border border-black/15 px-4 py-3 text-[11px] font-black uppercase">CANCEL</button>
              <button disabled={busy} className="rounded-[9px] bg-black px-5 py-3 text-[11px] font-black uppercase text-white">{busy ? "SAVING..." : "SAVE"}</button>
            </div>
          </form>
        </div>
      ) : null}
  </BOFrame>;
}
