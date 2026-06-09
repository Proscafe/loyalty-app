import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminMobileFloatingMenu } from "@/components/AdminMobileFloatingMenu";

export const dynamic = "force-dynamic";

type CommentFilter = "today" | "week" | "month";

type CommentCardRow = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  birthday?: string | null;
  experience_rating?: number | string | null;
  food_rating?: number | string | null;
  service_rating?: number | string | null;
  cleanliness_rating?: number | string | null;
  visit_again_rating?: number | string | null;
  heard_about_us?: string | null;
  comments?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const FILTERS: Array<{ key: CommentFilter; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

const MOBILE_ADMIN_MENU_ITEMS = [
  { label: "Overview", icon: "⌂", href: "/admin" },
  { label: "Activity", icon: "↯", href: "/admin/activity" },
  { label: "Users", icon: "♟", href: "/admin/users" },
  { label: "Loyalty Program", icon: "★", href: "/admin?tab=Loyalty+Program" },
  { label: "Comment Card", icon: "✎", href: "/admin/comment-cards" },
  { label: "Games", icon: "🎮", href: "/admin/predictions" },
];

const EMPTY_COPY: Record<CommentFilter, { title: string }> = {
  today: { title: "No comments today" },
  week: { title: "No comments this week" },
  month: { title: "No comments this month" },
};

function getStringValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function normalizeFilter(value: string | string[] | undefined): CommentFilter {
  const filter = Array.isArray(value) ? value[0] : value;
  if (filter === "week") return "week";
  if (filter === "month") return "month";
  return "today";
}

function getCustomerName(card: CommentCardRow) {
  return getStringValue(card.full_name) || "Guest";
}

function getCommentText(card: CommentCardRow) {
  return getStringValue(card.comments) || "No written comment.";
}

function averageRating(card: CommentCardRow) {
  const ratings = [
    card.experience_rating,
    card.food_rating,
    card.service_rating,
    card.cleanliness_rating,
    card.visit_again_rating,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (ratings.length === 0) return 0;

  return ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
}

function getBeirutDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? 1);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 1);

  return { year, month, day };
}

function beirutDateToUtc(year: number, month: number, day: number) {
  // Beirut is UTC+3 in this project, matching the admin dashboard visit-day logic.
  return new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
}

function getFilterRange(filter: CommentFilter) {
  const { year, month, day } = getBeirutDateParts();
  const todayStart = beirutDateToUtc(year, month, day);

  if (filter === "today") {
    const end = new Date(todayStart);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start: todayStart, end };
  }

  if (filter === "week") {
    const beirutToday = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dayOfWeek = beirutToday.getUTCDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    const start = new Date(todayStart);
    start.setUTCDate(start.getUTCDate() - mondayOffset);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
  }

  const start = beirutDateToUtc(year, month, 1);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

