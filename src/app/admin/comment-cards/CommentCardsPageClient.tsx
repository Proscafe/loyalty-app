"use client";

import { useMemo, useState } from "react";
import { AdminPageShell } from "@/components/AdminPageShell";
import { AdminMobileHeader } from "@/components/AdminMobileHeader";

type CommentCardRow = Record<string, any>;
type ProfileRow = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  client_code?: string | null;
  created_at?: string | null;
};

type Segment =
  | "all"
  | "needs_attention"
  | "five_star"
  | "gift_candidates"
  | "not_registered"
  | "not_contacted"
  | "with_comment";

const PAGE_BG =
  "radial-gradient(circle at top left, rgba(255,214,107,0.24), transparent 28%), linear-gradient(135deg, #365665 0%, #263f49 48%, #798673 100%)";
const GLASS_PANEL = "rgba(255,255,255,0.10)";

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_attention", label: "Needs Attention" },
  { key: "five_star", label: "5-Star Fans" },
  { key: "gift_candidates", label: "Gift Candidates" },
  { key: "not_registered", label: "Not Registered" },
  { key: "not_contacted", label: "Not Contacted" },
  { key: "with_comment", label: "With Comment" },
];

type TimeFilter = "today" | "week" | "month" | "year" | "all";

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "Show all" },
];

const DESKTOP_TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "Year" },
  { key: "all", label: "All" },
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

function dateTime(value?: string | null) {
  const date = validDate(value);
  if (!date) return "—";
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
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

function startOfYear() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).getTime();
}

function isSameTimeFilter(
  value: string | null | undefined,
  filter: TimeFilter,
) {
  if (filter === "all") return true;
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
  if (filter === "year")
    return time >= startOfYear() && time < todayStart + 86400000;
  return true;
}

