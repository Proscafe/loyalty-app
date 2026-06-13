"use client";

import { useMemo, useState } from "react";
import { AdminPageShell } from "@/components/AdminPageShell";

type ActivityRow = Record<string, any>;
type ProfileRow = { id: string; full_name?: string | null; phone?: string | null; client_code?: string | null };
type CategoryRow = { id: string; name?: string | null };
type Filter = "today" | "week" | "month" | "all";

const GLASS_CARD = "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "Show all" },
];

function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(value?: string | null) {
  const date = validDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeOnly(value?: string | null) {
  const date = validDate(value);
  if (!date) return "—";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function daysAgo(value?: string | null) {
  const date = validDate(value);
  if (!date) return "—";
  const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  return `${diff}d`;
}

function beirutStampWindowKey(value?: string | null) {
  const date = validDate(value);
  if (!date) return null;
  const beirut = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const hour = beirut.getUTCHours();
  if (hour >= 5 && hour < 9) return null;
  const start = new Date(Date.UTC(beirut.getUTCFullYear(), beirut.getUTCMonth(), beirut.getUTCDate(), 9, 0, 0));
  if (hour < 5) start.setUTCDate(start.getUTCDate() - 1);
  return start.toISOString().slice(0, 10);
}

function isSamePeriod(value: string | null | undefined, filter: Filter) {
  if (filter === "all") return true;
  const date = validDate(value);
  if (!date) return false;
  const now = new Date();
  if (filter === "today") return date.toDateString() === now.toDateString();
  const diff = now.getTime() - date.getTime();
  if (filter === "week") return diff >= 0 && diff <= 7 * 86400000;
  if (filter === "month") return diff >= 0 && diff <= 31 * 86400000;
  return true;
}

function actionLabel(action?: string | null) {
  const value = String(action ?? "activity").replace(/_/g, " ");
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function isStampLike(row: ActivityRow, categoryName: string) {
  const action = String(row.action_type ?? "").toLowerCase();
  if (/reward|redeem|gift|remove|claim|expire|delete|bounced|returned/.test(action)) return false;
  if (categoryName === "—" || categoryName.toLowerCase() === "gift") return false;
  return Boolean(row.client_id || row.category_id || categoryName !== "—");
}

export default function ActivityPageClient({
  transactions,
  profiles,
  categories,
}: {
  transactions: ActivityRow[];
  profiles: ProfileRow[];
  categories: CategoryRow[];
}) {
  const [rows, setRows] = useState<ActivityRow[]>(transactions);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("today");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const enriched = useMemo(() => {
    const base = rows.map((row) => {
      const profile = profileById.get(String(row.client_id ?? ""));
      const category = categoryById.get(String(row.category_id ?? ""));
      const clientName = String(row.client_name ?? profile?.full_name ?? "Client").trim();
      const categoryName = String(row.category_name ?? category?.name ?? (String(row.action_type ?? "").includes("reward") ? "Gift" : "—")).trim();
      return { row, clientName, categoryName };
    });

    const totals = new Map<string, number>();
    const seen = new Map<string, number>();
    const keys = base.map(({ row, clientName, categoryName }) => {
      if (!isStampLike(row, categoryName)) return null;
      const windowKey = beirutStampWindowKey(row.created_at) ?? `${dateOnly(row.created_at)}-${timeOnly(row.created_at)}`;
      return `${clientName.toLowerCase()}::${categoryName.toLowerCase()}::${windowKey}`;
    });

    keys.forEach((key) => {
      if (key) totals.set(key, (totals.get(key) ?? 0) + 1);
    });

    return base.map((item, index) => {
      const key = keys[index];
      if (!key || (totals.get(key) ?? 0) < 2) return { ...item, duplicate: false };
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      return { ...item, duplicate: count > 1 };
    });
  }, [rows, profileById, categoryById]);

  const visibleRows = enriched.filter(({ row, clientName, categoryName }) => {
    const term = query.trim().toLowerCase();
    const matchesSearch = !term || `${clientName} ${categoryName} ${row.issued_by_name ?? row.staff_name ?? ""}`.toLowerCase().includes(term);
    return matchesSearch && isSamePeriod(row.created_at, filter);
  });

  async function deleteStamp(row: ActivityRow) {
    const id = String(row.id ?? "");
    if (!id) return;
    const ok = window.confirm("Delete this stamp? If it created a gift, the gift will be reversed unless already redeemed.");
    if (!ok) return;
    setDeletingId(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/stamp-transactions/${id}`, { method: "DELETE" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not delete stamp.");
      setRows((current) => current.filter((item) => String(item.id) !== id));
      setMessage("Stamp deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete stamp.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminPageShell active="activity">
      <div className="px-4 py-5 lg:px-0 lg:py-0">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[34px] font-black tracking-[-0.04em] text-white">Activity</h1>
            <p className="mt-1 text-sm font-bold text-white/68">Track daily loyalty activity and stamp history.</p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search client name..."
              className="h-12 rounded-[14px] border-0 bg-white px-5 text-sm font-bold text-[#365665] outline-none lg:w-[280px]"
            />
            <div className="flex rounded-[16px] bg-white/12 p-1">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`h-10 rounded-[12px] px-4 text-[11px] font-black ${filter === item.key ? "bg-[#ffd66b] text-[#365665]" : "text-white/86"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {message ? <div className="mb-4 rounded-2xl bg-white/14 px-4 py-3 text-sm font-black text-white">{message}</div> : null}

        <section className="overflow-hidden rounded-[26px] border border-white/10 backdrop-blur-xl" style={{ background: GLASS_CARD }}>
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_0.7fr_0.7fr_0.7fr_0.55fr] border-b border-white/10 px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white lg:grid">
            <span>Client name</span><span>Category</span><span>Issue by</span><span>Date</span><span>Days ago</span><span>Time</span><span>Actions</span>
          </div>
          {visibleRows.length === 0 ? (
            <div className="p-6 text-sm font-bold text-white/70">No activity matches this filter.</div>
          ) : visibleRows.map(({ row, clientName, categoryName, duplicate }) => (
            <div key={String(row.id)} className={`grid gap-3 border-b border-white/8 px-5 py-4 text-sm font-black text-white last:border-b-0 lg:grid-cols-[1.2fr_1fr_1fr_0.7fr_0.7fr_0.7fr_0.55fr] ${duplicate ? "bg-[#ffd66b]/18" : ""}`}>
              <div>
                {clientName}
                {duplicate ? <span className="ml-2 rounded-full bg-[#ffd66b] px-2 py-1 text-[9px] font-black uppercase text-[#365665]">Double</span> : null}
              </div>
              <div>{categoryName}</div>
              <div>{String(row.issued_by_name ?? row.staff_name ?? row.issuer_name ?? "System")}</div>
              <div>{dateOnly(row.created_at)}</div>
              <div className="text-[#d7ffe2]">{daysAgo(row.created_at)}</div>
              <div>{timeOnly(row.created_at)}</div>
              <button
                type="button"
                disabled={deletingId === String(row.id)}
                onClick={() => void deleteStamp(row)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/18 text-red-400 transition hover:bg-white/28 disabled:opacity-50"
                title="Delete stamp"
              >
                🗑
              </button>
            </div>
          ))}
        </section>
      </div>
    </AdminPageShell>
  );
}
