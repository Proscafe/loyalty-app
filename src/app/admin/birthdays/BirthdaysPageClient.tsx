"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminPageShell } from "@/components/AdminPageShell";

type BirthdayRow = Record<string, any>;
type Segment = "all" | "today" | "week" | "month" | "sent" | "claimed" | "pending" | "not_contacted";

const PAGE_BG = "radial-gradient(circle at top left, rgba(255,214,107,0.24), transparent 28%), linear-gradient(135deg, #365665 0%, #263f49 48%, #798673 100%)";
const GLASS_PANEL = "rgba(255,255,255,0.10)";
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "All" }, { key: "today", label: "Today" }, { key: "week", label: "This Week" }, { key: "month", label: "This Month" }, { key: "sent", label: "Gifts Sent" }, { key: "claimed", label: "Claimed Gifts" }, { key: "pending", label: "Pending Gifts" }, { key: "not_contacted", label: "Not Contacted" },
];

function cleanText(value?: unknown) { const text = String(value ?? "").trim(); return text || "—"; }
function getText(row: BirthdayRow, keys: string[]) { for (const key of keys) { const value = row[key]; if (value === null || value === undefined) continue; const text = String(value).trim(); if (text) return text; } return ""; }
function validDate(value?: string | null) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function birthdayDate(value?: string | null) { const date = validDate(value); if (!date) return null; return date; }
function dateOnly(value?: string | null) { const date = validDate(value); if (!date) return "—"; return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function formatBirthday(value?: string | null) { const date = birthdayDate(value); if (!date) return cleanText(value); return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function dayOfYear(date: Date) { const start = new Date(date.getFullYear(), 0, 0); return Math.floor((date.getTime() - start.getTime()) / 86400000); }
function birthdayThisYear(value?: string | null) { const date = birthdayDate(value); if (!date) return null; const now = new Date(); return new Date(now.getFullYear(), date.getMonth(), date.getDate()); }
function daysUntilBirthday(value?: string | null) { const target = birthdayThisYear(value); if (!target) return null; const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (target.getTime() < today.getTime()) target.setFullYear(target.getFullYear() + 1); return Math.ceil((target.getTime() - today.getTime()) / 86400000); }
function csvEscape(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export default function BirthdaysPageClient() {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [rowsRaw, setRowsRaw] = useState<BirthdayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadBirthdays() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/birthday-datasheet", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Could not load birthdays.");
        if (mounted) setRowsRaw(Array.isArray(payload?.rows) ? payload.rows : []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Could not load birthdays.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadBirthdays();
    return () => { mounted = false; };
  }, []);

  const rows = useMemo(() => rowsRaw.map((row, index) => {
    const name = getText(row, ["name", "Name", "full_name", "Full Name", "customer_name", "Customer Name"]) || "Customer";
    const phone = getText(row, ["phone", "Phone", "Phone number", "phone_number", "mobile", "Mobile", "contact", "Contact"]);
    const birthday = getText(row, ["birthday", "Birthday", "birth_date", "Birth date", "date_of_birth", "Date of birth", "dob", "DOB"]);
    const status = cleanText(row.gift_status ?? row.status ?? row.GiftStatus ?? row["Gift Status"] ?? "Pending");
    const source = cleanText(row.source ?? row.Source ?? "Datasheet");
    const lastContacted = cleanText(row.last_contacted_at ?? row.contacted_at ?? row["Last Contacted"]);
    const daysLeft = daysUntilBirthday(birthday);
    return { id: String(row.id ?? `${name}-${phone}-${index}`), name, phone: phone || "—", birthday, birthdayLabel: formatBirthday(birthday), daysLeft, status, source, gift: cleanText(row.gift ?? row.Gift ?? row.reward ?? row.Reward ?? "Birthday Gift"), lastContacted, createdAt: cleanText(row.created_at ?? row.CreatedAt), raw: row };
  }).sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999)), [rowsRaw]);

  const visibleRows = rows.filter((row) => {
    const term = query.trim().toLowerCase();
    const matchesSearch = !term || `${row.name} ${row.phone} ${row.birthdayLabel} ${row.status} ${row.source}`.toLowerCase().includes(term);
    const status = row.status.toLowerCase();
    const matchesSegment = segment === "all" || (segment === "today" && row.daysLeft === 0) || (segment === "week" && row.daysLeft !== null && row.daysLeft <= 7) || (segment === "month" && row.daysLeft !== null && row.daysLeft <= 30) || (segment === "sent" && /sent/i.test(status)) || (segment === "claimed" && /claim|redeem/i.test(status)) || (segment === "pending" && /pending/i.test(status)) || (segment === "not_contacted" && row.lastContacted === "—");
    return matchesSearch && matchesSegment;
  });

  const summary = {
    today: rows.filter((row) => row.daysLeft === 0).length,
    week: rows.filter((row) => row.daysLeft !== null && row.daysLeft <= 7).length,
    month: rows.filter((row) => row.daysLeft !== null && row.daysLeft <= 30).length,
    sent: rows.filter((row) => /sent/i.test(row.status)).length,
    claimed: rows.filter((row) => /claim|redeem/i.test(row.status)).length,
    pending: rows.filter((row) => /pending/i.test(row.status)).length,
  };

  function downloadCsv() {
    const header = ["Name", "Phone", "Birthday", "Days Left", "Gift", "Status", "Source", "Last Contacted"];
    const csv = [header, ...visibleRows.map((row) => [row.name, row.phone, row.birthdayLabel, row.daysLeft === null ? "—" : row.daysLeft, row.gift, row.status, row.source, row.lastContacted])].map((line) => line.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "birthdays.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <AdminPageShell active="birthdays"><style>{`@media (min-width: 1024px) { html, body, main, [data-nextjs-scroll-focus-boundary] { background: ${PAGE_BG} !important; } body::before { content: ""; position: fixed; inset: 0; z-index: -1; background: ${PAGE_BG}; pointer-events: none; } }`}</style><div className="relative min-h-screen px-4 py-5 lg:-m-6 lg:px-6 lg:py-6 lg:bg-transparent"><div className="pointer-events-none fixed inset-0 -z-10 hidden lg:block" style={{ background: PAGE_BG }} /><MobileHeader /><div className="relative lg:min-h-[calc(100vh-48px)] lg:rounded-[34px] lg:border lg:border-white/10 lg:bg-white/10 lg:px-8 lg:py-8 lg:shadow-[0_26px_70px_rgba(35,54,47,0.22)] lg:backdrop-blur-2xl"><header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-[24px] font-black tracking-[-0.04em] text-white lg:text-[34px]">Birthdays</h1><p className="mt-1 text-[12px] font-bold text-white/70">Track birthdays, birthday gifts, and follow-ups.</p></div><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client name..." className="h-12 rounded-[16px] border-0 bg-white px-5 text-sm font-bold text-[#365665] outline-none lg:h-10 lg:w-[320px]" /><button type="button" onClick={downloadCsv} className="hidden h-10 w-10 items-center justify-center rounded-[12px] border border-white/25 bg-white/12 text-white transition hover:bg-white/18 lg:flex">↓</button></div></header><section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6"><SummaryCard label="Today’s Birthdays" value={summary.today} /><SummaryCard label="This Week" value={summary.week} /><SummaryCard label="This Month" value={summary.month} /><SummaryCard label="Gifts Sent" value={summary.sent} /><SummaryCard label="Claimed Gifts" value={summary.claimed} /><SummaryCard label="Pending Gifts" value={summary.pending} /></section><div className="mb-4 flex gap-2 overflow-x-auto pb-1">{SEGMENTS.map((item) => <button key={item.key} type="button" onClick={() => setSegment(item.key)} className={`h-9 shrink-0 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.08em] transition ${segment === item.key ? "bg-[#ffd66b] text-[#365665] shadow-[0_10px_28px_rgba(255,214,107,0.35)]" : "bg-white/12 text-white/80 hover:bg-white/18"}`}>{item.label}</button>)}</div><section className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.20)] backdrop-blur-2xl" style={{ background: GLASS_PANEL }}><div className="hidden lg:block"><div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.7fr_1fr_0.8fr_0.9fr_1.2fr_0.9fr] border-b border-white/25 px-6 py-4 text-[11px] font-black uppercase tracking-[0.14em] text-white"><div>Name</div><div>Phone</div><div>Birthday</div><div>Days Left</div><div>Gift</div><div>Status</div><div>Source</div><div>Actions</div><div>Last Contacted</div></div>{loading ? <Empty text="Loading birthdays..." /> : error ? <Empty text={error} /> : visibleRows.length === 0 ? <Empty text="No birthdays match this filter." /> : visibleRows.map((row) => <DesktopRow key={row.id} row={row} />)}</div><div className="lg:hidden">{loading ? <Empty text="Loading birthdays..." /> : error ? <Empty text={error} /> : visibleRows.length === 0 ? <Empty text="No birthdays match this filter." /> : visibleRows.map((row) => <MobileRow key={row.id} row={row} />)}</div></section></div></div></AdminPageShell>;
}

function MobileHeader() { return <div className="mb-5 lg:hidden"><div className="flex h-[58px] items-center justify-between rounded-[18px] bg-white/10 px-4 shadow-[0_14px_36px_rgba(35,54,47,0.16)] backdrop-blur-2xl"><img src="/apple-icon.png" alt="PRO's" className="h-[36px] w-auto origin-left object-contain" /><Link href="/profile" aria-label="Open profile" className="flex h-[32px] w-[32px] items-center justify-center text-[#ffd66b] transition hover:scale-105"><svg viewBox="0 0 24 24" className="h-[24px] w-[24px]" fill="currentColor"><path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 2.2c-4.2 0-7.6 2.2-7.6 5v.6c0 .4.3.6.7.6h13.8c.4 0 .7-.3.7-.6v-.6c0-2.8-3.4-5-7.6-5Z" /></svg></Link></div></div>; }
function SummaryCard({ label, value }: { label: string; value: string | number }) { return <div className="rounded-[18px] bg-white/10 px-4 py-4 shadow-[0_14px_36px_rgba(35,54,47,0.12)] backdrop-blur-2xl lg:rounded-[20px]"><div className="text-[11px] font-black text-white">{label}</div><div className="mt-2 text-[22px] font-black text-white">{value}</div></div>; }
function ActionButtons({ phone }: { phone: string }) { const wa = phone && phone !== "—" ? `https://wa.me/${phone.replace(/\D/g, "")}` : "#"; return <div className="flex flex-wrap items-center gap-2"><button className="h-8 rounded-full bg-[#ffd66b] px-4 text-[11px] font-black text-[#365665]">GIFT</button><a href={wa} target="_blank" rel="noreferrer" className="flex h-8 items-center rounded-full bg-[#20d66b] px-4 text-[11px] font-black text-white">WA</a><button className="h-8 rounded-full bg-white px-4 text-[11px] font-black text-[#365665]">CONTACTED</button></div>; }
function DesktopRow({ row }: { row: any }) { return <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.7fr_1fr_0.8fr_0.9fr_1.2fr_0.9fr] items-center border-b border-white/10 px-6 py-4 text-[12px] font-black text-white last:border-b-0"><div>{row.name}</div><div>{row.phone}</div><div>{row.birthdayLabel}</div><div className="text-[#bbffd8]">{row.daysLeft === null ? "—" : row.daysLeft === 0 ? "Today" : `${row.daysLeft}d`}</div><div>{row.gift}</div><div>{row.status}</div><div>{row.source}</div><ActionButtons phone={row.phone} /><div>{row.lastContacted}</div></div>; }
function MobileRow({ row }: { row: any }) { return <div className="border-b border-white/10 px-5 py-4 text-white last:border-b-0"><div className="flex items-start justify-between gap-3"><div><div className="text-[14px] font-black">{row.name}</div><div className="mt-1 text-[11px] font-black text-[#ffd66b]">{row.phone}</div></div><div className="text-right text-[12px] font-black text-[#bbffd8]">{row.daysLeft === null ? "—" : row.daysLeft === 0 ? "Today" : `${row.daysLeft}d`}</div></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-black text-white/70"><div>Birthday: {row.birthdayLabel}</div><div>Status: {row.status}</div><div>Gift: {row.gift}</div><div>Source: {row.source}</div></div><div className="mt-3"><ActionButtons phone={row.phone} /></div></div>; }
function Empty({ text }: { text: string }) { return <div className="p-8 text-sm font-bold text-white/70">{text}</div>; }