function rating(row: CommentCardRow) {
  const direct = Number(row.rating ?? row.average_rating ?? row.avg_rating);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const values = [
    row.experience_rating,
    row.food_rating,
    row.service_rating,
    row.cleanliness_rating,
    row.visit_again_rating,
  ]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function CommentCardsPageClient({
  comments,
  profiles,
}: {
  comments: CommentCardRow[];
  profiles: ProfileRow[];
}) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [giftRow, setGiftRow] = useState<any | null>(null);
  const [giftName, setGiftName] = useState("Free Sandwiches");
  const [giftNote, setGiftNote] = useState("");

  const profilePhones = useMemo(
    () =>
      new Set(
        profiles
          .map((profile) => String(profile.phone ?? "").replace(/\D/g, ""))
          .filter(Boolean),
      ),
    [profiles],
  );

  const rows = useMemo(() => {
    return comments.map((row) => {
      const phone = cleanText(row.phone ?? row.mobile ?? row.phone_number);
      const normalizedPhone = phone.replace(/\D/g, "");
      const score = rating(row);
      const comment = cleanText(row.comments ?? row.comment ?? row.feedback);
      const registered = Boolean(
        normalizedPhone && profilePhones.has(normalizedPhone),
      );
      const lastContacted = cleanText(
        row.last_contacted_at ?? row.contacted_at,
      );
      const needsAttention = score > 0 && score < 4;
      const giftCandidate =
        score >= 4.8 && !needsAttention && lastContacted === "—";

      return {
        id: String(row.id ?? `${phone}-${row.created_at}`),
        name: cleanText(row.full_name ?? row.name ?? row.customer_name),
        phone,
        age: cleanText(row.age),
        rating: score,
        heardFrom: cleanText(
          row.heard_about_us ?? row.heard_from ?? row.source,
        ),
        comment,
        submitted: dateTime(row.created_at ?? row.submitted_at),
        submittedRaw: String(row.created_at ?? row.submitted_at ?? ""),
        memberSince: registered ? "Registered" : "—",
        lastContacted,
        registered,
        needsAttention,
        giftCandidate,
        raw: row,
      };
    });
  }, [comments, profilePhones]);

  const visibleRows = rows.filter((row) => {
    const term = query.trim().toLowerCase();
    const matchesSearch =
      !term ||
      `${row.name} ${row.phone} ${row.comment} ${row.heardFrom}`
        .toLowerCase()
        .includes(term);

    const matchesSegment =
      segment === "all" ||
      (segment === "needs_attention" && row.needsAttention) ||
      (segment === "five_star" && row.rating >= 4.8) ||
      (segment === "gift_candidates" && row.giftCandidate) ||
      (segment === "not_registered" && !row.registered) ||
      (segment === "not_contacted" && row.lastContacted === "—") ||
      (segment === "with_comment" && row.comment !== "—");

    return matchesSearch && matchesSegment;
  });

  const desktopVisibleRows = visibleRows.filter((row) =>
    isSameTimeFilter(row.submittedRaw, timeFilter),
  );

  const mobileVisibleRows = visibleRows.filter((row) =>
    isSameTimeFilter(row.submittedRaw, timeFilter),
  );

  const mobileFilterLabel =
    TIME_FILTERS.find((item) => item.key === timeFilter)?.label ?? "Today";

  const segmentDateLabel =
    DESKTOP_TIME_FILTERS.find((item) => item.key === timeFilter)?.label ??
    "Today";

  const summaryRows = desktopVisibleRows;

  const averageRating = summaryRows.length
    ? summaryRows.reduce((sum, row) => sum + row.rating, 0) / summaryRows.length
    : 0;

  const topHeardFrom = useMemo(() => {
    const counts = new Map<string, number>();
    summaryRows.forEach((row) => {
      if (!row.heardFrom || row.heardFrom === "—") return;
      counts.set(row.heardFrom, (counts.get(row.heardFrom) ?? 0) + 1);
    });
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]} (${top[1]})` : "—";
  }, [summaryRows]);

  function downloadCsv() {
    const header = [
      "Name",
      "Phone",
      "Age",
      "Rating",
      "Heard From",
      "Comment",
      "Submitted",
      "Member Since",
      "Last Contacted",
    ];
    const csv = [
      header,
      ...desktopVisibleRows.map((row) => [
        row.name,
        row.phone,
        row.age,
        row.rating ? row.rating.toFixed(1) : "—",
        row.heardFrom,
        row.comment,
        row.submitted,
        row.memberSince,
        row.lastContacted,
      ]),
    ]
      .map((line) => line.map(csvEscape).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "comment-cards.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPageShell active="comment-cards">
      <style>{`@media (min-width: 1024px) { html, body, main, [data-nextjs-scroll-focus-boundary] { background: ${PAGE_BG} !important; } body::before { content: ""; position: fixed; inset: 0; z-index: -1; background: ${PAGE_BG}; pointer-events: none; } }`}</style>
      <div className="relative min-h-screen px-4 py-5 lg:-m-6 lg:px-6 lg:py-6 lg:bg-transparent">
        <div
          className="pointer-events-none fixed inset-0 -z-10 hidden lg:block"
          style={{ background: PAGE_BG }}
        />

        <div className="mb-5 lg:hidden">
          <AdminMobileHeader />
        </div>

        <div className="relative lg:min-h-[calc(100vh-48px)] lg:px-4 lg:py-4">
          <header className="relative mb-5 lg:mb-5 lg:min-h-[64px]">
            <div className="rounded-[26px] border border-white/10 bg-white/10 px-5 py-5 backdrop-blur-2xl lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-0">
              <div className="flex items-center justify-between gap-3 lg:flex lg:items-end lg:justify-between lg:gap-4">
                <div className="lg:min-w-0">
                  <h1 className="whitespace-nowrap text-[23px] font-black tracking-[-0.04em] text-white lg:text-[34px]">
                    Comment Cards
                  </h1>
                  <p className="mt-1 hidden text-[12px] font-bold text-white/70 lg:block">
                    Review feedback, ratings, and follow up with customers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterOpen(true)}
                  className="h-11 shrink-0 rounded-full bg-[#ffd66b] px-6 text-[12px] font-black text-[#365665] lg:hidden"
                >
                  {mobileFilterLabel}
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 lg:absolute lg:right-0 lg:top-0 lg:mt-0 lg:flex-row lg:items-center lg:justify-end">
              <div className="hidden lg:relative lg:block">
                <select
                  value={timeFilter}
                  onChange={(event) =>
                    setTimeFilter(event.target.value as TimeFilter)
                  }
                  className="h-10 cursor-pointer appearance-none rounded-full border-0 bg-[#ffd66b] px-5 pr-9 text-[11px] font-black uppercase tracking-[0.08em] text-[#365665] outline-none"
                  aria-label="Date filter"
                >
                  {DESKTOP_TIME_FILTERS.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-black text-[#365665]">
                  ▾
                </span>
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, phone, comment..."
                className="h-12 rounded-[16px] border-0 bg-white px-5 text-sm font-bold text-[#365665] outline-none lg:h-10 lg:w-[300px]"
              />
              <button
                type="button"
                onClick={downloadCsv}
                className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-transparent text-[18px] font-black text-white transition hover:bg-white/10 lg:flex"
                aria-label="Download comment cards CSV"
                title="Download"
              >
                ↓
              </button>
            </div>
          </header>

          <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <SummaryCard
              label="Total Feedback"
              value={summaryRows.length}
              mobileHidden
            />
            <SummaryCard
              label="Registered Members"
              value={summaryRows.filter((row) => row.registered).length}
              mobileHidden
            />
            <SummaryCard
              label="Average Rating"
              value={averageRating ? `${averageRating.toFixed(1)}/5` : "—"}
            />
            <SummaryCard
              label="Needs Attention"
              value={summaryRows.filter((row) => row.needsAttention).length}
            />
            <SummaryCard label="Heard From" value={topHeardFrom} mobileHidden />
          </section>

          <div className="mb-4 hidden gap-2 overflow-x-auto pb-1 lg:flex">
            {SEGMENTS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSegment(item.key)}
                className={`h-9 shrink-0 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.08em] transition ${segment === item.key ? "bg-[#ffd66b] text-[#365665]" : "bg-white/12 text-white/80 hover:bg-white/18"}`}
              >
                {item.key === "all" ? segmentDateLabel : item.label}
              </button>
            ))}
          </div>

          <section
            className="overflow-hidden rounded-[28px] border border-white/10 backdrop-blur-2xl "
            style={{ background: GLASS_PANEL }}
          >
            <div className="hidden lg:block">
              <div className="grid grid-cols-[1.35fr_1fr_0.45fr_0.7fr_1fr_1.25fr_1fr_1fr_1.35fr_1fr] border-b border-white/25 px-6 py-4 text-[11px] font-black uppercase tracking-[0.14em] text-white">
                <div>Name</div>
                <div>Phone</div>
                <div>Age</div>
                <div>Rating</div>
                <div>Heard From</div>
                <div>Comment</div>
                <div>Submitted</div>
                <div>Member Since</div>
                <div>Actions</div>
                <div>Last Contacted</div>
              </div>
              {desktopVisibleRows.length === 0 ? (
                <Empty />
              ) : (
                desktopVisibleRows.map((row) => (
                  <DesktopRow
                    key={row.id}
                    row={row}
                    onGift={() => setGiftRow(row)}
                  />
                ))
              )}
            </div>
            <div className="lg:hidden">
              {mobileVisibleRows.length === 0 ? (
                <Empty />
              ) : (
                mobileVisibleRows.map((row) => (
                  <MobileRow
                    key={row.id}
                    row={row}
                    onOpen={() => setSelectedRow(row)}
                  />
                ))
              )}
            </div>
          </section>

          {filterOpen ? (
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-5 lg:hidden"
              onClick={() => setFilterOpen(false)}
            >
              <div
                className="w-full max-w-[320px] rounded-[28px] border border-white/15 bg-[#365665]/95 p-4 backdrop-blur-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 text-center text-[12px] font-black uppercase tracking-[0.16em] text-white/70">
                  Filter
                </div>
                <div className="grid gap-2">
                  {TIME_FILTERS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setTimeFilter(item.key);
                        setFilterOpen(false);
                      }}
                      className={`h-12 rounded-full text-[12px] font-black ${timeFilter === item.key ? "bg-[#ffd66b] text-[#365665]" : "bg-white/10 text-white"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {selectedRow ? (
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-5 backdrop-blur-sm lg:hidden"
              onClick={() => setSelectedRow(null)}
            >
              <div
                className="max-h-[82vh] w-full max-w-md overflow-y-auto rounded-[30px] border border-white/15 bg-[#365665]/95 p-5 text-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[24px] font-black tracking-[-0.04em]">
                      {selectedRow.name}
                    </h2>
                    <div className="mt-1 text-[12px] font-black text-[#ffd66b]">
                      {selectedRow.phone}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRow(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[18px] font-black"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[12px] font-bold">
                  <DetailItem
                    label="Rating"
                    value={
                      selectedRow.rating
                        ? `★ ${selectedRow.rating.toFixed(1)}`
                        : "—"
                    }
                  />
                  <DetailItem label="Source" value={selectedRow.heardFrom} />
                  <DetailItem label="Submitted" value={selectedRow.submitted} />
                  <DetailItem label="Member" value={selectedRow.memberSince} />
                  <DetailItem
                    label="Last contacted"
                    value={selectedRow.lastContacted}
                  />
                  <DetailItem label="Age" value={selectedRow.age} />
                </div>

                <div className="mt-4 rounded-[22px] bg-white/10 p-4">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
                    Comment
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] font-bold leading-6 text-white/86">
                    {selectedRow.comment}
                  </p>
                </div>

                <div className="mt-4">
                  <ActionButtons
                    phone={selectedRow.phone}
                    onGift={() => setGiftRow(selectedRow)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {giftRow ? (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-5 backdrop-blur-sm"
              onClick={() => setGiftRow(null)}
            >
              <form
                className="w-full max-w-[460px] rounded-[28px] bg-[#111b1f]/95 p-5 text-white shadow-2xl lg:max-w-[520px] lg:p-6"
                onClick={(event) => event.stopPropagation()}
                onSubmit={(event) => {
                  event.preventDefault();
                  setGiftRow(null);
                  setGiftNote("");
                }}
              >
                <div className="mb-5">
                  <h2 className="text-[24px] font-black tracking-[-0.04em] lg:text-[26px]">
                    Send gift
                  </h2>
                  <p className="mt-2 text-[13px] font-bold text-white/55">
                    Send a gift to {giftRow.name}.
                  </p>
                </div>

                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white">
                  Gift
                </label>
                <select
                  value={giftName}
                  onChange={(event) => setGiftName(event.target.value)}
                  className="h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none"
                >
                  <option>Free Sandwiches</option>
                  <option>Free Dessert</option>
                  <option>Free Coffee</option>
                  <option>10% Discount</option>
                  <option>Free Hooka</option>
                </select>

                <label className="mb-2 mt-5 block text-[11px] font-black uppercase tracking-[0.14em] text-white">
                  Note
                </label>
                <textarea
                  value={giftNote}
                  onChange={(event) => setGiftNote(event.target.value)}
                  placeholder="Optional note..."
                  className="min-h-[90px] w-full resize-none rounded-[16px] border-0 bg-white px-4 py-4 text-[13px] font-bold text-[#365665] outline-none placeholder:text-[#8a98a4] lg:min-h-[96px]"
                />

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setGiftRow(null);
                      setGiftNote("");
                    }}
                    className="h-10 rounded-full px-5 text-[11px] font-black uppercase tracking-[0.12em] text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-11 rounded-full bg-[#ffd66b] px-6 text-[11px] font-black uppercase tracking-[0.12em] text-[#263f49]"
                  >
                    Send gift
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </AdminPageShell>
  );
}

function SummaryCard({
  label,
  value,
  mobileHidden = false,
}: {
  label: string;
  value: string | number;
  mobileHidden?: boolean;
}) {
  return (
    <div
      className={`${mobileHidden ? "hidden lg:block" : ""} rounded-[18px] bg-white/10 px-4 py-4 backdrop-blur-2xl lg:rounded-[20px]`}
    >
      <div className="text-[11px] font-black text-white">{label}</div>
      <div className="mt-2 text-[22px] font-black text-white">{value}</div>
    </div>
  );
}

function ActionButtons({
  phone,
  onGift,
}: {
  phone: string;
  onGift?: () => void;
}) {
  const wa =
    phone && phone !== "—" ? `https://wa.me/${phone.replace(/\D/g, "")}` : "#";
  return (
    <div className="flex flex-wrap items-center gap-1.5 lg:flex-nowrap">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onGift?.();
        }}
        className="h-8 rounded-full bg-[#ffd66b] px-4 text-[11px] font-black text-[#365665] lg:h-7 lg:px-3 lg:text-[10px]"
      >
        GIFT
      </button>
      <a
        href={wa}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="flex h-8 items-center rounded-full bg-[#20d66b] px-4 text-[11px] font-black text-white lg:h-7 lg:px-3 lg:text-[10px]"
      >
        WA
      </a>
      <button
        type="button"
        onClick={(event) => event.stopPropagation()}
        className="h-8 rounded-full bg-white px-4 text-[11px] font-black text-[#365665] lg:h-7 lg:px-3 lg:text-[10px]"
      >
        CONTACTED
      </button>
    </div>
  );
}

