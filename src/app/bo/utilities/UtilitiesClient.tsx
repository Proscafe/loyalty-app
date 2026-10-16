"use client";

import { FormEvent, useEffect, useState } from "react";
import { BOFrame } from "../BOFrame";

type Utility = {
  id: number;
  name: string;
  base_amount: number | null;
  base_currency: string | null;
  divisor: number | null;
  notes: string | null;
  cost_per_use_lbp: number | null;
  usage_count: number;
};
type ApiData = { rate: number; utilities: Utility[] };
type Draft = { name: string; base_amount: string; base_currency: "USD" | "LBP"; divisor: string; notes: string };
const EMPTY: Draft = { name: "", base_amount: "", base_currency: "USD", divisor: "", notes: "" };

async function responseJson(response: Response): Promise<any> {
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* invalid server response */ }
  if (!response.ok) throw new Error(body?.error || `Utility API failed (HTTP ${response.status}): ${text.slice(0, 160) || "empty response"}`);
  if (!body) throw new Error(`Utility API returned an empty response (HTTP ${response.status}).`);
  return body;
}
const formatMoney = (amount: number | null | undefined, currency: "USD" | "LBP") =>
  amount === null || amount === undefined || !Number.isFinite(Number(amount)) ? "—" :
    new Intl.NumberFormat("en-US", { minimumFractionDigits: currency === "USD" ? 2 : 0,
      maximumFractionDigits: currency === "USD" ? 4 : 0 }).format(Number(amount));
const inputClass = "w-full rounded-lg border border-black/20 bg-white px-3 py-2 text-[13px] outline-none focus:border-black";

