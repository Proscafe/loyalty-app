"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BOFrame } from "../BOFrame";
import { moneyLbp, moneyUsd, pct } from "../format";
import { downloadMenuPricingXlsx } from "./downloadMenuPricingXlsx";
import { downloadBoTablePdf } from "../downloadBoTablePdf";

type Item = {
  id: number;
  recipe_id?: number | null;
  name: string;
  sp_usd: number | null;
  sp_lbp: number | null;
  cost_lbp: number | null;
  food_cost_pct: number | null;
  gross_profit_lbp: number | null;
  margin_pct: number | null;
  over_threshold?: boolean;
  needs_review?: boolean;
  recipe?: { id?: number; name?: string; lines?: Array<{ id?: number; sourceName?: string; sourceUnit?: string; line_type?: string; qty?: number; sourceCost?: number | null; lineCost?: number | null; needs_review?: boolean }> };
};
type Section = { id: number | string; name: string; items: Item[] };
type Payload = { sections: Section[]; unsectioned: Item[]; rate: number; threshold?: number; comparisons?: Record<string, number> };
type Filter = "all" | "missing" | "over";
type IncreaseMode = "percent" | "usd" | "lbp";
type ViewCurrency = "LBP" | "USD";
type SortKey = "name" | "sp_usd" | "sp_lbp" | "cost" | "cost_pct" | "profit" | "margin" | "new_price" | "new_cost_pct" | "compare_price" | "compare_cost_pct";
type SortDirection = "asc" | "desc";