function DesktopRow({ row, onGift }: { row: any; onGift?: () => void }) {
  return (
    <div className="grid grid-cols-[1.35fr_1fr_0.45fr_0.7fr_1fr_1.25fr_1fr_1fr_1.35fr_1fr] items-center border-b border-white/10 px-6 py-4 text-[12px] font-black text-white last:border-b-0">
      <div>{row.name}</div>
      <div>{row.phone}</div>
      <div>{row.age}</div>
      <div className="text-[#9cffc9]">
        ★ {row.rating ? row.rating.toFixed(1) : "—"}
      </div>
      <div>{row.heardFrom}</div>
      <div className="truncate pr-4">{row.comment}</div>
      <div>{row.submitted}</div>
      <div>{row.memberSince}</div>
      <ActionButtons phone={row.phone} onGift={onGift} />
      <div>{row.lastContacted}</div>
    </div>
  );
}

function MobileRow({ row, onOpen }: { row: any; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full border-b border-white/10 px-5 py-4 text-left text-white last:border-b-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-black">{row.name}</div>
          <div className="mt-1 text-[11px] font-black text-[#ffd66b]">
            {row.phone}
          </div>
        </div>
        <div className="text-[13px] font-black text-[#9cffc9]">
          ★ {row.rating ? row.rating.toFixed(1) : "—"}
        </div>
      </div>
      <div className="mt-3 line-clamp-2 text-[12px] font-bold text-white/80">
        {row.comment}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-white/70">
        <span>{row.heardFrom}</span>
        <span>•</span>
        <span>{row.submitted}</span>
      </div>
    </button>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[18px] bg-white/10 p-3">
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45">
        {label}
      </div>
      <div className="mt-1 break-words text-[12px] font-black text-white">
        {value}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="p-8 text-sm font-bold text-white/70">
      No comment cards today.
    </div>
  );
}
