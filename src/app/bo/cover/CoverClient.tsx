"use client";

import { useEffect, useMemo, useState } from "react";
import { BOFrame } from "../BOFrame";
import { moneyLbp, moneyUsd, pct } from "../format";

type Row = Record<string, any>;

export function CoverClient() {
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    const res = await fetch("/api/bo/cover", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) setError(json?.error || "Unable to load Cover.");
    else setData(json);
  }

  useEffect(() => { void load(); }, []);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = [...(data?.sections ?? [])];

    if (data?.unsectioned?.length) {
      all.push({ id: "none", name: "UNSECTIONED", items: data.unsectioned });
    }

    return all
      .map((section: Row) => ({
        ...section,
        items: (section.items ?? []).filter(
          (item: Row) => !q || String(item.name).toLowerCase().includes(q),
        ),
      }))
      .filter((section: Row) => section.items.length);
  }, [data, search]);

  async function updatePrice(id: number, value: string) {
    setSavingId(id);
    setError("");

    const res = await fetch("/api/bo/cover", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        sp_usd: value.trim() === "" ? null : Number(value),
      }),
    });

    const json = await res.json();
    setSavingId(null);

    if (!res.ok) {
      setError(json?.error || "Unable to update price.");
      return;
    }

    await load();
  }

  return (
    <BOFrame
      active="/bo/cover"
      title="COVER"
      subtitle={`Selling price vs live cost · rate ${Number(data?.rate ?? 0).toLocaleString()} LBP/USD`}
    >
      {error ? <div className="mb-4 rounded-[12px] bg-red-950/35 px-4 py-3 text-[12px] font-bold">{error}</div> : null}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="SEARCH COVER ITEM"
        className="mb-4 w-full rounded-[11px] bg-[#1e3025] px-3 py-3 text-[12px] font-bold outline-none"
      />

      <div className="space-y-5">
        {sections.map((section: Row) => (
          <section key={String(section.id)} className="overflow-hidden rounded-[16px] border border-white/10">
            <div className="bg-[#ffd66b]/10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#ffd66b]">
              {section.name}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left">
                <thead className="bg-[#1d2e24] text-[9px] font-black uppercase text-white/45">
                  <tr>
                    <th className="px-4 py-3">ITEM</th>
                    <th className="px-3 py-3 text-right">SP USD</th>
                    <th className="px-3 py-3 text-right">SP LBP</th>
                    <th className="px-3 py-3 text-right">COST</th>
                    <th className="px-3 py-3 text-right">FOOD COST</th>
                    <th className="px-3 py-3 text-right">PROFIT</th>
                    <th className="px-3 py-3 text-right">MARGIN</th>
                    <th className="px-3 py-3 text-right">CURRENT PRICE</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item: Row) => (
                    <tr key={item.id} className={`border-t border-white/[0.07] text-[12px] ${item.over_threshold ? "bg-red-950/10" : ""}`}>
                      <td className="px-4 py-3 font-black">{item.name}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          key={`${item.id}-${item.sp_usd}`}
                          defaultValue={item.sp_usd ?? ""}
                          onBlur={(e) => void updatePrice(Number(item.id), e.target.value)}
                          className="w-[94px] rounded-[8px] bg-[#f4e8b7] px-2 py-2 text-right font-black text-[#26382d] outline-none"
                        />
                        {savingId === item.id ? <span className="ml-2 text-[9px] text-white/35">...</span> : null}
                      </td>
                      <td className="px-3 py-3 text-right">{moneyLbp(item.sp_lbp)}</td>
                      <td className="px-3 py-3 text-right">{moneyLbp(item.cost_lbp)}</td>
                      <td className={`px-3 py-3 text-right font-black ${item.over_threshold ? "text-red-300" : "text-[#ffd66b]"}`}>{pct(item.food_cost_pct)}</td>
                      <td className="px-3 py-3 text-right">{moneyLbp(item.gross_profit_lbp)}</td>
                      <td className="px-3 py-3 text-right">{pct(item.margin_pct)}</td>
                      <td className="px-3 py-3 text-right">{moneyLbp(item.current_price_lbp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </BOFrame>
  );
}
