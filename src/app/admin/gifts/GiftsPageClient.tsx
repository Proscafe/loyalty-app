"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminPageShell } from "@/components/AdminPageShell";
import { createClient } from "@/lib/supabase/client";

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

type DateRange = "week" | "month" | "year2026" | "all";

type SortKey =
  | "clientName"
  | "label"
  | "giftType"
  | "status"
  | "expiresAt"
  | "daysLeft"
  | "issuedBy"
  | "memberSince"
  | "source"
  | "lastContacted";

type SortDirection = "asc" | "desc";

type DisplayGiftRow = {
  id: string;
  clientId: string;
  clientName: string;
  giftType: string;
  label: string;
  status: string;
  expiresAt?: string | null;
  issuedBy: string;
  issuedDate?: string | null;
  memberSince?: string | null;
  source: string;
  phone: string;
  lastContacted: string;
  raw: GiftRow;
};

const PAGE_BG =
  "radial-gradient(circle at top left, rgba(255,214,107,0.24), transparent 28%), linear-gradient(135deg, #365665 0%, #263f49 48%, #798673 100%)";
const GLASS_PANEL = "rgba(255,255,255,0.10)";

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "Available" },
  { key: "loyalty", label: "Loyalty Rewards" },
  { key: "birthday", label: "Birthday Gifts" },
  { key: "sent", label: "Sent Gifts" },
  { key: "comment_cards", label: "Comment Cards" },
  { key: "redeemed", label: "Redeemed" },
  { key: "expired", label: "Expired" },
  { key: "expiring", label: "Expiring Soon" },
  { key: "pending", label: "Pending Registration" },
];

