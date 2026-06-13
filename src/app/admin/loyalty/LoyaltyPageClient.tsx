"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminPageShell } from "@/components/AdminPageShell";

const GLASS_CARD = "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";

type Settings = {
  id: string;
  program_name: string;
  stamp_name: string;
  gift_name: string;
  is_enabled: boolean;
  average_stamp_cost: number;
  stamps_per_gift: number;
  currency: string;
};

type Category = {
  id: string;
  name: string;
  sort_order?: number | null;
  is_active?: boolean | null;
  average_price?: number | null;
};

const DEFAULT_SETTINGS: Settings = {
  id: "default",
  program_name: "PRO’s Club",
  stamp_name: "Stamp",
  gift_name: "Gift",
  is_enabled: true,
  average_stamp_cost: 0,
  stamps_per_gift: 5,
  currency: "$",
};

function parseNumber(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function LoyaltyPageClient() {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(null), 2400);
  }

  async function load() {
    setLoading(true);
    const [settingsResult, categoryResult] = await Promise.all([
      supabase.from("loyalty_program_settings").select("*").limit(1),
      supabase.from("loyalty_categories").select("*").order("sort_order", { ascending: true }),
    ]);

    if (!settingsResult.error && settingsResult.data?.[0]) {
      const row = settingsResult.data[0] as Partial<Settings>;
      setSettings({
        ...DEFAULT_SETTINGS,
        ...row,
        id: String(row.id || "default"),
        is_enabled: row.is_enabled !== false,
        average_stamp_cost: parseNumber(row.average_stamp_cost),
        stamps_per_gift: Math.max(1, Number(row.stamps_per_gift) || 5),
        currency: String(row.currency || "$"),
      });
    }
    if (!categoryResult.error) setCategories((categoryResult.data ?? []) as Category[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings(next = settings) {
    setSaving(true);
    try {
      const payload = {
        id: next.id || "default",
        program_name: next.program_name.trim() || DEFAULT_SETTINGS.program_name,
        stamp_name: next.stamp_name.trim() || DEFAULT_SETTINGS.stamp_name,
        gift_name: next.gift_name.trim() || DEFAULT_SETTINGS.gift_name,
        is_enabled: next.is_enabled,
        average_stamp_cost: parseNumber(next.average_stamp_cost),
        stamps_per_gift: Math.max(1, Number(next.stamps_per_gift) || 5),
        currency: next.currency.trim() || "$",
      };

      const response = await fetch("/api/admin/loyalty-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not save loyalty program.");
      setSettings((current) => ({ ...current, ...payload, ...(json.settings ?? {}) }));
      showMessage("Loyalty program saved.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not save loyalty program.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(enabled: boolean) {
    const next = { ...settings, is_enabled: enabled };
    setSettings(next);
    await saveSettings(next);
  }

  async function saveCategory(category: Category) {
    setSavingCategoryId(category.id);
    const payload = {
      name: category.name.trim(),
      is_active: category.is_active !== false,
      average_price: parseNumber(category.average_price),
      sort_order: category.sort_order ?? 0,
    };
    const { error } = await supabase.from("loyalty_categories").update(payload).eq("id", category.id);
    setSavingCategoryId(null);
    if (error) showMessage(error.message);
    else showMessage("Category saved.");
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const { error } = await supabase.from("loyalty_categories").insert({
      name,
      is_active: true,
      sort_order: categories.length + 1,
      average_price: 0,
    });
    if (error) showMessage(error.message);
    else {
      setNewCategoryName("");
      await load();
      showMessage("Category added.");
    }
  }

  return (
    <AdminPageShell active="loyalty-program">
      <div className="px-4 py-5 lg:px-0 lg:py-0">
        <header
          className="mb-5 rounded-[28px] border border-white/10 p-5 backdrop-blur-xl lg:mb-6 lg:flex lg:flex-row lg:items-end lg:justify-between"
          style={{ background: GLASS_CARD }}
        >
          <div>
            <h1 className="text-[34px] font-black tracking-[-0.04em] text-white">Loyalty Program</h1>
            <p className="mt-1 hidden text-sm font-bold text-white/68 lg:block">Manage program status, stamp rules, and category values.</p>
          </div>
          <button
            type="button"
            onClick={() => void toggleEnabled(!settings.is_enabled)}
            className={`hidden h-12 rounded-full px-6 text-[12px] font-black uppercase tracking-[0.14em] lg:block ${settings.is_enabled ? "bg-[#ffd66b] text-[#365665]" : "bg-white/14 text-white"}`}
          >
            {settings.is_enabled ? "Enabled" : "Disabled"}
          </button>
        </header>

        <section className="mb-5 rounded-[28px] border border-white/10 p-5 backdrop-blur-xl lg:hidden" style={{ background: GLASS_CARD }}>
          <div className="mb-7 flex justify-start">
            <span className="pt-1 text-[18px] font-black uppercase tracking-[0.12em] text-emerald-100">
              {settings.is_enabled ? "Active" : "Inactive"}
            </span>
          </div>
          <h2 className="mb-4 text-[22px] font-black tracking-[-0.04em] text-white">{settings.program_name}</h2>
          <button
            type="button"
            onClick={() => void toggleEnabled(!settings.is_enabled)}
            className={`h-12 w-full rounded-full px-6 text-[12px] font-black uppercase tracking-[0.14em] ${settings.is_enabled ? "bg-[#9d8178] text-white" : "bg-[#ffd66b] text-[#365665]"}`}
          >
            {settings.is_enabled ? "Disable Program" : "Enable Program"}
          </button>
        </section>

        {message ? <div className="mb-4 rounded-2xl bg-white/14 px-4 py-3 text-sm font-black text-white">{message}</div> : null}

        <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[28px] border border-white/10 p-5 backdrop-blur-xl" style={{ background: GLASS_CARD }}>
            <h2 className="text-2xl font-black text-white">Program settings</h2>
            <div className="mt-5 space-y-4">
              {[
                ["Program name", "program_name"],
                ["Stamp name", "stamp_name"],
                ["Gift name", "gift_name"],
                ["Currency", "currency"],
              ].map(([label, key]) => (
                <label key={key} className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/62">{label}</span>
                  <input
                    value={String(settings[key as keyof Settings])}
                    onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/12 px-4 text-sm font-black text-white outline-none placeholder:text-white/38"
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/62">Stamps per gift</span>
                <input
                  type="number"
                  value={settings.stamps_per_gift}
                  onChange={(event) => setSettings((current) => ({ ...current, stamps_per_gift: Number(event.target.value) }))}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/12 px-4 text-sm font-black text-white outline-none"
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSettings()}
                className="h-12 w-full rounded-full bg-[#ffd66b] text-[12px] font-black uppercase tracking-[0.14em] text-[#365665] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save settings"}
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 p-5 backdrop-blur-xl" style={{ background: GLASS_CARD }}>
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">Categories</h2>
                <p className="text-xs font-bold text-white/62">Average price is used in Lifetime $ calculations.</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="New category"
                  className="h-11 rounded-2xl border border-white/10 bg-white/12 px-4 text-sm font-black text-white outline-none placeholder:text-white/38"
                />
                <button type="button" onClick={() => void addCategory()} className="h-11 rounded-2xl bg-[#ffd66b] px-4 text-[11px] font-black uppercase text-[#365665]">Add</button>
              </div>
            </div>
            {loading ? (
              <div className="p-5 text-sm font-black text-white/70">Loading...</div>
            ) : (
              <div className="space-y-3">
                {categories.map((category, index) => (
                  <div key={category.id} className="grid gap-3 rounded-[22px] border border-white/10 bg-white/8 p-4 lg:grid-cols-[1fr_0.45fr_0.45fr_auto] lg:items-center">
                    <input
                      value={category.name}
                      onChange={(event) => setCategories((current) => current.map((item) => item.id === category.id ? { ...item, name: event.target.value } : item))}
                      className="h-11 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-black text-white outline-none"
                    />
                    <input
                      type="number"
                      value={category.average_price ?? 0}
                      onChange={(event) => setCategories((current) => current.map((item) => item.id === category.id ? { ...item, average_price: Number(event.target.value) } : item))}
                      className="h-11 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-black text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCategories((current) => current.map((item) => item.id === category.id ? { ...item, is_active: item.is_active === false } : item))}
                      className={`h-11 rounded-2xl px-4 text-[11px] font-black uppercase ${category.is_active === false ? "bg-white/12 text-white" : "bg-[#ffd66b] text-[#365665]"}`}
                    >
                      {category.is_active === false ? "Off" : "On"}
                    </button>
                    <button
                      type="button"
                      disabled={savingCategoryId === category.id}
                      onClick={() => void saveCategory({ ...category, sort_order: category.sort_order ?? index + 1 })}
                      className="h-11 rounded-2xl bg-white/14 px-4 text-[11px] font-black uppercase text-white disabled:opacity-60"
                    >
                      Save
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}
