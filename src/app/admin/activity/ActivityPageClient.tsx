"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdminPageShell } from "@/components/AdminPageShell";

type ActivityRow = Record<string, any>;
type ProfileRow = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  client_code?: string | null;
};
type CategoryRow = { id: string; name?: string | null };
type Filter = "today" | "week" | "month";

const MOBILE_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";
const PAGE_BG =
  "radial-gradient(circle at top left, rgba(255,214,107,0.24), transparent 28%), linear-gradient(135deg, #365665 0%, #263f49 48%, #798673 100%)";
const GLASS_PANEL = "rgba(255,255,255,0.10)";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

const MOBILE_FILTERS = FILTERS;

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

function timeOnly(value?: string | null) {
  const date = validDate(value);
  if (!date) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function monthKey(value?: string | null) {
  const date = validDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return "Month";
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function isSameMonthKey(value: string | null | undefined, key: string | null) {
  if (!key) return true;
  return monthKey(value) === key;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function startOfWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  return start.getTime();
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function beirutStampWindowKey(value?: string | null) {
  const date = validDate(value);
  if (!date) return null;
  const beirut = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const hour = beirut.getUTCHours();
  if (hour >= 5 && hour < 9) return null;
  const start = new Date(
    Date.UTC(
      beirut.getUTCFullYear(),
      beirut.getUTCMonth(),
      beirut.getUTCDate(),
      9,
      0,
      0,
    ),
  );
  if (hour < 5) start.setUTCDate(start.getUTCDate() - 1);
  return start.toISOString().slice(0, 10);
}

function isSamePeriod(value: string | null | undefined, filter: Filter) {
  const date = validDate(value);
  if (!date) return false;
  const time = date.getTime();
  const todayStart = startOfToday();

  if (filter === "today")
    return time >= todayStart && time < todayStart + 86400000;
  if (filter === "week")
    return time >= startOfWeek() && time < todayStart + 86400000;
  if (filter === "month")
    return time >= startOfMonth() && time < todayStart + 86400000;
  return true;
}

function titleCase(value?: unknown) {
  const text = String(value ?? "activity")
    .replace(/_/g, " ")
    .trim();
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanText(value?: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function isStampLike(row: ActivityRow, categoryName: string) {
  if (row.activity_source === "stamp") return true;
  const action = String(row.action_type ?? "").toLowerCase();
  if (
    /reward|redeem|gift|remove|claim|expire|delete|bounced|returned/.test(
      action,
    )
  )
    return false;
  if (categoryName === "—" || categoryName.toLowerCase() === "gift")
    return false;
  return Boolean(row.client_id || row.category_id || categoryName !== "—");
}

function stampPhrase(row: ActivityRow, categoryName: string) {
  const count = Number(row.stamp_delta ?? row.quantity ?? 1);
  const safeCount = Number.isFinite(count) && count > 0 ? count : 1;
  const category = categoryName !== "—" ? `${categoryName} ` : "";
  return `${safeCount} ${category}stamp${safeCount === 1 ? "" : "s"}`;
}

function rewardOrStampLabel(row: ActivityRow, categoryName: string) {
  if (isStampLike(row, categoryName)) return stampPhrase(row, categoryName);
  const explicit = cleanText(
    row.reward_label ??
      row.gift_type ??
      row.reward_type ??
      row.reward_name ??
      row.title,
  );
  if (explicit !== "—") return explicit;
  if (categoryName !== "—") return categoryName;
  return "—";
}

function activityType(row: ActivityRow, categoryName: string) {
  const action = String(
    row.action_type ??
      row.reward_type ??
      row.status ??
      row.activity_source ??
      "",
  ).toLowerCase();
  if (/redeem|redeemed/.test(action) || row.redeemed_at) return "Redeemed";
  if (/expire|expired/.test(action) || row.expired_activity) return "Expired";
  if (/contact|contacted/.test(action) || row.contact_key) return "Contact";
  if (
    /gift|reward|issued|earned|claim|bounced|returned/.test(action) ||
    row.reward_type ||
    row.activity_source === "reward"
  )
    return "Gift";
  if (isStampLike(row, categoryName)) return "Stamp";
  return titleCase(row.action_type);
}

function activitySentence(
  row: ActivityRow,
  clientName: string,
  categoryName: string,
) {
  const type = activityType(row, categoryName);
  const item = rewardOrStampLabel(row, categoryName);
  const action = String(row.action_type ?? row.status ?? "").toLowerCase();

  if (type === "Stamp") {
    const direction = String(row.stamp_direction ?? action).toLowerCase();
    if (/redeem|remove|deduct|spent/.test(direction))
      return `${clientName} redeemed ${item}`;
    if (/receive|received/.test(direction))
      return `${clientName} received ${item}`;
    return `${clientName} earned ${item}`;
  }
  if (type === "Redeemed") return `${clientName} redeemed ${item}`;
  if (type === "Expired") return `${clientName} gift expired`;
  if (type === "Contact") return `${clientName} was marked as contacted`;
  if (/bounced|returned/.test(action)) return `${clientName} gift was returned`;
  if (type === "Gift") return `${clientName} received ${item}`;
  return `${clientName} ${titleCase(row.action_type).toLowerCase()}`;
}

function renderHighlightedActivity(
  activity: string,
  type: string,
  itemLabel: string,
  categoryName: string,
) {
  const highlight =
    type === "Stamp" && categoryName !== "—"
      ? categoryName
      : /gift|redeemed/i.test(type) && itemLabel !== "—"
        ? itemLabel
        : "";

  if (!highlight) return activity;

  const lowerActivity = activity.toLowerCase();
  const lowerHighlight = highlight.toLowerCase();
  const start = lowerActivity.indexOf(lowerHighlight);

  if (start < 0) return activity;

  const before = activity.slice(0, start);
  const match = activity.slice(start, start + highlight.length);
  const after = activity.slice(start + highlight.length);

  return (
    <>
      {before}
      <span className="text-[#ffd66b]">{match}</span>
      {after}
    </>
  );
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function ActivityPageClient({
  activities,
  profiles,
  categories,
}: {
  activities: ActivityRow[];
  profiles: ProfileRow[];
  categories: CategoryRow[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("today");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [desktopFilterOpen, setDesktopFilterOpen] = useState(false);
  const desktopFilterRef = useRef<HTMLDivElement | null>(null);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent | TouchEvent) {
      if (!desktopFilterRef.current) return;
      if (!desktopFilterRef.current.contains(event.target as Node)) {
        setDesktopFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
    };
  }, []);

  const enriched = useMemo(() => {
    const base = activities.map((row) => {
      const profile = profileById.get(
        String(row.client_id ?? row.profile_id ?? ""),
      );
      const category = categoryById.get(String(row.category_id ?? ""));
      const clientName = cleanText(
        row.client_name ??
          profile?.full_name ??
          profile?.client_code ??
          "Client",
      );
      const categoryName = cleanText(
        row.category_name ??
          category?.name ??
          (row.activity_source === "reward" ? "Gift" : "—"),
      );
      const type = activityType(row, categoryName);
      const itemLabel = rewardOrStampLabel(row, categoryName);
      const activity = activitySentence(row, clientName, categoryName);
      const staffName = cleanText(
        row.issued_by_name ?? row.staff_name ?? row.issuer_name ?? "System",
      );
      return {
        row,
        clientName,
        categoryName,
        type,
        itemLabel,
        activity,
        staffName,
      };
    });

    const groupedStampKeys = new Set<string>();
    const seenSingles = new Map<string, number>();

    for (const item of base) {
      if (!isStampLike(item.row, item.categoryName)) continue;
      const key = `${item.clientName.toLowerCase()}::${item.categoryName.toLowerCase()}::${beirutStampWindowKey(item.row.created_at) ?? `${dateOnly(item.row.created_at)}-${timeOnly(item.row.created_at)}`}`;
      if (Number(item.row.stamp_delta ?? 1) > 1) groupedStampKeys.add(key);
    }

    return base
      .map((item) => {
        const key = isStampLike(item.row, item.categoryName)
          ? `${item.clientName.toLowerCase()}::${item.categoryName.toLowerCase()}::${beirutStampWindowKey(item.row.created_at) ?? `${dateOnly(item.row.created_at)}-${timeOnly(item.row.created_at)}`}`
          : null;

        let duplicate = false;
        let hidden = false;

        if (key && isStampLike(item.row, item.categoryName)) {
          const currentCount = (seenSingles.get(key) ?? 0) + 1;
          seenSingles.set(key, currentCount);
          duplicate = currentCount > 1 && !groupedStampKeys.has(key);

          if (
            groupedStampKeys.has(key) &&
            Number(item.row.stamp_delta ?? 1) === 1
          ) {
            hidden = true;
          }
        }

        return { ...item, duplicate, hidden };
      })
      .filter((item) => !item.hidden);
  }, [activities, profileById, categoryById]);

  const availableMonths = useMemo(() => {
    const months = new Map<string, string>();
    for (const item of enriched) {
      const key = monthKey(item.row.created_at);
      if (key && !months.has(key)) months.set(key, monthLabelFromKey(key));
    }
    return Array.from(months.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, label]) => ({ key, label }));
  }, [enriched]);

  const desktopFilterLabel = selectedMonth
    ? monthLabelFromKey(selectedMonth)
    : (FILTERS.find((item) => item.key === filter)?.label ?? "Today");

  const visibleRows = enriched.filter(
    ({
      row,
      clientName,
      categoryName,
      type,
      itemLabel,
      activity,
      staffName,
    }) => {
      const term = query.trim().toLowerCase();
      const matchesSearch =
        !term ||
        `${activity} ${clientName} ${type} ${itemLabel} ${categoryName} ${staffName}`
          .toLowerCase()
          .includes(term);
      return (
        matchesSearch &&
        (selectedMonth
          ? isSameMonthKey(row.created_at, selectedMonth)
          : isSamePeriod(row.created_at, filter))
      );
    },
  );

  function chooseFilter(nextFilter: Filter) {
    setFilter(nextFilter);
    setSelectedMonth(null);
    setDesktopFilterOpen(false);
  }

  function chooseMonth(month: string) {
    setSelectedMonth(month);
    setDesktopFilterOpen(false);
  }

  function openClientCard(clientId: unknown) {
    const id = String(clientId ?? "").trim();
    if (!id) return;

    try {
      window.sessionStorage.setItem("proscafe_open_client_id", id);
    } catch {}

    window.location.href = `/admin/users?client=${encodeURIComponent(id)}`;
  }

  function downloadCsv() {
    const header = [
      "Activity",
      "Customer",
      "Type",
      "Reward / Stamp",
      "Staff",
      "Date",
      "Time",
    ];
    const lines = visibleRows.map(
      ({ row, activity, clientName, type, itemLabel, staffName }) => [
        activity,
        clientName,
        type,
        itemLabel,
        staffName,
        dateOnly(row.created_at),
        timeOnly(row.created_at),
      ],
    );
    const csv = [header, ...lines]
      .map((line) => line.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "activity.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPageShell active="activity">
      <style>{`@media (min-width: 1024px) { html, body, main, [data-nextjs-scroll-focus-boundary] { background: ${PAGE_BG} !important; } body::before { content: ""; position: fixed; inset: 0; z-index: -1; background: ${PAGE_BG}; pointer-events: none; } }`}</style>
      <div
        data-activity-page="true"
        className="relative min-h-screen px-4 py-5 lg:-m-6 lg:px-6 lg:py-6 lg:bg-transparent"
      >
        <div
          className="pointer-events-none fixed inset-0 -z-10 hidden lg:block"
          style={{ background: PAGE_BG }}
        />

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
                aria-hidden="true"
              >
                <path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 2.2c-4.2 0-7.6 2.2-7.6 5v.6c0 .4.3.6.7.6h13.8c.4 0 .7-.3.7-.6v-.6c0-2.8-3.4-5-7.6-5Z" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="relative lg:min-h-[calc(100vh-48px)] lg:rounded-[34px] lg:border lg:border-white/10 lg:bg-white/10 lg:px-8 lg:py-8 lg:shadow-[0_26px_70px_rgba(35,54,47,0.22)] lg:backdrop-blur-2xl">
          <div className="relative">
            <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="px-0 py-0">
                <h1 className="text-[24px] font-black tracking-[-0.04em] text-white lg:text-[34px]">
                  Activity
                </h1>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search client name..."
                  className="h-12 rounded-[16px] border-0 bg-white px-5 text-sm font-bold text-[#365665] outline-none lg:h-10 lg:w-[198px]"
                />

                <div className="hidden items-center gap-2 lg:flex">
                  <div
                    ref={desktopFilterRef}
                    className="relative"
                    onMouseEnter={() => setDesktopFilterOpen(true)}
                  >
                    <button
                      type="button"
                      onClick={() => setDesktopFilterOpen((open) => !open)}
                      className="flex h-10 min-w-[150px] items-center justify-between gap-4 rounded-[16px] bg-[#ffd66b] px-5 text-[12px] font-black text-[#365665] shadow-[0_8px_24px_rgba(255,214,107,0.30)] transition hover:brightness-105"
                      aria-expanded={desktopFilterOpen}
                    >
                      <span>{desktopFilterLabel}</span>
                      <span
                        className={`text-[10px] transition ${desktopFilterOpen ? "rotate-180" : ""}`}
                      >
                        ⌄
                      </span>
                    </button>

                    {desktopFilterOpen ? (
                      <div className="absolute right-0 top-12 z-50 w-[230px] overflow-hidden rounded-[20px] border border-white/15 bg-[#365665]/95 p-2 text-white shadow-[0_26px_70px_rgba(18,35,38,0.36)] backdrop-blur-2xl">
                        {FILTERS.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => chooseFilter(item.key)}
                            className={`flex h-10 w-full items-center justify-between rounded-[14px] px-4 text-left text-[12px] font-black transition ${
                              !selectedMonth && filter === item.key
                                ? "bg-[#ffd66b] text-[#365665]"
                                : "text-white/90 hover:bg-white/12"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}

                        <div className="my-2 h-px bg-white/12" />
                        <div className="px-4 pb-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
                          Month
                        </div>
                        <div className="max-h-[220px] overflow-y-auto pr-1">
                          {availableMonths.length === 0 ? (
                            <div className="px-4 py-3 text-[12px] font-bold text-white/60">
                              No months available
                            </div>
                          ) : (
                            availableMonths.map((month) => (
                              <button
                                key={month.key}
                                type="button"
                                onClick={() => chooseMonth(month.key)}
                                className={`flex h-10 w-full items-center rounded-[14px] px-4 text-left text-[12px] font-black transition ${
                                  selectedMonth === month.key
                                    ? "bg-[#ffd66b] text-[#365665]"
                                    : "text-white/90 hover:bg-white/12"
                                }`}
                              >
                                {month.label}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={downloadCsv}
                    className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/25 bg-white/12 text-white transition hover:bg-white/18"
                    aria-label="Download activity CSV"
                  >
                    ↓
                  </button>
                </div>

                <div className="flex items-center gap-2 rounded-[18px] bg-white/10 p-1 lg:hidden">
                  {MOBILE_FILTERS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => chooseFilter(item.key)}
                      className={`h-10 rounded-[14px] px-5 text-[12px] font-black transition ${
                        filter === item.key
                          ? "bg-[#ffd66b] text-[#365665] shadow-[0_10px_28px_rgba(255,214,107,0.35)]"
                          : "text-white hover:bg-white/10"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            <section
              className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.20)] backdrop-blur-2xl"
              style={{ background: GLASS_PANEL }}
            >
              <div className="hidden lg:block">
                {visibleRows.length === 0 ? (
                  <div className="p-8 text-sm font-bold text-white/70">
                    No activity matches this filter.
                  </div>
                ) : (
                  visibleRows.map(({ row, activity, staffName, duplicate, type, itemLabel, categoryName }) => (
                    <button
                      key={`${String(row.activity_source ?? "activity")}-${String(row.id)}`}
                      type="button"
                      onClick={() => openClientCard(row.client_id ?? row.profile_id)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-6 border-b border-white/10 px-7 py-3 text-left text-[12px] font-black text-white transition hover:bg-white/10 last:border-b-0 ${duplicate ? "bg-[#ffd66b]/16" : ""}`}
                    >
                      <div className="min-w-0 break-words">
                        {renderHighlightedActivity(activity, type, itemLabel, categoryName)}
                        {duplicate ? (
                          <span className="ml-2 rounded-full bg-[#ffd66b] px-2 py-1 text-[9px] font-black uppercase text-[#365665]">
                            Double
                          </span>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right text-[12px] font-black text-white/90">
                        {staffName} · {dateOnly(row.created_at)} ·{" "}
                        {timeOnly(row.created_at)}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="lg:hidden">
                {visibleRows.length === 0 ? (
                  <div className="p-6 text-sm font-bold text-white/70">
                    No activity matches this filter.
                  </div>
                ) : (
                  visibleRows.map(({ row, activity, staffName, duplicate, type, itemLabel, categoryName }) => (
                    <button
                      key={`${String(row.activity_source ?? "activity")}-${String(row.id)}`}
                      type="button"
                      onClick={() => openClientCard(row.client_id ?? row.profile_id)}
                      className={`flex w-full cursor-pointer flex-col gap-1 border-b border-white/10 px-5 py-3 text-left text-[12px] font-black text-white transition hover:bg-white/10 last:border-b-0 ${duplicate ? "bg-[#ffd66b]/18" : ""}`}
                    >
                      <div className="min-w-0 break-words leading-[1.35]">
                        {renderHighlightedActivity(activity, type, itemLabel, categoryName)}
                        {duplicate ? (
                          <span className="ml-2 rounded-full bg-[#ffd66b] px-2 py-1 text-[9px] font-black uppercase text-[#365665]">
                            Double
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] font-black text-white/76">
                        {staffName} · {dateOnly(row.created_at)} · {timeOnly(row.created_at)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}
