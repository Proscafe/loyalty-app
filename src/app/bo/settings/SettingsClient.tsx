"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BOFrame } from "../BOFrame";

type ListKey = "ingredient_categories" | "menu_categories" | "suppliers";
type Item = { id: number; name: string; sort?: number | null };
type SettingsResponse = {
  settings: Record<string, string>;
  ingredient_categories: Item[];
  menu_categories: Item[];
  suppliers: Item[];
};

const alphabetically = (a: Item, b: Item) => String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base", numeric: true });

const SECTIONS: { key: ListKey; title: string }[] = [
  { key: "ingredient_categories", title: "INGREDIENT CATEGORIES" },
  { key: "menu_categories", title: "MENU CATEGORIES" },
  { key: "suppliers", title: "SUPPLIERS" },
];

async function apiJson(response: Response) {
  const raw = await response.text();
  let result: any;
  try { result = raw ? JSON.parse(raw) : null; } catch {
    throw new Error(`Settings API returned HTTP ${response.status} instead of JSON.`);
  }
  if (!response.ok) throw new Error(result?.error || `Settings API error: HTTP ${response.status}.`);
  return result;
}

export function SettingsClient() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [rate, setRate] = useState("");
  const [newNames, setNewNames] = useState<Record<ListKey, string>>({ ingredient_categories: "", menu_categories: "", suppliers: "" });
  const [busy, setBusy] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<ListKey, boolean>>({ ingredient_categories: false, menu_categories: false, suppliers: false });
  const allSectionsCollapsed = SECTIONS.every(({ key }) => collapsedSections[key]);
  const [transfer, setTransfer] = useState<{ section: ListKey; item: Item; counts: Record<string, number>; total: number } | null>(null);
  const [destination, setDestination] = useState("");
  const [viewing, setViewing] = useState<{ section: ListKey; item: Item; counts?: Record<string, number>; total?: number } | null>(null);
  const [editingItem, setEditingItem] = useState<{ section: ListKey; item: Item } | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (updateRate = false) => {
    const result = await apiJson(await fetch("/api/bo/settings", { cache: "no-store" })) as SettingsResponse;
    setData({ ...result,
      ingredient_categories: [...(result.ingredient_categories ?? [])].sort(alphabetically),
      menu_categories: [...(result.menu_categories ?? [])].sort(alphabetically),
      suppliers: [...(result.suppliers ?? [])].sort(alphabetically),
    });
    if (updateRate) setRate(String(result.settings?.usd_lbp_rate ?? ""));
  }, []);

  useEffect(() => {
    void load(true).catch(e => setError(e instanceof Error ? e.message : "Unable to load Settings."));
  }, [load]);

  async function saveRate(e: FormEvent) {
    e.preventDefault();
    const value = Number(rate.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) { setError("Enter a valid USD to LBP exchange rate greater than zero."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(await fetch("/api/bo/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { usd_lbp_rate: String(value) } }),
      }));
      await load(true);
      setMessage("Exchange rate saved successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save exchange rate."); }
    finally { setBusy(false); }
  }

  async function mutate(action: "create" | "rename" | "delete", section: ListKey, item?: Item) {
    let name = "";
    if (action === "create") name = newNames[section].trim();
    if (action === "rename") name = editName.trim();
    if (action !== "delete" && !name) { setError("Enter a name before saving."); return; }
    if (action === "delete" && section !== "suppliers" && item) {
      setBusy(true); setError(""); setMessage("");
      try {
        const result = await apiJson(await fetch("/api/bo/settings", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "inspect_delete", section, id: item.id }),
        }));
        setDestination("");
        setTransfer({ section, item, counts: result.counts, total: result.total });
      } catch (e) { setError(e instanceof Error ? e.message : "Unable to inspect category assignments."); }
      finally { setBusy(false); }
      return;
    }
    if (action === "delete" && !window.confirm(`Delete “${item?.name}”? If it is used by existing items, deletion will be blocked.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(await fetch("/api/bo/settings", {
        method: action === "create" ? "POST" : action === "rename" ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, id: item?.id, name }),
      }));
      await load();
      if (action === "create") setNewNames(current => ({ ...current, [section]: "" }));
      if (action === "rename") setEditingItem(null);
      setMessage(action === "create" ? `“${name}” added.` : action === "rename" ? `Name changed to “${name}”.` : `“${item?.name}” deleted.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update list."); }
    finally { setBusy(false); }
  }

  async function openView(section: ListKey, item: Item) {
    setError("");
    setViewing({ section, item });
    if (section === "suppliers") return;
    try {
      const result = await apiJson(await fetch("/api/bo/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "inspect_delete", section, id: item.id }),
      }));
      setViewing(current => current?.item.id === item.id && current.section === section
        ? { ...current, counts: result.counts, total: result.total } : current);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load category details."); }
  }

  async function confirmTransferDelete() {
    if (!transfer) return;
    if (transfer.total > 0 && !destination) { setError("Choose a destination category first."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiJson(await fetch("/api/bo/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transfer_delete", section: transfer.section, id: transfer.item.id,
          destination_id: transfer.total > 0 ? Number(destination) : null }),
      }));
      const name = transfer.item.name;
      setTransfer(null); setDestination("");
      await load();
      setMessage(result.total ? `Transferred ${result.total} assignments and deleted “${name}”.` : `“${name}” deleted.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to transfer and delete category."); await load(); }
    finally { setBusy(false); }
  }

  return (
    <BOFrame active="/bo/settings" title="SETTINGS" subtitle="Exchange rate, categories and suppliers.">
      {error && <div role="alert" className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">{error}</div>}
      {message && <div role="status" className="mb-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-xs font-semibold text-black">{message}</div>}

      <form onSubmit={saveRate} className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-black/10 bg-white p-4">
        <label className="w-full max-w-[420px] text-left">
          <span className="mb-2 block text-left text-[11px] font-bold uppercase text-black/70">USD → LBP RATE</span>
          <input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="90000" className="w-full rounded-lg border border-black/20 bg-white px-3 py-3 text-sm font-semibold text-black outline-none focus:border-black" />
        </label>
        <button type="submit" disabled={busy} className="rounded-lg bg-black px-5 py-3 text-xs font-bold uppercase text-white hover:bg-black/80 disabled:opacity-50">{busy ? "SAVING..." : "SAVE RATE"}</button>
      </form>

      {viewing && <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setViewing(null); }}>
        <div role="dialog" aria-modal="true" aria-label={`View ${viewing.item.name}`} className="w-full max-w-[540px] overflow-hidden rounded-2xl border border-black/15 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-black/50">{SECTIONS.find(s => s.key === viewing.section)?.title}</p><h2 className="mt-1 text-xl font-black text-black">{viewing.item.name}</h2></div>
            <button type="button" aria-label="Close view" onClick={() => setViewing(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/15 text-lg hover:bg-gray-100">×</button>
          </div>
          <div className="space-y-3 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-black/10 bg-gray-50 p-3"><p className="text-[10px] font-bold uppercase text-black/50">Name</p><p className="mt-1 break-words text-sm font-semibold">{viewing.item.name}</p></div>
              <div className="rounded-xl border border-black/10 bg-gray-50 p-3"><p className="text-[10px] font-bold uppercase text-black/50">Record ID</p><p className="mt-1 text-sm font-semibold">{viewing.item.id}</p></div>
            </div>
            {viewing.section !== "suppliers" && <div className="rounded-xl border border-black/10 p-3">
              <p className="mb-2 text-xs font-bold uppercase text-black/70">Items using this category</p>
              {viewing.counts ? <div className="space-y-2">{Object.entries(viewing.counts).map(([label, count]) => <div key={label} className="flex justify-between text-sm"><span className="capitalize text-black/70">{label}</span><strong>{count}</strong></div>)}<div className="flex justify-between border-t border-black/10 pt-2 text-sm font-bold"><span>Total assignments</span><span>{viewing.total ?? 0}</span></div></div> : <p className="text-xs text-black/50">Loading assignments…</p>}
            </div>}
            {viewing.section === "suppliers" && <p className="text-xs text-black/60">Supplier details are read-only here. Use Edit to rename this supplier.</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4"><button type="button" onClick={() => setViewing(null)} className="rounded-lg border border-black/20 px-4 py-2.5 text-xs font-bold">CLOSE</button><button type="button" onClick={() => { setEditName(viewing.item.name); setEditingItem({ section: viewing.section, item: viewing.item }); setViewing(null); }} className="rounded-lg bg-black px-4 py-2.5 text-xs font-bold text-white">EDIT</button></div>
        </div>
      </div>}

      {editingItem && <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setEditingItem(null); }}>
        <form role="dialog" aria-modal="true" aria-label={`Edit ${editingItem.item.name}`} onSubmit={e => { e.preventDefault(); void mutate("rename", editingItem.section, editingItem.item); }} className="w-full max-w-[500px] overflow-hidden rounded-2xl border border-black/15 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-black/10 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-black/50">{SECTIONS.find(s => s.key === editingItem.section)?.title}</p><h2 className="mt-1 text-xl font-black">Edit name</h2></div><button type="button" aria-label="Close edit" onClick={() => setEditingItem(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/15 text-lg">×</button></div>
          <div className="p-5"><label className="block text-xs font-bold uppercase text-black/70">Name<input autoFocus maxLength={160} value={editName} onChange={e => setEditName(e.target.value)} className="mt-2 w-full rounded-lg border border-black/25 bg-white px-3 py-3 text-sm font-medium text-black outline-none focus:border-black" /></label></div>
          <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4"><button type="button" disabled={busy} onClick={() => setEditingItem(null)} className="rounded-lg border border-black/20 px-4 py-2.5 text-xs font-bold">CANCEL</button><button type="submit" disabled={busy || !editName.trim() || editName.trim() === editingItem.item.name} className="rounded-lg bg-black px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{busy ? "SAVING..." : "SAVE CHANGES"}</button></div>
        </form>
      </div>}

      {transfer && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4" role="presentation">
        <div role="dialog" aria-modal="true" aria-label="Transfer category before deletion" className="w-full max-w-[510px] rounded-2xl border border-black/15 bg-white p-5 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-black/10 pb-4"><div><p className="text-[10px] font-bold uppercase text-black/50">TRANSFER BEFORE DELETE</p><h2 className="mt-1 text-xl font-black text-black">{transfer.item.name}</h2></div><button type="button" aria-label="Close transfer" onClick={() => setTransfer(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/20 text-lg">×</button></div>
          <p className="mt-2 text-sm text-black/70">{transfer.total > 0
            ? `This category has ${transfer.total} linked assignments. Choose another category to receive them before deletion.`
            : "This category has no linked items and can be deleted."}</p>
          {transfer.total > 0 && <>
            <div className="mt-4 rounded-xl border border-black/10 bg-gray-50 p-3"><div className="mb-2 text-xs font-bold uppercase text-black/60">Affected assignments</div>{Object.entries(transfer.counts).map(([name, count]) => <div key={name} className="flex justify-between py-1 text-sm"><span className="capitalize">{name}</span><strong>{count}</strong></div>)}</div>
            <label className="mt-4 block text-xs font-bold uppercase text-black/70">Move items to
              <select value={destination} onChange={e => setDestination(e.target.value)} className="mt-2 w-full rounded-lg border border-black/20 bg-white px-3 py-3 text-sm font-normal text-black">
                <option value="">Select destination category</option>
                {(data?.[transfer.section] ?? []).filter(x => x.id !== transfer.item.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          </>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => setTransfer(null)} className="rounded-lg border border-black/20 px-4 py-2.5 text-xs font-bold">CANCEL</button>
            <button type="button" disabled={busy || (transfer.total > 0 && !destination)} onClick={() => void confirmTransferDelete()} className="rounded-lg bg-red-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{busy ? "WORKING..." : transfer.total > 0 ? "TRANSFER & DELETE" : "DELETE CATEGORY"}</button>
          </div>
        </div>
      </div>}

      <div className="mb-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setCollapsedSections({ ingredient_categories: !allSectionsCollapsed, menu_categories: !allSectionsCollapsed, suppliers: !allSectionsCollapsed })}
          aria-label={allSectionsCollapsed ? "Expand all settings sections" : "Collapse all settings sections"}
          title={allSectionsCollapsed ? "Expand all sections" : "Collapse all sections"}
          className="inline-flex items-center gap-2 rounded-lg border border-black/20 bg-white px-3 py-2 text-xs font-bold text-black hover:bg-gray-100"
        >
          {allSectionsCollapsed ? "EXPAND ALL" : "COLLAPSE ALL"}
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            {allSectionsCollapsed && <path d="M12 7v10" />}
            <path d="M7 12h10" />
          </svg>
        </button>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {SECTIONS.map(({ key, title }) => (
          <section key={key} className="min-w-0 rounded-2xl border border-black/10 bg-white p-4">
            <h2 className={`text-left text-xs font-black uppercase text-black ${collapsedSections[key] ? "" : "mb-3"}`}>
              <button type="button" aria-expanded={!collapsedSections[key]} aria-controls={`settings-${key}`}
                onClick={() => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }))}
                className="flex w-full items-center justify-between gap-3 rounded-md py-1 text-left hover:text-black/70">
                <span>{title} <span className="font-medium text-black/50">({data?.[key]?.length ?? 0})</span></span>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M7 12h10" />
                  {collapsedSections[key] && <path d="M12 7v10" />}
                </svg>
              </button>
            </h2>
            {!collapsedSections[key] && <div id={`settings-${key}`}>
            <form onSubmit={e => { e.preventDefault(); void mutate("create", key); }} className="mb-3 flex items-center gap-2">
              <input aria-label={`New ${title.toLowerCase()} name`} value={newNames[key]} onChange={e => setNewNames(previous => ({ ...previous, [key]: e.target.value }))} placeholder="Add new..." className="min-w-0 flex-1 rounded-lg border border-black/20 bg-white px-3 py-2.5 text-xs text-black outline-none focus:border-black" />
              <button type="submit" disabled={busy || !newNames[key].trim()} className="shrink-0 rounded-lg bg-black px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">ADD</button>
            </form>
            <div className="max-h-[460px] space-y-1.5 overflow-y-auto">
              {(data?.[key] ?? []).map(item => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-black/5 bg-gray-50 px-3 py-2">
                  <span className="min-w-0 flex-1 break-words text-xs font-medium text-black">{item.name}</span>
                  <button type="button" disabled={busy} onClick={() => void openView(key, item)} title={`View ${item.name}`} aria-label={`View ${item.name}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-black hover:bg-gray-100 disabled:opacity-40">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button type="button" disabled={busy} onClick={() => { setEditName(item.name); setEditingItem({ section: key, item }); }} title={`Edit ${item.name}`} aria-label={`Edit ${item.name}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-black hover:bg-gray-100 disabled:opacity-40">
                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>
                  </button>
                  <button type="button" disabled={busy} onClick={() => void mutate("delete", key, item)} title={`Delete ${item.name}`} aria-label={`Delete ${item.name}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-40">
                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>
                  </button>
                </div>
              ))}
              {data && !(data[key] ?? []).length && <p className="py-6 text-center text-xs text-black/50">No entries yet.</p>}
            </div>
            </div>}
          </section>
        ))}
      </div>
    </BOFrame>
  );
}
