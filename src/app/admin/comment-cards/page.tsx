import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import AdminDashboard from "../AdminDashboard";
import { AdminMobileFloatingMenu } from "@/components/AdminMobileFloatingMenu";
import { CommentCardsMobileFilter } from "@/components/CommentCardsMobileFilter";
import type { Profile, Reward, StampTransaction } from "@/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type CommentCardRow = Record<string, any>;
type DateFilter = "today" | "yesterday" | "week" | "month" | "all";

type Metrics = {
  totalClients: number;
  stampsIssued: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  mostActiveCategoryName: string;
};

const FILTERS: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "Show all" },
];

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeFilter(value: string): DateFilter {
  if (["today", "yesterday", "week", "month", "all"].includes(value)) {
    return value as DateFilter;
  }

  return "today";
}

function readString(row: CommentCardRow, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return fallback;
}

function readNumber(row: CommentCardRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function getName(row: CommentCardRow) {
  return readString(row, [
    "client_name",
    "customer_name",
    "full_name",
    "name",
    "user_name",
  ]);
}

function getPhone(row: CommentCardRow) {
  return readString(row, ["client_phone", "phone", "phone_number", "mobile"], "");
}

function getEmail(row: CommentCardRow) {
  return readString(row, ["client_email", "email", "customer_email"], "");
}

function getComment(row: CommentCardRow) {
  return readString(
    row,
    [
      "comment",
      "comments",
      "feedback",
      "message",
      "notes",
      "additional_comments",
      "description",
    ],
    "No written comment.",
  );
}

function getCreatedAt(row: CommentCardRow) {
  return String(row.created_at ?? row.submitted_at ?? row.inserted_at ?? "");
}

function getRatingValues(row: CommentCardRow) {
  const values = [
    readNumber(row, ["experience_rating", "experience", "overall_experience"]),
    readNumber(row, ["food_rating", "food"]),
    readNumber(row, ["service_rating", "service"]),
    readNumber(row, ["cleanliness_rating", "cleanliness"]),
    readNumber(row, ["visit_again_rating", "visit_again", "would_visit_again"]),
  ].filter((value): value is number => value !== null);

  const directRating = readNumber(row, ["rating", "overall_rating", "average_rating"]);

  if (values.length > 0) return values;
  if (directRating !== null) return [directRating];

  return [];
}

function getAverageRating(row: CommentCardRow) {
  const values = getRatingValues(row);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function beirutDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    key: `${get("year")}-${get("month")}-${get("day")}`,
    monthKey: `${get("year")}-${get("month")}`,
  };
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function weekdayIndex(shortWeekday: string) {
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  return map[shortWeekday] ?? 0;
}

function matchesDateFilter(row: CommentCardRow, filter: DateFilter) {
  if (filter === "all") return true;

  const createdAt = getCreatedAt(row);
  if (!createdAt) return false;

  const rowDate = new Date(createdAt);
  if (Number.isNaN(rowDate.getTime())) return false;

  const now = new Date();
  const rowParts = beirutDateParts(rowDate);
  const nowParts = beirutDateParts(now);

  if (filter === "today") return rowParts.key === nowParts.key;

  if (filter === "yesterday") {
    const yesterdayParts = beirutDateParts(addDays(now, -1));
    return rowParts.key === yesterdayParts.key;
  }

  if (filter === "month") return rowParts.monthKey === nowParts.monthKey;

  const startOfWeek = addDays(now, -weekdayIndex(nowParts.weekday));
  const startKey = beirutDateParts(startOfWeek).key;
  return rowParts.key >= startKey && rowParts.key <= nowParts.key;
}

function makeQueryHref(filter: DateFilter, search: string) {
  const params = new URLSearchParams();
  params.set("filter", filter);
  if (search.trim()) params.set("q", search.trim());
  return `/admin/comment-cards?${params.toString()}`;
}

function searchMatches(row: CommentCardRow, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    getName(row),
    getPhone(row),
    getEmail(row),
    getComment(row),
    readString(row, ["client_code", "member_id", "code"], ""),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

function EmptyState({ filter }: { filter: DateFilter }) {
  const labelByFilter: Record<DateFilter, string> = {
    today: "No comments today",
    yesterday: "No comments yesterday",
    week: "No comments this week",
    month: "No comments this month",
    all: "No comments yet",
  };

  return (
    <div className="rounded-[28px] bg-[#718078] px-6 py-10 text-center shadow-[0_18px_44px_rgba(20,30,26,0.14)]">
      <p className="text-[18px] font-black text-white">{labelByFilter[filter]}</p>
    </div>
  );
}

function MobileCommentCard({ row }: { row: CommentCardRow }) {
  const rating = getAverageRating(row);

  return (
    <article className="rounded-[28px] bg-[#718078] p-5 shadow-[0_18px_44px_rgba(20,30,26,0.14)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-[20px] font-black leading-tight text-white">
            {getName(row)}
          </h2>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#FFD66B]">
            {formatDate(getCreatedAt(row))}
          </p>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFD66B] text-[16px] font-black text-[#61716b]">
          {rating !== null ? rating.toFixed(1) : "—"}
        </div>
      </div>

      <p className="rounded-[20px] bg-white/12 p-4 text-[14px] font-bold leading-relaxed text-white/92">
        {getComment(row)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/74">
        <div>
          Phone
          <div className="mt-1 normal-case tracking-normal text-white">
            {getPhone(row) || "—"}
          </div>
        </div>
        <div>
          Email
          <div className="mt-1 truncate normal-case tracking-normal text-white">
            {getEmail(row) || "—"}
          </div>
        </div>
      </div>
    </article>
  );
}

async function loadAdminDashboardData() {
  const supabase = createAdminClient();

  const [
    usersResult,
    txnsResult,
    rewardsResult,
    totalClientsResult,
    stampsIssuedResult,
    rewardsEarnedResult,
    rewardsRedeemedResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("stamp_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("rewards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "client"),
    supabase
      .from("stamp_transactions")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("rewards")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("rewards")
      .select("id", { count: "exact", head: true })
      .eq("status", "redeemed"),
  ]);

  const metrics: Metrics = {
    totalClients: totalClientsResult.count ?? 0,
    stampsIssued: stampsIssuedResult.count ?? 0,
    rewardsEarned: rewardsEarnedResult.count ?? 0,
    rewardsRedeemed: rewardsRedeemedResult.count ?? 0,
    mostActiveCategoryName: "—",
  };

  return {
    users: (usersResult.data ?? []) as Profile[],
    recentTxns: (txnsResult.data ?? []) as StampTransaction[],
    recentRewards: (rewardsResult.data ?? []) as Reward[],
    metrics,
  };
}

async function loadCommentCards() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("comment_cards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Comment cards load error", error);
    return [] as CommentCardRow[];
  }

  return (data ?? []) as CommentCardRow[];
}