const numeric = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const positivePrice = (value: unknown) => value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value) > 0;
// Some server/proxy failures return an empty or HTML response, not JSON.
// Report the HTTP status and a useful excerpt instead of crashing during response.json().
async function readApiResponse(response: Response): Promise<any> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`Menu Pricing API returned an empty response (HTTP ${response.status} ${response.statusText || ""}). Check the server terminal and the Network response.`);
  }
  try {
    const parsed = JSON.parse(body);
    if (!response.ok) throw new Error(parsed?.error || `Menu Pricing API failed (HTTP ${response.status}).`);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Menu Pricing API returned non-JSON data (HTTP ${response.status}): ${body.slice(0, 180)}`);
    }
    throw error;
  }
}
const inputStyle = "w-full min-w-[80px] rounded-md border border-black/20 bg-white px-2 py-1.5 text-right text-[12px] font-semibold text-black outline-none focus:border-black disabled:opacity-50";

// Each input owns its draft, preventing updates to another row from resetting the user's typing.
function PriceInput({ value, disabled, onSave, decimals = 2 }: {
  value: number | null | undefined;
  disabled?: boolean;
  onSave: (value: string) => boolean;
  decimals?: number;
}) {
  const format = (v: number | null | undefined, roundedDisplay = false) => {
    if (v === null || v === undefined) return "";
    if (decimals === 0) {
      const stored = Math.round(v);
      if (!roundedDisplay || typeof window === "undefined") return String(stored);
      try { const step = Number(JSON.parse(localStorage.getItem("pros_bo_currency_rounding") || "{}").lbp || 1); return String(Math.round(stored / step) * step); } catch { return String(stored); }
    }
    if (roundedDisplay && typeof window !== "undefined") {
      try { const step = Number(JSON.parse(localStorage.getItem("pros_bo_currency_rounding") || "{}").usd || 0.01); return (Math.round(v / step) * step).toFixed(2); } catch { /* use exact */ }
    }
    return String(Number(v.toFixed(decimals)));
  };
  const [draft, setDraft] = useState(format(value, true));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(format(value, true)); }, [value, focused]);
  const save = () => {
    setFocused(false);
    if (draft === format(value) || draft === format(value, true)) { setDraft(format(value, true)); return; }
    const n = draft.trim() === "" ? null : Number(draft.replace(/,/g, ""));
    if (n !== null && (!Number.isFinite(n) || n < 0)) { setDraft(format(value)); return; }
    if (!onSave(n === null ? "" : String(n))) setDraft(format(value));
  };
  return <input aria-label="Selling price" inputMode="decimal" className={inputStyle} value={draft} disabled={disabled}
    onFocus={() => { setDraft(format(value)); setFocused(true); }} onChange={e => setDraft(e.target.value)} onBlur={save}
    onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(format(value)); e.currentTarget.blur(); } }} />;
}

function withUpdatedPrice(item: Item, usd: number | null, rate: number): Item {
  const lbp = usd === null ? null : usd * rate;
  const cost = item.cost_lbp;
  return {
    ...item, sp_usd: usd, sp_lbp: lbp,
    food_cost_pct: lbp && cost !== null ? cost / lbp : null,
    gross_profit_lbp: lbp !== null && cost !== null ? lbp - cost : null,
    margin_pct: lbp && cost !== null ? (lbp - cost) / lbp : null,
  };
}
function applyPendingPrice(item: Item, pending: Record<string, { usd: number | null }>, rate: number): Item {
  const entry = pending[`price:${item.id}`];
  return entry ? withUpdatedPrice(item, entry.usd, rate) : item;
}

export function CoverClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [search, setSearch] = useState("");
  const [viewItem, setViewItem] = useState<Item | null>(null);
  const [flagSaving, setFlagSaving] = useState(false);
  const [flagError, setFlagError] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveBarSlotRef = useRef<HTMLDivElement>(null);
  const [saveBarDock, setSaveBarDock] = useState<{ left: number; width: number } | null>(null);
  const pendingRef = useRef<Record<string, { id: number; kind: "price" | "comparison"; usd: number | null; revision: number }>>({});
  const revisionRef = useRef(0);
  const saveRunningRef = useRef(false);
  const loadedRef = useRef(false);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const draftsStorageKey = "pros-bo-menu-pricing-pending-v1";
  useEffect(() => {
    const measure = () => {
      const slot = saveBarSlotRef.current;
      if (!slot) return;
      const rect = slot.getBoundingClientRect();
      setSaveBarDock(rect.top < 82 ? { left: rect.left, width: rect.width } : null);
    };
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    return () => { window.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, []);

  const [increaseMode, setIncreaseMode] = useState<IncreaseMode>("percent");
  const [increase, setIncrease] = useState("0");
  const [estimates, setEstimates] = useState<Record<number, string>>({});
  const [viewCurrency, setViewCurrency] = useState<ViewCurrency>("USD");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [greenLimit, setGreenLimit] = useState(30);
  const [amberLimit, setAmberLimit] = useState(35);
  const rate = numeric(data?.rate);

  async function load() {
    try {
      const res = await fetch("/api/bo/cover", { cache: "no-store" });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json?.error || "Unable to load Menu Pricing.");
      // Restore only queued edits: do not overwrite them with the server snapshot.
      let pending: typeof pendingRef.current = {};
      try {
        const raw = window.localStorage.getItem(draftsStorageKey);
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [key, row] of Object.entries(parsed)) {
            const entry = row as any;
            if (!entry || !Number.isInteger(entry.id) || entry.id <= 0 || !["price", "comparison"].includes(entry.kind) || (entry.usd !== null && (!Number.isFinite(entry.usd) || entry.usd < 0))) continue;
            pending[key] = { id: entry.id, kind: entry.kind, usd: entry.usd, revision: ++revisionRef.current };
          }
        }
      } catch { /* Browser storage may be unavailable. */ }
      pendingRef.current = pending;
      setPendingCount(Object.keys(pending).length);
      setSaveStatus(Object.keys(pending).length ? "pending" : "saved");
      const merged: Payload = { ...json, sections: (json.sections || []).map((section: Section) => ({ ...section, items: section.items.map((item: Item) => applyPendingPrice(item, pending, Number(json.rate))) })), unsectioned: (json.unsectioned || []).map((item: Item) => applyPendingPrice(item, pending, Number(json.rate))), comparisons: { ...json.comparisons } };
      for (const row of Object.values(pending)) if (row.kind === "comparison") merged.comparisons![String(row.id)] = row.usd as number;
      setData(merged);
      setEstimates(Object.fromEntries(Object.entries(merged.comparisons || {}).filter(([, usd]) => usd !== null && usd !== undefined).map(([id, usd]) => [id, String(viewCurrency === "LBP" ? Math.round(Number(usd) * Number(json.rate)) : usd)])));
      loadedRef.current = true;
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load Menu Pricing."); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    void fetch("/api/bo/settings", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(body => {
      if (!body?.settings) return;
      const green = Number(body.settings.food_cost_threshold);
      const amber = Number(body.settings.bar_cost_threshold);
      if (Number.isFinite(green) && green > 0 && green <= 1) setGreenLimit(green * 100);
      if (Number.isFinite(amber) && amber > 0 && amber <= 1) setAmberLimit(amber * 100);
    }).catch(() => {});
  }, []);

  const allSections = useMemo(() => {
    if (!data) return [] as Section[];
    return [...(data.sections || [])]
      .concat(data.unsectioned?.length ? [{ id: "none", name: "UNCATEGORIZED", items: data.unsectioned }] : []);
  }, [data]);
  const sections = useMemo(() => allSections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      const matchesText = item.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesCategory = category === "all" || String(section.id) === category;
      const matchesStatus = filter === "all" || (filter === "missing" && !positivePrice(item.sp_usd)) || (filter === "over" && Boolean(item.over_threshold));
      return matchesText && matchesCategory && matchesStatus;
    }),
  })).filter(section => section.items.length > 0 || (search.trim() === "" && filter === "all" && (category === "all" || String(section.id) === category))), [allSections, search, category, filter]);


  function storePending() {
    const entries = pendingRef.current;
    setPendingCount(Object.keys(entries).length);
    try {
      if (Object.keys(entries).length) window.localStorage.setItem(draftsStorageKey, JSON.stringify(entries));
      else window.localStorage.removeItem(draftsStorageKey);
    } catch { /* Save still works if storage is blocked/full. */ }
  }

  function queueChange(id: number, kind: "price" | "comparison", usd: number | null) {
    const key = `${kind}:${id}`;
    pendingRef.current[key] = { id, kind, usd, revision: ++revisionRef.current };
    storePending();
    setSaveStatus("pending");
  }

  function updatePrice(id: number, field: "usd" | "lbp", value: string): boolean {
    if (field === "lbp" && rate <= 0) { setError("Set a valid exchange rate in Settings before editing LBP prices."); return false; }
    const amount = value === "" ? null : Number(value);
    const usd = amount === null ? null : field === "lbp" ? amount / rate : amount;
    if (usd !== null && (!Number.isFinite(usd) || usd < 0)) { setError("Enter a valid non-negative price."); return false; }
    const existing = [...(data?.sections || []).flatMap(section => section.items), ...(data?.unsectioned || [])].find(item => item.id === id);
    if (existing && (existing.sp_usd === usd || (existing.sp_usd !== null && usd !== null && Math.abs(Number(existing.sp_usd) - usd) < 0.0000001))) return true;
    queueChange(id, "price", usd);
    setData(previous => previous ? {
      ...previous,
      sections: previous.sections.map(section => ({ ...section, items: section.items.map(item => item.id === id ? withUpdatedPrice(item, usd, rate) : item) })),
      unsectioned: previous.unsectioned.map(item => item.id === id ? withUpdatedPrice(item, usd, rate) : item),
    } : previous);
    setError("");
    return true;
  }

  function saveComparison(id: number, draft: string): boolean {
    const amount = draft.trim() === "" ? null : Number(draft.replace(/,/g, ""));
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) { setError("Compare Price must be zero or greater."); return false; }
    if (viewCurrency === "LBP" && rate <= 0) { setError("A valid exchange rate is required."); return false; }
    const usd = amount === null ? null : viewCurrency === "LBP" ? amount / rate : amount;
    const previous = data?.comparisons?.[String(id)];
    const current = previous === null || previous === undefined ? null : Number(previous);
    if (current === usd || (current !== null && usd !== null && Math.abs(current - usd) < 0.0000001)) return true;
    queueChange(id, "comparison", usd);
    setData(previous => previous ? { ...previous, comparisons: { ...previous.comparisons, [String(id)]: usd as number } } : previous);
    setError("");
    return true;
  }

  async function saveAll() {
    if (saveRunningRef.current || Object.keys(pendingRef.current).length === 0) return;
    saveRunningRef.current = true;
    setSaveStatus("saving");
    setError("");
    const snapshot = Object.values(pendingRef.current).map(row => ({ ...row }));
    let failed = false;
    try {
      // Use the existing API; one request per changed record, rather than per keystroke/blur.
      for (const row of snapshot) {
        try {
          const response = await fetch("/api/bo/cover", {
            method: row.kind === "price" ? "PUT" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(row.kind === "price" ? { id: row.id, sp_usd: row.usd } : { id: row.id, compare_sp_usd: row.usd }),
          });
          await readApiResponse(response);
          const key = `${row.kind}:${row.id}`;
          if (pendingRef.current[key]?.revision === row.revision) delete pendingRef.current[key];
          storePending();
        } catch (e) {
          failed = true;
          setError(e instanceof Error ? e.message : "Unable to save some pricing changes. Please retry.");
          break; // Preserve all unsaved rows for retry.
        }
      }
      if (!failed) setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } finally {
      saveRunningRef.current = false;
      setSaveStatus(failed ? "error" : Object.keys(pendingRef.current).length ? "pending" : "saved");
    }
  }
  saveRef.current = saveAll;
  useEffect(() => {
    const interval = window.setInterval(() => { if (loadedRef.current) void saveRef.current(); }, 60_000);
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.setTimeout(() => { void saveRef.current(); }, 0);
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(pendingRef.current).length > 0) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => { window.clearInterval(interval); window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onBeforeUnload); };
  }, []);

  async function resetScenarios() {
    if (saveRunningRef.current) { setError("Wait for the current save to finish."); return; }
    if (Object.values(pendingRef.current).some(row => row.kind === "comparison")) { setError("Save your pending Compare Prices before resetting them."); return; }
    if (!window.confirm("Clear all saved Compare Prices and reset the New Price adjustment? Selling prices will not change.")) return;
    setError("");
    try {
      const response = await fetch("/api/bo/cover", { method: "DELETE" });
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(payload.error || "Unable to reset saved comparisons.");
      setIncrease("0"); setIncreaseMode("percent"); setEstimates({});
      setData(previous => previous ? { ...previous, comparisons: {} } : previous);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to reset saved comparisons."); }
  }
  const nIncrease = numeric(increase);
  const newPrice = (item: Item) => {
    const base = numeric(item.sp_lbp);
    if (!positivePrice(item.sp_usd)) return null;
    return Math.max(0, increaseMode === "percent" ? base * (1 + nIncrease / 100) :
      increaseMode === "usd" ? base + nIncrease * rate : base + nIncrease);
  };
  const costRatio = (cost: number | null, price: number | null) => price !== null && price > 0 ? cost === null ? null : numeric(cost) / price : null;
  const comparisonAmount = (item: Item): number | null => {
    const draft = estimates[item.id];
    if (draft === undefined || draft.trim() === "") return null;
    const amount = Number(draft.replace(/,/g, ""));
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  };
  const comparisonLbp = (item: Item): number | null => {
    const amount = comparisonAmount(item);
    return amount === null ? null : viewCurrency === "LBP" ? amount : amount * rate;
  };
  const sortValue = (item: Item): string | number | null => {
    switch (sortKey) {
      case "name": return item.name;
      case "sp_usd": return item.sp_usd;
      case "sp_lbp": return item.sp_lbp;
      case "cost": return item.cost_lbp;
      case "cost_pct": return item.food_cost_pct;
      case "profit": return item.gross_profit_lbp;
      case "margin": return item.margin_pct;
      case "new_price": return newPrice(item);
      case "new_cost_pct": return costRatio(item.cost_lbp, newPrice(item));
      case "compare_price": return comparisonAmount(item);
      case "compare_cost_pct": return costRatio(item.cost_lbp, comparisonLbp(item));
    }
  };
  const sortedSections = sections.map(section => ({
    ...section,
    items: [...section.items].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (av === null || av === undefined) return bv === null || bv === undefined ? a.id - b.id : 1;
      if (bv === null || bv === undefined) return -1;
      const comparison = typeof av === "string" && typeof bv === "string"
        ? av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true })
        : Number(av) - Number(bv);
      return comparison === 0 ? a.id - b.id : (sortDirection === "asc" ? comparison : -comparison);
    }),
  }));
  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortDirection(previous => previous === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("asc"); }
  };
  const sortHeader = (key: SortKey, text: string) => <button type="button" onClick={() => sortBy(key)}
    aria-label={`Sort by ${text}${sortKey === key ? `, currently ${sortDirection === "asc" ? "ascending" : "descending"}` : ""}`}
    className={`flex w-full items-center gap-1 whitespace-nowrap font-bold hover:text-black focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-black ${key === "name" ? "justify-start text-left" : "justify-end text-right"}`}>
    {text}<span aria-hidden="true" className="text-[11px]">{sortKey === key ? sortDirection === "asc" ? "▲" : "▼" : "↕"}</span>
  </button>;
  const displayPct = (ratio: number | null | undefined) => ratio === null || ratio === undefined || !Number.isFinite(ratio) ? "—" : pct(ratio);
  const tone = (ratio: number | null | undefined, inverse = false) => {
    if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "text-black/40";
    const foodPercent = inverse ? 100 - ratio * 100 : ratio * 100;
    return foodPercent <= greenLimit ? "text-emerald-700" : foodPercent <= amberLimit ? "text-amber-700" : "text-red-700";
  };
  const asCurrency = (lbp: number | null | undefined) => lbp === null || lbp === undefined || !Number.isFinite(Number(lbp)) ? "—" : viewCurrency === "LBP" ? moneyLbp(lbp) : rate > 0 ? moneyUsd(Number(lbp) / rate) : "—";
  async function togglePreviewReviewFlag() {
    if (!viewItem?.recipe?.lines?.length || flagSaving) return;
    const recipeId = Number(viewItem.recipe_id ?? viewItem.recipe.id);
    if (!Number.isInteger(recipeId) || recipeId <= 0) {
      setFlagError("This menu item does not have a valid linked recipe ID.");
      return;
    }
    const lines = viewItem.recipe.lines;
    const flagged = lines.filter(line => line.needs_review === true);
    const targets = flagged.length ? flagged : lines.filter(line => Number(line.id) > 0).slice(0, 1);
    if (!targets.length || targets.some(line => !Number.isInteger(Number(line.id)) || Number(line.id) <= 0)) {
      setFlagError("This recipe has no saved lines that can be flagged.");
      return;
    }
    const nextFlag = flagged.length === 0;
    setFlagSaving(true);
    setFlagError("");
    try {
      for (const line of targets) {
        const response = await fetch("/api/bo/recipe-review", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ line_id: line.id, recipe_id: recipeId, needs_review: nextFlag }),
        });
        const payload = await readApiResponse(response);
        if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || "Unable to save review flag.");
      }
      const updated = {
        ...viewItem,
        needs_review: nextFlag,
        recipe: { ...viewItem.recipe, lines: lines.map(line => ({
          ...line, needs_review: targets.some(target => String(target.id) === String(line.id)) ? nextFlag : line.needs_review,
        })) },
      };
      setViewItem(updated);
      setData(previous => previous ? ({
        ...previous,
        sections: previous.sections.map(section => ({ ...section, items: section.items.map(item => item.id === viewItem.id ? { ...item, needs_review: nextFlag } : item) })),
        unsectioned: previous.unsectioned.map(item => item.id === viewItem.id ? { ...item, needs_review: nextFlag } : item),
      }) : previous);
    } catch (err) {
      setFlagError(err instanceof Error ? err.message : "Unable to save review flag.");
    } finally {
      setFlagSaving(false);
    }
  }
  const exportExcel = () => {
    const rows: (string | number | null)[][] = [];
    for (const section of sortedSections) {
      for (const item of section.items) {
        const simulated = newPrice(item);
        const compared = comparisonLbp(item);
        const exchange = viewCurrency === "USD" ? rate : 1;
        const monetary = (value: number | null | undefined) => value == null || !Number.isFinite(Number(value)) || exchange <= 0 ? null : Number((Number(value) / exchange).toFixed(viewCurrency === "USD" ? 2 : 0));
        rows.push([
          section.name, item.name, item.sp_usd, item.sp_lbp,
          monetary(item.cost_lbp), item.food_cost_pct == null ? null : item.food_cost_pct,
          monetary(item.gross_profit_lbp), item.margin_pct == null ? null : item.margin_pct,
          monetary(simulated), costRatio(item.cost_lbp, simulated),
          monetary(compared), costRatio(item.cost_lbp, compared),
        ]);
      }
    }
    downloadMenuPricingXlsx(rows, viewCurrency);
  };
  const exportPdf = async () => {
    const groups = sortedSections.map(section => ({
      title: section.name,
      rows: section.items.map(item => {
        const dividingRate = data?.rate || rate || 0;
        const costUsd = dividingRate > 0 && item.cost_lbp != null ? `$${(Number(item.cost_lbp) / dividingRate).toFixed(2)}` : "—";
        const profitUsd = dividingRate > 0 && item.gross_profit_lbp != null ? `$${(Number(item.gross_profit_lbp) / dividingRate).toFixed(2)}` : "—";
        return [item.name, item.sp_usd == null ? "—" : `$${Number(item.sp_usd).toFixed(2)}`,
          item.sp_lbp == null ? "—" : Math.round(Number(item.sp_lbp)).toLocaleString("en-US"),
          costUsd, item.food_cost_pct == null ? "—" : `${(Number(item.food_cost_pct) * 100).toFixed(1)}%`,
          profitUsd, item.margin_pct == null ? "—" : `${(Number(item.margin_pct) * 100).toFixed(1)}%`];
      }),
    }));
    await downloadBoTablePdf({ title: "MENU PRICING", subtitle: "Current visible pricing report · USD / LBP",
      columns: ["ITEM", "SELLING USD", "SELLING LBP", "COST USD", "FOOD COST %", "PROFIT USD", "MARGIN %"],
      groups, fileName: "pros-menu-pricing.pdf" });
  };
  const visibleIds = sections.map(section => String(section.id));
  const allCollapsed = visibleIds.length > 0 && visibleIds.every(id => collapsed[id]);
  return <BOFrame active="/bo/cover" title="MENU PRICING" subtitle={`Selling prices, food cost and price scenarios · Exchange rate ${rate.toLocaleString("en-US")} LBP/USD`}>
    <div ref={saveBarSlotRef} className="sticky top-[82px] z-[70]">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <div className="relative min-w-[190px] max-w-[360px] flex-1"><input aria-label="Search item" className="w-full rounded-md border border-black/20 bg-white px-3 py-2 pr-9 text-[12px] font-normal text-black" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Item" />{search && <button type="button" aria-label="Clear item search" title="Clear search" onClick={() => setSearch("")} className="absolute inset-y-0 right-1 flex w-8 items-center justify-center rounded text-black/60 hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800">✕</button>}</div>
        <div className="flex items-center gap-2 self-end pb-[10px] text-[12px] font-semibold" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${saveStatus === "error" ? "bg-red-500" : saveStatus === "saving" ? "bg-blue-500" : pendingCount ? "bg-amber-500" : "bg-emerald-500"}`} />
          <span>{saveStatus === "saving" ? "Saving changes…" : saveStatus === "error" ? `Save failed · ${pendingCount} pending` : pendingCount ? `${pendingCount} unsaved change${pendingCount === 1 ? "" : "s"}` : "All changes saved"}</span>
        </div>
      </div>
      <button type="button" onClick={() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.setTimeout(() => { void saveRef.current(); }, 0); }} disabled={saveStatus === "saving" || (!pendingCount && saveStatus !== "error")} className="rounded-lg bg-black px-4 py-2 text-[12px] font-bold text-white disabled:opacity-40">{saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Retry Save" : "Save Changes"}</button>
    </div>
    </div>
    {error && <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800">{error}</div>}
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-black/10 bg-white p-3">
      <label className="min-w-[170px] flex-1 text-[11px] font-bold text-black/70">Menu Category
        <select className="mt-1 w-full rounded-md border border-black/20 bg-white px-3 py-2 text-[12px] font-normal text-black" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">All categories</option>{[...allSections].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
      </label>
      <label className="min-w-[150px] flex-1 text-[11px] font-bold text-black/70">Price status
        <select className="mt-1 w-full rounded-md border border-black/20 bg-white px-3 py-2 text-[12px] font-normal text-black" value={filter} onChange={e => setFilter(e.target.value as Filter)}>
          <option value="all">All items</option><option value="missing">Missing selling price</option><option value="over">Above food cost target</option>
        </select>
      </label>
      <label className="min-w-[200px] flex-1 text-[11px] font-bold text-black/70">Price adjustment scenario
        <div className="mt-1 flex gap-1"><input inputMode="decimal" className="min-w-0 flex-1 rounded-md border border-black/20 px-2 py-2 text-[12px]" value={increase} onChange={e => setIncrease(e.target.value)} placeholder="e.g. -1 or 5" />
          <select aria-label="Increase type" className="w-[94px] rounded-md border border-black/20 px-1 text-[12px]" value={increaseMode} onChange={e => setIncreaseMode(e.target.value as IncreaseMode)}>
            <option value="percent">%</option><option value="usd">USD</option><option value="lbp">LBP</option>
          </select></div>
      </label>

      <div className="flex items-center gap-2 pb-1" role="group" aria-label="Display currency">
        <div className="inline-flex overflow-hidden rounded-lg border border-black/20">
          {(["LBP", "USD"] as const).map(currency => <button key={currency} type="button" aria-pressed={viewCurrency === currency} onClick={() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); setViewCurrency(currency); setEstimates(Object.fromEntries(Object.entries(data?.comparisons || {}).filter(([, v]) => v !== null).map(([id, usd]) => [id, String(currency === "LBP" ? Math.round(Number(usd) * rate) : usd)]))); }} className={`px-4 py-1.5 text-[12px] ${viewCurrency === currency ? "bg-black text-white" : "bg-white text-black"}`}>{currency}</button>)}
        </div>
      </div>
      <div className="flex items-center gap-2 pb-1">
        <button type="button" onClick={() => { void exportPdf().catch(e => setError(e instanceof Error ? e.message : "PDF export failed")); }} title="Download branded Menu Pricing PDF" aria-label="Download Menu Pricing PDF" className="inline-flex h-8 items-center rounded-md border border-black/20 bg-white px-3 text-[11px] font-bold text-black hover:bg-gray-100">PDF</button>
        <button type="button" onClick={exportExcel} aria-label="Download menu pricing as Excel" title="Download Excel (.xlsx)" className="inline-flex h-8 items-center gap-1 rounded-md border border-black/20 bg-white px-2 text-[11px] font-bold text-black hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4 16v4h16v-4"/></svg> Excel
        </button>

        <button type="button" onClick={resetScenarios} title="Reset New Price and Compare Price scenarios" aria-label="Reset all price scenarios" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black/20 bg-white text-black hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></svg>
        </button>
        <button type="button" onClick={() => setCollapsed(previous => ({ ...previous, ...Object.fromEntries(visibleIds.map(id => [id, !allCollapsed])) }))} title={allCollapsed ? "Expand all categories" : "Collapse all categories"} aria-label={allCollapsed ? "Expand all categories" : "Collapse all categories"} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black/20 bg-white text-black hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          {allCollapsed ? <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 7v10M7 12h10"/></svg> : <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 12h10"/></svg>}
        </button>
      </div>
    </div>
    {viewItem && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3" onMouseDown={e => { if (e.target === e.currentTarget) setViewItem(null); }}>
      <div role="dialog" aria-modal="true" aria-label={`${viewItem.name} recipe preview`} className="flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-5 py-4"><div><h2 className="text-xl font-bold">{viewItem.name}</h2></div><button type="button" onClick={() => setViewItem(null)} aria-label="Close preview" className="rounded-lg border px-3 py-2">✕</button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 text-[12px]">
          {flagError && <p role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 font-semibold text-red-800">{flagError}</p>}
          {viewItem.needs_review && <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 font-semibold text-amber-800">⚑ This recipe has lines flagged for review.</p>}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border p-3"><div className="text-black/50">Selling Price</div><strong>{moneyUsd(viewItem.sp_usd)}</strong></div>
            <div className="rounded-lg border p-3"><div className="text-black/50">Total Cost</div><strong>{asCurrency(viewItem.cost_lbp)}</strong></div>
            <div className="rounded-lg border p-3"><div className="text-black/50">Food Cost</div><strong className={`text-[16px] ${tone(viewItem.food_cost_pct)}`}>{displayPct(viewItem.food_cost_pct)}</strong></div>
            <div className="rounded-lg border p-3"><div className="text-black/50">Profit</div><strong>{asCurrency(viewItem.gross_profit_lbp)}</strong></div>
          </div>
          {viewItem.recipe?.lines?.length ? <div className="space-y-4">
            {([
              { title: 'INGREDIENTS', lines: viewItem.recipe.lines.filter(line => line.line_type !== 'utility' && line.line_type !== 'fixed') },
              { title: 'UTILITY COST', lines: viewItem.recipe.lines.filter(line => line.line_type === 'utility' || line.line_type === 'fixed') },
            ]).map(group => <section key={group.title} className="overflow-hidden rounded-xl border border-black/15">
              <h3 className="sticky top-0 z-20 border-b border-black/10 bg-[#e7e7e7] px-4 py-3 text-[12px] font-black text-black">{group.title}</h3>
              <div className="max-h-[340px] overflow-auto"><table className="w-full min-w-[450px] text-left"><thead className="sticky top-0 z-10 bg-gray-50 text-[11px] text-black/70"><tr><th className="p-2">Item</th><th className="p-2 text-right">QTY</th><th className="p-2">Unit</th><th className="p-2 text-right">Cost</th><th className="p-2">Review</th></tr></thead><tbody>
                {group.lines.length ? group.lines.map((line,i) => <tr key={line.id ?? i} className="border-t border-black/10"><td className="p-2">{line.sourceName || 'Item'}</td><td className="p-2 text-right">{line.qty ?? '—'}</td><td className="p-2">{line.sourceUnit ?? '—'}</td><td className="p-2 text-right">{asCurrency(line.lineCost)}</td><td className="p-2">{line.needs_review ? <span className="font-bold text-amber-700">⚑ Check</span> : '—'}</td></tr>) : <tr><td colSpan={5} className="p-4 text-center text-black/50">No items in this section</td></tr>}
              </tbody></table></div>
            </section>)}
          </div> : <p className="rounded-lg border p-4 text-black/60">No linked recipe lines are available.</p>}
        </div>
        <div className="sticky bottom-0 z-30 flex justify-end gap-2 border-t bg-white p-4">
          <button type="button" onClick={() => { setViewItem(null); setFlagError(""); }} className="rounded-lg border px-4 py-2 font-semibold">Close</button>
          <button type="button" onClick={() => void togglePreviewReviewFlag()} disabled={flagSaving || !viewItem.recipe?.lines?.some(line => Number(line.id) > 0)} aria-label={viewItem.needs_review ? "Clear recipe review flag" : "Flag recipe for review"} title={viewItem.needs_review ? "Clear review flags" : "Flag for review"} className={`inline-flex h-[40px] w-[44px] items-center justify-center rounded-lg border disabled:opacity-40 ${viewItem.needs_review ? "border-amber-400 bg-amber-50 text-amber-700" : "border-black/20 bg-white text-black hover:bg-amber-50"}`}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill={viewItem.needs_review ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4m0 1c4-3 7 3 12 0v11c-5 3-8-3-12 0" /></svg>
          </button>
          <a href={`/bo/menu?edit=${encodeURIComponent(String(viewItem.id))}`} className="rounded-lg bg-black px-4 py-2 font-semibold text-white">Edit Recipe →</a>
        </div>
      </div>
    </div>}
    <div className="space-y-3">
      {sortedSections.map(section => <section key={section.id} className="overflow-hidden rounded-xl border border-black/15 bg-white">
        <h2 className="border-b border-black/10 bg-[#f2f2f2] text-[12px] font-bold uppercase text-black">
          <button type="button" aria-expanded={!collapsed[String(section.id)]} aria-controls={`pricing-section-${section.id}`}
            onClick={() => setCollapsed(previous => ({ ...previous, [String(section.id)]: !previous[String(section.id)] }))}
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-200">
            <span>{section.name} <span className="ml-1 text-black/45">({section.items.length})</span></span>
            <span aria-hidden="true" className="text-base">{collapsed[String(section.id)] ? "+" : "−"}</span>
          </button>
        </h2>
        {!collapsed[String(section.id)] && section.items.length === 0 && <div className="px-4 py-5 text-xs text-black/50">No visible menu items in this category yet.</div>}
        {!collapsed[String(section.id)] && section.items.length > 0 && <div id={`pricing-section-${section.id}`} className="overflow-x-auto"><table className="w-full min-w-[1140px] border-collapse text-left text-[12px]">
          <thead className="bg-[#ebebeb] text-[10px] uppercase text-black/70"><tr>
            <th className="sticky left-0 z-10 w-[195px] border-b border-black/10 bg-[#ebebeb] px-3 py-2">{sortHeader("name", "Items")}</th>
            <th className="border-b border-black/10 px-2 py-2 text-right">{sortHeader("sp_usd", "Selling Price $")}</th>
            <th className="border-b border-black/10 px-2 py-2 text-right">{sortHeader("sp_lbp", "Selling Price LBP")}</th>
            <th className="border-b border-black/10 px-2 py-2 text-right">{sortHeader("cost", "Cost")}</th>
            <th className="border-b border-black/10 px-2 py-2 text-right">{sortHeader("cost_pct", "Cost %")}</th>
            <th className="border-b border-black/10 px-2 py-2 text-right">{sortHeader("profit", "Profit")}</th>
            <th className="border-b border-black/10 px-2 py-2 text-right">{sortHeader("margin", "Margin")}</th>
            <th className="border-b border-black/10 bg-gray-100 px-2 py-2 text-right">{sortHeader("new_price", "New Price")}</th>
            <th className="border-b border-black/10 bg-gray-100 px-2 py-2 text-right">{sortHeader("new_cost_pct", "New Cost %")}</th>
            <th className="border-b border-black/10 px-2 py-2 text-right">{sortHeader("compare_price", "Compare Price")}</th>
            <th className="border-b border-black/10 px-2 py-2 text-right">{sortHeader("compare_cost_pct", "Compare Cost %")}</th>
          </tr></thead><tbody>
            {section.items.map(item => {
              const raised = newPrice(item);
              const estimate = estimates[item.id];
              const comparedAmount = estimate !== undefined && estimate.trim() !== "" && Number.isFinite(Number(estimate.replace(/,/g, ""))) && Number(estimate.replace(/,/g, "")) >= 0 ? Number(estimate.replace(/,/g, "")) : null;
              const comparedLbp = comparedAmount === null ? null : viewCurrency === "LBP" ? comparedAmount : comparedAmount * rate;
              const raisedCost = costRatio(item.cost_lbp, raised);
              const comparedCost = costRatio(item.cost_lbp, comparedLbp);
              const priceTone = (candidate: number | null): string => {
                if (candidate === null || !positivePrice(item.sp_lbp)) return "text-black/40";
                const difference = candidate - Number(item.sp_lbp);
                return difference > 0.0001 ? "text-emerald-700" : difference < -0.0001 ? "text-red-700" : "text-black/70";
              };
              const newCostTone = priceTone(raised);
              const comparisonTone = priceTone(comparedLbp);
              return <tr key={item.id} className="border-b border-black/[0.08] last:border-b-0">
                <td className="sticky left-0 bg-white px-3 py-1.5 font-bold text-black">
                  <span className="inline-flex items-center gap-2">
                    <button type="button" onClick={() => { setFlagError(""); setViewItem(item); }} className="text-left font-bold underline-offset-2 hover:underline focus-visible:underline" title={`View ${item.name} recipe`}>{item.name}</button>
                    {(item.needs_review === true || item.recipe?.lines?.some(line => line.needs_review === true)) && <span className="inline-flex shrink-0 items-center text-amber-700" title="Recipe contains items needing review" aria-label="Needs review"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2a1 1 0 0 1 1 1v1c5-3 8 3 13 0v12c-5 3-8-3-13 0v5a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Z"/></svg></span>}
                  </span>
                </td>
                <td className="w-[102px] px-2 py-1"><PriceInput value={item.sp_usd} onSave={v => updatePrice(item.id, "usd", v)} /></td>
                <td className="w-[123px] px-2 py-1"><PriceInput value={item.sp_lbp} decimals={0} disabled={rate <= 0} onSave={v => updatePrice(item.id, "lbp", v)} /></td>
                <td className="px-2 py-1.5 text-right tabular-nums">{asCurrency(item.cost_lbp)}</td>
                <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${tone(item.food_cost_pct)}`}>{positivePrice(item.sp_usd) ? displayPct(item.food_cost_pct) : "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{positivePrice(item.sp_usd) ? asCurrency(item.gross_profit_lbp) : "—"}</td>
                <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${tone(item.margin_pct, true)}`}>{positivePrice(item.sp_usd) ? displayPct(item.margin_pct) : "—"}</td>
                <td className="bg-gray-50 px-2 py-1.5 text-right font-bold tabular-nums">{raised === null ? "—" : asCurrency(raised)}</td>
                <td className={`bg-gray-50 px-2 py-1.5 text-right font-bold tabular-nums ${newCostTone}`}>{displayPct(raisedCost)}</td>
                <td className="w-[120px] px-2 py-1"><input aria-label={`Compare selling price for ${item.name} in ${viewCurrency}`} inputMode="decimal" placeholder={`Enter ${viewCurrency}`} className={inputStyle} value={estimate ?? ""} onChange={e => setEstimates(prev => ({ ...prev, [item.id]: e.target.value }))} onBlur={e => { saveComparison(item.id, e.currentTarget.value); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /></td>
                <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${comparisonTone}`}>{displayPct(comparedCost)}</td>
              </tr>;
            })}
          </tbody></table></div>}
      </section>)}
      {data && sections.length === 0 && <div className="rounded-xl border border-black/10 bg-white p-6 text-center text-[12px] text-black/60">No items match your filters.</div>}
    </div>
  </BOFrame>;
}
