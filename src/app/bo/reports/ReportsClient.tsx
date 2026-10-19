"use client";

import { useEffect, useState } from "react";
import { BOFrame } from "../BOFrame";
import { moneyLbp, pct } from "../format";
import { ConsumptionSalesClient } from "./ConsumptionSalesClient";

type Row = Record<string, any>;

function foodCostTone(value: unknown) {
  if (value == null || !Number.isFinite(Number(value))) return "text-black/50";
  const percent = Number(value) * 100;
  return percent <= 30 ? "text-emerald-700" : percent <= 35 ? "text-amber-700" : "text-red-700";
}


export function ReportsClient() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/bo/reports", { cache: "no-store" });
        const body = await res.text();
        let json: any;
        try { json = JSON.parse(body); } catch { throw new Error(`Reports API returned HTTP ${res.status} without JSON.`); }
        if (!res.ok) throw new Error(json?.error || "Unable to load reports.");
        setData(json);
      } catch (err) { setError(err instanceof Error ? err.message : "Unable to load reports."); }
    })();
  }, []);

  return (
    <BOFrame
      active="/bo/reports"
      title="REPORTS"
      subtitle="Overview, food cost, profit and review queue."
    >
      {error ? <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-[12px] font-bold">{error}</div> : null}

      <ConsumptionSalesClient />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["MENU ITEMS", data?.totals?.menu_items ?? 0],
          ["INGREDIENTS", data?.totals?.ingredients ?? 0],
          ["RECIPES", data?.totals?.recipes ?? 0],
          ["UTILITIES", data?.totals?.utilities ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-[16px] border border-black/10 bg-white p-4">
            <div className="text-[9px] font-black uppercase tracking-[0.08em] text-black/60">{label}</div>
            <div className="mt-2 text-[25px] font-black text-black">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-[16px] border border-black/10 bg-white p-4">
          <h2 className="text-[13px] font-black uppercase">CATEGORY FOOD COST</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="text-[9px] font-black uppercase text-black/50">
                <tr><th className="py-2">CATEGORY</th><th className="py-2 text-right">ITEMS</th><th className="py-2 text-right">FOOD COST</th><th className="py-2 text-right">OVER</th></tr>
              </thead>
              <tbody>
                {(data?.by_category ?? []).map((row: Row) => (
                  <tr key={row.name} className="border-t border-black/10 text-[11px]">
                    <td className="py-3 font-black">{row.name}</td>
                    <td className="py-3 text-right">{row.items}</td>
                    <td className={`py-3 text-right font-bold ${foodCostTone(row.weighted_food_cost_pct)}`}>{pct(row.weighted_food_cost_pct)}</td>
                    <td className="py-3 text-right">{row.over}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[16px] border border-black/10 bg-white p-4">
          <h2 className="text-[13px] font-black uppercase">HIGHEST FOOD COST</h2>
          <div className="mt-3 space-y-2">
            {(data?.highest_food_cost ?? []).slice(0, 10).map((row: Row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-gray-50 px-3 py-2">
                <span className="text-[11px] font-bold">{row.name}</span>
                <span className={`text-[11px] font-black ${foodCostTone(row.food_cost_pct)}`}>{pct(row.food_cost_pct)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[16px] border border-black/10 bg-white p-4">
          <h2 className="text-[13px] font-black uppercase">LOWEST PROFIT</h2>
          <div className="mt-3 space-y-2">
            {(data?.lowest_profit ?? []).slice(0, 10).map((row: Row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-gray-50 px-3 py-2">
                <span className="text-[11px] font-bold">{row.name}</span>
                <span className="text-[11px] font-black">{moneyLbp(row.gross_profit_lbp)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[16px] border border-black/10 bg-white p-4">
          <h2 className="text-[13px] font-black uppercase">REVIEW QUEUE</h2>
          <div className="mt-3 space-y-2">
            {(data?.issues ?? []).slice(0, 15).map((row: Row) => (
              <div key={row.id} className="rounded-[10px] bg-gray-50 px-3 py-3">
                <div className="text-[9px] font-black uppercase tracking-[0.08em] text-black">{row.severity} · {row.category}</div>
                <div className="mt-1 text-[11px] font-semibold leading-5 text-black/70">{row.message}</div>
              </div>
            ))}
            {!data?.issues?.length ? <div className="text-[11px] text-black/50">NO OPEN REVIEW ITEMS</div> : null}
          </div>
        </section>
      </div>
    </BOFrame>
  );
}
