"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MobilePricingList } from "./MobilePricingList";

type Stats = { menuItems: number; visibleMenuItems: number; hiddenMenuItems: number; ingredients: number; production: number; categories: number; reviewLines: number };
type PricingItem = { id: number; name: string; active?: boolean; sp_usd?: number | null; cost_lbp?: number | null; gross_profit_lbp?: number | null; margin_pct?: number | null; food_cost_pct?: number | null };
type PricingSection = { id: string | number; name: string; items: PricingItem[] };
type PricingResponse = { sections?: PricingSection[]; unsectioned?: PricingItem[]; rate?: number };
type ProfitItem = { name: string; category: string; profitUsd: number; margin: number; foodCost: number; priceUsd: number };
type CategoryProfit = { name: string; count: number; avgProfitUsd: number; avgMargin: number; avgFoodCost: number; aggregateProfitUsd: number };

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const num = (value: unknown) => value === null || value === undefined || value === "" ? NaN : Number(value);

function deriveInsights(data: PricingResponse) {
  const rate = num(data.rate);
  const entries = (data.sections ?? []).flatMap(s => (s.items ?? []).map(item => ({ item, category: s.name || "Uncategorized" })));
  entries.push(...(data.unsectioned ?? []).map(item => ({ item, category: "Uncategorized" })));
  const valid: ProfitItem[] = [];
  let missingCosts = 0;
  for (const { item, category } of entries) {
    if (item.active === false) continue;
    const price = num(item.sp_usd);
    const profitLbp = num(item.gross_profit_lbp);
    const costLbp = num(item.cost_lbp);
    let profit = NaN;
    if (Number.isFinite(rate) && rate > 0 && Number.isFinite(profitLbp)) profit = profitLbp / rate;
    else if (Number.isFinite(rate) && rate > 0 && Number.isFinite(costLbp) && Number.isFinite(price)) profit = price - costLbp / rate;
    if (!(price > 0) || !Number.isFinite(profit)) { missingCosts++; continue; }
    const margin = profit / price;
    const foodCost = Number.isFinite(num(item.food_cost_pct)) ? num(item.food_cost_pct) : 1 - margin;
    valid.push({ name: item.name, category, profitUsd: profit, margin, foodCost, priceUsd: price });
  }
  const map = new Map<string, ProfitItem[]>();
  for (const item of valid) map.set(item.category, [...(map.get(item.category) ?? []), item]);
  const categories: CategoryProfit[] = [...map].map(([name, items]) => ({
    name, count: items.length,
    avgProfitUsd: items.reduce((sum, item) => sum + item.profitUsd, 0) / items.length,
    avgMargin: items.reduce((sum, item) => sum + item.margin, 0) / items.length,
    avgFoodCost: items.reduce((sum, item) => sum + item.foodCost, 0) / items.length,
    aggregateProfitUsd: items.reduce((sum, item) => sum + item.profitUsd, 0),
  }));
  return { categories, topByProfit: [...valid].sort((a, b) => b.profitUsd - a.profitUsd).slice(0, 5), lowMargin: [...valid].filter(i => i.margin < 0.65).sort((a, b) => a.margin - b.margin).slice(0, 5), pricedItems: valid.length, missingCosts };
}

