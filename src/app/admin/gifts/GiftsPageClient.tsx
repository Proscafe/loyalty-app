"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminPageShell } from "@/components/AdminPageShell";

type GiftRow = Record<string, any>;
type ProfileRow = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  client_code?: string | null;
  created_at?: string | null;
};
type Segment =
  | "all"
  | "loyalty"
  | "birthday"
  | "sent"
  | "comment_cards"
  | "available"
  | "redeemed"
  | "expired"
  | "expiring"
  | "pending";

const PAGE_BG =
  "radial-gradient(circle at top left, rgba(255,214,107,0.24), transparent 28%), linear-gradient(135deg, #365665 0%, #263f49 48%, #798673 100%)";
const GLASS_PANEL = "rgba(255,255,255,0.10)";
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "All" },
  { key: "loyalty", label: "Loyalty Rewards" },
  { key: "birthday", label: "Birthday Gifts" },
  { key: "sent", label: "Sent Gifts" },
  { key: "comment_cards", label: "Comment Cards" },
  { key: "available", label: "Available" },
  { key: "redeemed", label: "Redeemed" },
  { key: "expired", label: "Expired" },
  { key: "expiring", label: "Expiring Soon" },
  { key: "pending", label: "Pending Registration" },
];

function cleanText(value?: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

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

function daysLeft(value?: string | null) {
  const date = validDate(value);
  if (!date) return "—";
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.ceil((end - start) / 86400000);
  return diff > 0 ? `${diff}d` : diff === 0 ? "Today" : "—";
}

function isExpired(value?: string | null) {
  const date = validDate(value);
  if (!date) return false;
  const today = new Date();
  return date.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function GiftsPageClient({ gifts, profiles }: { gifts: GiftRow[]; profiles: ProfileRow[] }) {
  const [giftRows, setGiftRows] = useState<GiftRow[]>(gifts);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);

  const rows = useMemo(
    () =>
      giftRows.map((gift) => {
        const profile = profileById.get(String(gift.client_id ?? gift.profile_id ?? ""));
        const statusRaw = String(gift.status ?? gift.reward_status ?? "available").toLowerCase();
        const expiresAt = gift.expires_at ?? gift.expiry_date ?? gift.valid_until;
        const expired = statusRaw === "expired" || isExpired(expiresAt);
        const redeemed = statusRaw === "redeemed" || Boolean(gift.redeemed_at);
        const status = redeemed ? "Redeemed" : expired ? "Expired" : statusRaw === "bounced" ? "Bounced" : "Available";
        const source = cleanText(
          gift.source ??
            gift.reward_source ??
            gift.activity_source ??
            (String(gift.reward_type ?? "").toLowerCase().includes("birthday") ? "Birthdays" : "System"),
        );
        const type = cleanText(
          gift.type ?? gift.reward_type ?? (source === "Birthdays" ? "Birthday Gift" : source === "Comment Cards" ? "Comment Card" : "Loyalty"),
        );
        const label = cleanText(gift.reward_label ?? gift.gift_type ?? gift.reward_name ?? gift.title ?? gift.name);
        const clientName = cleanText(gift.client_name ?? profile?.full_name ?? profile?.client_code ?? "Client");
        const issuedBy = cleanText(gift.issued_by_name ?? gift.staff_name ?? gift.issuer_name ?? (source === "System" ? "System" : "Pros"));
        return {
          id: String(gift.id ?? `${clientName}-${label}-${gift.created_at}`),
          clientName,
          type,
          label,
          status,
          expiresAt,
          issuedBy,
          issuedDate: gift.created_at ?? gift.issued_at,
          memberSince: profile?.created_at,
          source,
          phone: cleanText(profile?.phone ?? gift.phone),
          lastContacted: cleanText(gift.last_contacted_at ?? gift.contacted_at),
          raw: gift,
        };
      }),
    [giftRows, profileById],
  );

  const visibleRows = rows.filter((row) => {
    const term = query.trim().toLowerCase();
    const matchesSearch = !term || `${row.clientName} ${row.phone} ${row.label} ${row.status} ${row.source}`.toLowerCase().includes(term);
    const status = row.status.toLowerCase();
    const left = daysLeft(row.expiresAt);
    const soon = /^([1-7])d$|^Today$/.test(left);
    const matchesSegment =
      segment === "all" ||
      (segment === "loyalty" && row.type.toLowerCase().includes("loyalty")) ||
      (segment === "birthday" && `${row.type} ${row.source}`.toLowerCase().includes("birthday")) ||
      (segment === "sent" && row.type.toLowerCase().includes("sent")) ||
      (segment === "comment_cards" && row.source.toLowerCase().includes("comment")) ||
      (segment === "available" && status === "available") ||
      (segment === "redeemed" && status === "redeemed") ||
      (segment === "expired" && status === "expired") ||
      (segment === "expiring" && status === "available" && soon) ||
      (segment === "pending" && row.clientName === "Client");
    return matchesSearch && matchesSegment;
  });

  const redeemed = rows.filter((row) => row.status === "Redeemed").length;
  const expired = rows.filter((row) => row.status === "Expired").length;
  const available = rows.filter((row) => row.status === "Available").length;
  const expiring = rows.filter((row) => row.status === "Available" && /^([1-7])d$|^Today$/.test(daysLeft(row.expiresAt))).length;

  async function handleManualRedeem(row: any) {
    if (row.status === "Redeemed" || redeemingId) return;

    setRedeemingId(row.id);
    try {
      const response = await fetch("/api/admin/gifts/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId: row.id }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.error ?? "Could not redeem gift.");
      }

      const redeemedAt = json?.redeemed_at ?? new Date().toISOString();
      setGiftRows((current) =>
        current.map((gift) => {
          const currentId = String(gift.id ?? "");
          if (currentId !== row.id) return gift;
          return {
            ...gift,
            status: "redeemed",
            reward_status: "redeemed",
            redeemed_at: redeemedAt,
          };
        }),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not redeem gift.");
    } finally {
      setRedeemingId(null);
    }
  }

  function downloadCsv() {
    const header = ["Client Name", "Type", "Gift", "Status", "Expiry", "Days Left", "Issued By", "Issued Date", "Member Since", "Source", "Last Contacted"];
    const csv = [
      header,
      ...visibleRows.map((row) => [
        row.clientName,
        row.type,
        row.label,
        row.status,
        dateOnly(row.expiresAt),
        daysLeft(row.expiresAt),
        row.issuedBy,
        dateOnly(row.issuedDate),
        dateOnly(row.memberSince),
        row.source,
        row.lastContacted,
      ]),
    ]
      .map((line) => line.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gifts.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPageShell active="gifts">
      <style>{`@media (min-width: 1024px) { html, body, main, [data-nextjs-scroll-focus-boundary] { background: ${PAGE_BG} !important; } body::before { content: ""; position: fixed; inset: 0; z-index: -1; background: ${PAGE_BG}; pointer-events: none; } }`}</style>
      <div className="relative min-h-screen px-4 py-5 lg:-m-6 lg:bg-transparent lg:px-6 lg:py-6">
        <div className="pointer-events-none fixed inset-0 -z-10 hidden lg:block" style={{ background: PAGE_BG }} />
        <MobileHeader />
        <div className="relative lg:min-h-[calc(100vh-48px)] lg:rounded-[34px] lg:border lg:border-white/10 lg:bg-white/10 lg:px-8 lg:py-8 lg:shadow-[0_26px_70px_rgba(35,54,47,0.22)] lg:backdrop-blur-2xl">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[24px] font-black tracking-[-0.04em] text-white lg:text-[34px]">Gifts</h1>
              <p className="mt-1 text-[12px] font-bold text-white/70">Track rewards, sent gifts, expiry, and usage.</p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search client name..."
                className="h-12 rounded-[16px] border-0 bg-white px-5 text-sm font-bold text-[#365665] outline-none lg:h-10 lg:w-[320px]"
              />
              <button
                type="button"
                onClick={downloadCsv}
                className="hidden h-10 w-10 items-center justify-center rounded-[12px] border border-white/25 bg-white/12 text-white transition hover:bg-white/18 lg:flex"
              >
                ↓
              </button>
            </div>
          </header>

          <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-7">
            <SummaryCard label="Gifts sent" value={rows.length} />
            <SummaryCard label="Redeemed" value={redeemed} />
            <SummaryCard label="Gift value" value="$150.5" />
            <SummaryCard label="Expired" value={expired} />
            <SummaryCard label="Available" value={available} />
            <SummaryCard label="Expiring soon" value={expiring} />
            <SummaryCard label="Pending" value={rows.filter((row) => row.clientName === "Client").length} />
          </section>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {SEGMENTS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSegment(item.key)}
                className={`h-9 shrink-0 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.08em] transition ${
                  segment === item.key ? "bg-[#ffd66b] text-[#365665] shadow-[0_10px_28px_rgba(255,214,107,0.35)]" : "bg-white/12 text-white/80 hover:bg-white/18"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <section className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.20)] backdrop-blur-2xl" style={{ background: GLASS_PANEL }}>
            <div className="hidden lg:block">
              <div className="grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_0.9fr_0.7fr_0.8fr_0.9fr_0.9fr_0.9fr_1.35fr_0.9fr] border-b border-white/25 px-6 py-4 text-[11px] font-black uppercase tracking-[0.14em] text-white">
                <div>Client Name</div>
                <div>Type</div>
                <div>Gifts</div>
                <div>Status</div>
                <div>Expiry</div>
                <div>Days Left</div>
                <div>Issued By</div>
                <div>Issued Date</div>
                <div>Member Since</div>
                <div>Source</div>
                <div>Actions</div>
                <div>Last Contacted</div>
              </div>
              {visibleRows.length === 0 ? <Empty /> : visibleRows.map((row) => <DesktopRow key={row.id} row={row} onRedeem={handleManualRedeem} redeeming={redeemingId === row.id} />)}
            </div>
            <div className="lg:hidden">
              {visibleRows.length === 0 ? <Empty /> : visibleRows.map((row) => <MobileRow key={row.id} row={row} onRedeem={handleManualRedeem} redeeming={redeemingId === row.id} />)}
            </div>
          </section>
        </div>
      </div>
    </AdminPageShell>
  );
}

function MobileHeader() {
  return (
    <div className="mb-5 lg:hidden">
      <div className="flex h-[58px] items-center justify-between rounded-[18px] bg-white/10 px-4 shadow-[0_14px_36px_rgba(35,54,47,0.16)] backdrop-blur-2xl">
        <img src="/apple-icon.png" alt="PRO's" className="h-[36px] w-auto origin-left object-contain" />
        <Link href="/profile" aria-label="Open profile" className="flex h-[32px] w-[32px] items-center justify-center text-[#ffd66b] transition hover:scale-105">
          <svg viewBox="0 0 24 24" className="h-[24px] w-[24px]" fill="currentColor">
            <path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 2.2c-4.2 0-7.6 2.2-7.6 5v.6c0 .4.3.6.7.6h13.8c.4 0 .7-.3.7-.6v-.6c0-2.8-3.4-5-7.6-5Z" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[18px] bg-white/10 px-4 py-4 shadow-[0_14px_36px_rgba(35,54,47,0.12)] backdrop-blur-2xl lg:rounded-[20px]">
      <div className="text-[11px] font-black text-white">{label}</div>
      <div className="mt-2 text-[22px] font-black text-white">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "Available";
  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${ok ? "text-[#bbffd8]" : status === "Redeemed" ? "text-white" : "bg-[#ffd66b]/20 text-[#ffd66b]"}`}>
      {status}
    </span>
  );
}

function ActionButtons({ phone, row, onRedeem, redeeming }: { phone: string; row: any; onRedeem: (row: any) => void; redeeming: boolean }) {
  const wa = phone && phone !== "—" ? `https://wa.me/${phone.replace(/\D/g, "")}` : "#";
  const alreadyRedeemed = row.status === "Redeemed";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={wa} target="_blank" rel="noreferrer" className="flex h-8 items-center rounded-full bg-[#20d66b] px-3 text-[11px] font-black text-white">
        WA
      </a>
      <button className="h-8 rounded-full bg-white px-4 text-[11px] font-black text-[#365665]">CONTACTED</button>
      <button
        type="button"
        onClick={() => onRedeem(row)}
        disabled={alreadyRedeemed || redeeming}
        title={alreadyRedeemed ? "Already redeemed" : "Redeem gift manually"}
        className={`h-8 w-8 rounded-full text-[12px] font-black transition ${
          alreadyRedeemed ? "bg-white/15 text-white/45" : "bg-[#ffd66b] text-[#365665] hover:scale-105 disabled:opacity-60"
        }`}
      >
        {redeeming ? "…" : "R"}
      </button>
      <button className="h-8 w-8 rounded-full bg-[#ffdede] text-[14px] font-black text-[#d92f3a]">⌫</button>
    </div>
  );
}

function DesktopRow({ row, onRedeem, redeeming }: { row: any; onRedeem: (row: any) => void; redeeming: boolean }) {
  return (
    <div className="grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_0.9fr_0.7fr_0.8fr_0.9fr_0.9fr_0.9fr_1.35fr_0.9fr] items-center border-b border-white/10 px-6 py-4 text-[12px] font-black text-white last:border-b-0">
      <div>{row.clientName}</div>
      <div>{row.type}</div>
      <div>{row.label}</div>
      <StatusBadge status={row.status} />
      <div>{dateOnly(row.expiresAt)}</div>
      <div className="text-[#bbffd8]">{row.status === "Available" ? daysLeft(row.expiresAt) : "—"}</div>
      <div>{row.issuedBy}</div>
      <div>{dateOnly(row.issuedDate)}</div>
      <div>{dateOnly(row.memberSince)}</div>
      <div>{row.source}</div>
      <ActionButtons phone={row.phone} row={row} onRedeem={onRedeem} redeeming={redeeming} />
      <div>{row.lastContacted}</div>
    </div>
  );
}

function MobileRow({ row, onRedeem, redeeming }: { row: any; onRedeem: (row: any) => void; redeeming: boolean }) {
  return (
    <div className="border-b border-white/10 px-5 py-4 text-white last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-black">{row.clientName}</div>
          <div className="mt-1 text-[11px] font-black text-[#ffd66b]">{row.label}</div>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-black text-white/70">
        <div>Expiry: {dateOnly(row.expiresAt)}</div>
        <div>Left: {row.status === "Available" ? daysLeft(row.expiresAt) : "—"}</div>
        <div>Type: {row.type}</div>
        <div>Source: {row.source}</div>
      </div>
      <div className="mt-3">
        <ActionButtons phone={row.phone} row={row} onRedeem={onRedeem} redeeming={redeeming} />
      </div>
    </div>
  );
}

function Empty() {
  return <div className="p-8 text-sm font-bold text-white/70">No gifts match this filter.</div>;
}
