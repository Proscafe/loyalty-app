"use client";

import { useEffect, useState } from "react";
import { BOFrame } from "../BOFrame";
import { moneyLbp, pct } from "../format";

type Row = Record<string, any>;

export function ReportsClient() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/bo/reports", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) setError(json?.error || "Unable to load reports.");
      else setData(json);
    })();
  }, []);

  return (
    <BOFrame
      active="/bo/reports"
      title="REPORTS"
      subtitle="Overview, food cost, profit and review queue."
    >
      {error ? <div className="mb-4 rounded-[12px] bg-red-950/35 px-4 py-3 text-[12px] font-bold">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["MENU ITEMS", data?.totals?.menu_items ?? 0],
          ["INGREDIENTS", data?.totals?.ingredients ?? 0],
          ["RECIPES", data?.totals?.recipes ?? 0],
          ["UTILITIES", data?.totals?.utilities ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-[16px] border border-white/10 bg-white/[0.045] p-4">
            <div className="text-[9px] font-black uppercase tracking-[0.08em] text-white/35">{label}</div>
            <div className="mt-2 text-[25px] font-black text-[#ffd66b]">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-[16px] border border-white/10 bg-white/[0.045] p-4">
          <h2 className="text-[13px] font-black uppercase">CATEGORY FOOD COST</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="text-[9px] font-black uppercase text-white/35">
                <tr><th className="py-2">CATEGORY</th><th className="py-2 text-right">ITEMS</th><th className="py-2 text-right">FOOD COST</th><th className="py-2 text-right">OVER</th></tr>
              </thead>
              <tbody>
                {(data?.by_category ?? []).map((row: Row) => (
                  <tr key={row.name} className="border-t border-white/8 text-[11px]">
                    <td className="py-3 font-black">{row.name}</td>
                    <td className="py-3 text-right">{row.items}</td>
                    <td className="py-3 text-right text-[#ffd66b]">{pct(row.weighted_food_cost_pct)}</td>
                    <td className="py-3 text-right">{row.over}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[16px] border border-white/10 bg-white/[0.045] p-4">
          <h2 className="text-[13px] font-black uppercase">HIGHEST FOOD COST</h2>
          <div className="mt-3 space-y-2">
            {(data?.highest_food_cost ?? []).slice(0, 10).map((row: Row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-white/[0.04] px-3 py-2">
                <span className="text-[11px] font-bold">{row.name}</span>
                <span className="text-[11px] font-black text-[#ffd66b]">{pct(row.food_cost_pct)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[16px] border border-white/10 bg-white/[0.045] p-4">
          <h2 className="text-[13px] font-black uppercase">LOWEST PROFIT</h2>
          <div className="mt-3 space-y-2">
            {(data?.lowest_profit ?? []).slice(0, 10).map((row: Row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-white/[0.04] px-3 py-2">
                <span className="text-[11px] font-bold">{row.name}</span>
                <span className="text-[11px] font-black">{moneyLbp(row.gross_profit_lbp)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[16px] border border-white/10 bg-white/[0.045] p-4">
          <h2 className="text-[13px] font-black uppercase">REVIEW QUEUE</h2>
          <div className="mt-3 space-y-2">
            {(data?.issues ?? []).slice(0, 15).map((row: Row) => (
              <div key={row.id} className="rounded-[10px] bg-white/[0.04] px-3 py-3">
                <div className="text-[9px] font-black uppercase tracking-[0.08em] text-[#ffd66b]">{row.severity} · {row.category}</div>
                <div className="mt-1 text-[11px] font-semibold leading-5 text-white/70">{row.message}</div>
              </div>
            ))}
            {!data?.issues?.length ? <div className="text-[11px] text-white/35">NO OPEN REVIEW ITEMS</div> : null}
          </div>
        </section>
      </div>
    </BOFrame>
  );
}