export function HomeDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [statsError, setStatsError] = useState("");
  const [pricingError, setPricingError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<"profit" | "margin">("profit");

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatsError(""); setPricingError("");
    const results = await Promise.allSettled([
      fetch("/api/bo/home/stats", { cache: "no-store" }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not load statistics"); return data as Stats; }),
      fetch("/api/bo/cover", { cache: "no-store" }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not load pricing insights"); return data as PricingResponse; }),
    ]);
    if (results[0].status === "fulfilled") setStats(results[0].value);
    else setStatsError(results[0].reason instanceof Error ? results[0].reason.message : "Statistics unavailable");
    if (results[1].status === "fulfilled") setPricing(results[1].value);
    else setPricingError(results[1].reason instanceof Error ? results[1].reason.message : "Pricing insights unavailable");
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const insights = useMemo(() => pricing ? deriveInsights(pricing) : null, [pricing]);
  const orderedCategories = useMemo(() => [...(insights?.categories ?? [])].sort((a, b) => sortMode === "profit" ? b.avgProfitUsd - a.avgProfitUsd : b.avgMargin - a.avgMargin), [insights, sortMode]);
  const cards = [
    { label: "MENU ITEMS", value: stats?.menuItems, href: "/bo/cover", description: "Menu Pricing records" },
    { label: "VISIBLE ON MENU", value: stats?.visibleMenuItems, href: "/bo/cover", description: "Active menu items" },
    { label: "HIDDEN ITEMS", value: stats?.hiddenMenuItems, href: "/bo/menu", description: "Hidden from the menu" },
    { label: "INGREDIENTS", value: stats?.ingredients, href: "/bo/fnb", description: "Ingredient records" },
    { label: "PRODUCTION", value: stats?.production, href: "/bo/prep", description: "Prep and sauces" },
    { label: "CATEGORIES", value: stats?.categories, href: "/bo/settings", description: "Menu categories" },
  ];
  const ratio = stats && stats.menuItems > 0 ? Math.round(stats.visibleMenuItems / stats.menuItems * 100) : 0;
  const topCategory = orderedCategories[0];
  return <><MobilePricingList /><div className="hidden space-y-4 text-black lg:block">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#25206f]">LIVE COST & MARGIN OVERVIEW</p><h2 className="mt-1 text-xl font-black">Back Office Dashboard</h2><p className="mt-1 text-sm text-gray-600">Inventory, category profitability and menu cost insights.</p></div>
      <button type="button" disabled={loading} onClick={() => void refresh()} className="rounded-lg border border-[#25206f] bg-[#25206f] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#39328a] disabled:opacity-50">{loading ? "REFRESHING…" : "REFRESH DATA ↻"}</button>
    </div>
    {statsError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Stats: {statsError}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(card => <Link key={card.label} href={card.href} className="group rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-[#25206f]/30 hover:shadow-md"><div className="flex items-center justify-between gap-2"><h3 className="text-[11px] font-black uppercase tracking-wide text-gray-600">{card.label}</h3><span className="text-gray-400 group-hover:text-[#25206f]">↗</span></div><div className="mt-3 text-3xl font-black tabular-nums text-gray-950">{stats ? card.value?.toLocaleString() : "—"}</div><p className="mt-2 text-xs text-gray-600">{card.description}</p></Link>)}</div>
    {pricingError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Pricing insights: {pricingError}</p>}
    <div className="grid gap-3 lg:grid-cols-3">
      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><p className="text-[11px] font-black uppercase text-gray-500">Most profitable category</p><p className="mt-2 truncate text-xl font-black text-[#25206f]">{topCategory?.name ?? "—"}</p><p className="mt-2 text-2xl font-black">{topCategory ? money(topCategory.avgProfitUsd) : "—"}</p><p className="mt-1 text-xs text-gray-500">Average gross profit per menu item sold</p></section>
      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><p className="text-[11px] font-black uppercase text-gray-500">Priced items analyzed</p><p className="mt-2 text-3xl font-black text-[#25206f]">{insights ? insights.pricedItems : "—"}</p><p className="mt-2 text-xs text-gray-500">{insights ? `${insights.missingCosts} excluded due to missing price or cost` : "From visible Menu Pricing records"}</p></section>
      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><p className="text-[11px] font-black uppercase text-gray-500">Review workload</p><p className="mt-2 text-3xl font-black text-amber-700">{stats ? stats.reviewLines : "—"}</p><p className="mt-2 text-xs text-gray-500">Recipe lines flagged for review</p></section>
    </div>
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-black">CATEGORY PROFITABILITY</h3><p className="mt-1 text-xs text-gray-600">Compare estimated profit per item sold; this is not a sales-volume ranking.</p></div><div className="flex gap-2"><button type="button" onClick={() => setSortMode("profit")} className={`rounded-lg px-3 py-2 text-xs font-bold ${sortMode === "profit" ? "bg-[#25206f] text-white" : "border bg-white"}`}>Profit $</button><button type="button" onClick={() => setSortMode("margin")} className={`rounded-lg px-3 py-2 text-xs font-bold ${sortMode === "margin" ? "bg-[#25206f] text-white" : "border bg-white"}`}>Margin %</button></div></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[12px]"><thead className="bg-[#f1f1f3] text-[10px] uppercase text-gray-600"><tr><th className="p-3">Category</th><th className="p-3 text-right">Items</th><th className="p-3 text-right">Avg profit / item</th><th className="p-3 text-right">Avg margin</th><th className="p-3 text-right">Avg food cost</th></tr></thead><tbody>{orderedCategories.map(category => <tr key={category.name} className="border-t border-black/10"><td className="p-3 font-bold">{category.name}</td><td className="p-3 text-right">{category.count}</td><td className="p-3 text-right font-bold">{money(category.avgProfitUsd)}</td><td className="p-3 text-right">{percent(category.avgMargin)}</td><td className="p-3 text-right">{percent(category.avgFoodCost)}</td></tr>)}</tbody></table>{!orderedCategories.length && <p className="p-4 text-sm text-gray-500">No valid category pricing data available.</p>}</div>
    </section>
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><h3 className="text-sm font-black">TOP PROFIT PER ITEM</h3><p className="mt-1 text-xs text-gray-600">Highest estimated gross profit for one item sold.</p><div className="mt-4 space-y-2">{insights?.topByProfit.map((item, index) => <div key={`${item.category}-${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-gray-50 p-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{index + 1}. {item.name}</p><p className="text-[11px] text-gray-500">{item.category}</p></div><span className="shrink-0 text-sm font-bold text-emerald-700">{money(item.profitUsd)}</span></div>)}{!insights?.topByProfit.length && <p className="text-sm text-gray-500">No pricing data available.</p>}</div></section>
      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><h3 className="text-sm font-black">COST CONTROL OPPORTUNITIES</h3><p className="mt-1 text-xs text-gray-600">Items with margins below 65% to review.</p><div className="mt-4 space-y-2">{insights?.lowMargin.map((item, index) => <div key={`${item.category}-${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-gray-50 p-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{item.name}</p><p className="text-[11px] text-gray-500">{item.category}</p></div><span className="shrink-0 text-sm font-bold text-amber-700">{percent(item.margin)} margin</span></div>)}{!insights?.lowMargin.length && <p className="text-sm text-gray-500">No lower-margin items found.</p>}</div></section>
    </div>
    <div className="grid gap-3 lg:grid-cols-2"><section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-sm font-black">MENU VISIBILITY</h3><span className="text-xl font-black">{stats ? `${ratio}%` : "—"}</span></div><p className="mt-1 text-xs text-gray-600">Share of menu items visible for pricing.</p><div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${ratio}%` }}/></div><p className="mt-3 text-xs text-gray-600">{stats ? `${stats.visibleMenuItems} visible · ${stats.hiddenMenuItems} hidden` : "Waiting for data"}</p></section><section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><h3 className="text-sm font-black">NEXT ACTIONS</h3><p className="mt-1 text-xs text-gray-600">Review price and cost accuracy before making menu changes.</p><div className="mt-5 flex gap-2"><Link href="/bo/cover" className="rounded-lg border px-4 py-2.5 text-xs font-bold hover:bg-gray-100">MENU PRICING ↗</Link><Link href="/bo/menu" className="rounded-lg border px-4 py-2.5 text-xs font-bold hover:bg-gray-100">REVIEW RECIPES ↗</Link></div></section></div>
    <p className="pb-3 text-xs text-gray-500">Profit and margin comparisons are based on current menu selling prices and recorded recipe costs. Actual best-sellers and category revenue require POS sales quantities and transaction history.</p>
  </div></>;
}