export default async function AdminCommentCardsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const profile = await requireRole(["master_admin"]);
  const params = (await searchParams) ?? {};
  const activeFilter = normalizeFilter(firstValue(params.filter));
  const search = firstValue(params.q);

  const [dashboardData, commentCards] = await Promise.all([
    loadAdminDashboardData(),
    loadCommentCards(),
  ]);

  const filteredCards = commentCards
    .filter((row) => matchesDateFilter(row, activeFilter))
    .filter((row) => searchMatches(row, search));

  const ratedCards = filteredCards
    .map((row) => getAverageRating(row))
    .filter((rating): rating is number => rating !== null);

  const averageRating = ratedCards.length
    ? ratedCards.reduce((sum, rating) => sum + rating, 0) / ratedCards.length
    : 0;

  const activeFilterLabel =
    FILTERS.find((filter) => filter.key === activeFilter)?.label ?? "Today";

  return (
    <>
      {/* Desktop keeps the original AdminDashboard Comment Cards design */}
      <div className="hidden lg:block">
        <AdminDashboard
          profile={profile}
          users={dashboardData.users}
          recentTxns={dashboardData.recentTxns}
          recentRewards={dashboardData.recentRewards}
          metrics={dashboardData.metrics}
          initialTab="Comment Cards"
        />
      </div>

      {/* Mobile-only standalone Comment Cards page */}
      <main className="min-h-screen bg-[#61716b] px-4 py-5 text-white lg:hidden">
        <div className="mb-5 flex h-[76px] items-center justify-between rounded-[18px] bg-[#7c8b82] px-6 shadow-[0_18px_44px_rgba(20,30,26,0.14)]">
          <Link href="/admin" aria-label="Back to admin dashboard">
            <img
              src="/pros-logo-basic.png"
              alt="PRO's"
              className="h-12 w-auto object-contain"
            />
          </Link>

          <Link
            href="/profile"
            aria-label="Open profile"
            className="flex h-12 w-12 items-center justify-center text-[#FFD66B]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-9 w-9"
              aria-hidden="true"
            >
              <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Zm0 2c-4.418 0-8 2.239-8 5v1.25c0 .414.336.75.75.75h14.5a.75.75 0 0 0 .75-.75V19c0-2.761-3.582-5-8-5Z" />
            </svg>
          </Link>
        </div>

        <div className="mb-5 rounded-[26px] bg-[#718078] px-6 py-5 shadow-[0_18px_44px_rgba(20,30,26,0.16)]">
          <h1 className="text-[24px] font-black leading-none tracking-[-0.04em] text-white">
            Comment Cards
          </h1>
        </div>

        <form
          action="/admin/comment-cards"
          className="mb-5 rounded-[26px] bg-[#718078] p-4 shadow-[0_18px_44px_rgba(20,30,26,0.14)]"
        >
          <input type="hidden" name="filter" value={activeFilter} />
          <input
            name="q"
            defaultValue={search}
            placeholder="Search name, phone, member ID..."
            className="mb-3 h-12 w-full rounded-[16px] border-none bg-white px-4 text-[13px] font-black text-[#314f5b] outline-none placeholder:text-[#314f5b]/45"
          />

          <CommentCardsMobileFilter
            filters={FILTERS}
            activeFilter={activeFilter}
            activeFilterLabel={activeFilterLabel}
            search={search}
          />
        </form>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-[18px] bg-[#718078] px-4 py-3 shadow-[0_14px_34px_rgba(20,30,26,0.12)]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
              Comments
            </p>
            <p className="mt-2 text-[24px] font-black leading-none text-white">
              {filteredCards.length}
            </p>
          </div>

          <div className="rounded-[18px] bg-[#718078] px-4 py-3 shadow-[0_14px_34px_rgba(20,30,26,0.12)]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
              Avg. Rating
            </p>
            <p className="mt-2 text-[24px] font-black leading-none text-white">
              {Number.isFinite(averageRating) && averageRating > 0
                ? averageRating.toFixed(1)
                : "—"}
            </p>
          </div>
        </div>

        <div className="space-y-4 pb-24">
          {filteredCards.length > 0 ? (
            filteredCards.map((row) => (
              <MobileCommentCard key={String(row.id ?? getCreatedAt(row))} row={row} />
            ))
          ) : (
            <EmptyState filter={activeFilter} />
          )}
        </div>

        <AdminMobileFloatingMenu active="comment-cards" />
      </main>
    </>
  );
}
