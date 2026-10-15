"use client";

import { FormEvent, useEffect, useState } from "react";
import { BOFrame } from "../BOFrame";

type Row = Record<string, any>;

export function SettingsClient() {
  const [data, setData] = useState<any>(null);
  const [draft, setDraft] = useState<any>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/bo/settings", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Unable to load settings.");
      return;
    }
    setData(json);
    setDraft(json.settings ?? {});
  }

  useEffect(() => { void load(); }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/bo/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: draft }),
    });

    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(json?.error || "Unable to save settings.");
      return;
    }

    setMessage("SETTINGS SAVED");
    await load();
  }

  return (
    <BOFrame
      active="/bo/settings"
      title="SETTINGS"
      subtitle="Central exchange rate and costing rules."
    >
      {error ? <div className="mb-4 rounded-[12px] bg-red-950/35 px-4 py-3 text-[12px] font-bold">{error}</div> : null}
      {message ? <div className="mb-4 rounded-[12px] bg-[#ffd66b]/10 px-4 py-3 text-[11px] font-black uppercase text-[#ffd66b]">{message}</div> : null}

      <form onSubmit={save} className="rounded-[18px] border border-white/10 bg-white/[0.045] p-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label>
            <span className="mb-2 block text-[10px] font-black uppercase text-white/45">USD → LBP RATE</span>
            <input value={draft.usd_lbp_rate ?? ""} onChange={(e) => setDraft({ ...draft, usd_lbp_rate: e.target.value })} className="w-full rounded-[10px] bg-white px-3 py-3 font-black text-[#26382d]" />
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-black uppercase text-white/45">FOOD COST THRESHOLD</span>
            <input value={draft.food_cost_threshold ?? ""} onChange={(e) => setDraft({ ...draft, food_cost_threshold: e.target.value })} placeholder="0.40" className="w-full rounded-[10px] bg-white px-3 py-3 font-black text-[#26382d]" />
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-black uppercase text-white/45">CURRENT PRICE ADJUSTMENT</span>
            <input value={draft.price_adjust_pct ?? ""} onChange={(e) => setDraft({ ...draft, price_adjust_pct: e.target.value })} placeholder="0.10" className="w-full rounded-[10px] bg-white px-3 py-3 font-black text-[#26382d]" />
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-black uppercase text-white/45">BAR COST THRESHOLD</span>
            <input value={draft.bar_cost_threshold ?? ""} onChange={(e) => setDraft({ ...draft, bar_cost_threshold: e.target.value })} placeholder="0.30" className="w-full rounded-[10px] bg-white px-3 py-3 font-black text-[#26382d]" />
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-black uppercase text-white/45">LBP ROUNDING</span>
            <input value={draft.lbp_rounding ?? ""} onChange={(e) => setDraft({ ...draft, lbp_rounding: e.target.value })} className="w-full rounded-[10px] bg-white px-3 py-3 font-black text-[#26382d]" />
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-black uppercase text-white/45">DISPLAY CURRENCY</span>
            <select value={draft.display_currency ?? "LBP"} onChange={(e) => setDraft({ ...draft, display_currency: e.target.value })} className="w-full rounded-[10px] bg-white px-3 py-3 font-black text-[#26382d]">
              <option>LBP</option><option>USD</option>
            </select>
          </label>
        </div>

        <button disabled={busy} className="mt-5 rounded-[11px] bg-[#ffd66b] px-5 py-3 text-[11px] font-black uppercase text-[#26382d] disabled:opacity-60">
          {busy ? "SAVING..." : "SAVE SETTINGS"}
        </button>
      </form>

      <div className="mt-5 grid gap-4 xl:grid-cols-4">
        {[
          ["INGREDIENT CATEGORIES", data?.ingredient_categories],
          ["MENU CATEGORIES", data?.menu_categories],
          ["COVER SECTIONS", data?.cover_sections],
          ["SUPPLIERS", data?.suppliers],
        ].map(([title, rows]) => (
          <section key={String(title)} className="rounded-[16px] border border-white/10 bg-white/[0.045] p-4">
            <h2 className="text-[11px] font-black uppercase text-[#ffd66b]">{title}</h2>
            <div className="mt-3 max-h-[320px] space-y-1 overflow-y-auto">
              {((rows as Row[]) ?? []).map((row: Row) => (
                <div key={row.id} className="rounded-[8px] bg-white/[0.04] px-3 py-2 text-[10px] font-bold text-white/65">{row.name}</div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </BOFrame>
  );
}
