"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BOFrame } from "../BOFrame";

type Status = "pending" | "confirmed" | "skipped" | "excluded" | "modifier";
type PosMap = { id: number; pos_key: string; pos_name: string; pos_division: string; pos_group: string; status: Status; menu_item_id: number | null; notes: string };
type PosRow = { id: number; pos_key: string; quantity: number; amount_lbp: number; pdf_page: number };
type MenuItem = { id: number; name: string; recipe_id: number | null; menu_category_id: number | null; active: boolean };
type Dataset = { current_import: { period_start: string; period_end: string; branch: string } | null; imports: any[]; mappings: PosMap[]; rows: PosRow[]; menu: MenuItem[] };
const FILTERS: { value: string; name: string }[] = [ { value: "all", name: "All" }, { value: "pending", name: "Needs review" }, { value: "skipped", name: "Skipped" }, { value: "confirmed", name: "Confirmed" }, { value: "modifier", name: "Modifier" }, { value: "excluded", name: "Excluded" } ];
const format = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
async function jsonResponse(res: Response) { const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`); return j; }
// Suggestions are client-side rankings, not approved mappings or probabilities.
const ALIASES: Record<string, string> = {
  miranada: "mirinda", mirenda: "mirinda", miranda: "mirinda", sevenup: "7up", halloum: "halloumi", halloume: "halloumi",
  fries: "fries", chips: "fries", chkn: "chicken", chk: "chicken",
  mozz: "mozzarella", veg: "vegetable", veggies: "vegetable",
  btl: "bottle", btle: "bottle", pcs: "piece", pc: "piece",
  bbq: "barbecue", sand: "sandwich", sando: "sandwich",
  hookah: "hooka", shisha: "hooka", arghile: "hooka",
};
const STOP_WORDS = new Set(["the", "with", "and", "of", "a", "an", "plate", "portion", "serving"]);
function normalizedTokens(value: string): string[] {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ")
    .trim().split(/\s+/).filter(Boolean).map(token => {
      const alias = ALIASES[token] ?? token;
      return alias.length > 4 && alias.endsWith("s") && !alias.endsWith("ss") ? alias.slice(0, -1) : alias;
    }).filter(token => !STOP_WORDS.has(token));
}
function bigrams(value: string): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < value.length - 1; i++) result.add(value.slice(i, i + 2));
  return result;
}
function similarity(posName: string, menuName: string): number {
  const a = normalizedTokens(posName);
  const b = normalizedTokens(menuName);
  if (!a.length || !b.length) return 0;
  const left = new Set(a), right = new Set(b);
  const intersection = [...left].filter(token => right.has(token)).length;
  const overlap = (2 * intersection) / (left.size + right.size);
  const joinedA = [...left].sort().join(" ");
  const joinedB = [...right].sort().join(" ");
  if (joinedA === joinedB) return 100;
  const gramsA = bigrams(joinedA), gramsB = bigrams(joinedB);
  const matchingGrams = [...gramsA].filter(g => gramsB.has(g)).length;
  const characterScore = gramsA.size + gramsB.size ? 2 * matchingGrams / (gramsA.size + gramsB.size) : 0;
  const containment = joinedA.includes(joinedB) || joinedB.includes(joinedA) ? 0.08 : 0;
  return Math.min(99, Math.round(100 * (0.72 * overlap + 0.28 * characterScore + containment)));
}

export function PosMappingClient() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [posSearch, setPosSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [targetId, setTargetId] = useState("");
  const [notes, setNotes] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [editor, setEditor] = useState<"recipe" | "ingredient" | null>(null);
  const load = useCallback(async () => {
    const result = await jsonResponse(await fetch("/api/bo/pos-mapping", { cache: "no-store" }));
    setData(result);
  }, []);
  useEffect(() => { void load().catch(e => setError(String(e.message))); }, [load]);
  const maps = useMemo(() => new Map((data?.mappings ?? []).map(m => [m.pos_key, m])), [data]);
  const records = useMemo(() => (data?.rows ?? []).map(r => ({ ...r, mapping: maps.get(r.pos_key) })).filter(r => !!r.mapping), [data, maps]);
  const visible = useMemo(() => records.filter(r => (filter === "all" || r.mapping?.status === filter) && (!posSearch.trim() || `${r.mapping?.pos_name} ${r.mapping?.pos_division} ${r.mapping?.pos_group}`.toLowerCase().includes(posSearch.trim().toLowerCase()))), [records, filter, posSearch]);
  const selected = records.find(r => r.pos_key === selectedKey) ?? visible[0] ?? null;
  const selectedMap = selected?.mapping;
  const availableMenu = useMemo(() => (data?.menu ?? []).filter(x => `${x.name} ${x.id}`.toLowerCase().includes(menuSearch.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name)).slice(0, 100), [data, menuSearch]);
  const suggestions = useMemo(() => {
    if (!selectedMap || !data) return [];
    return data.menu.map(item => ({ item, score: similarity(selectedMap.pos_name, item.name) }))
      .filter(entry => entry.score >= 25)
      .sort((a, b) => b.score - a.score || Number(b.item.active) - Number(a.item.active) || Number(!!b.item.recipe_id) - Number(!!a.item.recipe_id) || a.item.name.localeCompare(b.item.name))
      .slice(0, 5);
  }, [data, selectedMap?.pos_name]);
  const chooseMatch = (id: number) => {
    setTargetId(String(id));
    setMenuSearch("");
    setShowMenu(false);
    setError("");
  };
  const setSelected = (key: string) => {
    const m = maps.get(key);
    setSelectedKey(key);
    setTargetId(m?.menu_item_id ? String(m.menu_item_id) : "");
    setMenuSearch(""); setNotes(m?.notes || ""); setShowMenu(false);
  };
  useEffect(() => {
    if (!data || !visible.length) return;
    if (selectedKey && visible.some(v => v.pos_key === selectedKey)) return;
    const m = visible[0].mapping;
    setSelectedKey(visible[0].pos_key); setTargetId(m?.menu_item_id ? String(m.menu_item_id) : ""); setNotes(m?.notes || ""); setMenuSearch("");
  }, [data, visible, selectedKey]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.value, f.value === "all" ? records.length : records.filter(x => x.mapping?.status === f.value).length])), [records]);
  async function importSeed() {
    if (!window.confirm("Import the 442 item rows for PRO'S SARL (Main), September 2026? Existing reviewed mappings will be preserved.")) return;
    setBusy(true); setError("");
    try { const result = await jsonResponse(await fetch("/api/bo/pos-mapping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import_main_september" }) })); await load(); setMessage(`${result.imported} Main branch items imported. All decisions remain editable.`); }
    catch (e) { setError(e instanceof Error ? e.message : "Import failed"); } finally { setBusy(false); }
  }
  async function save(status: Status, explicitItemId?: number) {
    if (!selectedMap || busy) return;
    const chosenId = explicitItemId === undefined ? targetId : String(explicitItemId);
    if (status === "confirmed" && !chosenId) { setError("Select a BO menu item to confirm the match."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await jsonResponse(await fetch("/api/bo/pos-mapping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", pos_key: selectedMap.pos_key, status, menu_item_id: chosenId || null, notes }) }));
      const next = visible.findIndex(v => v.pos_key === selectedMap.pos_key);
      await load();
      setMessage(`${selectedMap.pos_name} saved as ${status === "skipped" ? "Skipped — return to it anytime" : status}.`);
      const following = visible[next + 1] ?? visible[next - 1];
      setSelectedKey(following?.pos_key || "");
      if (following) { setTargetId(following.mapping?.menu_item_id ? String(following.mapping.menu_item_id) : ""); setNotes(following.mapping?.notes || ""); setMenuSearch(""); }
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function closeEditor() {
    setEditor(null);
    try {
      const previousIds = new Set((data?.menu ?? []).map(item => item.id));
      const refreshed: Dataset = await jsonResponse(await fetch("/api/bo/pos-mapping", { cache: "no-store" }));
      setData(refreshed);
      if (editor === "recipe") {
        const created = refreshed.menu.filter(item => !previousIds.has(item.id));
        if (created.length === 1) chooseMatch(created[0].id);
        setMessage(created.length === 1 ? `New menu item ${created[0].name} selected. Confirm the match to save it.` : "Menu and recipe list refreshed. Select the item to map it.");
      } else setMessage("Ingredient editor closed. Ingredient changes are available in Recipes.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not refresh menu items."); }
  }
  const assigned = data?.menu.find(x => String(x.id) === targetId);
  const btn = "rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-40";
  return <BOFrame active="/bo/pos-mapping" title="POS Item Mapping" subtitle="Review Main branch sales items and connect them to Recipes">
    <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 text-[#242341] sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-xs font-bold uppercase tracking-[0.15em] text-[#797a9a]">Reports / Mapping</div><h1 className="mt-1 text-2xl font-extrabold text-[#25206f]">POS Item Mapping</h1><p className="text-sm text-[#686984]">PRO'S SARL — Main branch only. Klayaat is excluded.</p></div>
        <button onClick={importSeed} disabled={busy} className={`${btn} border-[#25206f] bg-[#25206f] text-white`}>{data?.rows.length ? "Re-import September (safe)" : "Import September 2026 — Main"}</button>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
      {!data ? <div className="rounded-2xl bg-white p-8 text-sm text-[#777]">Loading POS mapping…</div> : !data.rows.length ? <section className="rounded-2xl border border-[#e3e3ed] bg-white p-8 text-center"><h2 className="text-lg font-bold">Start with the September report</h2><p className="mt-2 text-sm text-[#777]">This package includes the 442 Main branch item rows from the uploaded report. Import them once; nothing will be linked automatically.</p></section> : <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{FILTERS.map(f => <button key={f.value} onClick={() => { setFilter(f.value); setSelectedKey(""); }} className={`rounded-2xl border p-3 text-left transition-colors ${filter === f.value ? "border-[#25206f] bg-[#eeecff]" : "border-[#e2e2ed] bg-white hover:bg-[#f8f8fc]"}`}><div className="text-xs font-medium text-[#696b81]">{f.name}</div><div className="mt-1 text-2xl font-extrabold text-[#25206f]">{counts[f.value] || 0}</div></button>)}</div>
        <div className="grid min-h-[520px] gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(370px,1.2fr)]">
          <section className="overflow-hidden rounded-2xl border border-[#e2e2ec] bg-white"><div className="border-b p-4"><label className="mb-2 block text-xs font-bold text-[#676b84]">SEARCH POS ITEM</label><input className="w-full rounded-xl border border-[#dedee8] px-3 py-2.5 text-sm outline-none focus:border-[#25206f]" value={posSearch} onChange={e => setPosSearch(e.target.value)} placeholder="Search any POS name or group…"/><p className="mt-2 text-xs text-[#85859a]">{visible.length} items · {data.current_import?.period_start} to {data.current_import?.period_end}</p></div>
          <div className="max-h-[600px] overflow-auto">{visible.map(r => <button key={r.pos_key} onClick={() => setSelected(r.pos_key)} className={`flex w-full items-start justify-between gap-2 border-b border-[#f0f0f5] px-4 py-3 text-left hover:bg-[#f7f7fb] ${r.pos_key === selected?.pos_key ? "bg-[#eeecff]" : ""}`}><span className="min-w-0"><span className="block truncate text-sm font-bold">{r.mapping?.pos_name}</span><span className="block truncate text-[11px] text-[#83839a]">{r.mapping?.pos_group}</span></span><span className="shrink-0 text-xs font-semibold text-[#25206f]">{format(r.quantity)} sold</span></button>)}{!visible.length && <div className="p-6 text-center text-sm text-[#888]">No items in this filter.</div>}</div></section>
          <section className="rounded-2xl border border-[#e2e2ec] bg-white p-5 sm:p-6">{selectedMap ? <div className="space-y-5"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-[#eeecff] px-3 py-1 text-[11px] font-bold uppercase text-[#25206f]">{selectedMap.status === "pending" ? "Needs review" : selectedMap.status}</span><span className="text-xs text-[#8b8ba0]">PDF page {selected?.pdf_page || "—"}</span></div><div><h2 className="text-xl font-extrabold text-[#25206f]">{selectedMap.pos_name}</h2><p className="mt-1 text-xs text-[#797a91]">{selectedMap.pos_division} / {selectedMap.pos_group}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#f7f7fa] p-3"><div className="text-[11px] text-[#85859a]">Qty sold</div><div className="text-lg font-bold">{format(selected?.quantity || 0)}</div></div><div className="rounded-xl bg-[#f7f7fa] p-3"><div className="text-[11px] text-[#85859a]">Revenue LBP</div><div className="text-lg font-bold">{format(selected?.amount_lbp || 0)}</div></div></div>
            <div className="rounded-xl border border-[#dedcf0] bg-[#faf9ff] p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#25206f]">Suggested BO Menu Matches</div>
                <span className="text-[11px] text-[#85859a]">Ranked automatically · review before confirming</span>
              </div>
              {suggestions.length ? <div className="mt-3 space-y-2">{suggestions.map(({ item, score }) => <button
                type="button" key={item.id} onClick={() => chooseMatch(item.id)} onDoubleClick={() => void save("confirmed", item.id)} disabled={busy} title="Click to select; double-click to confirm and save"
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors hover:border-[#25206f] hover:bg-[#efedff] disabled:opacity-50 ${targetId === String(item.id) ? "border-[#25206f] bg-[#eeecff]" : "border-[#e4e2ee] bg-white"}`}>
                <span className="min-w-0"><span className="block text-sm font-semibold text-[#25206f]">{item.name}</span>
                  <span className="mt-1 block text-[11px] text-[#777890]">{item.recipe_id ? "Recipe linked" : "No recipe linked"}{!item.active ? " · Hidden item" : ""}{targetId === String(item.id) ? " · Selected" : ""}</span></span>
                <span className="shrink-0 rounded-full bg-[#f0effa] px-2.5 py-1 text-xs font-bold text-[#25206f]">{score}% similar</span>
              </button>)}</div> : <p className="mt-3 text-xs text-[#777890]">No close name matches. Use the manual search below.</p>}
              <p className="mt-3 text-[11px] leading-5 text-[#85859a]">Similarity scores compare names only; they are not probabilities. Single-click selects without saving. Double-click confirms and saves immediately.</p>
            </div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditor("recipe")} className={`${btn} border-[#25206f] bg-[#eeecff] text-[#25206f]`}>+ New / New As Recipe</button><button type="button" onClick={() => setEditor("ingredient")} className={`${btn} border-[#dddde8] bg-white text-[#25206f]`}>+ New Ingredient</button></div>
            <div><label className="mb-2 block text-xs font-bold text-[#5b5c79]">SEARCH & MATCH BO MENU ITEM</label><input className="w-full rounded-xl border border-[#dddde8] px-3 py-3 text-sm outline-none focus:border-[#25206f]" value={menuSearch} onChange={e => { setMenuSearch(e.target.value); setShowMenu(true); }} onFocus={() => setShowMenu(true)} placeholder="Type part of a menu item name…"/>{assigned && <div className="mt-2 flex items-center justify-between rounded-lg bg-[#eeecff] px-3 py-2 text-xs font-bold text-[#25206f]">Selected: {assigned.name} {assigned.recipe_id ? "· Recipe linked" : "· No recipe"}<button onClick={() => { setTargetId(""); setMenuSearch(""); }} className="ml-2 underline">Clear</button></div>}{showMenu && <div className="mt-1 max-h-[220px] overflow-auto rounded-xl border border-[#e2e2ec] bg-white shadow-sm">{availableMenu.map(x => <button key={x.id} onClick={() => chooseMatch(x.id)} className="flex w-full items-center justify-between border-b border-[#f2f2f5] px-3 py-2 text-left text-sm hover:bg-[#f0effc]"><span>{x.name}</span><span className="ml-3 shrink-0 text-[10px] text-[#8b8b9d]">{x.recipe_id ? "Recipe" : "No recipe"}{!x.active ? " · Hidden" : ""}</span></button>)}{!availableMenu.length && <div className="p-4 text-sm text-[#888]">No matching BO menu item.</div>}</div>}</div>
            <div><label className="mb-2 block text-xs font-bold text-[#5b5c79]">NOTES (OPTIONAL)</label><textarea rows={2} className="w-full rounded-xl border border-[#dddde8] px-3 py-2 text-sm outline-none focus:border-[#25206f]" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Portion differences, combo details, explanation…"/></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><button disabled={busy || !targetId} onClick={() => void save("confirmed")} className={`${btn} border-[#25206f] bg-[#25206f] text-white`}>Confirm match</button><button disabled={busy} onClick={() => void save("skipped")} className={`${btn} border-amber-200 bg-amber-50 text-amber-900`}>Skip for later</button><button disabled={busy} onClick={() => void save("modifier")} className={`${btn} border-[#d5d5e5] bg-[#f6f6fb] text-[#25206f]`}>Modifier</button><button disabled={busy} onClick={() => void save("excluded")} className={`${btn} border-[#ddd] bg-white text-[#6a6a76]`}>Exclude</button></div>
            <p className="text-xs leading-5 text-[#86869b]">Changes are saved in Supabase. Confirmed links use BO item IDs, not names. Skipped items remain available in the Skipped tab. Modifiers are held separately for review; no ingredient usage is calculated on this page.</p></div> : <div className="p-6 text-center text-sm text-[#888]">Choose a POS item on the left.</div>}</section>
        </div>
      </>}
      {editor && <div className="fixed inset-0 z-[9990] flex flex-col bg-black/60 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={editor === "recipe" ? "Create recipe" : "Create ingredient"}>
        <div className="flex items-center justify-between rounded-t-xl bg-white px-4 py-3 text-[#25206f]"><strong>{editor === "recipe" ? "New / New As Recipe" : "New Ingredient"}</strong><button type="button" onClick={() => void closeEditor()} className="rounded-lg bg-[#25206f] px-4 py-2 text-xs font-bold text-white">Done — Refresh Items & Close ✕</button></div>
        <iframe title={editor === "recipe" ? "Recipes editor" : "Ingredients editor"} src={editor === "recipe" ? "/bo/menu?posCreate=recipe" : "/bo/fnb?posCreate=ingredient"} className="min-h-0 w-full flex-1 rounded-b-xl border-0 bg-white" />
      </div>}
    </main>
  </BOFrame>;
}
