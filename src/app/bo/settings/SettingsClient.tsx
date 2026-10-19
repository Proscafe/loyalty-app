"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BOFrame } from "../BOFrame";
import { MENU_FAMILIES, menuFamily } from "@/lib/bo/menuFamily";
import { downloadAllProductionPdf } from "../downloadAllProductionPdf";
import { downloadAllMenuRecipesPdf } from "../downloadAllMenuRecipesPdf";

type ListKey = "ingredient_categories" | "menu_categories" | "suppliers";
type Item = { id: number; name: string; sort?: number | null; family?: string | null };
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
  const [lbpRounding, setLbpRounding] = useState("1");
  const [usdRounding, setUsdRounding] = useState("0.01");
  const [setupOpen, setSetupOpen] = useState(false);
  const [newMenuFamily, setNewMenuFamily] = useState<"Food" | "Beverage" | "Hooka">("Food");
  const [recipeDownloadsOpen, setRecipeDownloadsOpen] = useState(false);
  const [productionDownloadsOpen, setProductionDownloadsOpen] = useState(false);
  const [greenThreshold, setGreenThreshold] = useState("30");
  const [amberThreshold, setAmberThreshold] = useState("35");
  const [newNames, setNewNames] = useState<Record<ListKey, string>>({ ingredient_categories: "", menu_categories: "", suppliers: "" });
  const [busy, setBusy] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<ListKey, boolean>>({ ingredient_categories: false, menu_categories: false, suppliers: false });
  const allSectionsCollapsed = SECTIONS.every(({ key }) => collapsedSections[key]);
  const [transfer, setTransfer] = useState<{ section: ListKey; item: Item; counts: Record<string, number>; total: number } | null>(null);
  const [destination, setDestination] = useState("");
  const [viewing, setViewing] = useState<{ section: ListKey; item: Item; counts?: Record<string, number>; total?: number } | null>(null);
  const [editingItem, setEditingItem] = useState<{ section: ListKey; item: Item } | null>(null);
  const [editName, setEditName] = useState("");
  const [editPosition, setEditPosition] = useState("1");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedRecipeCategories, setSelectedRecipeCategories] = useState<number[]>([]);
  const [pdfBusy, setPdfBusy] = useState<"priced" | "plain" | "recipes-priced" | "recipes-plain" | null>(null);

  async function exportProductionPdf(withPrices: boolean) {
    setPdfBusy(withPrices ? "priced" : "plain"); setError("");
    try {
      const response = await fetch("/api/bo/recipes", { cache: "no-store" });
      const result = await apiJson(response);
      await downloadAllProductionPdf(result, withPrices);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to export Production PDF."); }
    finally { setPdfBusy(null); }
  }

  async function exportMenuRecipesPdf(withPrices: boolean) {
    if (!selectedRecipeCategories.length) { setError("Select at least one menu category before exporting recipes."); return; }
    setPdfBusy(withPrices ? "recipes-priced" : "recipes-plain"); setError("");
    try {
      const [recipesResponse, menuResponse] = await Promise.all([
        fetch("/api/bo/recipes", { cache: "no-store" }),
        fetch("/api/bo/menu", { cache: "no-store" }),
      ]);
      const recipesData = await apiJson(recipesResponse);
      const menuData = await apiJson(menuResponse);
      await downloadAllMenuRecipesPdf({
        recipes: recipesData.recipes ?? [],
        all_recipes: recipesData.all_recipes ?? recipesData.recipes ?? [],
        ingredients: recipesData.ingredients ?? [],
        items: menuData.items ?? menuData.menuItems ?? [],
        categories: data?.menu_categories ?? menuData.categories ?? [],
        utilities: recipesData.utilities ?? [],
        rate: Number(menuData.usd_lbp_rate ?? recipesData.usd_lbp_rate ?? data?.settings?.usd_lbp_rate ?? 0),
      }, withPrices, "menu", selectedRecipeCategories);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to export menu recipes."); }
    finally { setPdfBusy(null); }
  }

  const load = useCallback(async (updateRate = false) => {
    const result = await apiJson(await fetch("/api/bo/settings", { cache: "no-store" })) as SettingsResponse;
    setData({ ...result,
      ingredient_categories: [...(result.ingredient_categories ?? [])].sort(alphabetically),
      menu_categories: [...(result.menu_categories ?? [])],
      suppliers: [...(result.suppliers ?? [])].sort(alphabetically),
    });
    setSelectedRecipeCategories(prev => prev.length ? prev.filter(id => (result.menu_categories ?? []).some((c: Item) => Number(c.id) === id)) : (result.menu_categories ?? []).map((c: Item) => Number(c.id)));
    if (updateRate) {
      setRate(String(result.settings?.usd_lbp_rate ?? ""));
      setLbpRounding(String(result.settings?.lbp_rounding ?? "1"));
      setUsdRounding(String(result.settings?.usd_rounding ?? "0.01"));
      setGreenThreshold(String(Number(result.settings?.food_cost_threshold ?? "0.30") * 100));
      setAmberThreshold(String(Number(result.settings?.bar_cost_threshold ?? "0.35") * 100));
    }
  }, []);

  useEffect(() => {
    void load(true).catch(e => setError(e instanceof Error ? e.message : "Unable to load Settings."));
  }, [load]);

  async function saveRate(e: FormEvent) {
    e.preventDefault();
    const value = Number(rate.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) { setError("Enter a valid USD to LBP exchange rate greater than zero."); return; }
    const green = Number(greenThreshold), amber = Number(amberThreshold);
    if (!Number.isFinite(green) || !Number.isFinite(amber) || green < 0 || green > amber || amber > 100) { setError("Food-cost guide: Good must be less than or equal to Watch. For example, Good 30% and Watch 35% (not Good 40% and Watch 30%)."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(await fetch("/api/bo/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { usd_lbp_rate: String(value), lbp_rounding: lbpRounding, usd_rounding: usdRounding, food_cost_threshold: String(green / 100), bar_cost_threshold: String(amber / 100) } }),
      }));
      await load(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pros_bo_currency_rounding", JSON.stringify({ lbp: Number(lbpRounding), usd: Number(usdRounding) }));
        window.dispatchEvent(new Event("pros-bo-rounding-changed"));
        window.localStorage.setItem("pros_bo_food_cost_thresholds", JSON.stringify({ good: green / 100, watch: amber / 100 }));
      }
      setMessage("Exchange rate and display rounding preferences saved. Refresh other open tabs to apply.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save exchange rate."); }
    finally { setBusy(false); }
  }

  async function mutate(action: "create" | "rename" | "delete", section: ListKey, item?: Item) {
    let name = "";
    if (action === "create") name = newNames[section].trim();
    if (action === "rename") name = editName.trim();
    const position = action === "rename" && section === "menu_categories" ? Number(editPosition) : undefined;
    if (position !== undefined && (!Number.isSafeInteger(position) || position < 1 || position > (data?.menu_categories.length ?? 0))) { setError(`Position must be between 1 and ${data?.menu_categories.length ?? 0}.`); return; }
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
      const saved = await apiJson(await fetch("/api/bo/settings", {
        method: action === "create" ? "POST" : action === "rename" ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, id: item?.id, name, ...(action === "create" && section === "menu_categories" ? { family: newMenuFamily } : {}), ...(position !== undefined ? { position } : {}) }),
      }));
      await load();
      if (action === "rename" && section === "menu_categories" && position !== undefined) {
        const verified = (saved.menu_categories ?? []).findIndex((row: Item) => Number(row.id) === Number(item?.id)) + 1;
        if (verified !== position) throw new Error(`Requested position ${position} was not verified. Please refresh Settings.`);
      }
      if (action === "create") setNewNames(current => ({ ...current, [section]: "" }));
      if (action === "rename") setEditingItem(null);
      setMessage(action === "create" ? `“${name}” added.` : action === "rename" ? `“${name}” saved${position !== undefined ? ` at position ${position}` : ""}.` : `“${item?.name}” deleted.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update list."); }
    finally { setBusy(false); }
  }

  async function moveMenuCategory(item: Item, direction: "up" | "down") {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(await fetch("/api/bo/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder_menu_category", id: item.id, direction }),
      }));
      await load();
      setMessage(`“${item.name}” moved ${direction}. Menu Pricing will show this order after refresh.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reorder Menu Categories.");
      await load().catch(() => {});
    } finally { setBusy(false); }
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
        <label className="w-full max-w-[260px] text-left">
          <span className="mb-2 block text-left text-[11px] font-bold uppercase text-black/70">LBP DISPLAY ROUNDING</span>
          <select value={lbpRounding} onChange={e => setLbpRounding(e.target.value)} className="w-full rounded-lg border border-black/20 bg-white px-3 py-3 text-sm font-semibold text-black">
            <option value="1">Exact LBP (1)</option>
            <option value="100">Nearest 100 LBP</option>
            <option value="500">Nearest 500 LBP</option>
            <option value="1000">Nearest 1,000 LBP</option>
            <option value="5000">Nearest 5,000 LBP</option>
            <option value="10000">Nearest 10,000 LBP</option>
          </select>

        </label>
        <label className="w-full max-w-[260px] text-left">
          <span className="mb-2 block text-left text-[11px] font-bold uppercase text-black/70">USD DISPLAY ROUNDING</span>
          <select value={usdRounding} onChange={e => setUsdRounding(e.target.value)} className="w-full rounded-lg border border-black/20 bg-white px-3 py-3 text-sm font-semibold text-black">
            <option value="0.01">Nearest $0.01</option>
            <option value="0.05">Nearest $0.05</option>
            <option value="0.1">Nearest $0.10</option>
            <option value="0.5">Nearest $0.50</option>
            <option value="1">Nearest $1.00</option>
          </select>
        </label>
        <button type="submit" disabled={busy} className="rounded-lg bg-black px-5 py-3 text-xs font-bold uppercase text-white hover:bg-black/80 disabled:opacity-50">{busy ? "SAVING..." : "SAVE SETTINGS"}</button>
        <div className="w-full border-t border-black/10 pt-3">
          <div className="mb-2 text-[11px] font-bold uppercase text-black/70">Food-cost guide</div>
          <div className="flex flex-wrap items-end gap-4 text-xs">
            <label className="font-semibold text-emerald-700">Good ≤ <input type="number" min="0" max={amberThreshold} step="1" value={greenThreshold} onChange={e => setGreenThreshold(e.target.value)} className="ml-1 w-16 rounded-lg border border-black/20 bg-white px-2 py-2 text-black" /> %</label>
            <label className="font-semibold text-amber-700">Watch ≤ <input type="number" min={greenThreshold} max="100" step="1" value={amberThreshold} onChange={e => setAmberThreshold(e.target.value)} className="ml-1 w-16 rounded-lg border border-black/20 bg-white px-2 py-2 text-black" /> %</label>
            <span className="pb-2 font-semibold text-red-700">High &gt; {amberThreshold || "35"}%</span>

          </div>
        </div>
      </form>

      <section className="mb-4 rounded-2xl border border-black/10 bg-white p-4 sm:p-5" aria-label="Production PDF exports">
        <button type="button" onClick={() => setProductionDownloadsOpen(v => !v)} aria-expanded={productionDownloadsOpen} className="flex w-full items-center justify-between gap-2 text-left"><span><h2 className="text-sm font-black uppercase text-black">Production Downloads</h2><span className="mt-1 block text-xs font-normal text-black/60">Export preparations and sauces with or without prices.</span></span><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/20 text-lg font-bold">{productionDownloadsOpen ? "−" : "+"}</span></button>
        {productionDownloadsOpen && <div className="mt-3"><p className="mb-3 text-xs text-black/60">Download all preparations and sauces in one PDF, including ingredients, quantities, yields and notes.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={pdfBusy !== null} onClick={() => void exportProductionPdf(true)} className="rounded-lg bg-black px-4 py-3 text-xs font-bold text-white disabled:opacity-40">{pdfBusy === "priced" ? "GENERATING..." : "DOWNLOAD PDF WITH PRICES"}</button>
          <button type="button" disabled={pdfBusy !== null} onClick={() => void exportProductionPdf(false)} className="rounded-lg border border-black/20 bg-white px-4 py-3 text-xs font-bold text-black disabled:opacity-40">{pdfBusy === "plain" ? "GENERATING..." : "DOWNLOAD PDF WITHOUT PRICES"}</button>
        </div>
        </div>}
      </section>

      <section className="mb-4 rounded-2xl border border-black/10 bg-white p-4 sm:p-6" aria-label="Menu Recipes PDF exports">
        <button type="button" aria-expanded={recipeDownloadsOpen} onClick={() => setRecipeDownloadsOpen(v => !v)} className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-3 text-left hover:bg-gray-50">
          <span><span className="block text-base font-black uppercase text-black">Recipe Downloads</span><span className="mt-1 block text-xs text-black/60">Export selected active menu recipes with or without prices. Priced PDFs include utility costs.</span></span>
          <span className="shrink-0 rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-bold">{recipeDownloadsOpen ? "−" : "+"}</span>
        </button>
        {recipeDownloadsOpen && <div className="pt-3">
        <div className="mb-4 rounded-xl border border-black/10 bg-gray-50 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-black">
              <input type="checkbox" className="h-4 w-4 accent-black" checked={!!data?.menu_categories.length && selectedRecipeCategories.length === data.menu_categories.length}
                onChange={e => setSelectedRecipeCategories(e.target.checked ? (data?.menu_categories ?? []).map(c => Number(c.id)) : [])} />
              SELECT ALL CATEGORIES
            </label>
            <span className="text-xs text-black/60">{selectedRecipeCategories.length} of {data?.menu_categories.length ?? 0} selected</span>
          </div>
          <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
            {[...(data?.menu_categories ?? [])].sort(alphabetically).map(category =>
              <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-100">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-black" checked={selectedRecipeCategories.includes(Number(category.id))}
                  onChange={e => setSelectedRecipeCategories(prev => e.target.checked ? [...prev, Number(category.id)] : prev.filter(id => id !== Number(category.id)))} />
                <span>{category.name}</span>
              </label>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={pdfBusy !== null || !selectedRecipeCategories.length} onClick={() => void exportMenuRecipesPdf(true)} className="rounded-lg bg-black px-4 py-3 text-xs font-bold text-white disabled:opacity-40">{pdfBusy === "recipes-priced" ? "GENERATING..." : "DOWNLOAD ALL RECIPES WITH PRICES"}</button>
          <button type="button" disabled={pdfBusy !== null || !selectedRecipeCategories.length} onClick={() => void exportMenuRecipesPdf(false)} className="rounded-lg border border-black/20 bg-white px-4 py-3 text-xs font-bold text-black disabled:opacity-40">{pdfBusy === "recipes-plain" ? "GENERATING..." : "DOWNLOAD ALL RECIPES WITHOUT PRICES"}</button>
        </div>
        </div>}
      </section>

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
          <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4"><button type="button" onClick={() => setViewing(null)} className="rounded-lg border border-black/20 px-4 py-2.5 text-xs font-bold">CLOSE</button><button type="button" onClick={() => { setEditName(viewing.item.name); setEditPosition(String((data?.menu_categories ?? []).findIndex(x => x.id === viewing.item.id) + 1)); setEditingItem({ section: viewing.section, item: viewing.item }); setViewing(null); }} className="rounded-lg bg-black px-4 py-2.5 text-xs font-bold text-white">EDIT</button></div>
        </div>
      </div>}

      {editingItem && <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setEditingItem(null); }}>
        <form role="dialog" aria-modal="true" aria-label={`Edit ${editingItem.item.name}`} onSubmit={e => { e.preventDefault(); void mutate("rename", editingItem.section, editingItem.item); }} className="w-full max-w-[500px] overflow-hidden rounded-2xl border border-black/15 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-black/10 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-black/50">{SECTIONS.find(s => s.key === editingItem.section)?.title}</p><h2 className="mt-1 text-xl font-black">Edit {editingItem.section === "menu_categories" ? "menu category" : "name"}</h2></div><button type="button" aria-label="Close edit" onClick={() => setEditingItem(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/15 text-lg">×</button></div>
          <div className="p-5"><label className="block text-xs font-bold uppercase text-black/70">Name<input autoFocus maxLength={160} value={editName} onChange={e => setEditName(e.target.value)} className="mt-2 w-full rounded-lg border border-black/25 bg-white px-3 py-3 text-sm font-medium text-black outline-none focus:border-black" /></label>{editingItem.section === "menu_categories" && <label className="mt-4 block text-xs font-bold uppercase text-black/70">Display position <span className="font-normal normal-case text-black/50">(1 = first; {data?.menu_categories.length ?? 0} = last)</span><input type="number" min={1} max={data?.menu_categories.length ?? 0} step={1} value={editPosition} onChange={e => setEditPosition(e.target.value)} className="mt-2 w-full rounded-lg border border-black/25 bg-white px-3 py-3 text-sm font-medium text-black outline-none focus:border-black" /></label>}</div>
          <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4"><button type="button" disabled={busy} onClick={() => setEditingItem(null)} className="rounded-lg border border-black/20 px-4 py-2.5 text-xs font-bold">CANCEL</button><button type="submit" disabled={busy || !editName.trim() || (editName.trim() === editingItem.item.name && (editingItem.section !== "menu_categories" || Number(editPosition) === (data?.menu_categories.findIndex(x => x.id === editingItem.item.id) ?? -1) + 1))} className="rounded-lg bg-black px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{busy ? "SAVING..." : "SAVE CHANGES"}</button></div>
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

      <section className="mb-4 rounded-2xl border border-black/10 bg-white p-4 sm:p-5" aria-label="Setup management">
        <button type="button" onClick={() => setSetupOpen(v => !v)} aria-expanded={setupOpen} aria-controls="bo-settings-setup" className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left hover:bg-gray-50">
          <span><span className="block text-base font-black uppercase text-black">Setup</span><span className="mt-1 block text-xs font-normal normal-case text-black/60">Manage ingredient categories, menu categories and suppliers.</span></span>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/20 bg-white text-lg font-bold" aria-hidden="true">{setupOpen ? "−" : "+"}</span>
        </button>
        {setupOpen && <div id="bo-settings-setup" className="pt-4">
      <div className="mb-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setCollapsedSections({ ingredient_categories: !allSectionsCollapsed, menu_categories: !allSectionsCollapsed, suppliers: !allSectionsCollapsed })}
          aria-label={allSectionsCollapsed ? "Expand all settings sections" : "Collapse all settings sections"}
          title={allSectionsCollapsed ? "Expand all sections" : "Collapse all sections"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/20 bg-white text-lg font-bold text-black hover:bg-gray-100"
        >
          {allSectionsCollapsed ? "+" : "−"}

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
            {key === "menu_categories" && <div className="mb-3" role="group" aria-label="Choose a family for the new menu category">
              <p className="mb-2 text-[11px] font-semibold text-black/65">Add new category to:</p>
              <div className="grid grid-cols-3 gap-2">{MENU_FAMILIES.map(family => <button type="button" key={family} aria-pressed={newMenuFamily === family} onClick={() => setNewMenuFamily(family)} className={`rounded-lg border px-2 py-2.5 text-center text-[11px] font-bold transition ${newMenuFamily === family ? "border-[#25206F] bg-[#25206F] text-white shadow-sm" : "border-black/10 bg-[#f3f3fa] text-[#25206F] hover:border-[#25206F]/50"}`}>{family.toUpperCase()} <span className={newMenuFamily === family ? "text-white/70" : "text-black/50"}>({(data?.menu_categories ?? []).filter(c => (c.family ?? menuFamily(c.name)) === family).length})</span></button>)}</div>
              <p className="mt-1.5 text-[11px] text-black/50">Selected: {newMenuFamily}. The new category will be saved under this family.</p>
            </div>}
            <form onSubmit={e => { e.preventDefault(); void mutate("create", key); }} className="mb-3 flex items-center gap-2">
              <input aria-label={`New ${title.toLowerCase()} name`} value={newNames[key]} onChange={e => setNewNames(previous => ({ ...previous, [key]: e.target.value }))} placeholder="Add new..." className="min-w-0 flex-1 rounded-lg border border-black/20 bg-white px-3 py-2.5 text-xs text-black outline-none focus:border-black" />
              <button type="submit" disabled={busy || !newNames[key].trim()} className="shrink-0 rounded-lg bg-black px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">ADD</button>
            </form>
            {key === "menu_categories" && <p className="mb-2 text-[11px] text-black/60">Edit a category and enter its exact position (for example, 2). Other categories shift automatically. Save once; Menu Pricing cards follow this order.</p>}
            <div className="max-h-[460px] space-y-1.5 overflow-y-auto">
              {(data?.[key] ?? []).map((item, index) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-black/5 bg-gray-50 px-3 py-2">
                  {key === "menu_categories" && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-black/10 bg-white text-[11px] font-bold tabular-nums text-black/70">{index + 1}</span>}
                  <span className="min-w-0 flex-1 break-words text-xs font-medium text-black">{item.name}{key === "menu_categories" && <span className="ml-2 rounded-md bg-[#f0f0fa] px-1.5 py-1 text-[10px] font-semibold text-[#25206F]">{item.family ?? menuFamily(item.name)}</span>}</span>
                  {key === "menu_categories" && <div className="flex shrink-0 flex-col gap-0.5">
                    <button type="button" disabled={busy || index === 0} onClick={() => void moveMenuCategory(item, "up")} aria-label={`Move ${item.name} up`} title="Move category up" className="flex h-5 w-7 items-center justify-center rounded border border-black/15 bg-white text-xs font-bold disabled:opacity-25">↑</button>
                    <button type="button" disabled={busy || index === (data?.menu_categories.length ?? 0) - 1} onClick={() => void moveMenuCategory(item, "down")} aria-label={`Move ${item.name} down`} title="Move category down" className="flex h-5 w-7 items-center justify-center rounded border border-black/15 bg-white text-xs font-bold disabled:opacity-25">↓</button>
                  </div>}
                  <button type="button" disabled={busy} onClick={() => void openView(key, item)} title={`View ${item.name}`} aria-label={`View ${item.name}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-black hover:bg-gray-100 disabled:opacity-40">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button type="button" disabled={busy} onClick={() => { setEditName(item.name); setEditPosition(String(index + 1)); setEditingItem({ section: key, item }); }} title={`Edit ${item.name}`} aria-label={`Edit ${item.name}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-black hover:bg-gray-100 disabled:opacity-40">
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
        </div>}
      </section>
    </BOFrame>
  );
}
