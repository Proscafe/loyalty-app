"use client";

import { useEffect, useMemo, useState } from "react";

type PriceItem = { id: number; name: string; sp_usd: number | null; cost_lbp: number | null; gross_profit_lbp: number | null };
type PriceSection = { id: number | string; name: string; items: PriceItem[] };
type PricePayload = { sections?: PriceSection[]; unsectioned?: PriceItem[]; rate?: number; error?: string };

const usd = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? `$${value.toFixed(2)}` : "—";

export function MobilePricingList() {
  const [payload, setPayload] = useState<PricePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/bo/cover", { cache: "no-store" })
      .then(async (res) => { const data = await res.json() as PricePayload; if (!res.ok) throw new Error(data.error || "Unable to load Menu Pricing."); return data; })
      .then((data) => { if (!cancelled) setPayload(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load prices."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  const groups = useMemo(() => {
    const all = [...(payload?.sections || [])];
    if (payload?.unsectioned?.length) all.push({ id: "uncategorized", name: "Uncategorized", items: payload.unsectioned });
    const query = search.toLocaleLowerCase().trim();
    return all.map(group => ({ ...group, items: group.items.filter(item => !query || item.name.toLocaleLowerCase().includes(query)) }))
      .filter(group => group.items.length > 0);
  }, [payload, search]);

  const rate = Number(payload?.rate) || 0;
  const rows = groups.reduce((total, group) => total + group.items.length, 0);
  return <section className="space-y-3 lg:hidden" aria-label="Mobile menu pricing overview">
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">MENU PRICING</h2><p className="mt-1 text-xs text-gray-600">Read-only price and profitability overview</p></div><button type="button" onClick={() => setRevision(v => v + 1)} disabled={loading} className="rounded-lg border border-black/20 px-3 py-2 text-xs font-bold disabled:opacity-50">Refresh</button></div>
      <input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search menu items" placeholder="Search menu items..." className="mt-4 w-full rounded-xl border border-black/20 bg-white px-3 py-3 text-base outline-none focus:border-black" />
      {!loading && !error && <p className="mt-2 text-xs text-gray-500">{rows} menu items · Prices in USD</p>}
    </div>
    {loading && <p className="rounded-xl bg-white p-4 text-sm">Loading menu prices…</p>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {!loading && !error && groups.map(group => <section key={String(group.id)} className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      <h3 className="border-b border-black/10 bg-gray-100 px-4 py-3 text-xs font-black uppercase">{group.name} ({group.items.length})</h3>
      <div className="divide-y divide-black/10">{group.items.map(item => {
        const price = item.sp_usd == null ? null : Number(item.sp_usd);
        const cost = item.cost_lbp == null || rate <= 0 ? null : Number(item.cost_lbp) / rate;
        const profit = item.gross_profit_lbp == null || rate <= 0 ? (price != null && cost != null ? price - cost : null) : Number(item.gross_profit_lbp) / rate;
        return <article key={item.id} className="px-4 py-3"><h4 className="mb-2 text-[13px] font-bold text-black">{item.name}</h4><div className="grid grid-cols-3 gap-2 text-left">
          <div className="rounded-lg bg-gray-50 p-2"><div className="text-[10px] font-semibold uppercase text-gray-500">Sell USD</div><div className="mt-1 text-sm font-bold tabular-nums">{usd(price)}</div></div>
          <div className="rounded-lg bg-gray-50 p-2"><div className="text-[10px] font-semibold uppercase text-gray-500">Cost USD</div><div className="mt-1 text-sm font-bold tabular-nums">{usd(cost)}</div></div>
          <div className="rounded-lg bg-gray-50 p-2"><div className="text-[10px] font-semibold uppercase text-gray-500">Profit USD</div><div className={`mt-1 text-sm font-bold tabular-nums ${profit != null && profit < 0 ? "text-red-700" : "text-emerald-700"}`}>{usd(profit)}</div></div>
        </div></article>;
      })}</div>
    </section>)}
    {!loading && !error && !groups.length && <p className="rounded-xl bg-white p-4 text-sm text-gray-600">No matching menu items.</p>}
  </section>;
}
