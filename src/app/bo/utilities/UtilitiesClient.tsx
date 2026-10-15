"use client";

import { FormEvent, useEffect, useState } from "react";
import { BOFrame } from "../BOFrame";
import { moneyLbp } from "../format";

type Row = Record<string, any>;

const EMPTY = {
  name: "",
  mode: "pool",
  ingredient_id: "",
  ingredient_rate: "",
  base_amount: "",
  base_currency: "USD",
  divisor: "",
  unit_label: "",
  notes: "",
};

export function UtilitiesClient() {
  const [data, setData] = useState<any>(null);
  const [draft, setDraft] = useState<any>({ ...EMPTY });
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/bo/utilities", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) setError(json?.error || "Unable to load utilities.");
    else setData(json);
  }

  useEffect(() => { void load(); }, []);

  function startAdd() {
    setEditing(null);
    setDraft({ ...EMPTY });
    setOpen(true);
  }

  function startEdit(row: Row) {
    setEditing(row);
    setDraft({
      name: row.name ?? "",
      mode: row.mode ?? "pool",
      ingredient_id: row.ingredient_id ? String(row.ingredient_id) : "",
      ingredient_rate: row.ingredient_rate ?? "",
      base_amount: row.base_amount ?? "",
      base_currency: row.base_currency ?? "USD",
      divisor: row.divisor ?? "",
      unit_label: row.unit_label ?? "",
      notes: row.notes ?? "",
    });
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);

    const res = await fetch("/api/bo/utilities", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, id: editing?.id }),
    });

    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(json?.error || "Unable to save utility.");
      return;
    }

    setOpen(false);
    await load();
  }

  async function remove(row: Row) {
    if (!confirm(`Delete "${row.name}"?`)) return;
    const res = await fetch(`/api/bo/utilities?id=${row.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) setError(json?.error || "Unable to delete utility.");
    else await load();
  }

  return (
    <BOFrame
      active="/bo/utilities"
      title="UTL COST"
      subtitle="Add, edit and use the utility items found in the workbook."
      actions={
        <button onClick={startAdd} className="rounded-[10px] bg-black px-4 py-3 text-[11px] font-black uppercase text-white">
          ADD UTILITY
        </button>
      }
    >
      {error ? <div className="mb-4 rounded-[10px] border border-black/10 bg-white px-4 py-3 text-[12px] font-bold">{error}</div> : null}

      <div className="overflow-hidden rounded-[14px] border border-black/10 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-[#efefef] text-[9px] font-black uppercase text-black/45">
              <tr><th className="px-4 py-3">UTILITY</th><th className="px-3 py-3">MODE</th><th className="px-3 py-3">UNIT</th><th className="px-3 py-3 text-right">BASE / SHARE</th><th className="px-3 py-3 text-right">COST / USE</th><th className="px-4 py-3 text-right">ACTION</th></tr>
            </thead>
            <tbody>
              {(data?.utilities ?? []).map((row: Row) => (
                <tr key={row.id} className="border-t border-black/[0.07] text-[11px]">
                  <td className="px-4 py-3 font-black">{row.name}</td>
                  <td className="px-3 py-3 uppercase text-black/55">{row.mode}</td>
                  <td className="px-3 py-3">{row.unit_label || "—"}</td>
                  <td className="px-3 py-3 text-right">{row.mode === "ingredient" ? row.ingredient_rate ?? "—" : `${row.base_amount ?? "—"} ${row.base_currency ?? ""}`}</td>
                  <td className="px-3 py-3 text-right font-black">{moneyLbp(row.cost_per_use_lbp)}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(row)} className="rounded-[8px] border border-black/15 px-3 py-2 text-[10px] font-black uppercase hover:bg-black hover:text-white">EDIT</button>
                    <button onClick={() => void remove(row)} className="rounded-[8px] border border-black/10 px-3 py-2 text-[10px] font-black uppercase text-black/50">DELETE</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-[20px] border border-black/10 bg-white p-5 shadow-2xl">
            <h2 className="text-[22px] font-black uppercase">{editing ? "EDIT UTILITY" : "ADD UTILITY"}</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input required placeholder="UTILITY NAME" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="sm:col-span-2 rounded-[9px] border border-black/15 px-3 py-3" />

              <select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3">
                <option value="pool">PERIOD POOL</option>
                <option value="ingredient">INGREDIENT LINK</option>
              </select>

              <input placeholder="UNIT LABEL" value={draft.unit_label} onChange={(e) => setDraft({ ...draft, unit_label: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3" />

              {draft.mode === "ingredient" ? (
                <>
                  <select value={draft.ingredient_id} onChange={(e) => setDraft({ ...draft, ingredient_id: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3">
                    <option value="">SELECT F&B INGREDIENT</option>
                    {(data?.ingredients ?? []).map((x: Row) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <input placeholder="SHARE / ALLOCATION" value={draft.ingredient_rate} onChange={(e) => setDraft({ ...draft, ingredient_rate: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3" />
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input placeholder="BASE AMOUNT" value={draft.base_amount} onChange={(e) => setDraft({ ...draft, base_amount: e.target.value })} className="min-w-0 flex-1 rounded-[9px] border border-black/15 px-3 py-3" />
                    <select value={draft.base_currency} onChange={(e) => setDraft({ ...draft, base_currency: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3"><option>USD</option><option>LBP</option></select>
                  </div>
                  <input placeholder="ALLOCATIONS / DIVISOR" value={draft.divisor} onChange={(e) => setDraft({ ...draft, divisor: e.target.value })} className="rounded-[9px] border border-black/15 px-3 py-3" />
                </>
              )}

              <textarea placeholder="NOTES" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="sm:col-span-2 rounded-[9px] border border-black/15 px-3 py-3" />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-[9px] border border-black/15 px-4 py-3 text-[11px] font-black uppercase">CANCEL</button>
              <button disabled={busy} className="rounded-[9px] bg-black px-5 py-3 text-[11px] font-black uppercase text-white">{busy ? "SAVING..." : "SAVE UTILITY"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </BOFrame>
  );
}