function cleanText(value?: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function displayGiftLabel(value?: unknown) {
  const text = cleanText(value);
  return (
    text
      .replace(/\s+item$/i, "")
      .replace(/\s*[-–—]\s*winner\s+in\s+.+?\s+prediction\s*$/i, "")
      .replace(/\s+winner\s+in\s+.+?\s+prediction\s*$/i, "")
      .trim() || "—"
  );
}

function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(value?: string | null) {
  const date = validDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysLeft(value?: string | null) {
  const date = validDate(value);
  if (!date) return "—";
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const diff = Math.ceil((end - start) / 86400000);
  return diff > 0 ? `${diff}d` : diff === 0 ? "Today" : "—";
}

function isExpired(value?: string | null) {
  const date = validDate(value);
  if (!date) return false;
  const today = new Date();
  return (
    date.getTime() <
    new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  );
}

function monthKey(value?: string | null) {
  const date = validDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function isInsideDateRange(
  value: string | null | undefined,
  range: DateRange,
  selectedMonth: string,
) {
  if (range === "all") return true;
  const date = validDate(value);
  if (!date) return false;
  const now = new Date();
  if (range === "week") {
    const start = new Date(now);
    const day = start.getDay();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - day);
    return date.getTime() >= start.getTime();
  }
  if (range === "month") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }
  if (range === "year2026") {
    if (selectedMonth) return monthKey(value) === selectedMonth;
    return date.getFullYear() === 2026;
  }
  return true;
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function normalizedText(...values: unknown[]) {
  return values
    .map((value) =>
      String(value ?? "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .join(" ");
}

function giftTypeFor(gift: GiftRow, source: string, label?: string) {
  const haystack = normalizedText(
    source,
    label,
    gift.source,
    gift.reward_source,
    gift.activity_source,
    gift.origin,
    gift.origin_type,
    gift.reward_origin,
    gift.context,
    gift.context_type,
    gift.type,
    gift.gift_type,
    gift.gift_category,
    gift.category_name,
    gift.reward_category,
    gift.reward_type,
    gift.game_id,
    gift.match_id,
    gift.prediction_match_id,
    gift.prediction_entry_id,
    gift.comment_card_id,
    gift.comment_id,
    gift.birthday_id,
    gift.loyalty_program_id,
    gift.category_id,
  );

  if (haystack.includes("comment")) return "Comment Cards";
  if (haystack.includes("birthday")) return "Birthday";
  if (haystack.includes("winner in") || haystack.includes("prediction"))
    return "Games";
  if (
    haystack.includes("game") ||
    haystack.includes("prediction") ||
    haystack.includes("match") ||
    haystack.includes("world cup") ||
    haystack.includes("football") ||
    (haystack.includes("system") && haystack.includes("free dessert"))
  ) {
    return "Games";
  }
  return "Loyalty Card";
}

function sortValue(row: DisplayGiftRow, key: SortKey) {
  if (key === "expiresAt") return validDate(row.expiresAt)?.getTime() ?? 0;
  if (key === "memberSince") return validDate(row.memberSince)?.getTime() ?? 0;
  if (key === "daysLeft") {
    const left = daysLeft(row.expiresAt);
    if (left === "Today") return 0;
    const parsed = Number.parseInt(left, 10);
    return Number.isFinite(parsed) ? parsed : 99999;
  }
  return String(row[key] ?? "").toLowerCase();
}

export default function GiftsPageClient({
  gifts,
  profiles,
}: {
  gifts: GiftRow[];
  profiles: ProfileRow[];
}) {
  const supabase = createClient();
  const [giftRows, setGiftRows] = useState<GiftRow[]>(gifts);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("expiresAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmRedeemRow, setConfirmRedeemRow] = useState<DisplayGiftRow | null>(null);
  const [currentStaffName, setCurrentStaffName] = useState("Staff user");
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  useEffect(() => {
    let active = true;

    async function loadCurrentStaff() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!active || !user) return;

      setCurrentStaffId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      const displayName =
        String(profile?.full_name ?? "").trim() ||
        String(profile?.email ?? "").trim() ||
        String(user.email ?? "").trim() ||
        "Staff user";

      setCurrentStaffName(displayName);
    }

    loadCurrentStaff();

    return () => {
      active = false;
    };
  }, [supabase]);

  const rows = useMemo<DisplayGiftRow[]>(
    () =>
      giftRows.map((gift) => {
        const clientId = String(gift.client_id ?? gift.profile_id ?? "");
        const profile = profileById.get(clientId);
        const statusRaw = String(
          gift.status ?? gift.reward_status ?? "available",
        ).toLowerCase();
        const expiresAt =
          gift.expires_at ?? gift.expiry_date ?? gift.valid_until;
        const expired = statusRaw === "expired" || isExpired(expiresAt);
        const redeemed = statusRaw === "redeemed" || Boolean(gift.redeemed_at);
        const status = redeemed
          ? "Redeemed"
          : expired
            ? "Expired"
            : statusRaw === "bounced"
              ? "Bounced"
              : "Available";
        const source = cleanText(
          gift.source ??
            gift.reward_source ??
            gift.activity_source ??
            (String(gift.reward_type ?? "")
              .toLowerCase()
              .includes("birthday")
              ? "Birthdays"
              : "System"),
        );
        const label = displayGiftLabel(
          gift.reward_label ??
            gift.gift_type ??
            gift.reward_name ??
            gift.title ??
            gift.name ??
            gift.reward_type ??
            gift.type,
        );
        const clientName = cleanText(
          gift.client_name ??
            profile?.full_name ??
            profile?.client_code ??
            "Client",
        );
        const issuedBy = cleanText(
          gift.issued_by_name ??
            gift.staff_name ??
            gift.issuer_name ??
            (source === "System" ? "System" : "Pros"),
        );
        return {
          id: String(gift.id ?? `${clientName}-${label}-${gift.created_at}`),
          clientId,
          clientName,
          giftType: giftTypeFor(gift, source, label),
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

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      const term = query.trim().toLowerCase();
      const matchesSearch =
        !term ||
        `${row.clientName} ${row.phone} ${row.label} ${row.giftType} ${row.status} ${row.source}`
          .toLowerCase()
          .includes(term);
      const status = row.status.toLowerCase();
      const left = daysLeft(row.expiresAt);
      const soon = /^([1-7])d$|^Today$/.test(left);
      const matchesSegment =
        (segment === "all" && status !== "redeemed") ||
        (segment === "loyalty" && row.giftType === "Loyalty Card") ||
        (segment === "birthday" && row.giftType === "Birthday") ||
        (segment === "sent" &&
          (row.source.toLowerCase().includes("sent") ||
            row.giftType === "Games" ||
            row.issuedBy.toLowerCase() !== "system")) ||
        (segment === "comment_cards" && row.giftType === "Comment Cards") ||
        (segment === "available" && status === "available") ||
        (segment === "redeemed" && status === "redeemed") ||
        (segment === "expired" && status === "expired") ||
        (segment === "expiring" && status === "available" && soon) ||
        (segment === "pending" && row.clientName === "Client");
      const dateSource =
        row.raw.created_at ??
        row.raw.issued_at ??
        row.expiresAt ??
        row.memberSince;
      const matchesDate = isInsideDateRange(
        dateSource,
        dateRange,
        selectedMonth,
      );
      return matchesSearch && matchesSegment && matchesDate;
    });

    return [...filtered].sort((a, b) => {
      const aValue = sortValue(a, sortKey);
      const bValue = sortValue(b, sortKey);
      const result =
        typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? result : -result;
    });
  }, [dateRange, query, rows, segment, selectedMonth, sortDirection, sortKey]);


  useEffect(() => {
    if (!confirmRedeemRow) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirmRedeemRow(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmRedeemRow]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    rows.forEach((row) => {
      const key = monthKey(
        row.raw.created_at ??
          row.raw.issued_at ??
          row.expiresAt ??
          row.memberSince,
      );
      if (key.startsWith("2026-")) months.add(key);
    });
    return Array.from(months).sort().reverse();
  }, [rows]);

  const redeemed = rows.filter((row) => row.status === "Redeemed").length;
  const expired = rows.filter((row) => row.status === "Expired").length;
  const available = rows.filter((row) => row.status === "Available").length;
  const expiring = rows.filter(
    (row) =>
      row.status === "Available" &&
      /^([1-7])d$|^Today$/.test(daysLeft(row.expiresAt)),
  ).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function sortLabel(key: SortKey, label: string) {
    return `${label}${sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}`;
  }

  function downloadCsv() {
    const header = [
      "Client Name",
      "Gift",
      "Gift Type",
      "Status",
      "Expiry",
      "Days Left",
      "Issued By",
      "Member Since",
      "Source",
      "Actions",
      "Last Contacted",
    ];
    const csv = [
      header,
      ...visibleRows.map((row) => [
        row.clientName,
        row.label,
        row.giftType,
        row.status,
        dateOnly(row.expiresAt),
        daysLeft(row.expiresAt),
        row.issuedBy,
        dateOnly(row.memberSince),
        row.source,
        "",
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

  function requestManualRedeem(row: DisplayGiftRow) {
    if (row.status === "Redeemed" || redeemingId) return;
    setConfirmRedeemRow(row);
  }

  async function handleManualRedeem(row: DisplayGiftRow) {
    if (row.status === "Redeemed" || redeemingId) return;
    setRedeemingId(row.id);
    try {
      const response = await fetch("/api/admin/gifts/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftId: String(row.raw.id ?? row.id ?? "").trim(),
          redeemedById: currentStaffId,
          redeemedByName: currentStaffName,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Failed to redeem gift");
      setConfirmRedeemRow(null);
      setGiftRows((current) =>
        current.map((gift) =>
          String(gift.id) === String(row.raw.id ?? row.id)
            ? {
                ...gift,
                status: "redeemed",
                redeemed_at: json?.redeemed_at ?? new Date().toISOString(),
              }
            : gift,
        ),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to redeem gift");
    } finally {
      setRedeemingId(null);
    }
  }

  async function handleReverseGift(row: DisplayGiftRow) {
    if (row.status !== "Redeemed" || reversingId) return;

    const confirmed = window.confirm(
      `Reverse ${row.label} for ${row.clientName}? This will send the gift back to the client as available.`,
    );

    if (!confirmed) return;

    setReversingId(row.id);
    try {
      const response = await fetch("/api/admin/gifts/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftId: String(row.raw.id ?? row.id ?? "").trim(),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Failed to reverse gift");

      setGiftRows((current) =>
        current.map((gift) =>
          String(gift.id) === String(row.raw.id ?? row.id)
            ? {
                ...gift,
                status: "available",
                reward_status: "available",
                redeemed_at: null,
                redeemed_by: null,
                redeemed_by_id: null,
                redeemed_by_name: null,
              }
            : gift,
        ),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to reverse gift");
    } finally {
      setReversingId(null);
    }
  }

  async function handleDeleteGift(row: DisplayGiftRow) {
    if (deletingId) return;

    const confirmed = window.confirm(
      `Delete ${row.label} for ${row.clientName}? This permanently removes the gift from the database.`,
    );

    if (!confirmed) return;

    setDeletingId(row.id);
    try {
      const response = await fetch("/api/admin/gifts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftId: String(row.raw.id ?? row.id ?? "").trim(),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Failed to delete gift");

      setGiftRows((current) =>
        current.filter((gift) => String(gift.id) !== String(row.raw.id ?? row.id)),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete gift");
    } finally {
      setDeletingId(null);
    }
  }

  const headerClass =
    "text-left text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:text-[#ffd66b]";

  return (
    <AdminPageShell active="gifts">
      <style>{`@media (min-width: 1024px) { html, body, main, [data-nextjs-scroll-focus-boundary] { background: ${PAGE_BG} !important; } body::before { content: ""; position: fixed; inset: 0; z-index: -1; background: ${PAGE_BG}; pointer-events: none; } }`}</style>
      <div className="relative min-h-screen px-4 py-5 lg:-m-6 lg:bg-transparent lg:px-6 lg:py-6">
        <div
          className="pointer-events-none fixed inset-0 -z-10 hidden lg:block"
          style={{ background: PAGE_BG }}
        />
        <MobileHeader />
        <div className="relative lg:min-h-[calc(100vh-48px)] lg:rounded-[34px] lg:border lg:border-white/10 lg:bg-white/10 lg:px-8 lg:py-8 lg:shadow-[0_26px_70px_rgba(35,54,47,0.22)] lg:backdrop-blur-2xl">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[24px] font-black tracking-[-0.04em] text-white lg:text-[34px]">
                Gifts
              </h1>
              <p className="mt-1 text-[12px] font-bold text-white/70">
                Track rewards, sent gifts, expiry, and usage.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search client name..."
                className="h-12 rounded-[16px] border-0 bg-white px-5 text-sm font-bold text-[#365665] outline-none lg:h-10 lg:w-[320px]"
              />
              <div
                className="relative hidden lg:block"
                onMouseEnter={() => setFilterOpen(true)}
                onMouseLeave={() => setFilterOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setFilterOpen((current) => !current)}
                  className="h-10 rounded-[12px] border border-white/25 bg-white/12 px-5 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-white/18"
                >
                  Filter
                </button>
                {filterOpen ? (
                  <div className="absolute right-0 top-[39px] z-30 w-[260px] rounded-[22px] border border-white/20 bg-[#365665]/95 p-3 shadow-[0_22px_54px_rgba(20,35,35,0.28)] backdrop-blur-2xl">
                    <FilterOption
                      label="This Week"
                      active={dateRange === "week"}
                      onClick={() => {
                        setDateRange("week");
                        setSelectedMonth("");
                      }}
                    />
                    <FilterOption
                      label="This Month"
                      active={dateRange === "month"}
                      onClick={() => {
                        setDateRange("month");
                        setSelectedMonth("");
                      }}
                    />
                    <FilterOption
                      label="Year 2026"
                      active={dateRange === "year2026" && !selectedMonth}
                      onClick={() => {
                        setDateRange("year2026");
                        setSelectedMonth("");
                      }}
                    />
                    {dateRange === "year2026" ? (
                      <div className="mt-2 rounded-[16px] bg-white/10 p-2">
                        {availableMonths.length ? (
                          availableMonths.map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setDateRange("year2026");
                                setSelectedMonth(key);
                              }}
                              className={`mb-1 block h-8 w-full rounded-[12px] px-3 text-left text-[11px] font-black ${selectedMonth === key ? "bg-[#ffd66b] text-[#365665]" : "text-white hover:bg-white/10"}`}
                            >
                              {monthLabel(key)}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-[11px] font-bold text-white/70">
                            No 2026 months found.
                          </div>
                        )}
                      </div>
                    ) : null}
                    <FilterOption
                      label="Show All"
                      active={dateRange === "all"}
                      onClick={() => {
                        setDateRange("all");
                        setSelectedMonth("");
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={downloadCsv}
                className="hidden h-10 w-10 items-center justify-center rounded-[12px] border border-white/25 bg-white/12 text-white transition hover:bg-white/18 lg:flex"
              >
                ↓
              </button>
            </div>
          </header>

          <section className="mb-4 hidden gap-3 lg:grid lg:grid-cols-7">
            <SummaryCard label="Gifts sent" value={rows.length} />
            <SummaryCard label="Redeemed" value={redeemed} />
            <SummaryCard label="Gift value" value="$150.5" />
            <SummaryCard label="Expired" value={expired} />
            <SummaryCard label="Available" value={available} />
            <SummaryCard label="Expiring soon" value={expiring} />
            <SummaryCard
              label="Pending"
              value={rows.filter((row) => row.clientName === "Client").length}
            />
          </section>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {SEGMENTS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSegment(item.key)}
                className={`h-9 shrink-0 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.08em] transition ${
                  segment === item.key
                    ? "bg-[#ffd66b] text-[#365665]"
                    : "bg-white/12 text-white/80 hover:bg-white/18"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <section
            className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.20)] backdrop-blur-2xl"
            style={{ background: GLASS_PANEL }}
          >
            <div className="hidden lg:block">
              <div className="grid grid-cols-[1.05fr_0.9fr_0.8fr_0.7fr_0.75fr_0.6fr_0.7fr_0.8fr_0.65fr_1.7fr_0.8fr] border-b border-white/25 px-6 py-4">
                <button
                  type="button"
                  onClick={() => toggleSort("clientName")}
                  className={headerClass}
                >
                  {sortLabel("clientName", "Client Name")}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("label")}
                  className={headerClass}
                >
                  {sortLabel("label", "Gift")}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("giftType")}
                  className={headerClass}
                >
                  {sortLabel("giftType", "Gift Type")}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("status")}
                  className={headerClass}
                >
                  {sortLabel("status", "Status")}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("expiresAt")}
                  className={headerClass}
                >
                  {sortLabel("expiresAt", "Expiry")}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("daysLeft")}
                  className={headerClass}
                >
                  {sortLabel("daysLeft", "Days Left")}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("issuedBy")}
                  className={headerClass}
                >
                  {sortLabel("issuedBy", "Issued By")}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("memberSince")}
                  className={headerClass}
                >
                  {sortLabel("memberSince", "Member Since")}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("source")}
                  className={headerClass}
                >
                  {sortLabel("source", "Source")}
                </button>
                <div className="text-left text-[11px] font-black uppercase tracking-[0.14em] text-white">
                  Actions
                </div>
                <button
                  type="button"
                  onClick={() => toggleSort("lastContacted")}
                  className={headerClass}
                >
                  {sortLabel("lastContacted", "Last Contacted")}
                </button>
              </div>
              {visibleRows.length === 0 ? (
                <Empty />
              ) : (
                visibleRows.map((row) => (
                  <DesktopRow
                    key={row.id}
                    row={row}
                    onRedeem={requestManualRedeem}
                    onReverse={handleReverseGift}
                    onDelete={handleDeleteGift}
                    redeeming={redeemingId === row.id}
                    reversing={reversingId === row.id}
                    deleting={deletingId === row.id}
                  />
                ))
              )}
            </div>
            <div className="lg:hidden">
              {visibleRows.length === 0 ? (
                <Empty />
              ) : (
                visibleRows.map((row) => (
                  <MobileRow
                    key={row.id}
                    row={row}
                    onRedeem={requestManualRedeem}
                    onReverse={handleReverseGift}
                    onDelete={handleDeleteGift}
                    redeeming={redeemingId === row.id}
                    reversing={reversingId === row.id}
                    deleting={deletingId === row.id}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {confirmRedeemRow ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm"
          onMouseDown={() => setConfirmRedeemRow(null)}
        >
          <div
            className="w-full max-w-[460px] rounded-[28px] border border-white/25 bg-[#5f7169] p-6 text-white shadow-[0_30px_90px_rgba(20,35,35,0.38)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[24px] font-black tracking-[-0.04em]">
                  Redeem Gift
                </h2>
                <p className="mt-1 text-[12px] font-bold text-white/70">
                  Confirm this gift redemption.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRedeemRow(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-lg font-black text-white transition hover:bg-white/20"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 rounded-[20px] border border-white/15 bg-white/10 p-4 text-[13px] font-bold">
              <div>
                <span className="text-white/60">Client: </span>
                <span>{confirmRedeemRow.clientName}</span>
              </div>
              <div>
                <span className="text-white/60">Gift: </span>
                <span>{confirmRedeemRow.label}</span>
              </div>
              <div>
                <span className="text-white/60">Expiry: </span>
                <span>{dateOnly(confirmRedeemRow.expiresAt)}</span>
              </div>
              <div>
                <span className="text-white/60">Redeemed by: </span>
                <span>{currentStaffName}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmRedeemRow(null)}
                className="h-11 rounded-full border border-white/25 bg-white/10 px-6 text-[12px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleManualRedeem(confirmRedeemRow)}
                disabled={redeemingId === confirmRedeemRow.id}
                className="h-11 rounded-full bg-[#ffd66b] px-6 text-[12px] font-black uppercase tracking-[0.08em] text-[#365665] transition hover:brightness-105 disabled:opacity-60"
              >
                {redeemingId === confirmRedeemRow.id ? "Redeeming..." : "Confirm Redeem"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  );
}

function FilterOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-2 block h-9 w-full rounded-[13px] px-3 text-left text-[11px] font-black uppercase tracking-[0.08em] transition ${
        active
          ? "bg-[#ffd66b] text-[#365665]"
          : "bg-white/10 text-white hover:bg-white/16"
      }`}
    >
      {label}
    </button>
  );
}

function MobileHeader() {
  return (
    <div className="mb-5 lg:hidden">
      <div className="flex h-[58px] items-center justify-between rounded-[18px] bg-white/10 px-4 shadow-[0_14px_36px_rgba(35,54,47,0.16)] backdrop-blur-2xl">
        <img
          src="/apple-icon.png"
          alt="PRO's"
          className="h-[36px] w-auto origin-left object-contain"
        />
        <Link
          href="/profile"
          aria-label="Open profile"
          className="flex h-[32px] w-[32px] items-center justify-center text-[#ffd66b] transition hover:scale-105"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[24px] w-[24px]"
            fill="currentColor"
          >
            <path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 2.2c-4.2 0-7.6 2.2-7.6 5v.6c0 .4.3.6.7.6h13.8c.4 0 .7-.3.7-.6v-.6c0-2.8-3.4-5-7.6-5Z" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
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
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
        ok
          ? "text-[#bbffd8]"
          : status === "Redeemed"
            ? "text-white"
            : "bg-[#ffd66b]/20 text-[#ffd66b]"
      }`}
    >
      {status}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6.5 6 7.5 20h9L17.5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function ActionButtons({
  phone,
  row,
  onRedeem,
  onReverse,
  onDelete,
  redeeming,
  reversing,
  deleting,
}: {
  phone: string;
  row: DisplayGiftRow;
  onRedeem: (row: DisplayGiftRow) => void;
  onReverse: (row: DisplayGiftRow) => void;
  onDelete: (row: DisplayGiftRow) => void;
  redeeming: boolean;
  reversing: boolean;
  deleting: boolean;
}) {
  const wa =
    phone && phone !== "—" ? `https://wa.me/${phone.replace(/\D/g, "")}` : "#";
  const alreadyRedeemed = row.status === "Redeemed";

  return (
    <div className="flex min-w-[190px] flex-nowrap items-center gap-2">
      <a
        href={wa}
        target="_blank"
        rel="noreferrer"
        className="flex h-8 items-center rounded-full bg-[#20d66b] px-3 text-[10px] font-black text-white"
      >
        WA
      </a>
      <button className="h-8 rounded-full bg-white px-3 text-[10px] font-black text-[#365665]">
        CONTACTED
      </button>
      <button
        type="button"
        onClick={() => (alreadyRedeemed ? onReverse(row) : onRedeem(row))}
        disabled={redeeming || reversing}
        title={alreadyRedeemed ? "Reverse gift back to client" : "Redeem gift manually"}
        className={`h-8 w-8 rounded-full text-[12px] font-black transition ${
          alreadyRedeemed
            ? "bg-[#ffd66b] text-[#365665] hover:scale-105 disabled:opacity-60"
            : "bg-[#ffd66b] text-[#365665] hover:scale-105 disabled:opacity-60"
        }`}
      >
        {redeeming || reversing ? "…" : "R"}
      </button>
      <button
        type="button"
        onClick={() => onDelete(row)}
        disabled={deleting}
        title="Delete gift from database"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffdede] text-[#d92f3a] transition hover:scale-105 disabled:opacity-60"
      >
        {deleting ? "…" : <TrashIcon />}
      </button>
    </div>
  );
}

function DesktopRow({
  row,
  onRedeem,
  onReverse,
  onDelete,
  redeeming,
  reversing,
  deleting,
}: {
  row: DisplayGiftRow;
  onRedeem: (row: DisplayGiftRow) => void;
  onReverse: (row: DisplayGiftRow) => void;
  onDelete: (row: DisplayGiftRow) => void;
  redeeming: boolean;
  reversing: boolean;
  deleting: boolean;
}) {
  return (
    <div className="grid grid-cols-[1.05fr_0.9fr_0.8fr_0.7fr_0.75fr_0.6fr_0.7fr_0.8fr_0.65fr_1.7fr_0.8fr] items-center border-b border-white/10 px-6 py-4 text-[12px] font-black text-white last:border-b-0">
      <div>
        {row.clientId ? (
          <Link
            href={`/admin/users/${row.clientId}`}
            className="transition hover:text-[#ffd66b]"
          >
            {row.clientName}
          </Link>
        ) : (
          row.clientName
        )}
      </div>
      <div>{row.label}</div>
      <div>{row.giftType}</div>
      <StatusBadge status={row.status} />
      <div>{dateOnly(row.expiresAt)}</div>
      <div className="text-[#bbffd8]">
        {row.status === "Available" ? daysLeft(row.expiresAt) : "—"}
      </div>
      <div>{row.issuedBy}</div>
      <div>{dateOnly(row.memberSince)}</div>
      <div>{row.source}</div>
      <ActionButtons
        phone={row.phone}
        row={row}
        onRedeem={onRedeem}
        onReverse={onReverse}
        onDelete={onDelete}
        redeeming={redeeming}
        reversing={reversing}
        deleting={deleting}
      />
      <div>{row.lastContacted}</div>
    </div>
  );
}

function MobileRow({
  row,
  onRedeem,
  onReverse,
  onDelete,
  redeeming,
  reversing,
  deleting,
}: {
  row: DisplayGiftRow;
  onRedeem: (row: DisplayGiftRow) => void;
  onReverse: (row: DisplayGiftRow) => void;
  onDelete: (row: DisplayGiftRow) => void;
  redeeming: boolean;
  reversing: boolean;
  deleting: boolean;
}) {
  return (
    <div className="border-b border-white/10 px-5 py-4 text-white last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-black">
            {row.clientId ? (
              <Link
                href={`/admin/users/${row.clientId}`}
                className="transition hover:text-[#ffd66b]"
              >
                {row.clientName}
              </Link>
            ) : (
              row.clientName
            )}
          </div>
          <div className="mt-1 text-[11px] font-black text-[#ffd66b]">
            {row.label}
          </div>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-black text-white/70">
        <div>Expiry: {dateOnly(row.expiresAt)}</div>
        <div>
          Left: {row.status === "Available" ? daysLeft(row.expiresAt) : "—"}
        </div>
        <div>Gift Type: {row.giftType}</div>
        <div>Source: {row.source}</div>
        <div>Last contacted: {row.lastContacted}</div>
      </div>
      <div className="mt-3">
        <ActionButtons
          phone={row.phone}
          row={row}
          onRedeem={onRedeem}
          onReverse={onReverse}
          onDelete={onDelete}
          redeeming={redeeming}
          reversing={reversing}
          deleting={deleting}
        />
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="p-8 text-sm font-bold text-white/70">
      No gifts match this filter.
    </div>
  );
}
