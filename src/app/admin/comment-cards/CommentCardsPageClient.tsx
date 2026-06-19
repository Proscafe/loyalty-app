"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminPageShell } from "@/components/AdminPageShell";

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

  const profilePhones = useMemo(
    () => new Set(profiles.map((profile) => String(profile.phone ?? "").replace(/\D/g, "")).filter(Boolean)),
    [profiles],
  );

  const rows = useMemo(() => {
    return comments.map((row) => {
      const phone = cleanText(row.phone ?? row.mobile ?? row.phone_number);
      const normalizedPhone = phone.replace(/\D/g, "");
      const score = rating(row);
      const comment = cleanText(row.comments ?? row.comment ?? row.feedback);
      const registered = Boolean(normalizedPhone && profilePhones.has(normalizedPhone));
      const lastContacted = cleanText(row.last_contacted_at ?? row.contacted_at);
      const needsAttention = score > 0 && score < 4;
      const giftCandidate = score >= 4.8 && !needsAttention && lastContacted === "—";

      return {
        id: String(row.id ?? `${phone}-${row.created_at}`),
        name: cleanText(row.full_name ?? row.name ?? row.customer_name),
        phone,
        age: cleanText(row.age),
        rating: score,
        heardFrom: cleanText(row.heard_about_us ?? row.heard_from ?? row.source),
        comment,
        submitted: dateTime(row.created_at ?? row.submitted_at),
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
      `${row.name} ${row.phone} ${row.comment} ${row.heardFrom}`.toLowerCase().includes(term);

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

  const averageRating = rows.length
    ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length
    : 0;

  function downloadCsv() {
    const header = ["Name", "Phone", "Age", "Rating", "Heard From", "Comment", "Submitted", "Member Since", "Last Contacted"];
    const csv = [
      header,
      ...visibleRows.map((row) => [
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
        <div className="pointer-events-none fixed inset-0 -z-10 hidden lg:block" style={{ background: PAGE_BG }} />

        <div className="mb-5 lg:hidden">
          <div className="flex h-[58px] items-center justify-between rounded-[18px] bg-white/10 px-4 shadow-[0_14px_36px_rgba(35,54,47,0.16)] backdrop-blur-2xl">
            <img src="/apple-icon.png" alt="PRO's" className="h-[36px] w-auto origin-left object-contain" />
            <Link href="/profile" aria-label="Open profile" className="flex h-[32px] w-[32px] items-center justify-center text-[#ffd66b] transition hover:scale-105">
              <svg viewBox="0 0 24 24" className="h-[24px] w-[24px]" fill="currentColor" aria-hidden="true"><path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 2.2c-4.2 0-7.6 2.2-7.6 5v.6c0 .4.3.6.7.6h13.8c.4 0 .7-.3.7-.6v-.6c0-2.8-3.4-5-7.6-5Z" /></svg>
            </Link>
          </div>
        </div>

        <div className="relative lg:min-h-[calc(100vh-48px)] lg:rounded-[34px] lg:border lg:border-white/10 lg:bg-white/10 lg:px-8 lg:py-8 lg:shadow-[0_26px_70px_rgba(35,54,47,0.22)] lg:backdrop-blur-2xl">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[24px] font-black tracking-[-0.04em] text-white lg:text-[34px]">Comment Cards</h1>
              <p className="mt-1 text-[12px] font-bold text-white/70">Review feedback, ratings, and follow up with customers.</p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, comment..." className="h-12 rounded-[16px] border-0 bg-white px-5 text-sm font-bold text-[#365665] outline-none lg:h-10 lg:w-[320px]" />
              <button type="button" onClick={downloadCsv} className="hidden h-10 w-10 items-center justify-center rounded-[12px] border border-white/25 bg-white/12 text-white transition hover:bg-white/18 lg:flex" aria-label="Download comment cards CSV">↓</button>
            </div>
          </header>

          <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Total Feedback" value={rows.length} />
            <SummaryCard label="Registered Members" value={rows.filter((row) => row.registered).length} />
            <SummaryCard label="Average Rating" value={averageRating ? `${averageRating.toFixed(1)}/5` : "—"} />
            <SummaryCard label="Needs Attention" value={rows.filter((row) => row.needsAttention).length} />
          </section>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {SEGMENTS.map((item) => (
              <button key={item.key} type="button" onClick={() => setSegment(item.key)} className={`h-9 shrink-0 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.08em] transition ${segment === item.key ? "bg-[#ffd66b] text-[#365665] shadow-[0_10px_28px_rgba(255,214,107,0.35)]" : "bg-white/12 text-white/80 hover:bg-white/18"}`}>
                {item.label}
              </button>
            ))}
          </div>

          <section className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.20)] backdrop-blur-2xl" style={{ background: GLASS_PANEL }}>
            <div className="hidden lg:block">
              <div className="grid grid-cols-[1.35fr_1fr_0.45fr_0.7fr_1fr_1.25fr_1fr_1fr_1.35fr_1fr] border-b border-white/25 px-6 py-4 text-[11px] font-black uppercase tracking-[0.14em] text-white">
                <div>Name</div><div>Phone</div><div>Age</div><div>Rating</div><div>Heard From</div><div>Comment</div><div>Submitted</div><div>Member Since</div><div>Actions</div><div>Last Contacted</div>
              </div>
              {visibleRows.length === 0 ? <Empty /> : visibleRows.map((row) => <DesktopRow key={row.id} row={row} />)}
            </div>
            <div className="lg:hidden">
              {visibleRows.length === 0 ? <Empty /> : visibleRows.map((row) => <MobileRow key={row.id} row={row} />)}
            </div>
          </section>
        </div>
      </div>
    </AdminPageShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-[18px] bg-white/10 px-4 py-4 shadow-[0_14px_36px_rgba(35,54,47,0.12)] backdrop-blur-2xl lg:rounded-[20px]"><div className="text-[11px] font-black text-white">{label}</div><div className="mt-2 text-[22px] font-black text-white">{value}</div></div>;
}

function ActionButtons({ phone }: { phone: string }) {
  const wa = phone && phone !== "—" ? `https://wa.me/${phone.replace(/\D/g, "")}` : "#";
  return <div className="flex flex-wrap items-center gap-2"><button className="h-8 rounded-full bg-[#ffd66b] px-4 text-[11px] font-black text-[#365665]">GIFT</button><a href={wa} target="_blank" rel="noreferrer" className="flex h-8 items-center rounded-full bg-[#20d66b] px-4 text-[11px] font-black text-white">WA</a><button className="h-8 rounded-full bg-white px-4 text-[11px] font-black text-[#365665]">CONTACTED</button></div>;
}

function DesktopRow({ row }: { row: any }) {
  return <div className="grid grid-cols-[1.35fr_1fr_0.45fr_0.7fr_1fr_1.25fr_1fr_1fr_1.35fr_1fr] items-center border-b border-white/10 px-6 py-4 text-[12px] font-black text-white last:border-b-0"><div>{row.name}</div><div>{row.phone}</div><div>{row.age}</div><div className="text-[#9cffc9]">★ {row.rating ? row.rating.toFixed(1) : "—"}</div><div>{row.heardFrom}</div><div className="truncate pr-4">{row.comment}</div><div>{row.submitted}</div><div>{row.memberSince}</div><ActionButtons phone={row.phone} /><div>{row.lastContacted}</div></div>;
}

function MobileRow({ row }: { row: any }) {
  return <div className="border-b border-white/10 px-5 py-4 text-white last:border-b-0"><div className="flex items-start justify-between gap-3"><div><div className="text-[14px] font-black">{row.name}</div><div className="mt-1 text-[11px] font-black text-[#ffd66b]">{row.phone}</div></div><div className="text-[13px] font-black text-[#9cffc9]">★ {row.rating ? row.rating.toFixed(1) : "—"}</div></div><div className="mt-3 text-[12px] font-bold text-white/80">{row.comment}</div><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-white/70"><span>{row.heardFrom}</span><span>•</span><span>{row.submitted}</span></div><div className="mt-3"><ActionButtons phone={row.phone} /></div></div>;
}

function Empty() {
  return <div className="p-8 text-sm font-bold text-white/70">No comment cards match this filter.</div>;
}
