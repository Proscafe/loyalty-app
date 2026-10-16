"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BOFrame } from "../BOFrame";
import { moneyLbp, moneyUsd } from "../format";

type Row = Record<string, any>;

const EMPTY = {
  name: "",
  category_id: "",
  purchase_unit: "",
  purchase_qty: "",
  price: "",
  price_currency: "USD",
  supplier_id: "",
  new_supplier: "",
  brand: "",
  pack_size: "",
  consumption_unit: "",
  notes: "",
};

export function FnbClient() {
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState("");
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<any>({ ...EMPTY });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    const res = await fetch("/api/bo/fnb", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) setError(json?.error || "Unable to load F&B.");
    else setData(json);
  }

  useEffect(() => { void load(); }, []);

  const brands = useMemo<string[]>(
    () =>
      Array.from(
        new Set<string>(
          (data?.ingredients ?? [])
            .map((row: Row) => String(row.brand ?? "").trim())
            .filter((value: string) => Boolean(value)),
        ),
      ).sort(),
    [data],
  );

  const units = useMemo<string[]>(
    () =>
      Array.from(
        new Set<string>(
          (data?.ingredients ?? [])
            .map((row: Row) => String(row.purchase_unit ?? "").trim())
            .filter((value: string) => Boolean(value)),
        ),
      ).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (data?.ingredients ?? []).filter((row: Row) => {
      if (
        q &&
        ![
          row.name,
          row.category_name,
          row.supplier_name,
          row.brand,
          row.purchase_unit,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      ) return false;

      if (category && String(row.category_id ?? "") !== category) return false;
      if (supplier && String(row.supplier_id ?? "") !== supplier) return false;
      if (brand && String(row.brand ?? "") !== brand) return false;
      if (unit && String(row.purchase_unit ?? "") !== unit) return false;
      if (missing && row.price !== null && Number(row.price) > 0) return false;

      return true;
    });
  }, [data, search, category, supplier, brand, unit, missing]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of filtered) {
      const group = row.category_name || "UNCATEGORISED";
      map.set(group, [...(map.get(group) ?? []), row]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function resetFilters() {
    setSearch("");
    setCategory("");
    setSupplier("");
    setBrand("");
    setUnit("");
    setMissing(false);
  }

  function startAdd() {
    setEditing(null);
    setDraft({ ...EMPTY });
    setOpen(true);
  }

  function startEdit(row: Row) {
    setEditing(row);
    setDraft({
      name: row.name ?? "",
      category_id: row.category_id ? String(row.category_id) : "",
      purchase_unit: row.purchase_unit ?? "",
      purchase_qty: row.purchase_qty ?? "",
      price: row.price ?? "",
      price_currency: row.price_currency ?? "USD",
      supplier_id: row.supplier_id ? String(row.supplier_id) : "",
      new_supplier: "",
      brand: row.brand ?? "",
      pack_size: row.pack_size ?? "",
      consumption_unit: row.consumption_unit ?? "",
      notes: row.notes ?? "",
    });
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const res = await fetch(
      editing ? `/api/bo/fnb/${editing.id}` : "/api/bo/fnb",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          category_id: draft.category_id || null,
          supplier_id: draft.supplier_id || null,
          purchase_qty: draft.purchase_qty || null,
          price: draft.price || null,
          pack_size: draft.pack_size || null,
        }),
      },
    );

    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(json?.error || "Unable to save ingredient.");
      return;
    }

    setOpen(false);
    await load();
  }

  async function remove(row: Row) {
    if (!confirm(`Delete "${row.name}"?`)) return;
    const res = await fetch(`/api/bo/fnb/${row.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) setError(json?.error || "Unable to delete ingredient.");
    else await load();
  }

  return (
    <BOFrame
      active="/bo/fnb"
      title="F&B"
      subtitle={`${data?.ingredients?.length ?? 0} ingredients · grouped list`}
      actions={
        <button
          onClick={startAdd}
          className="rounded-[10px] bg-black px-4 py-3 text-[11px] font-black uppercase text-white hover:bg-black/80"
        >
          ADD INGREDIENT
        </button>
      }
    >
      {error ? (
        <div className="mb-4 rounded-[10px] border border-black/10 bg-white px-4 py-3 text-[12px] font-bold">
          {error}
        </div>
      ) : null}

      <section className="mb-4 rounded-[16px] border border-black/10 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH"
            className="rounded-[9px] border border-black/15 bg-white px-3 py-2.5 text-[12px] font-bold outline-none focus:border-black"
          />

          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-[9px] border border-black/15 bg-white px-3 py-2.5 text-[11px] font-bold">
            <option value="">ALL CATEGORIES</option>
            {(data?.categories ?? []).map((row: Row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>

          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="rounded-[9px] border border-black/15 bg-white px-3 py-2.5 text-[11px] font-bold">
            <option value="">ALL SUPPLIERS</option>
            {(data?.suppliers ?? []).map((row: Row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>

          <select value={brand} onChange={(e) => setBrand(e.target.value)} className="rounded-[9px] border border-black/15 bg-white px-3 py-2.5 text-[11px] font-bold">
            <option value="">ALL BRANDS</option>
            {brands.map((value) => <option key={value}>{value}</option>)}
          </select>

          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-[9px] border border-black/15 bg-white px-3 py-2.5 text-[11px] font-bold">
            <option value="">ALL UNITS</option>
            {units.map((value) => <option key={value}>{value}</option>)}
          </select>

          <div className="flex gap-2">
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-[9px] border border-black/15 px-3 text-[10px] font-black uppercase">
              <input type="checkbox" checked={missing} onChange={(e) => setMissing(e.target.checked)} className="accent-black" />
              MISSING PRICE
            </label>
            <button type="button" onClick={resetFilters} className="rounded-[9px] border border-black/15 px-3 text-[10px] font-black uppercase hover:bg-black hover:text-white">
              RESET
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {grouped.map(([group, rows]) => (
          <section key={group} className="overflow-hidden rounded-[14px] border border-black/10 bg-white">
            <div className="flex items-center justify-between border-b border-black/10 bg-[#efefef] px-4 py-3">
              <h2 className="text-[11px] font-black uppercase tracking-[0.06em]">{group}</h2>
              <span className="text-[10px] font-black text-black/40">{rows.length} ITEMS</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] border-collapse text-left">
                <thead className="text-[9px] font-black uppercase tracking-[0.04em] text-black/45">
                  <tr>
                    <th className="px-4 py-3">ITEM</th>
                    <th className="px-3 py-3">UNIT</th>
                    <th className="px-3 py-3 text-right">QTY</th>
                    <th className="px-3 py-3 text-right">PRICE USD</th>
                    <th className="px-3 py-3 text-right">PRICE LBP</th>
                    <th className="px-3 py-3">SUPPLIER</th>
                    <th className="px-3 py-3">BRAND</th>
                    <th className="px-3 py-3 text-right">PACK</th>
                    <th className="px-3 py-3 text-right">COST / UNIT</th>
                    <th className="px-4 py-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: Row) => (
                    <tr key={row.id} className="border-t border-black/[0.07] text-[11px] hover:bg-black/[0.025]">
                      <td className="px-4 py-3 font-black">{row.name}</td>
                      <td className="px-3 py-3 text-black/60">{row.purchase_unit || "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.purchase_qty ?? "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{moneyUsd(row.price_usd)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{moneyLbp(row.price_lbp)}</td>
                      <td className="px-3 py-3">{row.supplier_name || "—"}</td>
                      <td className="px-3 py-3">{row.brand || "—"}</td>
                      <td className="px-3 py-3 text-right">{row.pack_size ? `${row.pack_size} ${row.consumption_unit || ""}` : "—"}</td>
                      <td className="px-3 py-3 text-right font-black">{moneyLbp(row.cost_per_consumption_unit)}</td>
                      <td className="px-4 py-3"><div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(row)} className="rounded-[8px] border border-black/15 px-3 py-2 text-[10px] font-black uppercase hover:bg-black hover:text-white">EDIT</button>
                        <button onClick={() => void remove(row)} className="rounded-[8px] border border-black/10 px-3 py-2 text-[10px] font-black uppercase text-black/50 hover:text-black">DELETE</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

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
    </BOFrame>
  );
}