export function UtilitiesClient() {
  const [data, setData] = useState<ApiData | null>(null);
  const [editing, setEditing] = useState<Utility | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const rate = Number(data?.rate ?? 0);
  async function load() {
    try {
      const response = await fetch("/api/bo/utilities", { cache: "no-store" });
      setData(await responseJson(response) as ApiData);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load utilities."); }
  }
  useEffect(() => { void load(); }, []);
  function add() { setEditing(null); setDraft({ ...EMPTY }); setError(""); setOpen(true); }
  function edit(row: Utility) {
    setEditing(row);
    setDraft({ name: row.name, base_amount: String(row.base_amount ?? ""),
      base_currency: row.base_currency === "LBP" ? "LBP" : "USD",
      divisor: String(row.divisor ?? ""), notes: row.notes ?? "" });
    setError(""); setOpen(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/bo/utilities", {
        method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: editing?.id ?? null }),
      });
      const result = await responseJson(response);
      await load(); setOpen(false);
      setSuccess(editing ? "Utility saved successfully." : `Utility saved. Added to ${result.added_to_menu_recipes ?? 0} Menu Costing recipe(s) with QTY 1.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save utility."); }
    finally { setBusy(false); }
  }
  async function remove(row: Utility) {
    const count = row.usage_count ?? 0;
    const message = count > 0
      ? `Delete “${row.name}”? This is used by ${count} recipe line(s). Deleting it will also remove those utility lines from recipes and change their costing. This cannot be undone.`
      : `Delete “${row.name}”? This cannot be undone.`;
    if (!window.confirm(message)) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/bo/utilities?id=${row.id}`, { method: "DELETE" });
      await responseJson(response);
      await load(); setSuccess(`“${row.name}” deleted successfully.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete utility."); }
    finally { setBusy(false); }
  }
  const base = Number(draft.base_amount);
  const allocations = Number(draft.divisor);
  const valid = draft.base_amount.trim() !== "" && draft.divisor.trim() !== "" &&
    Number.isFinite(base) && base > 0 && Number.isFinite(allocations) && allocations > 0;
  const costUsd = valid && rate > 0 ? draft.base_currency === "USD" ? base / allocations : base / allocations / rate : null;
  const costLbp = valid && rate > 0 ? draft.base_currency === "LBP" ? base / allocations : base * rate / allocations : null;
  return <BOFrame active="/bo/utilities" title="UTILITY COST" subtitle="Manage utility allocation costs."
    actions={<button type="button" onClick={add} className="rounded-lg bg-black px-4 py-3 text-[11px] font-bold text-white">ADD UTILITY</button>}>
    {error && <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-800">{error}<button className="ml-3 font-bold" onClick={() => setError("")}>Dismiss</button></div>}
    {success && <div role="status" className="mb-3 rounded-lg border border-black/10 bg-white px-3 py-2 text-[12px]">{success}</div>}
    <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
      <table className="w-full min-w-[800px] border-collapse text-left text-[12px]">
        <thead className="bg-gray-100 text-[10px] uppercase text-black/60"><tr>
          <th className="px-3 py-2">Utility</th><th className="px-3 py-2 text-right">Base Amount</th>
          <th className="px-3 py-2 text-right">Allocations</th><th className="px-3 py-2 text-right">Cost USD</th>
          <th className="px-3 py-2 text-right">Cost LBP</th>
          <th className="px-3 py-2 text-right">Action</th>
        </tr></thead>
        <tbody>{(data?.utilities ?? []).map(row => {
          const lbp = row.cost_per_use_lbp;
          const usd = lbp != null && rate > 0 ? lbp / rate : null;
          return <tr key={row.id} className="border-t border-black/10">
            <td className="px-3 py-2 font-bold">{row.name}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.base_amount, row.base_currency === "LBP" ? "LBP" : "USD")} {row.base_currency}</td>
            <td className="px-3 py-2 text-right tabular-nums">{row.divisor ?? "—"}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMoney(usd, "USD")}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.cost_per_use_lbp, "LBP")}</td>
            <td className="px-3 py-2"><div className="flex justify-end gap-2"><button disabled={busy} onClick={() => edit(row)} className="rounded-lg border border-black/20 px-3 py-2 text-[10px] font-bold">EDIT</button>
              <button disabled={busy} onClick={() => void remove(row)} className="rounded-lg border border-black/20 px-3 py-2 text-[10px] font-bold">DELETE</button></div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setOpen(false)}>
      <form onClick={e => e.stopPropagation()} onSubmit={save} className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-xl font-bold">{editing ? "EDIT UTILITY" : "ADD UTILITY"}</h2>
        <label className="mb-3 block text-[12px] font-bold">Utility name<input required className={`${inputClass} mt-1`} value={draft.name} onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}/></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] font-bold">Base Amount<div className="mt-1 flex gap-2"><input required min="0.000001" step="any" type="number" className={`${inputClass} min-w-0 flex-1`} value={draft.base_amount} onChange={e => setDraft(prev => ({ ...prev, base_amount: e.target.value }))}/>
            <select className="rounded-lg border border-black/20 px-2" value={draft.base_currency} onChange={e => setDraft(prev => ({ ...prev, base_currency: e.target.value as Draft["base_currency"] }))}><option>USD</option><option>LBP</option></select></div></label>
          <label className="text-[12px] font-bold">Allocations<input required min="0.000001" step="any" type="number" className={`${inputClass} mt-1`} value={draft.divisor} onChange={e => setDraft(prev => ({ ...prev, divisor: e.target.value }))}/></label>
        </div>
        <div className="my-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-100 p-3 text-[12px]"><div>Cost USD<div className="text-lg font-bold">{formatMoney(costUsd, "USD")}</div></div><div>Cost LBP<div className="text-lg font-bold">{formatMoney(costLbp, "LBP")}</div></div></div>
        <label className="block text-[12px] font-bold">Notes<textarea rows={2} className={`${inputClass} mt-1 resize-y`} value={draft.notes} onChange={e => setDraft(prev => ({ ...prev, notes: e.target.value }))}/></label>
        {error && <div role="alert" className="mt-3 text-[12px] text-red-700">{error}</div>}
        <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border border-black/20 px-4 py-2 text-[11px] font-bold">CANCEL</button>
          <button disabled={busy || !valid} type="submit" className="rounded-lg bg-black px-4 py-2 text-[11px] font-bold text-white disabled:opacity-50">{busy ? "SAVING..." : "SAVE UTILITY"}</button></div>
      </form>
    </div>}
  </BOFrame>;
}