function filterCommentCards(cards: CommentCardRow[], filter: CommentFilter) {
  const { start, end } = getFilterRange(filter);

  return cards.filter((card) => {
    if (!card.created_at) return false;
    const submittedAt = new Date(card.created_at);
    if (Number.isNaN(submittedAt.getTime())) return false;
    return submittedAt >= start && submittedAt < end;
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Beirut",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function loadCommentCards() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("comment_cards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Failed to load comment cards:", error);
    return [];
  }

  return (data ?? []) as CommentCardRow[];
}

export default async function AdminCommentCardsPage({ searchParams }: PageProps) {
  const profile = await requireRole(["master_admin"]);
  const params = searchParams ? await searchParams : {};
  const activeFilter = normalizeFilter(params.filter);
  const allCommentCards = await loadCommentCards();
  const commentCards = filterCommentCards(allCommentCards, activeFilter);

  const counts = {
    today: filterCommentCards(allCommentCards, "today").length,
    week: filterCommentCards(allCommentCards, "week").length,
    month: filterCommentCards(allCommentCards, "month").length,
  };

  return (
    <main className="min-h-screen bg-[#61716b] p-3 text-white lg:p-6">
      <div className="mx-auto flex w-full max-w-[1480px] gap-5">
        <AdminSidebar active="comment-cards" />

        <section className="min-w-0 flex-1">
          <header className="mb-5 flex h-[70px] items-center justify-between rounded-[18px] bg-white/10 px-5 shadow-[0_18px_46px_rgba(35,48,39,0.12)] backdrop-blur-2xl lg:hidden">
            <Link href="/admin" className="flex items-center" aria-label="Go to admin overview">
              <img
                src="/pros-logo-basic.png"
                alt="PRO's Cafe"
                className="h-[46px] w-auto object-contain"
                draggable={false}
              />
            </Link>

            <div
              className="flex h-10 w-10 items-center justify-center text-[#ffd66b]"
              title={profile.full_name || profile.email || "Admin"}
              aria-label="Admin profile"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-9 w-9 fill-current drop-shadow-[0_8px_18px_rgba(255,214,107,0.22)]"
              >
                <path d="M12 12.2a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4Zm0 2.1c-4.6 0-8.3 2.4-8.3 5.3 0 .9.7 1.6 1.6 1.6h13.4c.9 0 1.6-.7 1.6-1.6 0-2.9-3.7-5.3-8.3-5.3Z" />
              </svg>
            </div>
          </header>

          <div className="mb-5 hidden items-end justify-between lg:flex">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[#ffd66b]">
                Admin
              </p>
              <h1 className="mt-2 text-[40px] font-black leading-none text-white">
                Comment Cards
              </h1>
              <p className="mt-3 text-sm font-bold text-white/70">
                Review customer feedback and recent comment card submissions.
              </p>
            </div>

            <div className="rounded-full bg-white/10 px-5 py-3 text-sm font-black text-white/80">
              {profile.full_name || profile.email || "Admin"}
            </div>
          </div>

          <div className="mb-5 lg:hidden">
            <h1 className="text-[30px] font-black leading-none text-white">
              Comment Cards
            </h1>
            <p className="mt-2 text-[12px] font-bold text-white/65">
              {commentCards.length} comments found
            </p>
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:gap-3">
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter.key;
              const count = counts[filter.key];

              return (
                <Link
                  key={filter.key}
                  href={`/admin/comment-cards?filter=${filter.key}`}
                  className={`shrink-0 rounded-full px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] transition ${
                    isActive
                      ? "bg-[#ffd66b] text-[#61716b] shadow-[0_14px_30px_rgba(20,30,26,0.18)]"
                      : "bg-[#718078] text-white/78 hover:bg-[#7d8d85]"
                  }`}
                >
                  {filter.label} <span className="ml-1 opacity-70">{count}</span>
                </Link>
              );
            })}
          </div>

          {commentCards.length === 0 ? (
            <div className="rounded-[28px] bg-[#718078] p-7 text-center shadow-[0_18px_46px_rgba(20,30,26,0.18)]">
              <p className="text-lg font-black">{EMPTY_COPY[activeFilter].title}</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {commentCards.map((card) => {
                const name = getCustomerName(card);
                const comment = getCommentText(card);
                const rating = averageRating(card);
                const phone = getStringValue(card.phone);
                const heardAboutUs = getStringValue(card.heard_about_us);

                return (
                  <article
                    key={card.id}
                    className="rounded-[28px] bg-[#718078] p-5 shadow-[0_18px_46px_rgba(20,30,26,0.18)]"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-[21px] font-black text-white">
                          {name}
                        </h2>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#ffd66b]">
                          {formatDate(card.created_at)}
                        </p>
                      </div>

                      {rating > 0 ? (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ffd66b] text-[17px] font-black text-[#365665]">
                          {rating.toFixed(1)}
                        </div>
                      ) : null}
                    </div>

                    <p className="rounded-[22px] bg-white/10 p-4 text-[14px] font-bold leading-6 text-white/88">
                      {comment}
                    </p>

                    <div className="mt-4 grid gap-2 text-[12px] font-bold text-white/70">
                      {phone ? <div>Phone: {phone}</div> : null}
                      {heardAboutUs ? <div>Heard from: {heardAboutUs}</div> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <AdminMobileFloatingMenu active="comment-cards" />

        </section>
      </div>
    </main>
  );
}
