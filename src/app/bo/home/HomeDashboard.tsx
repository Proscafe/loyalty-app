"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = { menuItems: number; visibleMenuItems: number; hiddenMenuItems: number; ingredients: number; production: number; categories: number; reviewLines: number };

export function HomeDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function refresh() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/bo/home/stats", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load dashboard statistics.");
      setStats(payload as Stats);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load statistics."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  const cards = [
    { label: "MENU ITEMS", value: stats?.menuItems, href: "/bo/cover", description: "Items managed in Menu Pricing" },
    { label: "VISIBLE ON MENU", value: stats?.visibleMenuItems, href: "/bo/cover", description: "Currently active menu items" },
    { label: "HIDDEN ITEMS", value: stats?.hiddenMenuItems, href: "/bo/menu", description: "Items excluded from Menu Pricing" },
    { label: "INGREDIENTS", value: stats?.ingredients, href: "/bo/fnb", description: "Ingredient records" },
    { label: "PRODUCTION RECIPES", value: stats?.production, href: "/bo/prep", description: "Prep and sauce definitions" },
    { label: "MENU CATEGORIES", value: stats?.categories, href: "/bo/settings", description: "Managed in Settings" },
  ];
  const ratio = stats && stats.menuItems > 0 ? Math.round(stats.visibleMenuItems / stats.menuItems * 100) : 0;
  return <div className="space-y-5 text-black">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-gray-500">LIVE DATABASE OVERVIEW</p><h2 className="mt-1 text-xl font-black">Back Office Dashboard</h2><p className="mt-1 text-sm text-gray-600">Current inventory, menu coverage, and review workload.</p></div>
      <button type="button" disabled={loading} onClick={() => void refresh()} className="rounded-lg border border-black/20 bg-white px-4 py-2.5 text-xs font-bold hover:bg-gray-100 disabled:opacity-50">{loading ? "LOADING…" : "REFRESH STATS"}</button>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} <button type="button" className="ml-2 font-bold underline" onClick={() => void refresh()}>Retry</button></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(card => <Link key={card.label} href={card.href} className="group rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-black/30 hover:shadow-md">
        <div className="flex items-center justify-between gap-2"><h3 className="text-[11px] font-black uppercase tracking-wide text-gray-600">{card.label}</h3><span className="text-gray-500 group-hover:text-black">↗</span></div>
        <div className="mt-4 text-4xl font-black tabular-nums text-gray-950">{stats ? card.value?.toLocaleString() : "—"}</div>
        <p className="mt-2 text-xs text-gray-600">{card.description}</p>
      </Link>)}
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-sm font-black">MENU VISIBILITY</h3><span className="text-xl font-black tabular-nums">{stats ? `${ratio}%` : "—"}</span></div><p className="mt-1 text-xs text-gray-600">Share of menu items currently visible for pricing.</p><div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${ratio}%` }}/></div><p className="mt-3 text-xs text-gray-600">{stats ? `${stats.visibleMenuItems} visible · ${stats.hiddenMenuItems} hidden` : "Waiting for data"}</p></section>
      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black">REVIEW QUEUE</h3><p className="mt-1 text-xs text-gray-600">Recipe lines marked for review.</p></div><div className={`rounded-xl px-4 py-3 text-2xl font-black tabular-nums ${stats?.reviewLines ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-800"}`}>{stats ? stats.reviewLines.toLocaleString() : "—"}</div></div><div className="mt-5"><Link href="/bo/menu" className="inline-flex rounded-lg border border-black/20 bg-white px-4 py-2.5 text-xs font-bold hover:bg-gray-100">OPEN RECIPES →</Link></div></section>
    </div>
  </div>;
}
