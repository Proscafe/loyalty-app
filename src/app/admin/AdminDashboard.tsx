"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Toast } from "@/components/Toast";
import type { Profile, Reward, StampTransaction, UserRole } from "@/types";

interface Metrics {
  totalClients: number;
  stampsIssued: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  mostActiveCategoryName: string;
}

type AdminUser = Profile & {
  is_active?: boolean | null;
  gender?: string | null;
};

type AdminCategory = {
  id: string;
  name: string;
  sort_order?: number | null;
  average_price?: number | null;
};

type AdminClientStamp = {
  id?: string;
  client_id: string;
  category_id: string;
  stamp_count: number;
  updated_at?: string | null;
};

type CommentCardEntry = {
  id: string;
  full_name: string;
  phone: string;
  birthday?: string | null;
  experience_rating: number;
  food_rating: number;
  service_rating: number;
  cleanliness_rating: number;
  visit_again_rating: number;
  heard_about_us: string;
  comments?: string | null;
  created_at: string;
};

type BirthdayDatasheetEntry = {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  Name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  Phone?: string | null;
  birthday?: string | null;
  birth_date?: string | null;
  date_of_birth?: string | null;
  dob?: string | null;
  source?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

function getTextField(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }

  return "";
}

function getBirthdayDatasheetName(row: BirthdayDatasheetEntry) {
  return (
    getTextField(row, [
      "name",
      "Name",
      "full_name",
      "Full Name",
      "customer_name",
      "Customer Name",
    ]) || "Customer"
  );
}

function getBirthdayDatasheetPhone(row: BirthdayDatasheetEntry) {
  return getTextField(row, [
    "phone",
    "Phone",
    "Phone number",
    "phone_number",
    "mobile",
    "Mobile",
    "contact",
    "Contact",
  ]);
}

function getBirthdayDatasheetBirthday(row: BirthdayDatasheetEntry) {
  return getTextField(row, [
    "birthday",
    "Birthday",
    "birth_date",
    "Birth date",
    "date_of_birth",
    "Date of birth",
    "dob",
    "DOB",
  ]);
}


type PendingCommentCardReward = {
  id: string;
  source_comment_card_id?: string | null;
  full_name?: string | null;
  phone: string;
  normalized_phone?: string | null;
  category_id: string;
  reward_type: string;
  status: "pending" | "claimed" | "cancelled" | string;
  client_id?: string | null;
  claimed_reward_id?: string | null;
  earned_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

type PendingCommentCardGiftRow = Reward & {
  __pending_comment_card?: boolean;
  __pending_id?: string;
  __pending_full_name?: string | null;
  __pending_phone?: string | null;
  __pending_status?: string | null;
};

type QuickGiftTarget =
  | { kind: "member"; user: AdminUser; source?: "comment_cards" | "user" }
  | {
      kind: "pending_comment_card";
      cardId: string;
      fullName: string;
      phone: string;
    };

function quickGiftTargetName(target: QuickGiftTarget | null) {
  if (!target) return "this client";
  if (target.kind === "member") return target.user.full_name || "this client";
  return target.fullName || "this client";
}

type CommentCardFilter =
  | "all"
  | "registered"
  | "not_registered"
  | "five_star"
  | "low_rating"
  | "has_comments"
  | "today"
  | "week"
  | "month";

type CommentCardSortKey =
  | "name"
  | "phone"
  | "age"
  | "rating"
  | "heard_from"
  | "comment"
  | "submitted"
  | "member_since"
  | "last_contacted";

type SortDirection = "asc" | "desc";

interface Props {
  profile: Profile;
  users?: AdminUser[];
  recentTxns?: StampTransaction[];
  recentRewards?: Reward[];
  metrics: Metrics;
}

const TABS = [
  "Overview",
  "Users",
  "Activity",
  "Gifts",
  "Birthdays",
  "Comment Cards",
  "Loyalty Program",
  "Create Game",
] as const;
type Tab = (typeof TABS)[number];

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";
const GLASS_CARD_LIGHT =
  "linear-gradient(145deg, rgba(255,255,255,0.88), rgba(255,255,255,0.72))";
const BRAND_YELLOW = "#ffd66b";
const BRAND_GREEN = "#365665";

const CUSTOMER_TABLE_GRID =
  "minmax(130px,1fr) minmax(90px,0.6fr) minmax(78px,0.5fr) minmax(62px,0.38fr) minmax(52px,0.32fr) minmax(76px,0.48fr) minmax(52px,0.32fr) minmax(76px,0.48fr) minmax(178px,0.95fr) minmax(118px,0.7fr)";

function shortName(name?: string | null) {
  return (name || "Admin").trim().split(/\s+/)[0] || "Admin";
}

function normalizePhoneForMatch(value?: string | null) {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("961")) {
    const withoutCountryCode = digits.slice(3);

    if (withoutCountryCode.length === 7) {
      return `0${withoutCountryCode}`;
    }

    return withoutCountryCode;
  }

  if (digits.length === 7) {
    return `0${digits}`;
  }

  if (digits.length > 8) {
    return digits.slice(-8);
  }

  return digits;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function roleLabel(role: UserRole) {
  if (role === "master_admin") return "Admin";
  if (role === "staff") return "Staff";
  return "Client";
}

function normalizeRewardText(value?: string | null) {
  return String(value || "Reward")
    .replace(/ Item$/i, "")
    .trim();
}

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter(Boolean)).size;
}

function percentage(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function safeRatio(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function getMostActiveCustomer(
  users: Profile[],
  recentTxns: StampTransaction[],
) {
  const counts = new Map<string, number>();

  recentTxns.forEach((txn) => {
    if (!txn.client_id) return;
    counts.set(txn.client_id, (counts.get(txn.client_id) ?? 0) + 1);
  });

  let topClientId = "";
  let topCount = 0;

  counts.forEach((count, clientId) => {
    if (count > topCount) {
      topCount = count;
      topClientId = clientId;
    }
  });

  return (
    users.find((user) => user.id === topClientId)?.full_name ??
    (topClientId ? `Client ${topClientId.slice(0, 6)}` : "—")
  );
}

function getTopReward(rewards: Reward[] = []) {
  const counts = new Map<string, number>();

  rewards.forEach((reward) => {
    const name = normalizeRewardText(reward.reward_type);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });

  let topReward = "—";
  let topCount = 0;

  counts.forEach((count, reward) => {
    if (count > topCount) {
      topCount = count;
      topReward = reward;
    }
  });

  return topReward;
}

function MobileAdminDashboard({
  profile,
  users: initialUsers = [],
  recentTxns = [],
  recentRewards = [],
  metrics,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("Overview");

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");

    if (requestedTab && TABS.includes(requestedTab as Tab)) {
      setTab(requestedTab as Tab);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [activityTxns, setActivityTxns] = useState<StampTransaction[]>(
    recentTxns ?? [],
  );
  const [giftRows, setGiftRows] = useState<Reward[]>(recentRewards ?? []);
  const [profileNamesById, setProfileNamesById] = useState<
    Record<string, string>
  >({});
  const [categoryNamesById, setCategoryNamesById] = useState<
    Record<string, string>
  >({});
  const [categoryAveragePriceById, setCategoryAveragePriceById] = useState<
    Record<string, number>
  >({});
  const [activityView, setActivityView] = useState<"activity" | "gifts">(
    "activity",
  );
  const [activityGiftSearch, setActivityGiftSearch] = useState("");
  const [giftFilter, setGiftFilter] = useState<
    | "all"
    | "loyalty"
    | "birthday"
    | "sent"
    | "comment_cards"
    | "games"
    | "available"
    | "used"
    | "expired"
    | "expiring"
    | "pending"
  >("all");
  const [giftDashboardOpen, setGiftDashboardOpen] = useState(false);
  const [giftDashboardClientId, setGiftDashboardClientId] = useState("");
  const [giftDashboardCategoryId, setGiftDashboardCategoryId] = useState("");
  const [giftDashboardExpiry, setGiftDashboardExpiry] = useState("");
  const [giftDashboardNote, setGiftDashboardNote] = useState("");
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | UserRole>("staff");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleUserCount, setVisibleUserCount] = useState(15);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<AdminCategory[]>(
    [],
  );
  const [selectedStamps, setSelectedStamps] = useState<AdminClientStamp[]>([]);
  const [desktopClientStamps, setDesktopClientStamps] = useState<
    AdminClientStamp[]
  >([]);
  const [selectedRewards, setSelectedRewards] = useState<Reward[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");
  const [mobileGameLinks, setMobileGameLinks] = useState<
    Array<{
      id: string;
      title: string;
      label: string;
      sportType?: string | null;
      status: string;
      code: string;
      kickoff: string | null;
    }>
  >([]);
  const [mobileGameCreateOpen, setMobileGameCreateOpen] = useState(false);
  const [mobileGameKind, setMobileGameKind] = useState<
    "football" | "basketball"
  >("basketball");
  const [mobileGameSaving, setMobileGameSaving] = useState(false);
  const [mobileGameForm, setMobileGameForm] = useState({
    home_team: "",
    away_team: "",
    venue: "",
    match_label: "",
    tournament_id: "",
    kickoff_at: "",
    opens_at: "",
    closes_at: "",
    home_score: "",
    away_score: "",
    basketball_winner: "home",
    basketball_win_by: "",
  });

  function flash(message: string, t: "success" | "error" = "success") {
    setTone(t);
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  function mobilePredictionLinkFor(code: string) {
    if (typeof window === "undefined") return `/predict/${code}`;
    return `${window.location.origin}/predict/${code}`;
  }

  async function copyMobilePredictionLink(code: string) {
    await navigator.clipboard.writeText(mobilePredictionLinkFor(code));
    flash("Link copied.");
  }

  async function downloadMobileQr(code: string, title: string) {
    const link = mobilePredictionLinkFor(code);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(link)}`;

    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = `${title}-qr.png`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      flash("QR downloaded.");
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
      flash("QR opened.");
    }
  }

  async function refreshMobileGameLinks() {
    try {
      const response = await fetch("/api/admin/prediction-matches", {
        method: "GET",
      });
      const text = await response.text();
      const json = text
        ? (JSON.parse(text) as {
            matches?: Array<{
              id: string;
              sport_type?: string | null;
              tournament_id?: string | null;
              tournament_name?: string | null;
              prediction_tournaments?: { id?: string | null; name?: string | null } | null;
              home_team: string | null;
              away_team: string | null;
              secret_code: string;
              match_label: string | null;
              kickoff_at: string | null;
              opens_at: string | null;
              closes_at: string | null;
              is_active: boolean;
            }>;
            error?: string;
          })
        : {};

      if (!response.ok) {
        console.error(json.error ?? "Could not load game links.");
        return;
      }

      const nowMs = Date.now();

      setMobileGameLinks(
        (json.matches ?? []).map((match) => {
          const openMs = new Date(match.opens_at ?? "").getTime();
          const closeMs = new Date(match.closes_at ?? "").getTime();

          const status = !match.is_active
            ? "Closed"
            : Number.isFinite(openMs) && nowMs < openMs
              ? "Coming Soon"
              : Number.isFinite(closeMs) && nowMs > closeMs
                ? "Closed"
                : "Open";

          return {
            id: match.id,
            title: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
            label: match.match_label || "World Cup",
            status,
            code: match.secret_code,
            kickoff: match.kickoff_at ?? null,
          };
        }),
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function createMobileGameLink() {
    if (!mobileGameForm.home_team.trim() || !mobileGameForm.away_team.trim()) {
      flash("Add both teams first.", "error");
      return;
    }

    setMobileGameSaving(true);

    const basketballWinBy = Number(mobileGameForm.basketball_win_by);
    const hasBasketballResult =
      Number.isInteger(basketballWinBy) &&
      basketballWinBy >= 1 &&
      basketballWinBy <= 99;

    const payload =
      mobileGameKind === "basketball"
        ? {
            ...mobileGameForm,
            sport_type: "basketball",
            match_label: mobileGameForm.match_label.trim() || "Basket",
            venue:
              mobileGameForm.venue.trim() ||
              "Basketball rule: client chooses the winner, with bonus for exact win margin.",
            home_score:
              hasBasketballResult && mobileGameForm.basketball_winner === "home"
                ? String(basketballWinBy)
                : "",
            away_score:
              hasBasketballResult && mobileGameForm.basketball_winner === "away"
                ? String(basketballWinBy)
                : "",
          }
        : {
            ...mobileGameForm,
            sport_type: "football",
            match_label: mobileGameForm.match_label.trim() || "World Cup",
          };

    try {
      const response = await fetch("/api/admin/prediction-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withPredictionDatePayload(payload)),
      });

      const text = await response.text();
      const json = text
        ? (JSON.parse(text) as { match?: { id: string }; error?: string })
        : {};

      if (!response.ok || !json.match) {
        flash(json.error ?? "Could not create game link.", "error");
        return;
      }

      await refreshMobileGameLinks();

      setMobileGameForm({
        home_team: "",
        away_team: "",
        venue: "",
        match_label: "",
        tournament_id: "",
        kickoff_at: "",
        opens_at: "",
        closes_at: "",
        home_score: "",
        away_score: "",
        basketball_winner: "home",
        basketball_win_by: "",
      });

      setMobileGameCreateOpen(false);
      flash("Game link created.");
    } catch (error) {
      flash(
        error instanceof Error ? error.message : "Could not create game link.",
        "error",
      );
    } finally {
      setMobileGameSaving(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAdminData() {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const [txnResult, rewardResult] = await Promise.all([
        supabase
          .from("stamp_transactions")
          .select("*")
          .gte("created_at", fiveDaysAgo.toISOString())
          .neq("action_type", "manual_adjustment")
          .order("created_at", { ascending: false })
          .limit(50),

        supabase
          .from("rewards")
          .select("*")
          .gte("created_at", fiveDaysAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (!isMounted) return;

      const txns = ((txnResult.data ?? []) as StampTransaction[]).filter(
        (txn) => txn.action_type !== "manual_adjustment",
      );

      setActivityTxns(txns);

      const rewards = (rewardResult.data ?? []) as Reward[];

      if (rewardResult.data) {
        setGiftRows(rewards);
      }

      if (isMounted) {
        void refreshMobileGameLinks();
      }

      const ids = Array.from(
        new Set(
          [
            ...txns.flatMap((txn) => [txn.client_id, txn.staff_id]),
            ...rewards.flatMap((reward) => [
              reward.client_id,
              reward.redeemed_by,
            ]),
          ].filter((id): id is string => Boolean(id)),
        ),
      );

      if (ids.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, full_name, email, client_code")
          .in("id", ids);

        if (!isMounted) return;

        const names: Record<string, string> = {};

        (profileRows ?? []).forEach((row: any) => {
          names[row.id] =
            row.full_name || row.email || row.client_code || "Unknown";
        });

        setProfileNamesById(names);
      } else {
        setProfileNamesById({});
      }
    }

    void loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function refreshDesktopClientStamps() {
    const { data, error } = await supabase
      .from("client_stamps")
      .select("id, client_id, category_id, stamp_count, updated_at");

    if (error) {
      flash(error.message, "error");
      return;
    }

    setDesktopClientStamps((data ?? []) as unknown as AdminClientStamp[]);
  }

  async function setRole(userId: string, role: UserRole) {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, role } : user)),
    );

    if (selectedUser?.id === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, role } : prev));
    }

    flash("Role updated.");
  }

  async function deactivateUser(userId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", userId);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, is_active: false } : user,
      ),
    );

    if (selectedUser?.id === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, is_active: false } : prev));
    }

    flash("Account deactivated.");
  }

  async function reactivateUser(userId: string, role: UserRole) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: true, role })
      .eq("id", userId);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, is_active: true, role } : user,
      ),
    );

    if (selectedUser?.id === userId) {
      setSelectedUser((prev) =>
        prev ? { ...prev, is_active: true, role } : prev,
      );
    }

    flash("Account reactivated.");
  }

  async function openUserProfile(user: AdminUser) {
    setSelectedUser(user);
    setSelectedLoading(true);
    setSelectedCategories([]);
    setSelectedStamps([]);
    setSelectedRewards([]);

    try {
      const [categoryResult, stampResult, rewardResult] = await Promise.all([
        supabase
          .from("loyalty_categories")
          .select("id, name, sort_order, average_price")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),

        supabase
          .from("client_stamps")
          .select("id, client_id, category_id, stamp_count, updated_at")
          .eq("client_id", user.id),

        supabase
          .from("rewards")
          .select("*")
          .eq("client_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (categoryResult.error) {
        flash(categoryResult.error.message, "error");
      }

      if (stampResult.error) {
        flash(stampResult.error.message, "error");
      }

      if (rewardResult.error) {
        flash(rewardResult.error.message, "error");
      }

      const nextSelectedStamps = (stampResult.data ?? []) as AdminClientStamp[];

      setSelectedCategories((categoryResult.data ?? []) as AdminCategory[]);
      setSelectedStamps(nextSelectedStamps);
      setDesktopClientStamps((current) => [
        ...current.filter((stamp) => stamp.client_id !== user.id),
        ...nextSelectedStamps,
      ]);
      setSelectedRewards((rewardResult.data ?? []) as Reward[]);
    } finally {
      setSelectedLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesFilter = filter === "all" ? true : user.role === filter;

      if (!matchesFilter) return false;
      if (!search) return true;

      return [
        user.full_name,
        user.email,
        user.phone,
        user.client_code,
        roleLabel(user.role),
        user.is_active === false ? "deactivated inactive" : "active",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [users, filter, searchTerm]);

  const visibleUsers = useMemo(
    () => filteredUsers.slice(0, visibleUserCount),
    [filteredUsers, visibleUserCount],
  );

  const visibleActivityTxns = useMemo(() => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    return activityTxns.filter((txn) => {
      if (txn.action_type === "manual_adjustment") return false;
      const createdAt = new Date(txn.created_at).getTime();
      return !Number.isNaN(createdAt) && createdAt >= fiveDaysAgo.getTime();
    });
  }, [activityTxns]);

  const activeCustomers = useMemo(
    () => uniqueCount(visibleActivityTxns.map((txn) => txn.client_id)),
    [visibleActivityTxns],
  );

  const repeatCustomers = useMemo(() => {
    const counts = new Map<string, number>();

    visibleActivityTxns.forEach((txn) => {
      if (!txn.client_id) return;
      counts.set(txn.client_id, (counts.get(txn.client_id) ?? 0) + 1);
    });

    return Array.from(counts.values()).filter((count) => count > 1).length;
  }, [visibleActivityTxns]);

  const averageStampsPerCustomer = useMemo(() => {
    if (!metrics.totalClients) return "0";
    return (metrics.stampsIssued / metrics.totalClients).toFixed(1);
  }, [metrics.stampsIssued, metrics.totalClients]);

  const redemptionRate = useMemo(
    () => percentage(safeRatio(metrics.rewardsRedeemed, metrics.rewardsEarned)),
    [metrics.rewardsEarned, metrics.rewardsRedeemed],
  );

  const topReward = useMemo(() => getTopReward(giftRows), [giftRows]);
  const mostActiveCustomer = useMemo(
    () => getMostActiveCustomer(users, visibleActivityTxns),
    [visibleActivityTxns, users],
  );

  return (
    <main className="min-h-screen" style={{ background: PAGE_BG }}>
      <Toast message={toast} tone={tone} />

      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-5 font-raleway text-white">
        <section
          className="relative mb-5 overflow-hidden border border-white/20 px-5 py-5 shadow-[0_24px_70px_rgba(35,48,39,0.22)] backdrop-blur-2xl"
          style={{ borderRadius: 18, background: GLASS_CARD, minHeight: 154 }}
        >
          <img
            src="/client-main-card.png"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-[128%] translate-x-8 scale-[1.06] object-cover object-right opacity-55"
          />

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.34em] text-white/80">
                Admin Dashboard
              </p>

              <h1 className="text-[30px] font-black leading-[1.02] tracking-[-0.04em] text-white">
                Hello,
                <br />
                <span className="text-[#ffd66b]">
                  {shortName(profile.full_name)}
                </span>
              </h1>
            </div>

            <Link
              href="/admin/predictions"
              aria-label="Open World Cup predictions"
              className="group flex h-[112px] w-[112px] shrink-0 items-center justify-center transition active:scale-[0.98]"
            >
              <img
                src="/WC-logo.png"
                alt="World Cup"
                className="h-[108px] w-[108px] object-contain drop-shadow-[0_18px_34px_rgba(35,48,39,0.22)] transition group-active:scale-95"
                draggable={false}
              />
            </Link>
          </div>
        </section>

        <div className="relative z-30 mb-3 flex gap-1 rounded-full border border-white/14 bg-white/12 p-1 backdrop-blur-xl">
          {TABS.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => {
                setTab(item);
                setSelectedUser(null);
              }}
              className={`flex-1 rounded-full py-2 text-[11px] font-black transition ${
                tab === item
                  ? "bg-[#ffd66b] text-[#365665] shadow-[0_10px_24px_rgba(255,214,107,0.2)]"
                  : "text-white/68"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === "Users" ? (
          <div className="relative z-20 mb-5">
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setVisibleUserCount(15);
                setSelectedUser(null);
              }}
              placeholder="Search customers, staff, admin..."
              className="h-12 w-full rounded-full border border-white/18 bg-white px-5 text-[13px] font-bold text-black placeholder:text-zinc-400 outline-none backdrop-blur-xl focus:border-[#ffd66b]/70"
            />
          </div>
        ) : null}

        {tab === "Overview" && (
          <section className="mb-12 space-y-6">
            <DashboardGroup title="Primary Stats">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Total Customers"
                  value={metrics.totalClients}
                />
                <MetricCard label="Active Customers" value={activeCustomers} />
                <MetricCard
                  label="Stamps Issued"
                  value={metrics.stampsIssued}
                />
                <MetricCard
                  label="Gifts Redeemed"
                  value={metrics.rewardsRedeemed}
                />
              </div>
            </DashboardGroup>

            <DashboardGroup title="Performance">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label={
                    <>
                      Redemption
                      <br />
                      Rate
                    </>
                  }
                  value={redemptionRate}
                />
                <MetricCard
                  label="Average Stamps per Customer"
                  value={averageStampsPerCustomer}
                />
                <MetricCard label="Repeat Customers" value={repeatCustomers} />
              </div>
            </DashboardGroup>

            <DashboardGroup title="Insights">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Most Active Category"
                  value={metrics.mostActiveCategoryName || "—"}
                />
                <MetricCard label="Top Reward" value={topReward} />
                <MetricCard
                  label="Most Active Customer"
                  value={mostActiveCustomer}
                />
              </div>
            </DashboardGroup>
          </section>
        )}

        {tab === "Users" && (
          <section className="mb-12">
            {selectedUser ? (
              <ClientProfilePanel
                user={selectedUser}
                currentUserId={profile.id}
                categories={selectedCategories}
                stamps={selectedStamps}
                rewards={selectedRewards}
                loading={selectedLoading}
                onBack={() => setSelectedUser(null)}
                onRoleChange={(role) => void setRole(selectedUser.id, role)}
                onDeactivate={() => void deactivateUser(selectedUser.id)}
                onReactivate={(role) =>
                  void reactivateUser(selectedUser.id, role)
                }
              />
            ) : (
              <>
                <div className="mb-4 flex gap-1 rounded-full border border-white/14 bg-white/12 p-1 text-[11px] backdrop-blur-xl">
                  {(["all", "client", "staff", "master_admin"] as const).map(
                    (item) => (
                      <button
                        type="button"
                        key={item}
                        onClick={() => {
                          setFilter(item);
                          setVisibleUserCount(15);
                          setSelectedUser(null);
                        }}
                        className={`flex-1 rounded-full py-2 font-black transition ${
                          filter === item
                            ? "bg-[#ffd66b] text-[#365665] shadow-[0_10px_24px_rgba(255,214,107,0.2)]"
                            : "text-white/68"
                        }`}
                      >
                        {item === "all"
                          ? "All"
                          : item === "master_admin"
                            ? "Admin"
                            : item === "staff"
                              ? "Staff"
                              : "Clients"}
                      </button>
                    ),
                  )}
                </div>

                <div className="space-y-3">
                  {visibleUsers.map((user) => (
                    <div
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void openUserProfile(user)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void openUserProfile(user);
                        }
                      }}
                      className="w-full cursor-pointer border border-white/20 p-4 text-left shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl transition active:scale-[0.99]"
                      style={{ borderRadius: 24, background: GLASS_CARD }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[17px] font-black text-white">
                            {user.full_name}
                          </div>
                          <div className="mt-1 truncate text-[12px] font-semibold text-white/62">
                            {user.email}
                            {user.phone ? ` · ${user.phone}` : ""}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {user.client_code ? (
                              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                                {user.client_code}
                              </span>
                            ) : null}

                            {user.is_active === false ? (
                              <span className="rounded-full bg-red-500/14 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-red-300">
                                Deactivated
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <select
                          value={
                            user.is_active === false ? "deactivated" : user.role
                          }
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            event.stopPropagation();
                            const value = event.target.value;

                            if (value === "deactivated") {
                              void deactivateUser(user.id);
                              return;
                            }

                            if (user.is_active === false) {
                              void reactivateUser(user.id, value as UserRole);
                              return;
                            }

                            void setRole(user.id, value as UserRole);
                          }}
                          disabled={user.id === profile.id}
                          className={`shrink-0 rounded-full border border-white/30 bg-white/108 px-3 py-2 text-[11px] font-black outline-none disabled:opacity-55 ${
                            user.is_active === false
                              ? "text-red-600"
                              : "text-white"
                          }`}
                          title={
                            user.id === profile.id
                              ? "You cannot change your own role"
                              : ""
                          }
                        >
                          <option value="client">Client</option>
                          <option value="staff">Staff</option>
                          <option value="master_admin">Admin</option>
                          <option
                            value="deactivated"
                            className="font-black text-red-600"
                          >
                            Deactivate
                          </option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {filteredUsers.length === 0 ? (
                    <EmptyState text="No users in this view." />
                  ) : null}

                  {filteredUsers.length > visibleUsers.length ? (
                    <button
                      type="button"
                      onClick={() => setVisibleUserCount((count) => count + 15)}
                      className="w-full rounded-full bg-[#ffd66b] py-3 text-[12px] font-black text-[#365665] shadow-[0_14px_30px_rgba(255,214,107,0.18)]"
                    >
                      Load more
                    </button>
                  ) : null}
                </div>

                <p className="mt-4 px-1 text-[11px] font-semibold leading-relaxed text-white/58">
                  Tap a user to open their profile, stamps, and gifts.
                </p>
              </>
            )}
          </section>
        )}

        {tab === "Activity" && (
          <section className="mb-12 space-y-3">
            {visibleActivityTxns.length === 0 ? (
              <EmptyState text="No activity in the last 5 days." />
            ) : null}

            {visibleActivityTxns.map((transaction) => {
              const clientName =
                profileNamesById[transaction.client_id ?? ""] ?? "Client";
              const actorName =
                profileNamesById[transaction.staff_id ?? ""] ||
                (transaction.staff_id ? "Staff user" : "System");

              return (
                <div
                  key={transaction.id}
                  className="flex items-center gap-3 border border-white/20 p-4 shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
                  style={{ borderRadius: 24, background: GLASS_CARD }}
                >
                  <ActionBadge action={transaction.action_type} />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-black text-white">
                      {labelForAction(transaction.action_type, actorName)}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-white/58">
                      {transaction.action_type === "reward_redeemed" ? (
                        <>
                          <span className="font-black text-[#ffd66b]">
                            Claimed
                          </span>
                          {" by "}
                          <span className="font-black text-white">
                            {actorName}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-black text-[#ffd66b]">
                            {clientName}
                          </span>
                        </>
                      )}
                      {" · "}
                      {formatDate(transaction.created_at)}
                      {transaction.stamp_count_before !== null &&
                      transaction.stamp_count_after !== null ? (
                        <>
                          {" "}
                          · {transaction.stamp_count_before} →{" "}
                          {transaction.stamp_count_after}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {tab === "Gifts" && (
          <section className="mb-12 space-y-3">
            {(giftRows ?? []).length === 0 ? (
              <EmptyState text="No gifts yet." />
            ) : null}

            {(giftRows ?? []).map((reward) => {
              const clientName = profileNamesById[reward.client_id] ?? "Client";
              const confirmedByName = reward.redeemed_by
                ? (profileNamesById[reward.redeemed_by] ?? "Staff user")
                : null;
              const isBirthdayGift = /birthday|20%|discount|dessert/i.test(
                reward.reward_type || "",
              );

              return (
                <div
                  key={reward.id}
                  className="border border-white/20 p-4 shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
                  style={{ borderRadius: 24, background: GLASS_CARD }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[17px] font-black text-[#ffd66b]">
                        {normalizeRewardText(reward.reward_type)}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-black">
                        <span className="text-[#ffd66b]">{clientName}</span>
                        {isBirthdayGift ? (
                          <span className="rounded-full bg-[#ffd66b]/16 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#ffd66b]">
                            Birthday
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 text-[11px] font-semibold leading-5 text-white/62">
                        Earned {formatDate(reward.earned_at)}
                        {reward.status === "claimed" ? (
                          <>
                            {" · "}
                            <span className="font-black text-[#ffd66b]">
                              Claimed
                            </span>
                            {" by "}
                            <span className="font-black text-white">
                              {clientName}
                            </span>
                          </>
                        ) : null}
                        {reward.redeemed_at ? (
                          <>
                            {" · "}
                            <span className="font-black text-[#ffd66b]">
                              Confirmed
                            </span>
                            {confirmedByName ? (
                              <>
                                {" by "}
                                <span className="font-black text-white">
                                  {confirmedByName}
                                </span>
                              </>
                            ) : null}
                            {" · "}
                            {formatDate(reward.redeemed_at)}
                          </>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                        reward.status === "available"
                          ? "bg-[#ffd66b] text-[#365665]"
                          : reward.status === "redeemed" ||
                              reward.status === "claimed"
                            ? "bg-white/16 text-[#ffd66b]"
                            : "bg-white/102 text-white"
                      }`}
                    >
                      {reward.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {tab === "Loyalty Program" && (
          <section className="mb-12">
            <LoyaltyProgramPanel compact />
          </section>
        )}

        {tab === "Create Game" && (
          <section className="mb-12 space-y-4">
            <div
              className="border border-white/20 p-4 shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
              style={{ borderRadius: 24, background: GLASS_CARD }}
            >
              <button
                type="button"
                onClick={() => setMobileGameCreateOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/58">
                    Admin
                  </div>
                  <div className="mt-1 text-[22px] font-black leading-none text-white">
                    Create <span className="text-[#ffd66b]">Game Link</span>
                  </div>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[20px] font-black text-white">
                  {mobileGameCreateOpen ? "−" : "+"}
                </div>
              </button>

              {mobileGameCreateOpen ? (
                <div className="mt-4 border-t border-white/18 pt-4">
                  <div className="mb-4 grid grid-cols-2 gap-2 rounded-full border border-white/14 bg-white/12 p-1">
                    {(["football", "basketball"] as const).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setMobileGameKind(kind)}
                        className={`rounded-full py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                          mobileGameKind === kind
                            ? "bg-[#ffd66b] text-[#365665]"
                            : "text-white/68"
                        }`}
                      >
                        {kind === "football" ? "Football" : "Basketball"}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <MobileGameInput
                      label={
                        mobileGameKind === "basketball" ? "Team 1" : "Home Team"
                      }
                      value={mobileGameForm.home_team}
                      onChange={(value) =>
                        setMobileGameForm((current) => ({
                          ...current,
                          home_team: value,
                        }))
                      }
                    />
                    <MobileGameInput
                      label={
                        mobileGameKind === "basketball" ? "Team 2" : "Away Team"
                      }
                      value={mobileGameForm.away_team}
                      onChange={(value) =>
                        setMobileGameForm((current) => ({
                          ...current,
                          away_team: value,
                        }))
                      }
                    />
                    <MobileGameInput
                      label="Tournament"
                      value={mobileGameForm.match_label}
                      onChange={(value) =>
                        setMobileGameForm((current) => ({
                          ...current,
                          match_label: value,
                        }))
                      }
                    />
                    <MobileGameInput
                      label="Description"
                      value={mobileGameForm.venue}
                      onChange={(value) =>
                        setMobileGameForm((current) => ({
                          ...current,
                          venue: value,
                        }))
                      }
                    />
                    <MobileGameInput
                      type="datetime-local"
                      label="Match Timing"
                      value={mobileGameForm.kickoff_at}
                      onChange={(value) =>
                        setMobileGameForm((current) => ({
                          ...current,
                          kickoff_at: value,
                        }))
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <MobileGameInput
                        type="datetime-local"
                        label="Open Time"
                        value={mobileGameForm.opens_at}
                        onChange={(value) =>
                          setMobileGameForm((current) => ({
                            ...current,
                            opens_at: value,
                          }))
                        }
                      />
                      <MobileGameInput
                        type="datetime-local"
                        label="Close Time"
                        value={mobileGameForm.closes_at}
                        onChange={(value) =>
                          setMobileGameForm((current) => ({
                            ...current,
                            closes_at: value,
                          }))
                        }
                      />
                    </div>

                    {mobileGameKind === "football" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <MobileGameInput
                          label="Home Score"
                          value={mobileGameForm.home_score}
                          onChange={(value) =>
                            setMobileGameForm((current) => ({
                              ...current,
                              home_score: value,
                            }))
                          }
                        />
                        <MobileGameInput
                          label="Away Score"
                          value={mobileGameForm.away_score}
                          onChange={(value) =>
                            setMobileGameForm((current) => ({
                              ...current,
                              away_score: value,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <div className="rounded-[22px] border border-white/16 bg-white/10 p-3">
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/64">
                              Final Winner
                            </span>
                            <select
                              value={mobileGameForm.basketball_winner}
                              onChange={(event) =>
                                setMobileGameForm((current) => ({
                                  ...current,
                                  basketball_winner: event.target.value,
                                }))
                              }
                              className="h-11 w-full rounded-[16px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                            >
                              <option value="home">
                                {mobileGameForm.home_team || "Team 1"}
                              </option>
                              <option value="away">
                                {mobileGameForm.away_team || "Team 2"}
                              </option>
                            </select>
                          </label>

                          <MobileGameInput
                            label="Final Win By"
                            value={mobileGameForm.basketball_win_by}
                            onChange={(value) =>
                              setMobileGameForm((current) => ({
                                ...current,
                                basketball_win_by: value,
                              }))
                            }
                          />
                        </div>

                        <p className="mt-3 text-[11px] font-semibold leading-5 text-white/58">
                          Leave final winner and win-by empty when creating the
                          link. Add them after the game result is known.
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void createMobileGameLink()}
                      disabled={mobileGameSaving}
                      className="h-12 w-full rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.18em] text-[#365665] shadow-[0_14px_30px_rgba(255,214,107,0.18)] disabled:opacity-55"
                    >
                      {mobileGameSaving
                        ? "Creating..."
                        : mobileGameKind === "basketball"
                          ? "Create Basketball Link"
                          : "Create Football Link"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {mobileGameLinks.length === 0 ? (
              <EmptyState text="No games created yet." />
            ) : null}

            {mobileGameLinks.map((game) => (
              <div
                key={game.id}
                className="border border-white/20 p-4 shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
                style={{ borderRadius: 24, background: GLASS_CARD }}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-white/58">
                      {game.label}
                    </div>
                    <div className="truncate text-[24px] font-black leading-none tracking-[-0.04em] text-white">
                      {game.title.split(" vs ")[0]}{" "}
                      <span className="text-[#ffd66b]">vs</span>{" "}
                      {game.title.split(" vs ")[1] ?? ""}
                    </div>
                    <div className="mt-3 text-[12px] font-bold leading-5 text-white/78">
                      {game.sportType === "basketball" ? "Tip off" : "Kickoff"}{" "}
                      {game.kickoff ? formatDate(game.kickoff) : "—"}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] ${
                      game.status === "Open"
                        ? "bg-[#ffd66b] text-[#365665]"
                        : "bg-white/12 text-white"
                    }`}
                  >
                    {game.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={mobilePredictionLinkFor(game.code)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center justify-center rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.18em] text-white"
                  >
                    Open Link
                  </a>

                  <button
                    type="button"
                    onClick={() => void downloadMobileQr(game.code, game.title)}
                    className="flex h-11 items-center justify-center rounded-full bg-white/0 text-[11px] font-black uppercase tracking-[0.18em] text-white"
                  >
                    Download QR
                  </button>

                  <button
                    type="button"
                    onClick={() => void copyMobilePredictionLink(game.code)}
                    className="col-span-2 flex h-11 items-center justify-center rounded-full bg-white/14 text-[11px] font-black uppercase tracking-[0.18em] text-white"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

const DEFAULT_LOYALTY_SETTINGS = {
  id: "default",
  program_name: "PRO’s Club",
  stamp_name: "Stamp",
  gift_name: "Gift",
  is_enabled: true,
  average_stamp_cost: 0,
  stamps_per_gift: 5,
  currency: "$",
};

type LoyaltySettings = typeof DEFAULT_LOYALTY_SETTINGS;

type LoyaltyProgramCategory = AdminCategory & {
  is_active?: boolean | null;
  average_price?: number | null;
};

function parseMoneyValue(value: string | number | null | undefined) {
  const numberValue =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatLoyaltyMoney(value: number, currency: string) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${currency || "$"}${safeValue.toFixed(2)}`;
}

function LoyaltyProgramPanel({ compact = false }: { compact?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<LoyaltySettings>(
    DEFAULT_LOYALTY_SETTINGS,
  );
  const [categories, setCategories] = useState<LoyaltyProgramCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);
  const [showDisableWarning, setShowDisableWarning] = useState(false);

  function showMessage(text: string, tone: "success" | "error" = "success") {
    setMessage({ text, tone });
    setTimeout(() => setMessage(null), 2400);
  }

  async function recordProgramToggleLog(enabled: boolean) {
    try {
      await supabase.from("loyalty_program_logs").insert({
        action: enabled ? "enabled" : "disabled",
        actor_id: null,
        metadata: {
          source: compact ? "mobile_admin" : "desktop_admin",
        },
      });
    } catch {
      // Logs are best-effort. The toggle should still work if the log table is not installed yet.
    }
  }

  async function loadLoyaltyProgram() {
    setLoading(true);

    try {
      const [settingsResult, categoryResult] = await Promise.all([
        supabase.from("loyalty_program_settings").select("*").limit(1),
        supabase
          .from("loyalty_categories")
          .select("*")
          .order("sort_order", { ascending: true }),
      ]);

      if (
        !settingsResult.error &&
        settingsResult.data &&
        settingsResult.data.length > 0
      ) {
        const row = settingsResult.data[0] as Partial<LoyaltySettings>;

        setSettings({
          ...DEFAULT_LOYALTY_SETTINGS,
          ...row,
          id: String(row.id || "default"),
          is_enabled: row.is_enabled !== false,
          average_stamp_cost: parseMoneyValue(row.average_stamp_cost),
          stamps_per_gift: Number(row.stamps_per_gift) || 5,
          currency: String(row.currency || "$"),
        });
      } else if (settingsResult.error) {
        console.warn(
          "Loyalty settings table not ready:",
          settingsResult.error.message,
        );
      }

      if (categoryResult.error) {
        showMessage(categoryResult.error.message, "error");
      } else {
        setCategories((categoryResult.data ?? []) as LoyaltyProgramCategory[]);
      }
    } catch (error) {
      console.error(error);
      showMessage("Could not load loyalty settings.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLoyaltyProgram();
  }, []);

  async function saveSettings(nextSettings = settings) {
    setSavingSettings(true);

    try {
      const payload = {
        id: nextSettings.id || "default",
        program_name:
          nextSettings.program_name.trim() ||
          DEFAULT_LOYALTY_SETTINGS.program_name,
        stamp_name:
          nextSettings.stamp_name.trim() || DEFAULT_LOYALTY_SETTINGS.stamp_name,
        gift_name:
          nextSettings.gift_name.trim() || DEFAULT_LOYALTY_SETTINGS.gift_name,
        is_enabled: nextSettings.is_enabled,
        average_stamp_cost: parseMoneyValue(nextSettings.average_stamp_cost),
        stamps_per_gift: Math.max(1, Number(nextSettings.stamps_per_gift) || 5),
        currency: nextSettings.currency.trim() || "$",
      };

      const statusChanged = nextSettings.is_enabled !== settings.is_enabled;

      const response = await fetch("/api/admin/loyalty-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json().catch(() => ({}))) as {
        settings?: Partial<LoyaltySettings>;
        error?: string;
      };

      if (!response.ok || !json.settings) {
        showMessage(json.error ?? "Could not update loyalty program.", "error");
        return;
      }

      const saved = json.settings;
      setSettings((current) => ({
        ...current,
        ...saved,
        id: String(saved.id || current.id),
        is_enabled: saved.is_enabled !== false,
        average_stamp_cost: parseMoneyValue(saved.average_stamp_cost),
        stamps_per_gift: Number(saved.stamps_per_gift) || 5,
        currency: String(saved.currency || current.currency || "$"),
      }));

      if (statusChanged) {
        await recordProgramToggleLog(nextSettings.is_enabled);
      }

      showMessage(
        nextSettings.is_enabled
          ? "Loyalty program enabled."
          : "Loyalty program disabled.",
      );
    } catch (error) {
      console.error(error);
      showMessage("Could not save loyalty program.", "error");
    } finally {
      setSavingSettings(false);
    }
  }

  function requestProgramToggle() {
    if (settings.is_enabled) {
      setShowDisableWarning(true);
      return;
    }

    const nextSettings = { ...settings, is_enabled: true };
    setSettings(nextSettings);
    void saveSettings(nextSettings);
  }

  function confirmDisableProgram() {
    const nextSettings = { ...settings, is_enabled: false };
    setShowDisableWarning(false);
    setSettings(nextSettings);
    void saveSettings(nextSettings);
  }

  async function addCategory() {
    const name = newCategoryName.trim();

    if (!name) {
      showMessage("Add a category name first.", "error");
      return;
    }

    setSavingCategoryId("new");

    try {
      const { data, error } = await supabase
        .from("loyalty_categories")
        .insert({
          name,
          average_price: 0,
          is_active: true,
          sort_order: categories.length + 1,
        })
        .select("*")
        .limit(1);

      if (error) {
        showMessage(error.message, "error");
        return;
      }

      if (data && data.length > 0) {
        setCategories((current) => [
          ...current,
          data[0] as LoyaltyProgramCategory,
        ]);
      }

      setNewCategoryName("");
      showMessage("Category added.");
    } catch (error) {
      console.error(error);
      showMessage("Could not add category.", "error");
    } finally {
      setSavingCategoryId(null);
    }
  }

  async function updateCategory(
    category: LoyaltyProgramCategory,
    updates: Partial<LoyaltyProgramCategory>,
  ) {
    setSavingCategoryId(category.id);

    try {
      const payload: Record<string, unknown> = {};

      if (typeof updates.name === "string") {
        payload.name = updates.name.trim() || category.name;
      }

      if (typeof updates.average_price === "number") {
        payload.average_price = parseMoneyValue(updates.average_price);
      }

      if (typeof updates.is_active === "boolean") {
        payload.is_active = updates.is_active;
      }

      const { data, error } = await supabase
        .from("loyalty_categories")
        .update(payload)
        .eq("id", category.id)
        .select("*")
        .limit(1);

      if (error) {
        showMessage(error.message, "error");
        return;
      }

      const updatedCategory = (
        data && data.length > 0 ? data[0] : { ...category, ...updates }
      ) as LoyaltyProgramCategory;

      setCategories((current) =>
        current.map((item) =>
          item.id === category.id ? updatedCategory : item,
        ),
      );

      showMessage("Category updated.");
    } catch (error) {
      console.error(error);
      showMessage("Could not update category.", "error");
    } finally {
      setSavingCategoryId(null);
    }
  }

  async function removeCategory(category: LoyaltyProgramCategory) {
    const confirmed = window.confirm(
      `Remove ${category.name}? Disable it instead if clients already have stamps in this category.`,
    );

    if (!confirmed) return;

    setSavingCategoryId(category.id);

    try {
      const { error } = await supabase
        .from("loyalty_categories")
        .delete()
        .eq("id", category.id);

      if (error) {
        showMessage(error.message, "error");
        return;
      }

      setCategories((current) =>
        current.filter((item) => item.id !== category.id),
      );
      showMessage("Category removed.");
    } catch (error) {
      console.error(error);
      showMessage("Could not remove category.", "error");
    } finally {
      setSavingCategoryId(null);
    }
  }

  const mainGridClass = compact
    ? "grid gap-3"
    : "grid gap-3 lg:grid-cols-[1.2fr_0.75fr_auto]";

  if (compact) {
    return (
      <div className="space-y-4">
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/62">
                Loyalty Program
              </div>
              <h2 className="mt-1 text-[23px] font-black tracking-[-0.04em] text-white">
                Program Status
              </h2>
              <p className="mt-2 max-w-sm text-[12px] font-bold leading-5 text-white/68">
                Enable or disable the loyalty program for clients.
              </p>
            </div>

            <span
              className={`inline-flex h-10 items-center rounded-full px-4 text-[10px] font-black uppercase tracking-[0.16em] ${
                settings.is_enabled
                  ? "bg-emerald-400/18 text-emerald-100"
                  : "bg-red-500/18 text-red-100"
              }`}
            >
              {loading
                ? "Loading"
                : settings.is_enabled
                  ? "Active"
                  : "Disabled"}
            </span>
          </div>

          {message ? (
            <div
              className={`mt-4 rounded-[16px] px-4 py-3 text-[12px] font-black ${
                message.tone === "success"
                  ? "bg-emerald-400/16 text-emerald-100"
                  : "bg-red-500/16 text-red-100"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <button
            type="button"
            onClick={requestProgramToggle}
            disabled={savingSettings || loading}
            className={`mt-5 h-12 w-full rounded-full px-5 text-[11px] font-black uppercase tracking-[0.16em] transition disabled:opacity-55 ${
              settings.is_enabled
                ? "bg-red-500/20 text-red-100 hover:bg-red-500/28"
                : "bg-emerald-400/18 text-emerald-100 hover:bg-emerald-400/24"
            }`}
          >
            {savingSettings
              ? "Saving..."
              : settings.is_enabled
                ? "Disable Program"
                : "Enable Program"}
          </button>
        </Panel>

        {showDisableWarning ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-5 backdrop-blur-sm sm:items-center sm:pb-0">
            <div className="w-full max-w-md rounded-[28px] border border-white/18 bg-[#5f6f63] p-5 shadow-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ffd66b]">
                Warning
              </div>
              <h3 className="mt-2 text-[23px] font-black tracking-[-0.04em] text-white">
                Disable loyalty program?
              </h3>
              <p className="mt-3 text-[13px] font-bold leading-6 text-white/72">
                Client loyalty cards will appear blurred with a disabled
                message, and staff should not add new stamps while disabled.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setShowDisableWarning(false)}
                  className="h-12 rounded-full border border-white/20 bg-white/10 text-[11px] font-black uppercase tracking-[0.16em] text-white"
                >
                  Keep Active
                </button>
                <button
                  type="button"
                  onClick={confirmDisableProgram}
                  className="h-12 rounded-full bg-red-500/22 text-[11px] font-black uppercase tracking-[0.16em] text-red-100"
                >
                  Disable Program
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/62">
              Admin
            </div>
            <h2 className="mt-1 text-[23px] font-black tracking-[-0.04em] text-white">
              Loyalty Program
            </h2>
            <p className="mt-2 max-w-xl text-[12px] font-bold leading-5 text-white/68">
              Manage the program name, stamp value, gift rules, and categories.
            </p>
          </div>

          <span
            className={`inline-flex h-10 items-center rounded-full px-4 text-[10px] font-black uppercase tracking-[0.16em] ${
              settings.is_enabled
                ? "bg-emerald-400/18 text-emerald-100"
                : "bg-red-500/18 text-red-100"
            }`}
          >
            {settings.is_enabled ? "Active" : "Disabled"}
          </span>
        </div>

        {message ? (
          <div
            className={`mb-4 rounded-[16px] px-4 py-3 text-[12px] font-black ${
              message.tone === "success"
                ? "bg-emerald-400/16 text-emerald-100"
                : "bg-red-500/16 text-red-100"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <div className="rounded-[22px] border border-white/16 bg-white/10 p-4">
          <div className={mainGridClass}>
            <LoyaltyTextInput
              label="Program Name"
              value={settings.program_name}
              onChange={(value) =>
                setSettings((current) => ({ ...current, program_name: value }))
              }
              placeholder="PRO’s Club"
            />
            <LoyaltyNumberInput
              label="Stamps Needed"
              value={String(settings.stamps_per_gift)}
              onChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  stamps_per_gift: Number(value) || 1,
                }))
              }
              placeholder="5"
            />
            <div className="flex gap-2 lg:items-end">
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={savingSettings}
                className="h-12 flex-1 rounded-full bg-[#ffd66b] px-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#365665] transition hover:bg-[#f0cf61] disabled:opacity-55 lg:flex-none"
              >
                {savingSettings ? "Saving" : "Save"}
              </button>
              <button
                type="button"
                onClick={requestProgramToggle}
                disabled={savingSettings}
                className={`h-12 flex-1 rounded-full px-5 text-[10px] font-black uppercase tracking-[0.16em] transition disabled:opacity-55 lg:flex-none ${
                  settings.is_enabled
                    ? "bg-red-500/18 text-red-100 hover:bg-red-500/24"
                    : "bg-emerald-400/18 text-emerald-100 hover:bg-emerald-400/24"
                }`}
              >
                {settings.is_enabled ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[22px] border border-white/16 bg-white/10 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-[18px] font-black tracking-[-0.04em] text-white">
                Stamp Categories
              </h3>
              <p className="mt-1 text-[12px] font-bold leading-5 text-white/64">
                Add, rename, disable, or remove categories.
              </p>
            </div>
          </div>

          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="New category name"
              className="h-10 flex-1 rounded-[12px] border border-white/25 bg-white px-3 text-[12px] font-bold text-black outline-none focus:border-[#ffd66b]"
            />
            <button
              type="button"
              onClick={() => void addCategory()}
              disabled={savingCategoryId === "new"}
              className="h-10 rounded-[12px] bg-[#ffd66b] px-4 text-[10px] font-black uppercase tracking-[0.14em] text-[#365665] disabled:opacity-55"
            >
              Add Category
            </button>
          </div>

          {loading ? (
            <div className="rounded-[18px] bg-white/10 p-4 text-[13px] font-bold text-white/62">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-[18px] bg-white/10 p-4 text-[13px] font-bold text-white/62">
              No categories yet. Add your first stamp category.
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <LoyaltyCategoryRow
                  key={category.id}
                  category={category}
                  saving={savingCategoryId === category.id}
                  onSave={(name, averagePrice) =>
                    void updateCategory(category, {
                      name,
                      average_price: averagePrice,
                    })
                  }
                  onToggle={() =>
                    void updateCategory(category, {
                      is_active: !(category.is_active !== false),
                    })
                  }
                  onRemove={() => void removeCategory(category)}
                />
              ))}
            </div>
          )}
        </div>
      </Panel>

      {showDisableWarning ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-5 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="w-full max-w-md rounded-[28px] border border-white/18 bg-[#5f6f63] p-5 shadow-2xl">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ffd66b]">
              Warning
            </div>
            <h3 className="mt-2 text-[23px] font-black tracking-[-0.04em] text-white">
              Disable loyalty program?
            </h3>
            <p className="mt-3 text-[13px] font-bold leading-6 text-white/72">
              Staff will not be able to add new stamps while the program is
              disabled. Clients can still view their profile and existing gifts.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setShowDisableWarning(false)}
                className="h-12 rounded-full border border-white/20 bg-white/10 text-[11px] font-black uppercase tracking-[0.16em] text-white"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={confirmDisableProgram}
                className="h-12 rounded-full bg-red-500/22 text-[11px] font-black uppercase tracking-[0.16em] text-red-100"
              >
                Disable Program
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LoyaltyTextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-[14px] border border-white/25 bg-white px-4 text-[13px] font-bold text-black outline-none focus:border-[#ffd66b]"
      />
    </label>
  );
}

function LoyaltyNumberInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
        {label}
      </span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-[14px] border border-white/25 bg-white px-4 text-[13px] font-bold text-black outline-none focus:border-[#ffd66b]"
      />
    </label>
  );
}

function LoyaltyCategoryRow({
  category,
  saving,
  onSave,
  onToggle,
  onRemove,
}: {
  category: LoyaltyProgramCategory;
  saving: boolean;
  onSave: (name: string, averagePrice: number) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [averagePrice, setAveragePrice] = useState(
    String(parseMoneyValue(category.average_price)),
  );

  useEffect(() => {
    setName(category.name);
    setAveragePrice(String(parseMoneyValue(category.average_price)));
  }, [category.name, category.average_price]);

  const isActive = category.is_active !== false;
  const isDirty =
    name.trim() !== category.name ||
    parseMoneyValue(averagePrice) !== parseMoneyValue(category.average_price);

  return (
    <div className="rounded-[14px] border border-white/16 bg-white/10 px-3 py-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_160px_auto] lg:items-start">
        <div className="min-w-0">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 w-full rounded-[11px] border border-white/18 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.13em]">
            <span className={isActive ? "text-emerald-100" : "text-red-100"}>
              {isActive ? "Active" : "Disabled"}
            </span>
            <span className="text-white/36">•</span>
            <span className="text-white/52">ID: {category.id.slice(0, 8)}</span>
          </div>
        </div>

        <label className="block">
          <input
            type="number"
            min="0"
            step="0.01"
            value={averagePrice}
            onChange={(event) => setAveragePrice(event.target.value)}
            className="h-10 w-full rounded-[11px] border border-white/18 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
          />
          <span className="mt-1.5 block text-[8px] font-black uppercase tracking-[0.16em] text-white/58">
            Average Price
          </span>
        </label>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={() => onSave(name, parseMoneyValue(averagePrice))}
            disabled={saving || !isDirty}
            className="h-9 rounded-full bg-[#ffd66b] px-3 text-[9px] font-black uppercase tracking-[0.12em] text-[#365665] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={saving}
            className="h-9 rounded-full bg-white/14 px-3 text-[9px] font-black uppercase tracking-[0.12em] text-white disabled:opacity-45"
          >
            {isActive ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            className="h-9 rounded-full bg-red-500/16 px-3 text-[9px] font-black uppercase tracking-[0.12em] text-red-100 disabled:opacity-45"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileGameInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/64">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[16px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
      />
    </label>
  );
}

function ClientProfilePanel({
  user,
  currentUserId,
  categories,
  stamps,
  rewards,
  loading,
  onBack,
  onRoleChange,
  onDeactivate,
  onReactivate,
}: {
  user: AdminUser;
  currentUserId: string;
  categories: AdminCategory[];
  stamps: AdminClientStamp[];
  rewards: Reward[];
  loading: boolean;
  onBack: () => void;
  onRoleChange: (role: UserRole) => void;
  onDeactivate: () => void;
  onReactivate: (role: UserRole) => void;
}) {
  const stampByCategory = useMemo(() => {
    const map = new Map<string, number>();

    stamps.forEach((stamp) => {
      map.set(stamp.category_id, stamp.stamp_count ?? 0);
    });

    return map;
  }, [stamps]);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full bg-white/14 px-4 py-2 text-[12px] font-black text-white backdrop-blur-xl"
      >
        ← Back to users
      </button>

      <div
        className="border border-white/20 p-5 shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
        style={{ borderRadius: 26, background: GLASS_CARD }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/58">
              Member Profile
            </div>
            <h2 className="mt-2 truncate text-[25px] font-black leading-none text-[#ffd66b]">
              {user.full_name || "Client"}
            </h2>
            <div className="mt-2 text-[12px] font-semibold leading-5 text-white/66">
              {user.email || "No email"}
              {user.phone ? (
                <>
                  <br />
                  {user.phone}
                </>
              ) : null}
            </div>
            {user.client_code ? (
              <div className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                {user.client_code}
              </div>
            ) : null}
          </div>

          <select
            value={user.is_active === false ? "deactivated" : user.role}
            onChange={(event) => {
              const value = event.target.value;

              if (value === "deactivated") {
                onDeactivate();
                return;
              }

              if (user.is_active === false) {
                onReactivate(value as UserRole);
                return;
              }

              onRoleChange(value as UserRole);
            }}
            disabled={user.id === currentUserId}
            className={`shrink-0 rounded-full border border-white/30 bg-white/108 px-3 py-2 text-[11px] font-black outline-none disabled:opacity-55 ${
              user.is_active === false ? "text-red-600" : "text-white"
            }`}
          >
            <option value="client">Client</option>
            <option value="staff">Staff</option>
            <option value="master_admin">Admin</option>
            <option value="deactivated" className="font-black text-red-600">
              Deactivate
            </option>
          </select>
        </div>

        {user.is_active === false ? (
          <div className="mt-4 rounded-2xl border border-red-300/25 bg-red-500/12 px-4 py-3 text-[12px] font-black text-red-200">
            This account is deactivated.
          </div>
        ) : null}
      </div>

      <DashboardGroup title="Stamps">
        {loading ? <EmptyState text="Loading profile..." /> : null}

        {!loading && user.role !== "client" ? (
          <EmptyState text="This account is not a client, so there are no loyalty stamps." />
        ) : null}

        {!loading && user.role === "client" ? (
          <div className="space-y-3">
            {categories.length === 0 ? (
              <EmptyState text="No stamp categories found." />
            ) : null}

            {categories.map((category) => {
              const count = Math.max(
                0,
                Math.min(5, stampByCategory.get(category.id) ?? 0),
              );

              return (
                <div
                  key={category.id}
                  className="border border-white/20 p-4 shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
                  style={{ borderRadius: 22, background: GLASS_CARD }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="truncate text-[15px] font-black text-white">
                      {category.name === "Desserts 2" ? "Hooka" : category.name}
                    </div>
                    <div className="text-[13px] font-black tabular-nums text-[#ffd66b]">
                      {count}/5
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className={`h-2 rounded-full ${
                          index < count ? "bg-[#ffd66b]" : "bg-white/45"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </DashboardGroup>

      <DashboardGroup title="Gifts">
        {loading ? null : rewards.length === 0 ? (
          <EmptyState text="No gifts for this client yet." />
        ) : null}

        <div className="space-y-3">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className="border border-white/20 p-4 shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
              style={{ borderRadius: 22, background: GLASS_CARD }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[16px] font-black text-[#ffd66b]">
                    {normalizeRewardText(reward.reward_type)}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold leading-5 text-white/62">
                    Earned {formatDate(reward.earned_at)}
                    {reward.redeemed_at ? (
                      <> · Confirmed {formatDate(reward.redeemed_at)}</>
                    ) : null}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                    reward.status === "available"
                      ? "bg-[#ffd66b] text-[#365665]"
                      : reward.status === "redeemed" ||
                          reward.status === "claimed"
                        ? "bg-white/16 text-[#ffd66b]"
                        : "bg-white/102 text-white"
                  }`}
                >
                  {reward.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DashboardGroup>
    </div>
  );
}

function DashboardGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 px-1 text-[20px] font-black leading-none text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: React.ReactNode;
  value: number | string;
}) {
  const isLongText =
    typeof value === "string" && value.length > 8 && !value.includes("%");

  return (
    <div
      className="border border-white/20 p-4 shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
      style={{ borderRadius: 24, background: GLASS_CARD }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
        {label}
      </div>
      <div
        className={`mt-3 font-black leading-none text-white ${isLongText ? "text-[18px]" : "text-[26px]"}`}
      >
        {value}
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: StampTransaction["action_type"] }) {
  const styles: Record<string, string> = {
    add_stamp: "bg-emerald-400/18 text-emerald-100",
    remove_stamp: "bg-red-500/18 text-red-200",
    reward_earned: "bg-[#ffd66b]/22 text-[#ffd66b]",
    reward_redeemed: "bg-slate-400/18 text-slate-100",
    manual_adjustment: "bg-white/12 text-white/62",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${styles[action] ?? "bg-white/12 text-white/62"}`}
    >
      {String(action || "activity").replace(/_/g, " ")}
    </span>
  );
}

function labelForAction(
  action: StampTransaction["action_type"],
  actorName?: string,
): string {
  if (action === "add_stamp") {
    return `Stamp added by ${actorName || "Staff"}`;
  }

  if (action === "reward_redeemed") {
    return `Gift confirmed by ${actorName || "Staff"}`;
  }

  return (
    {
      reward_earned: "Gift earned",
      manual_adjustment: "",
    }[action] ?? "Activity updated"
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="border border-white/20 p-5 text-center text-[14px] font-semibold text-white/64 backdrop-blur-2xl"
      style={{ borderRadius: 24, background: GLASS_CARD }}
    >
      {text}
    </div>
  );
}

const D_BRAND_GREEN = "#365665";
const D_BRAND_OLIVE = "#798673";
const D_BRAND_YELLOW = "#ffd66b";
const D_BRAND_BG = "#f4f1e9";

function desktopShortName(name?: string | null) {
  return (name || "Admin").trim().split(/\s+/)[0] || "Admin";
}

function desktopFormatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function desktopFormatDateOnly(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function desktopFormatTimeOnly(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function desktopFormatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${desktopFormatDateOnly(value)} ${desktopFormatTimeOnly(value)}`;
}

function compactCommentPreview(value?: string | null) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length <= 3) return words.join(" ");
  return `${words.slice(0, 3).join(" ")}...`;
}

function desktopBirthdayInfo(value?: string | null) {
  if (!value) return { label: "—", daysLeft: null as number | null };

  const raw = String(value).trim();
  if (!raw) return { label: "—", daysLeft: null as number | null };

  const lowerRaw = raw.toLowerCase();
  const defaultBirthdayValues = new Set([
    "0001-01-01",
    "1900-01-01",
    "1970-01-01",
    "2000-01-01",
  ]);

  if (
    defaultBirthdayValues.has(raw.slice(0, 10)) ||
    lowerRaw === "default" ||
    lowerRaw === "null" ||
    lowerRaw === "undefined"
  ) {
    return { label: "—", daysLeft: null as number | null };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { label: raw, daysLeft: null as number | null };
  }

  const parsedYear = parsed.getFullYear();
  if (parsedYear <= 1901 || parsedYear === 1970 || parsedYear === 2000) {
    return { label: "—", daysLeft: null as number | null };
  }

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  let nextBirthday = new Date(
    todayStart.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  );

  if (nextBirthday < todayStart) {
    nextBirthday = new Date(
      todayStart.getFullYear() + 1,
      parsed.getMonth(),
      parsed.getDate(),
    );
  }

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (nextBirthday.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000),
    ),
  );

  return {
    label: parsed.toLocaleDateString("en", { month: "short", day: "numeric" }),
    daysLeft,
  };
}

function desktopBirthdayDaysLabel(daysLeft: number | null) {
  if (daysLeft === null) return "—";
  if (daysLeft === 0) return "Today";
  if (daysLeft === 1) return "1 day";
  return `${daysLeft} days`;
}

function commentRatingColorClass(rating: number) {
  if (rating >= 4.5) return "text-emerald-200";
  if (rating >= 4) return "text-[#ffd66b]";
  if (rating >= 3) return "text-orange-200";
  return "text-red-200";
}

function compareDesktopValues(
  first: string | number | null | undefined,
  second: string | number | null | undefined,
) {
  const firstMissing = first === null || first === undefined || first === "";
  const secondMissing =
    second === null || second === undefined || second === "";

  if (firstMissing && secondMissing) return 0;
  if (firstMissing) return 1;
  if (secondMissing) return -1;

  if (typeof first === "number" && typeof second === "number") {
    return first - second;
  }

  return String(first).localeCompare(String(second), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function commentCardWhatsappUrl(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function desktopFormatContactDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${desktopFormatDateOnly(value)} ${desktopFormatTimeOnly(value)}`;
}

function desktopCsvCell(value: string | number | null | undefined) {
  const safeValue = String(value ?? "");
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function desktopDownloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => desktopCsvCell(cell)).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function desktopFormatMoney(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return `$${safeValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function desktopVisitDayKey(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (number: number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function desktopGetBestPerformingDay(txns: StampTransaction[]) {
  if (!txns.length) return "—";

  const labels = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const counts = new Map<number, number>();

  txns.forEach((txn) => {
    const date = new Date(txn.created_at);
    if (Number.isNaN(date.getTime())) return;
    const day = date.getDay();
    counts.set(day, (counts.get(day) ?? 0) + 1);
  });

  const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  return best ? labels[best[0]] : "—";
}

function toPredictionDatePayloadValue(value?: string | null) {
  const raw = String(value ?? "").trim();

  if (!raw) return "";

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return raw;

  return date.toISOString();
}

function withPredictionDatePayload<
  T extends {
    kickoff_at?: string | null;
    opens_at?: string | null;
    closes_at?: string | null;
  },
>(payload: T) {
  return {
    ...payload,
    kickoff_at: toPredictionDatePayloadValue(payload.kickoff_at),
    opens_at: toPredictionDatePayloadValue(payload.opens_at),
    closes_at: toPredictionDatePayloadValue(payload.closes_at),
  };
}

function inferPredictionSportType(match: {
  sport_type?: string | null;
  match_label?: string | null;
  venue?: string | null;
}) {
  const text =
    `${match.sport_type ?? ""} ${match.match_label ?? ""} ${match.venue ?? ""}`.toLowerCase();

  return text.includes("basket") ? "basketball" : "football";
}

function tabIcon(tab: Tab) {
  if (tab === "Overview") return "⌂";
  if (tab === "Users") return "👤";
  if (tab === "Activity") return "↯";
  if (tab === "Gifts") return "🎁";
  if (tab === "Birthdays") return "🎂";
  if (tab === "Comment Cards") return "✎";
  if (tab === "Loyalty Program") return "★";
  return "⚽";
}

function desktopTabLabel(tab: Tab) {
  if (tab === "Users") return "Customer behavior";
  return tab;
}

function desktopRoleLabel(role: UserRole) {
  if (role === "master_admin") return "Admin";
  if (role === "staff") return "Staff";
  return "Client";
}

function desktopNormalizeRewardText(value?: string | null) {
  return String(value || "Reward")
    .replace(/ Item$/i, "")
    .trim();
}

function desktopUniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter(Boolean)).size;
}

function desktopPercentage(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function desktopSafeRatio(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function desktopGetMostActiveCustomer(
  users: Profile[],
  recentTxns: StampTransaction[],
) {
  const counts = new Map<string, number>();

  recentTxns.forEach((txn) => {
    if (!txn.client_id) return;
    counts.set(txn.client_id, (counts.get(txn.client_id) ?? 0) + 1);
  });

  let topClientId = "";
  let topCount = 0;

  counts.forEach((count, clientId) => {
    if (count > topCount) {
      topCount = count;
      topClientId = clientId;
    }
  });

  return (
    users.find((user) => user.id === topClientId)?.full_name ??
    (topClientId ? `Client ${topClientId.slice(0, 6)}` : "—")
  );
}

function desktopGetTopReward(rewards: Reward[] = []) {
  const counts = new Map<string, number>();

  rewards.forEach((reward) => {
    const name = desktopNormalizeRewardText(reward.reward_type);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });

  let topReward = "—";
  let topCount = 0;

  counts.forEach((count, reward) => {
    if (count > topCount) {
      topCount = count;
      topReward = reward;
    }
  });

  return topReward;
}

function maskPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 6) return value || "";
  return `${digits.slice(0, 2)}***${digits.slice(-3)}`;
}

type BirthdayProfileFields = {
  birthday?: string | null;
  birth_date?: string | null;
  date_of_birth?: string | null;
  dob?: string | null;
};

function getBirthdayValue(user: AdminUser) {
  const birthdayFields = user as AdminUser & BirthdayProfileFields;

  return (
    birthdayFields.birthday ||
    birthdayFields.birth_date ||
    birthdayFields.date_of_birth ||
    birthdayFields.dob ||
    null
  );
}

function getAgeFromBirthday(value?: string | null) {
  if (!value) return null;

  const raw = String(value).trim();
  const lowerRaw = raw.toLowerCase();
  const defaultBirthdayValues = new Set([
    "0001-01-01",
    "1900-01-01",
    "1970-01-01",
    "2000-01-01",
  ]);

  if (
    !raw ||
    defaultBirthdayValues.has(raw.slice(0, 10)) ||
    lowerRaw === "default" ||
    lowerRaw === "null" ||
    lowerRaw === "undefined"
  ) {
    return null;
  }

  const birthday = new Date(raw);
  if (Number.isNaN(birthday.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();

  const birthdayPassedThisYear =
    today.getMonth() > birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() &&
      today.getDate() >= birthday.getDate());

  if (!birthdayPassedThisYear) age -= 1;

  const birthYear = birthday.getFullYear();
  if (birthYear <= 1901 || birthYear === 1970 || birthYear === 2000) {
    return null;
  }

  return age >= 0 && age <= 120 ? age : null;
}

function desktopAgeLabel(age: number | null) {
  return age === null ? "—" : String(age);
}


type BirthdayFilter =
  | "all"
  | "today"
  | "week"
  | "month"
  | "upcoming"
  | "sent"
  | "claimed"
  | "expired"
  | "not_sent";

type BirthdayTiming = "Today" | "Tomorrow" | "This Week" | "This Month" | "Upcoming" | "Passed";

type BirthdaySortKey =
  | "name"
  | "age"
  | "birthday"
  | "days_left"
  | "gifts"
  | "gift_status"
  | "last_visit"
  | "gift_sent"
  | "source"
  | "last_contacted";

type BirthdayRow = {
  id: string;
  source: "Loyalty" | "Comment Cards" | "Datasheet";
  user: AdminUser | null;
  commentCard: CommentCardEntry | null;
  name: string;
  contact: string;
  phone: string;
  email: string;
  birthdayValue: string | null;
  birthdayInfo: ReturnType<typeof getNextBirthdayInfo>;
  birthdayRewards: Reward[];
  giftName: string;
  giftStatus: "Not Sent" | "Sent" | "Claimed" | "Expired";
  giftSentAt: string | null;
  expiry: string | null;
  latestVisit: string | null;
  memberSince: string | null;
  lastContactedKey: string;
  lastContactedKeys: string[];
  sourceId: string | null;
};

function getValidBirthdayDate(value?: string | null) {
  if (!value) return null;

  const raw = String(value).trim();
  const lowerRaw = raw.toLowerCase();
  const defaultBirthdayValues = new Set([
    "0001-01-01",
    "1900-01-01",
    "1970-01-01",
    "2000-01-01",
  ]);

  if (
    !raw ||
    defaultBirthdayValues.has(raw.slice(0, 10)) ||
    lowerRaw === "default" ||
    lowerRaw === "null" ||
    lowerRaw === "undefined"
  ) {
    return null;
  }

  const birthday = new Date(raw);
  if (Number.isNaN(birthday.getTime())) return null;

  return birthday;
}

function getNextBirthdayInfo(value?: string | null) {
  const birthday = getValidBirthdayDate(value);
  if (!birthday) return null;

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let nextBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());

  if (nextBirthday.getTime() < startToday.getTime()) {
    nextBirthday = new Date(today.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
  }

  const daysLeft = Math.round(
    (nextBirthday.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000),
  );

  let timing: BirthdayTiming = "Upcoming";
  if (daysLeft === 0) timing = "Today";
  else if (daysLeft === 1) timing = "Tomorrow";
  else if (daysLeft <= 7) timing = "This Week";
  else if (daysLeft <= 31) timing = "This Month";

  return { birthday, nextBirthday, daysLeft, timing };
}

function desktopBirthdayDateLabel(value?: string | null) {
  const birthday = getValidBirthdayDate(value);
  if (!birthday) return "—";

  return birthday.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function desktopBirthdayDaysCode(value?: string | null) {
  const info = getNextBirthdayInfo(value);
  if (!info) return "—";
  if (info.daysLeft === 0) return "0d";
  return `${info.daysLeft}d`;
}

function desktopBirthdayTimingClass(timing: BirthdayTiming) {
  if (timing === "Today") return "bg-[#ffd66b]/24 text-[#ffd66b]";
  if (timing === "Tomorrow" || timing === "This Week") return "bg-emerald-400/18 text-emerald-100";
  if (timing === "This Month") return "bg-white/12 text-white";
  return "bg-white/8 text-white/68";
}

function desktopBirthdayStatusClass(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes("claimed")) return "bg-slate-400/18 text-slate-100";
  if (lower.includes("expired")) return "bg-red-500/18 text-red-200";
  if (lower.includes("sent")) return "bg-emerald-400/18 text-emerald-100";
  return "bg-[#ffd66b]/18 text-[#ffd66b]";
}

function desktopBirthdayGiftMessage(customerName: string, giftName: string) {
  return `Happy Birthday ${customerName} 🎉

Pro's Cafe has a special gift for you: ${giftName}.

Login to proscafe.net to claim it.

Claim it on your next visit.
Valid for 30 days.`;
}

type DesktopTimeRange = "today" | "week" | "month" | "all";

function getDesktopTimeRangeStart(range: DesktopTimeRange) {
  if (range === "all") return null;

  const now = new Date();

  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const startOfWeek = new Date(now);
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(now.getDate() - daysFromMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}

function isWithinDesktopTimeRange(
  value: string | null | undefined,
  range: DesktopTimeRange,
) {
  if (range === "all") return true;

  if (!value) return false;

  const date = new Date(value);
  const start = getDesktopTimeRangeStart(range);

  if (!start) return true;

  return !Number.isNaN(date.getTime()) && date >= start;
}

function desktopTimeRangeLabel(range: DesktopTimeRange) {
  if (range === "today") return "Today";
  if (range === "week") return "This week";
  if (range === "month") return "This month";
  return "Show all";
}

function DesktopAdminDashboard({
  profile,
  users: initialUsers = [],
  recentTxns = [],
  recentRewards = [],
  metrics,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("Overview");
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [activityTxns, setActivityTxns] = useState<StampTransaction[]>(
    recentTxns ?? [],
  );
  const [giftRows, setGiftRows] = useState<Reward[]>(recentRewards ?? []);
  const [profileNamesById, setProfileNamesById] = useState<
    Record<string, string>
  >({});
  const [categoryNamesById, setCategoryNamesById] = useState<
    Record<string, string>
  >({});
  const [categoryAveragePriceById, setCategoryAveragePriceById] = useState<
    Record<string, number>
  >({});
  const [categoryAveragePriceByName, setCategoryAveragePriceByName] = useState<
    Record<string, number>
  >({});
  const [desktopGiftCategories, setDesktopGiftCategories] = useState<
    AdminCategory[]
  >([]);
  const [quickGiftTarget, setQuickGiftTarget] =
    useState<QuickGiftTarget | null>(null);
  const [quickGiftType, setQuickGiftType] = useState<"gift" | "discount">(
    "gift",
  );
  const [quickGiftCategoryId, setQuickGiftCategoryId] = useState("");
  const [quickDiscountValue, setQuickDiscountValue] = useState("10%");
  const [quickGiftDescription, setQuickGiftDescription] = useState("");
  const [desktopVersionLabel, setDesktopVersionLabel] =
    useState("V2.0 07062026");
  const [isDesktopVersionEditing, setIsDesktopVersionEditing] = useState(false);
  const [activityView, setActivityView] = useState<"activity" | "gifts">(
    "activity",
  );
  const [activityGiftSearch, setActivityGiftSearch] = useState("");
  const [giftFilter, setGiftFilter] = useState<
    | "all"
    | "loyalty"
    | "birthday"
    | "sent"
    | "comment_cards"
    | "games"
    | "available"
    | "used"
    | "expired"
    | "expiring"
    | "pending"
  >("all");
  const [giftDashboardOpen, setGiftDashboardOpen] = useState(false);
  const [giftDashboardClientId, setGiftDashboardClientId] = useState("");
  const [giftDashboardCategoryId, setGiftDashboardCategoryId] = useState("");
  const [giftDashboardExpiry, setGiftDashboardExpiry] = useState("");
  const [giftDashboardNote, setGiftDashboardNote] = useState("");
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | UserRole>("client");
  const [timeRange, setTimeRange] = useState<DesktopTimeRange>("today");
  const [commentCards, setCommentCards] = useState<CommentCardEntry[]>([]);
  const [birthdayDatasheetRows, setBirthdayDatasheetRows] = useState<BirthdayDatasheetEntry[]>([]);
  const [pendingCommentCardGifts, setPendingCommentCardGifts] = useState<
    PendingCommentCardReward[]
  >([]);
  const [commentSearch, setCommentSearch] = useState("");
  const [commentFilter, setCommentFilter] = useState<CommentCardFilter>("all");
  const [commentSort, setCommentSort] = useState<{
    key: CommentCardSortKey;
    direction: SortDirection;
  }>({ key: "submitted", direction: "desc" });
  const [birthdaySearch, setBirthdaySearch] = useState("");
  const [birthdayFilter, setBirthdayFilter] =
    useState<BirthdayFilter>("today");
  const [birthdaySort, setBirthdaySort] = useState<{
    key: BirthdaySortKey;
    direction: SortDirection;
  }>({ key: "name", direction: "asc" });
  const [birthdayContactHistory, setBirthdayContactHistory] = useState<
    Record<string, string[]>
  >({});
  const [selectedBirthdayRowIds, setSelectedBirthdayRowIds] = useState<string[]>([]);
  const [lastSelectedBirthdayIndex, setLastSelectedBirthdayIndex] = useState<number | null>(null);
  const [birthdayGiftConfirmRows, setBirthdayGiftConfirmRows] = useState<BirthdayRow[] | null>(null);
  const [birthdayDeleteConfirmRows, setBirthdayDeleteConfirmRows] = useState<BirthdayRow[] | null>(null);
  const [birthdayCreateOpen, setBirthdayCreateOpen] = useState(false);
  const [birthdayCreateName, setBirthdayCreateName] = useState("");
  const [birthdayCreatePhone, setBirthdayCreatePhone] = useState("");
  const [birthdayCreateDate, setBirthdayCreateDate] = useState("");
  const [birthdayCreateSaving, setBirthdayCreateSaving] = useState(false);

  useEffect(() => {
    const savedVersion = window.localStorage.getItem(
      "proscafe_admin_desktop_version_label",
    );
    if (savedVersion) setDesktopVersionLabel(savedVersion);
  }, []);

  const saveDesktopVersionLabel = (nextValue: string) => {
    const cleanedValue = nextValue.trim() || "V2.0 07062026";
    setDesktopVersionLabel(cleanedValue);
    window.localStorage.setItem(
      "proscafe_admin_desktop_version_label",
      cleanedValue,
    );
    setIsDesktopVersionEditing(false);
  };
  const [selectedCommentCardId, setSelectedCommentCardId] = useState<
    string | null
  >(null);
  const [commentContactHistory, setCommentContactHistory] = useState<
    Record<string, string[]>
  >({});
  const [reportFiltersOpen, setReportFiltersOpen] = useState(false);
  const [lastVisitFilter, setLastVisitFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [customerStatusFilter, setCustomerStatusFilter] = useState<
    "all" | "active" | "inactive" | "at_risk" | "vip"
  >("all");
  const [customerGenderFilter, setCustomerGenderFilter] = useState<
    "all" | "male" | "female"
  >("all");
  const [customerAgeRangeFilter, setCustomerAgeRangeFilter] = useState<
    "all" | "18-24" | "25-34" | "35-44" | "45+"
  >("all");
  const [customerVisitRangeFilter, setCustomerVisitRangeFilter] = useState<
    "all" | "0" | "1-3" | "4-10" | "10+"
  >("all");
  const [customerValueRangeFilter, setCustomerValueRangeFilter] = useState<
    "all" | "0" | "1-50" | "50-200" | "200+"
  >("all");
  const [customerSort, setCustomerSort] = useState<{
    key:
      | "name"
      | "contact"
      | "age"
      | "gender"
      | "lastVisit"
      | "visits"
      | "value"
      | "lifetime"
      | "gifts"
      | "giftValue"
      | "status";
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });
  const reportFilterRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleUserCount, setVisibleUserCount] = useState(15);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<AdminCategory[]>(
    [],
  );
  const [selectedStamps, setSelectedStamps] = useState<AdminClientStamp[]>([]);
  const [desktopClientStamps, setDesktopClientStamps] = useState<
    AdminClientStamp[]
  >([]);
  const [selectedRewards, setSelectedRewards] = useState<Reward[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");
  const [gameKind, setGameKind] = useState<"football" | "basketball">(
    "basketball",
  );
  const [gameForm, setGameForm] = useState({
    home_team: "",
    away_team: "",
    venue: "",
    match_label: "",
    tournament_id: "",
    kickoff_at: "",
    opens_at: "",
    closes_at: "",
    home_score: "",
    away_score: "",
    basketball_winner: "home",
    basketball_win_by: "",
  });
  const [gameSaving, setGameSaving] = useState(false);
  const [gameCreateOpen, setGameCreateOpen] = useState(false);
  const [tournamentPopupOpen, setTournamentPopupOpen] = useState(false);
  const [tournamentDeleteId, setTournamentDeleteId] = useState<string | null>(null);
  const [tournamentSaving, setTournamentSaving] = useState(false);
  const [tournamentForm, setTournamentForm] = useState({ name: "", sport_type: "basketball" as "football" | "basketball" });
  const [predictionTournaments, setPredictionTournaments] = useState<
    Array<{ id: string; name: string; sport_type: "football" | "basketball"; created_at?: string | null }>
  >([]);
  const [gameDateFilter, setGameDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [gameSportFilter, setGameSportFilter] = useState<"all" | "football" | "basketball">("all");
  const [gameTournamentFilter, setGameTournamentFilter] = useState("all");
  const [gameSort, setGameSort] = useState<{
    key: "sport" | "match" | "date" | "status" | "players";
    direction: "asc" | "desc";
  }>({ key: "date", direction: "desc" });
  const [createdGameLinks, setCreatedGameLinks] = useState<
    Array<{
      id: string;
      title: string;
      code: string;
      sport: string;
      matchLabel: string;
      kickoff: string | null;
      opensAt: string | null;
      closesAt: string | null;
      status: string;
      players: number;
      tournamentId?: string | null;
      tournamentName?: string | null;
    }>
  >([]);

  function flash(message: string, t: "success" | "error" = "success") {
    setTone(t);
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  async function refreshDesktopClientStamps() {
    const { data, error } = await supabase
      .from("client_stamps")
      .select("id, client_id, category_id, stamp_count, updated_at");

    if (error) {
      flash(error.message, "error");
      return;
    }

    setDesktopClientStamps((data ?? []) as unknown as AdminClientStamp[]);
  }

  const quickGiftCategoryOptions = useMemo(
    () =>
      desktopGiftCategories.map((category) => ({
        id: category.id,
        name: category.name === "Desserts 2" ? "Hooka" : category.name,
      })),
    [desktopGiftCategories],
  );

  const selectedQuickGiftCategoryName =
    quickGiftCategoryOptions.find(
      (category) => category.id === quickGiftCategoryId,
    )?.name ??
    quickGiftCategoryOptions[0]?.name ??
    "";

  const quickGiftLabel =
    quickGiftType === "discount"
      ? `Discount ${quickDiscountValue}`
      : selectedQuickGiftCategoryName
        ? `Free ${selectedQuickGiftCategoryName}`
        : "";

  useEffect(() => {
    if (quickGiftCategoryId || quickGiftCategoryOptions.length === 0) return;

    setQuickGiftCategoryId(quickGiftCategoryOptions[0].id);
  }, [quickGiftCategoryId, quickGiftCategoryOptions]);

  function resetQuickGiftForm() {
    setQuickGiftType("gift");
    setQuickGiftCategoryId(quickGiftCategoryOptions[0]?.id ?? "");
    setQuickDiscountValue("10%");
    setQuickGiftDescription("");
  }

  function openQuickGift(user: AdminUser, source: "comment_cards" | "user" = "user") {
    setQuickGiftTarget({ kind: "member", user, source });
    resetQuickGiftForm();
  }

  function openPendingCommentCardGift(row: {
    card: CommentCardEntry;
    member: AdminUser | null;
  }) {
    if (row.member) {
      openQuickGift(row.member, "comment_cards");
      return;
    }

    const phone = row.card.phone?.trim();

    if (!phone) {
      flash("Phone number is required to save a pending gift.", "error");
      return;
    }

    setQuickGiftTarget({
      kind: "pending_comment_card",
      cardId: row.card.id,
      fullName: row.card.full_name || "Guest",
      phone,
    });
    resetQuickGiftForm();
  }

  function closeQuickGift() {
    setQuickGiftTarget(null);
    setQuickGiftDescription("");
  }

  async function sendQuickGift() {
    if (!quickGiftTarget || !quickGiftLabel) return;

    const categoryId =
      quickGiftType === "gift"
        ? quickGiftCategoryId || quickGiftCategoryOptions[0]?.id
        : quickGiftCategoryOptions[0]?.id;

    if (!categoryId) {
      flash("No loyalty category found for this gift.", "error");
      return;
    }

    const quickSourceName = shortName(
      profile.full_name || profile.email || "Admin",
    );
    const quickGiftSourceLabel =
      quickGiftTarget.kind === "pending_comment_card" ||
      (quickGiftTarget.kind === "member" && quickGiftTarget.source === "comment_cards")
        ? " - Source Comment Cards"
        : "";
    const rewardType = quickGiftDescription.trim()
      ? `Sent Gift - ${quickGiftLabel} - Sent by ${quickSourceName}${quickGiftSourceLabel} - ${quickGiftDescription.trim()}`
      : `Sent Gift - ${quickGiftLabel} - Sent by ${quickSourceName}${quickGiftSourceLabel}`;

    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    if (quickGiftTarget.kind === "pending_comment_card") {
      const { error } = await supabase
        .from("pending_comment_card_rewards")
        .insert({
          source_comment_card_id: quickGiftTarget.cardId,
          full_name: quickGiftTarget.fullName,
          phone: quickGiftTarget.phone,
          normalized_phone: normalizePhoneForMatch(quickGiftTarget.phone),
          category_id: categoryId,
          reward_type: rewardType,
          status: "pending",
          expires_at: expiresAt,
        });

      if (error) {
        flash(error.message, "error");
        return;
      }

      const { data: pendingRows } = await supabase
        .from("pending_comment_card_rewards")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250);

      setPendingCommentCardGifts(
        (pendingRows ?? []) as unknown as PendingCommentCardReward[],
      );

      flash("Gift saved. It will be added when this phone number registers.");
      closeQuickGift();
      setActivityView("gifts");
      setGiftFilter("pending");
      return;
    }

    const { data, error } = await supabase
      .from("rewards")
      .insert({
        client_id: quickGiftTarget.user.id,
        category_id: categoryId,
        reward_type: rewardType,
        status: "available",
        earned_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .select("*")
      .maybeSingle();

    if (error) {
      flash(error.message, "error");
      return;
    }

    let emailWarning = "";

    if (data) {
      setGiftRows((current) => [data as Reward, ...current]);
    }

    if (quickGiftTarget.kind === "member" && quickGiftTarget.source === "comment_cards") {
      const recipientEmail = String(quickGiftTarget.user.email || "").trim();

      try {
        const response = await fetch("/api/admin/comment-card-gift-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: quickGiftTarget.user.id,
            to: recipientEmail || undefined,
            customer_name: quickGiftTarget.user.full_name || "Customer",
            gift_name: quickGiftLabel,
            expires_at: expiresAt,
          }),
        });

        const result = (await response.json().catch(() => null)) as
          | { success?: boolean; error?: string; to?: string; email_source?: string }
          | null;

        if (!response.ok || !result?.success) {
          emailWarning = result?.error
            ? ` Email not sent: ${result.error}`
            : " Email not sent.";
        } else if (result.email_source === "auth.email") {
          emailWarning = " Email sent using account email.";
        }
      } catch (error) {
        emailWarning = error instanceof Error ? ` Email not sent: ${error.message}` : " Email not sent.";
      }
    }

    flash(`Gift sent.${emailWarning}`);
    closeQuickGift();
  }

  const dashboardGiftClientOptions = useMemo(
    () =>
      users.filter(
        (user) => user.role === "client" && user.is_active !== false,
      ),
    [users],
  );

  const dashboardGiftCategoryOptions = useMemo(
    () =>
      desktopGiftCategories.map((category) => ({
        id: category.id,
        name: category.name === "Desserts 2" ? "Hooka" : category.name,
      })),
    [desktopGiftCategories],
  );

  function defaultGiftExpiryDate() {
    const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }

  function openGiftDashboardModal() {
    setGiftDashboardClientId(dashboardGiftClientOptions[0]?.id ?? "");
    setGiftDashboardCategoryId(dashboardGiftCategoryOptions[0]?.id ?? "");
    setGiftDashboardExpiry(defaultGiftExpiryDate());
    setGiftDashboardNote("");
    setGiftDashboardOpen(true);
  }

  function closeGiftDashboardModal() {
    setGiftDashboardOpen(false);
    setGiftDashboardNote("");
  }

  async function sendDashboardGift() {
    const clientId = giftDashboardClientId || dashboardGiftClientOptions[0]?.id;
    const categoryId =
      giftDashboardCategoryId || dashboardGiftCategoryOptions[0]?.id;
    const giftName =
      dashboardGiftCategoryOptions.find(
        (category) => category.id === categoryId,
      )?.name ?? "Gift";

    if (!clientId || !categoryId) {
      flash("Choose a client and a gift.", "error");
      return;
    }

    const sourceName = shortName(profile.full_name || profile.email || "Admin");
    const note = giftDashboardNote.trim();
    const rewardType = note
      ? `Sent Gift - Free ${giftName} - Sent by ${sourceName} - ${note}`
      : `Sent Gift - Free ${giftName} - Sent by ${sourceName}`;
    const expiryDate = giftDashboardExpiry
      ? new Date(`${giftDashboardExpiry}T23:59:59`).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("rewards")
      .insert({
        client_id: clientId,
        category_id: categoryId,
        reward_type: rewardType,
        status: "available",
        earned_at: new Date().toISOString(),
        expires_at: expiryDate,
      })
      .select("*")
      .maybeSingle();

    if (error) {
      flash(error.message, "error");
      return;
    }

    if (data) setGiftRows((current) => [data as Reward, ...current]);

    flash("Gift sent.");
    closeGiftDashboardModal();
    setActivityView("gifts");
  }


  async function sendBirthdayGift(row: BirthdayRow) {
    if (row.giftStatus !== "Not Sent") {
      flash("Birthday gifts already sent.", "error");
      return false;
    }

    const client = row.user;
    if (!client?.id) {
      flash("Birthday gifts can be sent after this guest registers.", "error");
      return false;
    }

    const fallbackCategoryId = dashboardGiftCategoryOptions[0]?.id ?? "";
    const dessertCategoryId =
      dashboardGiftCategoryOptions.find((category) =>
        String(category.name ?? "").toLowerCase().includes("dessert"),
      )?.id ?? fallbackCategoryId;

    if (!fallbackCategoryId) {
      flash("Add at least one active gift category first.", "error");
      return false;
    }

    const sourceName = shortName(profile.full_name || profile.email || "Admin");
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const birthdayGifts = [
      { name: "20% Discount", categoryId: fallbackCategoryId },
      { name: "Free Dessert", categoryId: dessertCategoryId },
    ];

    const { data, error } = await supabase
      .from("rewards")
      .insert(
        birthdayGifts.map((gift) => ({
          client_id: client.id,
          category_id: gift.categoryId,
          reward_type: `Birthday Gift - ${gift.name} - Sent by ${sourceName}`,
          status: "available",
          earned_at: now,
          expires_at: expiryDate,
        })),
      )
      .select("*");

    if (error) {
      flash(error.message, "error");
      return false;
    }

    const createdRewards = (data ?? []) as Reward[];
    if (createdRewards.length > 0) {
      setGiftRows((current) => [...createdRewards, ...current]);
    }

    flash("Birthday gifts sent.");
    return true;
  }

  function requestBirthdayGift(row: BirthdayRow) {
    if (row.giftStatus !== "Not Sent") {
      flash("Birthday gifts already sent.", "error");
      return;
    }

    setBirthdayGiftConfirmRows([row]);
  }

  function requestSelectedBirthdayGifts() {
    const selectedRows = filteredBirthdayRows.filter((row) =>
      selectedBirthdayRowIds.includes(row.id),
    );

    if (selectedRows.length === 0) {
      flash("Select at least one birthday row.", "error");
      return;
    }

    const rowsToSend = selectedRows.filter((row) => row.giftStatus === "Not Sent");

    if (rowsToSend.length === 0) {
      flash("Selected rows already have birthday gifts.", "error");
      return;
    }

    setBirthdayGiftConfirmRows(rowsToSend);
  }

  async function confirmBirthdayGiftSend() {
    const rowsToSend = birthdayGiftConfirmRows ?? [];
    setBirthdayGiftConfirmRows(null);

    if (rowsToSend.length === 0) return;

    let sentCount = 0;

    for (const row of rowsToSend) {
      if (row.giftStatus !== "Not Sent") continue;
      const sent = await sendBirthdayGift(row);
      if (sent) sentCount += 1;
    }

    setSelectedBirthdayRowIds([]);
    setLastSelectedBirthdayIndex(null);

    if (sentCount > 0) {
      flash(`Birthday gifts sent to ${sentCount} customer${sentCount === 1 ? "" : "s"}.`);
    } else {
      flash("No birthday gifts were sent. Selected rows may already have gifts or no linked loyalty account.", "error");
    }
  }


  function openBirthdayCreateModal() {
    setBirthdayCreateName("");
    setBirthdayCreatePhone("");
    setBirthdayCreateDate("");
    setBirthdayCreateOpen(true);
  }

  async function saveManualBirthdayDatasheetRow() {
    const name = birthdayCreateName.trim();
    const phone = birthdayCreatePhone.trim();
    const birthday = birthdayCreateDate.trim();

    if (!name) {
      flash("Add the customer name.", "error");
      return;
    }

    if (!birthday) {
      flash("Add the birthday date.", "error");
      return;
    }

    setBirthdayCreateSaving(true);

    try {
      const response = await fetch("/api/admin/birthday-datasheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, birthday }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Could not add birthday row.",
        );
      }

      const row = payload?.row as BirthdayDatasheetEntry | undefined;
      if (row) {
        setBirthdayDatasheetRows((current) => [row, ...current]);
      }

      setBirthdayCreateOpen(false);
      setBirthdayCreateName("");
      setBirthdayCreatePhone("");
      setBirthdayCreateDate("");
      flash("Birthday added to datasheet.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not add birthday row.", "error");
    } finally {
      setBirthdayCreateSaving(false);
    }
  }


  function requestSelectedBirthdayDelete() {
    const selectedRows = filteredBirthdayRows.filter((row) =>
      selectedBirthdayRowIds.includes(row.id),
    );

    if (selectedRows.length === 0) {
      flash("Select at least one birthday row.", "error");
      return;
    }

    setBirthdayDeleteConfirmRows(selectedRows);
  }

  async function confirmBirthdayDelete() {
    const rowsToDelete = birthdayDeleteConfirmRows ?? [];
    setBirthdayDeleteConfirmRows(null);

    if (rowsToDelete.length === 0) return;

    const deleteItems = rowsToDelete
      .map((row) => ({
        id: row.sourceId,
        source: row.source,
      }))
      .filter((row): row is { id: string; source: BirthdayRow["source"] } =>
        Boolean(row.id),
      );

    if (deleteItems.length === 0) {
      flash("No saved database rows were found for the selected birthdays.", "error");
      return;
    }

    try {
      const response = await fetch("/api/admin/birthdays/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: deleteItems }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Could not delete selected birthdays.",
        );
      }

      const datasheetIds = new Set(
        deleteItems
          .filter((item) => item.source === "Datasheet")
          .map((item) => item.id),
      );
      const commentIds = new Set(
        deleteItems
          .filter((item) => item.source === "Comment Cards")
          .map((item) => item.id),
      );
      const loyaltyIds = new Set(
        deleteItems
          .filter((item) => item.source === "Loyalty")
          .map((item) => item.id),
      );

      if (datasheetIds.size > 0) {
        setBirthdayDatasheetRows((current) =>
          current.filter((item) => !item.id || !datasheetIds.has(String(item.id))),
        );
      }

      if (commentIds.size > 0) {
        setCommentCards((current) =>
          current.map((card) =>
            commentIds.has(card.id) ? { ...card, birthday: null } : card,
          ),
        );
      }

      if (loyaltyIds.size > 0) {
        setUsers((current) =>
          current.map((user) =>
            loyaltyIds.has(user.id)
              ? ({
                  ...user,
                  birthday: null,
                  birth_date: null,
                  date_of_birth: null,
                  dob: null,
                } as AdminUser)
              : user,
          ),
        );
      }

      setSelectedBirthdayRowIds([]);
      setLastSelectedBirthdayIndex(null);

      const deletedCount = Number(payload?.deleted_count) || deleteItems.length;
      flash(`Deleted ${deletedCount} birthday record${deletedCount === 1 ? "" : "s"}.`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not delete birthdays.", "error");
    }
  }

  function openBirthdayWhatsApp(row: BirthdayRow) {
    if (!row.phone) {
      flash("No phone number found.", "error");
      return;
    }

    const message = desktopBirthdayGiftMessage(
      row.name,
      row.giftName === "—" ? "a special gift" : row.giftName,
    );
    const url = `${commentCardWhatsappUrl(row.phone)}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function toggleBirthdayRowSelection(rowId: string, index: number, shiftKey: boolean) {
    setSelectedBirthdayRowIds((current) => {
      if (shiftKey && lastSelectedBirthdayIndex !== null) {
        const start = Math.min(lastSelectedBirthdayIndex, index);
        const end = Math.max(lastSelectedBirthdayIndex, index);
        const rangeIds = filteredBirthdayRows.slice(start, end + 1).map((row) => row.id);
        return Array.from(new Set([...current, ...rangeIds]));
      }

      return current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId];
    });

    setLastSelectedBirthdayIndex(index);
  }

  function toggleAllBirthdayRows() {
    const visibleIds = filteredBirthdayRows.map((row) => row.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedBirthdayRowIds.includes(id));

    setSelectedBirthdayRowIds(allSelected ? [] : visibleIds);
    setLastSelectedBirthdayIndex(null);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function predictionLinkFor(code: string) {
    const publicUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://www.proscafe.net";

    return `${publicUrl.replace(/\/$/, "")}/predict/${code}`;
  }

  function setGameKickoffWithDefaultWindow(value: string) {
    setGameForm((current) => {
      if (!value) {
        return { ...current, kickoff_at: "", opens_at: "", closes_at: "" };
      }

      const kickoff = new Date(value);
      if (Number.isNaN(kickoff.getTime())) {
        return { ...current, kickoff_at: value };
      }

      const formatLocalDateTime = (date: Date) => {
        const pad = (number: number) => String(number).padStart(2, "0");

        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };

      return {
        ...current,
        kickoff_at: value,
        opens_at: formatLocalDateTime(
          new Date(kickoff.getTime() - 20 * 60 * 1000),
        ),
        closes_at: formatLocalDateTime(
          new Date(kickoff.getTime() + 10 * 60 * 1000),
        ),
      };
    });
  }

  const gameTournamentOptions = useMemo(
    () => predictionTournaments.filter((tournament) => tournament.sport_type === gameKind),
    [gameKind, predictionTournaments],
  );

  useEffect(() => {
    if (!gameForm.tournament_id) return;
    const selected = predictionTournaments.find((tournament) => tournament.id === gameForm.tournament_id);
    if (selected && selected.sport_type === gameKind) return;
    setGameForm((current) => ({ ...current, tournament_id: "" }));
  }, [gameForm.tournament_id, gameKind, predictionTournaments]);

  async function copyGamePredictionLink(code: string) {
    await navigator.clipboard.writeText(predictionLinkFor(code));
    flash("Game link copied.");
  }

  async function downloadGameQr(code: string, title: string) {
    const link = predictionLinkFor(code);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(link)}`;

    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = `${title}-qr.png`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      flash("QR downloaded.");
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
      flash("QR opened.");
    }
  }

  async function refreshPredictionTournaments() {
    try {
      const response = await fetch("/api/admin/prediction-tournaments", { method: "GET" });
      const text = await response.text();
      const json = text
        ? (JSON.parse(text) as {
            tournaments?: Array<{ id: string; name: string; sport_type: "football" | "basketball"; created_at?: string | null }>;
            error?: string;
          })
        : {};

      if (!response.ok) {
        flash(json.error ?? "Could not load tournaments.", "error");
        return;
      }

      setPredictionTournaments(json.tournaments ?? []);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not load tournaments.", "error");
    }
  }

  async function createPredictionTournament() {
    const name = tournamentForm.name.trim();
    if (!name) {
      flash("Tournament name is required.", "error");
      return;
    }

    setTournamentSaving(true);
    try {
      const response = await fetch("/api/admin/prediction-tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sport_type: tournamentForm.sport_type }),
      });
      const text = await response.text();
      const json = text ? (JSON.parse(text) as { tournament?: { id: string; name: string; sport_type: "football" | "basketball" }; error?: string }) : {};

      if (!response.ok || !json.tournament) {
        flash(json.error ?? "Could not create tournament.", "error");
        return;
      }

      setPredictionTournaments((current) => [json.tournament!, ...current]);
      setTournamentForm({ name: "", sport_type: tournamentForm.sport_type });
      flash("Tournament created.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not create tournament.", "error");
    } finally {
      setTournamentSaving(false);
    }
  }

  async function deletePredictionTournament(id: string) {
    try {
      const response = await fetch(`/api/admin/prediction-tournaments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const text = await response.text();
      const json = text ? (JSON.parse(text) as { success?: boolean; error?: string }) : {};

      if (!response.ok || !json.success) {
        flash(json.error ?? "Could not delete tournament.", "error");
        return;
      }

      setPredictionTournaments((current) => current.filter((tournament) => tournament.id !== id));
      setTournamentDeleteId(null);
      setGameForm((current) => current.tournament_id === id ? { ...current, tournament_id: "" } : current);
      setGameTournamentFilter((current) => current === id ? "all" : current);
      await refreshDesktopGameLinks();
      flash("Tournament deleted.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not delete tournament.", "error");
    }
  }

  async function refreshDesktopGameLinks() {
    try {
      const response = await fetch("/api/admin/prediction-matches", {
        method: "GET",
      });
      const text = await response.text();
      const json = text
        ? (JSON.parse(text) as {
            matches?: Array<{
              id: string;
              sport_type?: string | null;
              tournament_id?: string | null;
              tournament_name?: string | null;
              prediction_tournaments?: { id?: string | null; name?: string | null } | null;
              home_team: string | null;
              away_team: string | null;
              secret_code: string;
              match_label: string | null;
              kickoff_at: string | null;
              opens_at?: string | null;
              closes_at?: string | null;
              is_active?: boolean | null;
              entries_count?: number | null;
            }>;
            error?: string;
          })
        : {};

      if (!response.ok) {
        flash(json.error ?? "Could not load game links.", "error");
        return;
      }

      const nowMs = Date.now();

      setCreatedGameLinks(
        (json.matches ?? []).map((match) => {
          const openMs = new Date(match.opens_at ?? "").getTime();
          const closeMs = new Date(match.closes_at ?? "").getTime();

          const status =
            match.is_active === false
              ? "Closed"
              : Number.isFinite(openMs) && nowMs < openMs
                ? "Scheduled"
                : Number.isFinite(closeMs) && nowMs > closeMs
                  ? "Closed"
                  : "Open";

          return {
            id: match.id,
            title: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
            code: match.secret_code,
            sport:
              inferPredictionSportType(match) === "basketball"
                ? "Basketball"
                : "Football",
            matchLabel:
              match.match_label ||
              (match.sport_type === "basketball" ? "Basket" : "World Cup"),
            kickoff: match.kickoff_at ?? null,
            opensAt: match.opens_at ?? null,
            closesAt: match.closes_at ?? null,
            status,
            players: Number(match.entries_count ?? 0),
            tournamentId: match.tournament_id ?? match.prediction_tournaments?.id ?? null,
            tournamentName: match.tournament_name ?? match.prediction_tournaments?.name ?? null,
          };
        }),
      );
    } catch (error) {
      flash(
        error instanceof Error ? error.message : "Could not load game links.",
        "error",
      );
    }
  }

  async function createGameLinkFromDesktop() {
    if (!gameForm.home_team.trim() || !gameForm.away_team.trim()) {
      flash("Add both teams first.", "error");
      return;
    }

    setGameSaving(true);

    const payload =
      gameKind === "basketball"
        ? {
            ...gameForm,
            tournament_id: gameForm.tournament_id || null,
            sport_type: "basketball",
            match_label: gameForm.match_label.trim() || "Basket",
            venue:
              gameForm.venue.trim() ||
              "Basketball rule: client chooses the winner, with bonus for exact win margin.",
            home_score: "",
            away_score: "",
          }
        : {
            ...gameForm,
            tournament_id: gameForm.tournament_id || null,
            sport_type: "football",
            match_label: gameForm.match_label.trim() || "World Cup",
            home_score: "",
            away_score: "",
          };

    try {
      const response = await fetch("/api/admin/prediction-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withPredictionDatePayload(payload)),
      });

      const text = await response.text();
      const json = text
        ? (JSON.parse(text) as {
            match?: {
              id: string;
              home_team: string;
              away_team: string;
              secret_code: string;
            };
            error?: string;
          })
        : {};

      if (!response.ok || !json.match) {
        flash(json.error ?? "Could not create game link.", "error");
        return;
      }
      await refreshDesktopGameLinks();

      setGameForm({
        home_team: "",
        away_team: "",
        venue: "",
        match_label: "",
        tournament_id: "",
        kickoff_at: "",
        opens_at: "",
        closes_at: "",
        home_score: "",
        away_score: "",
        basketball_winner: "home",
        basketball_win_by: "",
      });

      flash("Game link created.");
    } catch (error) {
      flash(
        error instanceof Error ? error.message : "Could not create game link.",
        "error",
      );
    } finally {
      setGameSaving(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAdminData() {
      const [
        txnResult,
        rewardResult,
        categoryResult,
        commentCardResult,
        birthdayDatasheetResult,
        pendingCommentGiftResult,
        clientStampResult,
      ] = await Promise.all([
        supabase
          .from("stamp_transactions")
          .select("*")
          .neq("action_type", "manual_adjustment")
          .order("created_at", { ascending: false })
          .limit(250),

        supabase
          .from("rewards")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(250),

        supabase.from("loyalty_categories").select("id, name, average_price"),

        supabase
          .from("comment_cards")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300),

        fetch("/api/admin/birthday-datasheet", { cache: "no-store" })
          .then(async (response) => {
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
              return {
                data: null,
                error: new Error(
                  typeof payload?.error === "string"
                    ? payload.error
                    : "Could not load birthday datasheet.",
                ),
              };
            }

            return {
              data: Array.isArray(payload?.rows) ? payload.rows : [],
              error: null,
            };
          })
          .catch((error) => ({
            data: null,
            error: error instanceof Error ? error : new Error("Could not load birthday datasheet."),
          })),

        supabase
          .from("pending_comment_card_rewards")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(250),

        supabase
          .from("client_stamps")
          .select("id, client_id, category_id, stamp_count, updated_at"),
      ]);

      if (!isMounted) return;

      const txns = ((txnResult.data ?? []) as StampTransaction[]).filter(
        (txn) => txn.action_type !== "manual_adjustment",
      );

      setActivityTxns(txns);

      const rewards = (rewardResult.data ?? []) as Reward[];

      if (rewardResult.data) {
        setGiftRows(rewards);
      }

      const categoryNames: Record<string, string> = {};
      const categoryPrices: Record<string, number> = {};
      const categoryPricesByName: Record<string, number> = {};

      ((categoryResult.data ?? []) as AdminCategory[]).forEach((category) => {
        const categoryName =
          category.name === "Desserts 2" ? "Hooka" : category.name;
        const categoryPrice = parseMoneyValue(category.average_price);

        categoryNames[category.id] = categoryName;
        categoryPrices[category.id] = categoryPrice;
        categoryPricesByName[categoryName.toLowerCase()] = categoryPrice;
      });

      setCategoryNamesById(categoryNames);
      setCategoryAveragePriceById(categoryPrices);
      setCategoryAveragePriceByName(categoryPricesByName);
      setDesktopGiftCategories((categoryResult.data ?? []) as AdminCategory[]);

      if (commentCardResult.data) {
        setCommentCards(
          (commentCardResult.data ?? []) as unknown as CommentCardEntry[],
        );
      }

      if (birthdayDatasheetResult.data) {
        setBirthdayDatasheetRows(
          (birthdayDatasheetResult.data ?? []) as unknown as BirthdayDatasheetEntry[],
        );
      }

      if (birthdayDatasheetResult.error) {
        console.error("Could not load birthday_datasheet", birthdayDatasheetResult.error);
      }

      if (pendingCommentGiftResult.data) {
        setPendingCommentCardGifts(
          (pendingCommentGiftResult.data ??
            []) as unknown as PendingCommentCardReward[],
        );
      }

      if (clientStampResult.data) {
        setDesktopClientStamps(
          (clientStampResult.data ?? []) as unknown as AdminClientStamp[],
        );
      }

      void refreshDesktopGameLinks();
      void refreshPredictionTournaments();

      const ids = Array.from(
        new Set(
          [
            ...txns.flatMap((txn) => [txn.client_id, txn.staff_id]),
            ...rewards.flatMap((reward) => [
              reward.client_id,
              reward.redeemed_by,
            ]),
            ...(
              (pendingCommentGiftResult.data ??
                []) as PendingCommentCardReward[]
            )
              .filter((gift) => gift.client_id)
              .map((gift) => gift.client_id),
          ].filter((id): id is string => Boolean(id)),
        ),
      );

      if (ids.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, full_name, email, client_code")
          .in("id", ids);

        if (!isMounted) return;

        const names: Record<string, string> = {};

        (profileRows ?? []).forEach((row: any) => {
          names[row.id] =
            row.full_name || row.email || row.client_code || "Unknown";
        });

        setProfileNamesById(names);
      } else {
        setProfileNamesById({});
      }
    }

    void loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!reportFiltersOpen) return;

    function closeReportFilter(event: MouseEvent | TouchEvent) {
      if (!reportFilterRef.current) return;
      if (reportFilterRef.current.contains(event.target as Node)) return;
      setReportFiltersOpen(false);
    }

    document.addEventListener("mousedown", closeReportFilter);
    document.addEventListener("touchstart", closeReportFilter);

    return () => {
      document.removeEventListener("mousedown", closeReportFilter);
      document.removeEventListener("touchstart", closeReportFilter);
    };
  }, [reportFiltersOpen]);

  async function setRole(userId: string, role: UserRole) {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, role } : user)),
    );

    if (selectedUser?.id === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, role } : prev));
    }

    flash("Role updated.");
  }

  async function deactivateUser(userId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", userId);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, is_active: false } : user,
      ),
    );

    if (selectedUser?.id === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, is_active: false } : prev));
    }

    flash("Account deactivated.");
  }

  async function reactivateUser(userId: string, role: UserRole) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: true, role })
      .eq("id", userId);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, is_active: true, role } : user,
      ),
    );

    if (selectedUser?.id === userId) {
      setSelectedUser((prev) =>
        prev ? { ...prev, is_active: true, role } : prev,
      );
    }

    flash("Account reactivated.");
  }

  async function openUserProfile(user: AdminUser) {
    setSelectedUser(user);
    setSelectedLoading(true);
    setSelectedCategories([]);
    setSelectedStamps([]);
    setSelectedRewards([]);

    try {
      const [categoryResult, stampResult, rewardResult] = await Promise.all([
        supabase
          .from("loyalty_categories")
          .select("id, name, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),

        supabase
          .from("client_stamps")
          .select("id, client_id, category_id, stamp_count, updated_at")
          .eq("client_id", user.id),

        supabase
          .from("rewards")
          .select("*")
          .eq("client_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (categoryResult.error) {
        flash(categoryResult.error.message, "error");
      }

      if (stampResult.error) {
        flash(stampResult.error.message, "error");
      }

      if (rewardResult.error) {
        flash(rewardResult.error.message, "error");
      }

      setSelectedCategories((categoryResult.data ?? []) as AdminCategory[]);
      setSelectedStamps((stampResult.data ?? []) as AdminClientStamp[]);
      setSelectedRewards((rewardResult.data ?? []) as Reward[]);
    } finally {
      setSelectedLoading(false);
    }
  }

  async function addStampToSelectedClient(categoryId: string) {
    if (!selectedUser) return;

    const currentRow = selectedStamps.find(
      (stamp) => stamp.category_id === categoryId,
    );
    const currentCount = Math.max(0, currentRow?.stamp_count ?? 0);
    const nextCount = Math.min(currentCount + 1, 5);

    setSelectedLoading(true);

    const stampError = currentRow
      ? (
          await supabase
            .from("client_stamps")
            .update({
              stamp_count: nextCount,
              updated_at: new Date().toISOString(),
            })
            .eq("client_id", selectedUser.id)
            .eq("category_id", categoryId)
        ).error
      : (
          await supabase.from("client_stamps").insert({
            client_id: selectedUser.id,
            category_id: categoryId,
            stamp_count: nextCount,
            updated_at: new Date().toISOString(),
          })
        ).error;

    if (stampError) {
      flash(stampError.message, "error");
      setSelectedLoading(false);
      return;
    }

    await supabase.from("stamp_transactions").insert({
      client_id: selectedUser.id,
      category_id: categoryId,
      action_type: "add_stamp",
      stamp_count: 1,
      staff_id: profile.id,
      created_at: new Date().toISOString(),
    });

    if (nextCount >= 5) {
      const categoryName =
        selectedCategories
          .find((category) => category.id === categoryId)
          ?.name?.toLowerCase() ?? "";

      const rewardType = categoryName.includes("sandwich")
        ? "Free Sandwich"
        : categoryName.includes("main")
          ? "Free Main Course"
          : categoryName.includes("dessert")
            ? "Free Dessert"
            : categoryName.includes("coffee")
              ? "Free Coffee"
              : categoryName.includes("hooka") ||
                  categoryName.includes("hookah")
                ? "Free Hooka"
                : "Free Reward";

      const { error: rewardError } = await supabase.from("rewards").insert({
        client_id: selectedUser.id,
        category_id: categoryId,
        reward_type: rewardType,
        status: "available",
        earned_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });

      if (rewardError) {
        flash(rewardError.message, "error");
        setSelectedLoading(false);
        return;
      }

      await supabase
        .from("client_stamps")
        .update({
          stamp_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("client_id", selectedUser.id)
        .eq("category_id", categoryId);

      await supabase.from("stamp_transactions").insert({
        client_id: selectedUser.id,
        category_id: categoryId,
        action_type: "reward_earned",
        stamp_count: 5,
        staff_id: profile.id,
        created_at: new Date().toISOString(),
      });

      flash("Gift earned.");
      await refreshDesktopClientStamps();
      await openUserProfile(selectedUser);
      return;
    }

    flash("Stamp added.");
    await refreshDesktopClientStamps();
    await openUserProfile(selectedUser);
  }

  async function removeStampFromSelectedClient(categoryId: string) {
    if (!selectedUser) return;

    const currentRow = selectedStamps.find(
      (stamp) => stamp.category_id === categoryId,
    );
    const currentCount = Math.max(0, currentRow?.stamp_count ?? 0);

    if (!currentRow || currentCount <= 0) {
      flash("No stamp to remove.", "error");
      return;
    }

    setSelectedLoading(true);

    const nextCount = Math.max(0, currentCount - 1);

    const { error } = await supabase
      .from("client_stamps")
      .update({
        stamp_count: nextCount,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", selectedUser.id)
      .eq("category_id", categoryId);

    if (error) {
      flash(error.message, "error");
      setSelectedLoading(false);
      return;
    }

    flash("Stamp removed.");
    await refreshDesktopClientStamps();
    await openUserProfile(selectedUser);
  }

  async function sendGiftToSelectedClient(gift: string, description: string) {
    if (!selectedUser) return;

    const giftName = gift.trim();
    const giftDescription = description.trim();

    if (!giftName) {
      flash("Gift is required.", "error");
      return;
    }

    const matchedCategory =
      selectedCategories.find((category) => {
        const categoryName = category.name.toLowerCase();
        const rewardName = giftName.toLowerCase();

        return (
          rewardName.includes(categoryName) ||
          categoryName.includes(rewardName) ||
          (rewardName.includes("hooka") && categoryName.includes("hooka")) ||
          (rewardName.includes("hookah") && categoryName.includes("hooka")) ||
          (rewardName.includes("dessert") &&
            categoryName.includes("dessert")) ||
          (rewardName.includes("sandwich") &&
            categoryName.includes("sandwich")) ||
          (rewardName.includes("coffee") && categoryName.includes("coffee")) ||
          (rewardName.includes("main") && categoryName.includes("main"))
        );
      }) ?? selectedCategories[0];

    if (!matchedCategory?.id) {
      flash("No loyalty category found for this gift.", "error");
      return;
    }

    setSelectedLoading(true);

    const selectedSourceName = shortName(
      profile.full_name || profile.email || "Admin",
    );
    const rewardType = giftDescription
      ? `Sent Gift - ${giftName} - Sent by ${selectedSourceName} - ${giftDescription}`
      : `Sent Gift - ${giftName} - Sent by ${selectedSourceName}`;

    const { error } = await supabase.from("rewards").insert({
      client_id: selectedUser.id,
      category_id: matchedCategory.id,
      reward_type: rewardType,
      status: "available",
      earned_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) {
      flash(error.message, "error");
      setSelectedLoading(false);
      return;
    }

    flash("Gift sent.");
    await openUserProfile(selectedUser);
  }

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesFilter = filter === "all" ? true : user.role === filter;
      const createdAt = (
        user as unknown as AdminUser & { created_at?: string | null }
      ).created_at;
      const matchesTime = isWithinDesktopTimeRange(createdAt, timeRange);

      if (!matchesFilter || !matchesTime) return false;
      if (!search) return true;

      return [
        user.full_name,
        user.email,
        user.phone,
        user.client_code,
        desktopRoleLabel(user.role),
        user.is_active === false ? "deactivated inactive" : "active",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [users, filter, searchTerm, timeRange]);

  const visibleUsers = useMemo(
    () => filteredUsers.slice(0, visibleUserCount),
    [filteredUsers, visibleUserCount],
  );

  const visibleActivityTxns = useMemo(() => {
    return activityTxns.filter((txn) => {
      if (txn.action_type === "manual_adjustment") return false;
      return isWithinDesktopTimeRange(txn.created_at, timeRange);
    });
  }, [activityTxns, timeRange]);

  const desktopStampDeltaForTransaction = (txn: StampTransaction) => {
    const record = txn as unknown as Record<string, unknown>;
    const rawCount = Number(
      record.stamp_count ?? record.stamps ?? record.quantity ?? record.amount ?? 1,
    );
    const count = Number.isFinite(rawCount) ? Math.max(1, Math.abs(rawCount)) : 1;
    const actionType = String(record.action_type ?? "").toLowerCase();

    if (actionType.includes("remove")) return -count;
    if (actionType.includes("add")) return count;
    return 0;
  };

  const visibleStampsIssued = visibleActivityTxns.reduce(
    (sum, txn) => sum + desktopStampDeltaForTransaction(txn),
    0,
  );

  const pendingGiftRowsForDashboard = useMemo(() => {
    return pendingCommentCardGifts.map(
      (gift) =>
        ({
          id: `pending-comment-card-${gift.id}`,
          client_id: gift.client_id || `pending-comment-card-${gift.id}`,
          category_id: gift.category_id,
          reward_type: gift.reward_type,
          status: gift.status || "pending",
          earned_at: gift.earned_at || gift.created_at,
          expires_at: gift.expires_at,
          created_at: gift.created_at,
          updated_at: gift.updated_at,
          redeemed_at: null,
          redeemed_by: null,
          __pending_comment_card: true,
          __pending_id: gift.id,
          __pending_full_name: gift.full_name || "Guest",
          __pending_phone: gift.phone,
          __pending_status: gift.status,
        }) as unknown as PendingCommentCardGiftRow,
    );
  }, [pendingCommentCardGifts]);

  const allGiftRowsForDashboard = useMemo(
    () => [...giftRows, ...pendingGiftRowsForDashboard],
    [giftRows, pendingGiftRowsForDashboard],
  );

  const visibleGiftRows = useMemo(() => {
    return allGiftRowsForDashboard.filter((reward) =>
      isWithinDesktopTimeRange(
        reward.earned_at ?? reward.created_at,
        timeRange,
      ),
    );
  }, [allGiftRowsForDashboard, timeRange]);

  const currentTotalStamps = desktopClientStamps.reduce(
    (sum, stamp) => sum + Math.max(0, Number(stamp.stamp_count) || 0),
    0,
  );
  const dashboardTotalStamps =
    timeRange === "all" ? currentTotalStamps : visibleStampsIssued;
  const totalClientProfiles = users.filter(
    (user) => user.role === "client",
  ).length;

  const activeCustomers = useMemo(
    () => desktopUniqueCount(visibleActivityTxns.map((txn) => txn.client_id)),
    [visibleActivityTxns],
  );

  const repeatCustomers = useMemo(() => {
    const counts = new Map<string, number>();

    visibleActivityTxns.forEach((txn) => {
      if (!txn.client_id) return;
      counts.set(txn.client_id, (counts.get(txn.client_id) ?? 0) + 1);
    });

    return Array.from(counts.values()).filter((count) => count > 1).length;
  }, [visibleActivityTxns]);

  const averageStampsPerCustomer = useMemo(() => {
    if (!totalClientProfiles) return "0";
    return (currentTotalStamps / totalClientProfiles).toFixed(1);
  }, [currentTotalStamps, totalClientProfiles]);

  const redemptionRate = useMemo(
    () =>
      desktopPercentage(
        desktopSafeRatio(metrics.rewardsRedeemed, metrics.rewardsEarned),
      ),
    [metrics.rewardsEarned, metrics.rewardsRedeemed],
  );

  const topReward = useMemo(
    () => desktopGetTopReward(visibleGiftRows),
    [visibleGiftRows],
  );
  const mostActiveCustomer = useMemo(
    () => desktopGetMostActiveCustomer(users, visibleActivityTxns),
    [visibleActivityTxns, users],
  );

  const totalUsers = users.length;
  const totalStaff = users.filter((user) => user.role === "staff").length;
  const totalAdmins = users.filter(
    (user) => user.role === "master_admin",
  ).length;
  const totalDeactivated = users.filter(
    (user) => user.is_active === false,
  ).length;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(now.getDate() - daysFromMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const newUsersThisMonth = users.filter((user) => {
    const createdAt = new Date(
      String(
        (user as unknown as AdminUser & { created_at?: string | null })
          .created_at ?? "",
      ),
    );
    return !Number.isNaN(createdAt.getTime()) && createdAt >= startOfMonth;
  }).length;

  const newUsersThisWeek = users.filter((user) => {
    const createdAt = new Date(
      String(
        (user as unknown as AdminUser & { created_at?: string | null })
          .created_at ?? "",
      ),
    );
    return !Number.isNaN(createdAt.getTime()) && createdAt >= startOfWeek;
  }).length;

  const monthlyActiveUsers = activeCustomers;
  const latestActivities = visibleActivityTxns.slice(0, 5);
  const latestGifts = visibleGiftRows.slice(0, 50);
  const recentRewardClients = desktopUniqueCount(
    visibleGiftRows.map((reward) => reward.client_id),
  );

  function desktopDaysAgo(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    const startToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const startDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
    return Math.max(
      0,
      Math.floor((startToday - startDate) / (24 * 60 * 60 * 1000)),
    );
  }

  function activityDaysBadgeClass(days: number | null) {
    if (days === null) return "bg-white/12 text-white/46";
    if (days <= 7) return "bg-emerald-400/18 text-emerald-100";
    if (days <= 14) return "bg-[#ffd66b]/22 text-[#ffd66b]";
    if (days <= 30) return "bg-orange-400/20 text-orange-200";
    return "bg-red-500/18 text-red-200";
  }

  function activityDaysLabel(days: number | null) {
    return days === null ? "—" : `${days}d`;
  }

  function rewardIssueDate(reward: Reward) {
    return reward.earned_at ?? reward.created_at ?? null;
  }

  function rewardExpiryDate(reward: Reward) {
    const record = reward as unknown as Record<string, unknown>;
    const storedExpiry =
      typeof record.expires_at === "string" ? record.expires_at : "";

    if (storedExpiry) return storedExpiry;

    const issue = rewardIssueDate(reward);
    if (!issue) return null;

    const date = new Date(issue);
    if (Number.isNaN(date.getTime())) return null;

    date.setDate(date.getDate() + 30);
    return date.toISOString();
  }

  function rewardTypeInfo(reward: Reward) {
    const record = reward as PendingCommentCardGiftRow;
    const text = String(reward.reward_type || "");
    const lower = text.toLowerCase();
    const sentByMatch = text.match(/sent by\s+([^·-]+)/i);
    const issuedBy =
      sentByMatch?.[1]?.trim() ||
      shortName(profile.full_name || profile.email || "Admin");

    if (record.__pending_comment_card) {
      return { type: "Sent Gift", source: "Comment Cards", issuedBy };
    }

    if (lower.includes("comment card")) {
      return { type: "Sent Gift", source: "Comment Cards", issuedBy };
    }

    if (lower.includes("prediction") || lower.includes("winner in")) {
      return { type: "Sent Gift", source: "Games", issuedBy };
    }

    if (lower.includes("birthday")) {
      return { type: "Birthday", source: "System", issuedBy: "System" };
    }

    if (
      lower.includes("sent gift") ||
      lower.includes("sent by") ||
      lower.includes("discount")
    ) {
      return { type: "Sent Gift", source: "User", issuedBy };
    }

    return { type: "Loyalty", source: "System", issuedBy: "System" };
  }

  function giftClientName(reward: Reward) {
    const record = reward as PendingCommentCardGiftRow;

    if (record.__pending_comment_card) {
      const name = String(record.__pending_full_name || "Guest").trim();
      const phone = String(record.__pending_phone || "").trim();

      if (name && phone) return `${name} · ${phone}`;
      if (name) return name;
      if (phone) return phone;
      return "Pending guest";
    }

    return profileNamesById[reward.client_id] ?? "Client";
  }

  function giftMemberSince(reward: Reward) {
    if (!reward.client_id) return null;
    return users.find((item) => item.id === reward.client_id)?.created_at ?? null;
  }

  function giftDisplayName(reward: Reward) {
    const rawName = String(reward.reward_type || "Gift")
      .replace(/^Sent Gift\s*[-·:]\s*/i, "")
      .replace(/^Birthday Gift\s*[-·:]\s*/i, "")
      .replace(/\s*[-·]\s*Sent by\s+.*$/i, "")
      .replace(/\s*[-·]\s*Source\s+.*$/i, "")
      .replace(/\s*[-·]\s*Winner\s+in\s+.*$/i, "")
      .replace(/\s*[-·]\s*Comment\s+Card.*$/i, "")
      .replace(/\s*[-·]\s*Basketball\s+Prediction.*$/i, "")
      .replace(/\s*[-·]\s*Football\s+Prediction.*$/i, "")
      .trim();

    const cleanName = rawName.split(/\s*[-·]\s*/)[0]?.trim() || "Gift";

    return desktopNormalizeRewardText(cleanName);
  }

  function giftWhatsappUrl(reward: Reward) {
    const record = reward as PendingCommentCardGiftRow;

    if (record.__pending_comment_card) {
      return commentCardWhatsappUrl(record.__pending_phone);
    }

    const user = users.find((item) => item.id === reward.client_id);
    return commentCardWhatsappUrl(user?.phone);
  }

  function giftContactKeys(reward: Reward) {
    const record = reward as PendingCommentCardGiftRow;

    if (record.__pending_comment_card) {
      return sharedContactKeys(
        record.__pending_phone || null,
        null,
        record.__pending_full_name || record.__pending_id || reward.id,
      );
    }

    const user = users.find((item) => item.id === reward.client_id);
    return sharedContactKeys(
      user?.phone || null,
      user?.email || null,
      user?.full_name || reward.client_id || reward.id,
    );
  }

  function markGiftContacted(reward: Reward) {
    const keys = giftContactKeys(reward);
    markSharedContacted(keys, "Gifts", reward.id);
  }

  function markCustomerContacted(user: AdminUser) {
    const keys = sharedContactKeys(
      user.phone,
      user.email,
      user.full_name || user.id,
    );
    markSharedContacted(keys, "Customer behavior", user.id);
  }

  async function deleteGiftReward(reward: Reward) {
    const record = reward as PendingCommentCardGiftRow;
    const confirmed = window.confirm(
      "Delete this gift from the customer? This action cannot be undone.",
    );

    if (!confirmed) return;

    if (record.__pending_comment_card && record.__pending_id) {
      const { error } = await supabase
        .from("pending_comment_card_rewards")
        .delete()
        .eq("id", record.__pending_id);

      if (error) {
        flash(error.message, "error");
        return;
      }

      setPendingCommentCardGifts((current) =>
        current.filter((gift) => gift.id !== record.__pending_id),
      );
      flash("Gift deleted.");
      return;
    }

    const { error } = await supabase
      .from("rewards")
      .delete()
      .eq("id", reward.id);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setGiftRows((current) => current.filter((gift) => gift.id !== reward.id));
    flash("Gift deleted.");
  }

  function giftLeftInfo(reward: Reward) {
    const expiry = rewardExpiryDate(reward);
    if (!expiry) return { leftDays: null, label: "—", status: "Available" };
    const days = desktopDaysUntil(expiry);

    if (days === null)
      return { leftDays: null, label: "—", status: "Available" };
    if (days < 0)
      return { leftDays: days, label: "Expired", status: "Expired" };
    if (days === 0)
      return { leftDays: days, label: "Today", status: "Expires Today" };
    if (days <= 7)
      return {
        leftDays: days,
        label: `${days}d`,
        status: "Expiring Soon",
      };
    return { leftDays: days, label: `${days}d`, status: "Available" };
  }

  function desktopDaysUntil(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    const startToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const startDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
    return Math.ceil((startDate - startToday) / (24 * 60 * 60 * 1000));
  }

  function giftStatusInfo(reward: Reward) {
    const record = reward as PendingCommentCardGiftRow;
    const rawStatus = String(reward.status || "").toLowerCase();

    if (record.__pending_comment_card && rawStatus === "pending") {
      return {
        label: "Pending Registration",
        className: "bg-[#ffd66b]/22 text-[#ffd66b]",
      };
    }

    if (
      rawStatus === "redeemed" ||
      rawStatus === "claimed" ||
      rawStatus === "used"
    ) {
      return { label: "Used", className: "bg-slate-400/18 text-slate-100" };
    }

    const expiry = giftLeftInfo(reward);

    if (expiry.status === "Expired")
      return { label: "Expired", className: "bg-red-500/18 text-red-200" };
    if (expiry.status === "Expires Today")
      return {
        label: "Expires Today",
        className: "bg-orange-400/20 text-orange-200",
      };
    if (expiry.status === "Expiring Soon")
      return {
        label: "Expiring Soon",
        className: "bg-[#ffd66b]/22 text-[#ffd66b]",
      };
    return {
      label: "Available",
      className: "bg-emerald-400/18 text-emerald-100",
    };
  }

  function matchesActivityGiftSearch(values: Array<string | null | undefined>) {
    const search = activityGiftSearch.trim().toLowerCase();
    if (!search) return true;
    return values.filter(Boolean).join(" ").toLowerCase().includes(search);
  }

  const filteredActivityRows = useMemo(() => {
    return visibleActivityTxns.filter((transaction) => {
      const clientName =
        profileNamesById[transaction.client_id ?? ""] ?? "Client";
      const actorName =
        profileNamesById[transaction.staff_id ?? ""] ||
        (transaction.staff_id ? "Staff user" : "System");
      const categoryName =
        categoryNamesById[transaction.category_id ?? ""] ||
        (transaction.action_type === "reward_redeemed" ? "Gift" : "—");

      return matchesActivityGiftSearch([
        clientName,
        actorName,
        categoryName,
        transaction.action_type,
      ]);
    });
  }, [
    activityGiftSearch,
    categoryNamesById,
    matchesActivityGiftSearch,
    profileNamesById,
    visibleActivityTxns,
  ]);

  const filteredGiftDashboardRows = useMemo(() => {
    return visibleGiftRows.filter((reward) => {
      const clientName = giftClientName(reward);
      const info = rewardTypeInfo(reward);
      const status = giftStatusInfo(reward);
      const name = giftDisplayName(reward);

      if (
        !matchesActivityGiftSearch([
          clientName,
          name,
          reward.reward_type,
          info.source,
          (reward as PendingCommentCardGiftRow).__pending_phone,
        ])
      )
        return false;

      if (giftFilter === "loyalty" && info.type !== "Loyalty") return false;
      if (giftFilter === "birthday" && info.type !== "Birthday") return false;
      if (giftFilter === "sent" && info.type !== "Sent Gift") return false;
      if (giftFilter === "comment_cards" && info.source !== "Comment Cards") return false;
      if (giftFilter === "games" && info.source !== "Games") return false;
      if (giftFilter === "available" && status.label !== "Available")
        return false;
      if (giftFilter === "used" && status.label !== "Used") return false;
      if (giftFilter === "expired" && status.label !== "Expired") return false;
      if (giftFilter === "expiring" && status.label !== "Expiring Soon")
        return false;
      if (giftFilter === "pending" && status.label !== "Pending Registration")
        return false;

      return true;
    });
  }, [
    activityGiftSearch,
    giftFilter,
    giftStatusInfo,
    matchesActivityGiftSearch,
    profileNamesById,
    rewardTypeInfo,
    visibleGiftRows,
  ]);

  function giftEstimatedValue(reward: Reward) {
    const record = reward as unknown as Record<string, unknown>;
    const categoryId =
      typeof record.category_id === "string" ? record.category_id : "";
    const rewardText = String(reward.reward_type ?? "").toLowerCase();

    if (categoryId && categoryAveragePriceById[categoryId] !== undefined) {
      return categoryAveragePriceById[categoryId] ?? 0;
    }

    for (const [categoryName, price] of Object.entries(
      categoryAveragePriceByName,
    )) {
      if (categoryName && rewardText.includes(categoryName)) return price;
    }

    return 0;
  }

  const giftDashboardSummary = useMemo(() => {
    const giftsSent = filteredGiftDashboardRows.length;
    const redeemed = filteredGiftDashboardRows.filter(
      (reward) => giftStatusInfo(reward).label === "Used",
    ).length;
    const giftValue = filteredGiftDashboardRows.reduce(
      (sum, reward) => sum + giftEstimatedValue(reward),
      0,
    );
    const expiredRows = filteredGiftDashboardRows.filter(
      (reward) => giftStatusInfo(reward).label === "Expired",
    );
    const expiredValue = expiredRows.reduce(
      (sum, reward) => sum + giftEstimatedValue(reward),
      0,
    );
    const discountsSent = filteredGiftDashboardRows.filter((reward) =>
      String(reward.reward_type ?? "")
        .toLowerCase()
        .includes("discount"),
    ).length;
    const expiringSoon = filteredGiftDashboardRows.filter(
      (reward) => giftStatusInfo(reward).label === "Expiring Soon",
    ).length;
    const pendingRegistration = filteredGiftDashboardRows.filter(
      (reward) => giftStatusInfo(reward).label === "Pending Registration",
    ).length;

    return {
      giftsSent,
      redeemed,
      giftValue,
      expiredCount: expiredRows.length,
      expiredValue,
      discountsSent,
      expiringSoon,
      pendingRegistration,
    };
  }, [
    categoryAveragePriceById,
    categoryAveragePriceByName,
    filteredGiftDashboardRows,
    giftEstimatedValue,
    giftStatusInfo,
  ]);


  const birthdayRows = useMemo<BirthdayRow[]>(() => {
    const clientByNormalizedPhone = new Map<string, AdminUser>();
    users.forEach((user) => {
      if (user.role !== "client" || user.is_active === false) return;
      const key = normalizePhoneForMatch(user.phone);
      if (key) clientByNormalizedPhone.set(key, user);
    });

    const birthdayRewardsForUser = (clientId: string) =>
      giftRows
        .filter((reward) => reward.client_id === clientId)
        .filter((reward) => rewardTypeInfo(reward).type === "Birthday")
        .slice()
        .sort(
          (a, b) =>
            new Date(rewardIssueDate(b) || 0).getTime() -
            new Date(rewardIssueDate(a) || 0).getTime(),
        );

    const birthdayGiftNameFromRewards = (rewards: Reward[]) => {
      if (rewards.length === 0) return "20% Discount + Free Dessert";

      const names = rewards
        .map((reward) => giftDisplayName(reward))
        .filter(Boolean);

      const uniqueNames = Array.from(new Set(names));
      return uniqueNames.length > 0 ? uniqueNames.join(" + ") : "20% Discount + Free Dessert";
    };

    const birthdayGiftStatusFromRewards = (rewards: Reward[]): BirthdayRow["giftStatus"] => {
      if (rewards.length === 0) return "Not Sent";

      const labels = rewards.map((reward) => giftStatusInfo(reward).label.toLowerCase());
      if (labels.length > 0 && labels.every((label) => label === "used")) return "Claimed";
      if (labels.some((label) => label === "expired")) return "Expired";
      return "Sent";
    };

    const lastVisitForUser = (clientId: string) =>
      activityTxns
        .filter((txn) => txn.client_id === clientId)
        .slice()
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
        )[0]?.created_at ?? null;

    const rowFromUser = (user: AdminUser): BirthdayRow | null => {
      const birthdayValue = getBirthdayValue(user);
      const birthdayInfo = getNextBirthdayInfo(birthdayValue);
      if (!birthdayInfo) return null;

      const birthdayRewards = birthdayRewardsForUser(user.id);
      const giftStatus = birthdayGiftStatusFromRewards(birthdayRewards);
      const giftName = birthdayGiftNameFromRewards(birthdayRewards);

      return {
        id: `loyalty-${user.id}`,
        source: "Loyalty",
        user,
        commentCard: null,
        name: user.full_name || user.email || "Customer",
        contact: user.phone || user.email || "—",
        phone: user.phone || "",
        email: user.email || "",
        birthdayValue,
        birthdayInfo,
        birthdayRewards,
        giftName,
        giftStatus,
        giftSentAt: birthdayRewards[0] ? rewardIssueDate(birthdayRewards[0]) : null,
        expiry: birthdayRewards[0] ? rewardExpiryDate(birthdayRewards[0]) : null,
        latestVisit: lastVisitForUser(user.id),
        memberSince: user.created_at ?? null,
        lastContactedKey: sharedContactKey(user.phone, user.email, user.full_name || user.id),
        lastContactedKeys: sharedContactKeys(user.phone, user.email, user.full_name || user.id),
        sourceId: user.id,
      };
    };

    const loyaltyRows = users
      .filter((user) => user.role === "client" && user.is_active !== false)
      .map(rowFromUser)
      .filter((row): row is BirthdayRow => Boolean(row));

    const commentRows = commentCards
      .map((card): BirthdayRow | null => {
        const birthdayInfo = getNextBirthdayInfo(card.birthday);
        if (!birthdayInfo) return null;

        const phoneKey = normalizePhoneForMatch(card.phone);
        const matchedUser = phoneKey ? clientByNormalizedPhone.get(phoneKey) ?? null : null;
        const birthdayRewards = matchedUser ? birthdayRewardsForUser(matchedUser.id) : [];
        const giftStatus = birthdayGiftStatusFromRewards(birthdayRewards);
        const giftName = birthdayGiftNameFromRewards(birthdayRewards);

        return {
          id: `comment-${card.id}`,
          source: "Comment Cards",
          user: matchedUser,
          commentCard: card,
          name: card.full_name || matchedUser?.full_name || "Guest",
          contact: card.phone || matchedUser?.email || "—",
          phone: card.phone || matchedUser?.phone || "",
          email: matchedUser?.email || "",
          birthdayValue: card.birthday ?? null,
          birthdayInfo,
          birthdayRewards,
          giftName,
          giftStatus,
          giftSentAt: birthdayRewards[0] ? rewardIssueDate(birthdayRewards[0]) : null,
          expiry: birthdayRewards[0] ? rewardExpiryDate(birthdayRewards[0]) : null,
          latestVisit: matchedUser ? lastVisitForUser(matchedUser.id) : null,
          memberSince: matchedUser?.created_at ?? null,
          lastContactedKey: sharedContactKey(card.phone || matchedUser?.phone || null, matchedUser?.email || null, card.full_name || matchedUser?.full_name || card.id),
          lastContactedKeys: sharedContactKeys(card.phone || matchedUser?.phone || null, matchedUser?.email || null, card.full_name || matchedUser?.full_name || card.id),
          sourceId: card.id,
        };
      })
      .filter((row): row is BirthdayRow => Boolean(row));

    const datasheetRows = birthdayDatasheetRows
      .map((item, index): BirthdayRow | null => {
        const datasheetBirthday = getBirthdayDatasheetBirthday(item);
        const birthdayInfo = getNextBirthdayInfo(datasheetBirthday);
        if (!birthdayInfo) return null;

        const datasheetName = getBirthdayDatasheetName(item);
        const datasheetPhone = getBirthdayDatasheetPhone(item);
        const phoneKey = normalizePhoneForMatch(datasheetPhone);
        const matchedUser = phoneKey ? clientByNormalizedPhone.get(phoneKey) ?? null : null;
        const birthdayRewards = matchedUser ? birthdayRewardsForUser(matchedUser.id) : [];
        const giftStatus = birthdayGiftStatusFromRewards(birthdayRewards);
        const giftName = birthdayGiftNameFromRewards(birthdayRewards);
        const stableId = item.id ?? phoneKey ?? `${datasheetName}-${datasheetBirthday}-${index}`;

        return {
          id: `datasheet-${stableId}`,
          source: "Datasheet",
          user: matchedUser,
          commentCard: null,
          name: datasheetName || matchedUser?.full_name || "Customer",
          contact: datasheetPhone || matchedUser?.phone || matchedUser?.email || "—",
          phone: datasheetPhone || matchedUser?.phone || "",
          email: matchedUser?.email || "",
          birthdayValue: datasheetBirthday || null,
          birthdayInfo,
          birthdayRewards,
          giftName,
          giftStatus,
          giftSentAt: birthdayRewards[0] ? rewardIssueDate(birthdayRewards[0]) : null,
          expiry: birthdayRewards[0] ? rewardExpiryDate(birthdayRewards[0]) : null,
          latestVisit: matchedUser ? lastVisitForUser(matchedUser.id) : null,
          memberSince: matchedUser?.created_at ?? item.created_at ?? null,
          lastContactedKey: sharedContactKey(datasheetPhone || matchedUser?.phone || null, matchedUser?.email || null, datasheetName || matchedUser?.full_name || stableId),
          lastContactedKeys: sharedContactKeys(datasheetPhone || matchedUser?.phone || null, matchedUser?.email || null, datasheetName || matchedUser?.full_name || stableId),
          sourceId: item.id ? String(item.id) : null,
        };
      })
      .filter((row): row is BirthdayRow => Boolean(row));

    return [...loyaltyRows, ...commentRows, ...datasheetRows].sort(
      (a, b) => (a.birthdayInfo?.daysLeft ?? 9999) - (b.birthdayInfo?.daysLeft ?? 9999),
    );
  }, [
    activityTxns,
    birthdayDatasheetRows,
    commentCards,
    giftDisplayName,
    giftRows,
    giftStatusInfo,
    rewardExpiryDate,
    rewardIssueDate,
    rewardTypeInfo,
    users,
  ]);

  const filteredBirthdayRows = useMemo(() => {
    const query = birthdaySearch.trim().toLowerCase();
    const direction = birthdaySort.direction === "asc" ? 1 : -1;

    const rows = birthdayRows.filter((row) => {
      const giftStatus = row.giftStatus.toLowerCase();
      const timing = row.birthdayInfo?.timing;
      const daysLeft = row.birthdayInfo?.daysLeft ?? 9999;
      const haystack = `${row.name} ${row.contact} ${row.phone} ${row.email}`.toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (birthdayFilter === "today" && timing !== "Today") return false;
      if (birthdayFilter === "week" && daysLeft > 7) return false;
      if (birthdayFilter === "month" && daysLeft > 31) return false;
      if (birthdayFilter === "upcoming" && daysLeft <= 0) return false;
      if (birthdayFilter === "sent" && giftStatus !== "sent") return false;
      if (birthdayFilter === "claimed" && giftStatus !== "claimed") return false;
      if (birthdayFilter === "expired" && giftStatus !== "expired") return false;
      if (birthdayFilter === "not_sent" && giftStatus !== "not sent") return false;

      return true;
    });

    const textValue = (value?: string | null) => String(value ?? "").toLowerCase();
    const dateValue = (value?: string | null) => {
      const time = new Date(value ?? "").getTime();
      return Number.isNaN(time) ? 0 : time;
    };
    const numberValue = (value: number | null | undefined) =>
      typeof value === "number" && Number.isFinite(value) ? value : -1;

    return rows.slice().sort((first, second) => {
      if (birthdaySort.key === "name") {
        return first.name.localeCompare(second.name) * direction;
      }
      if (birthdaySort.key === "age") {
        return (numberValue(getAgeFromBirthday(first.birthdayValue)) -
          numberValue(getAgeFromBirthday(second.birthdayValue))) * direction;
      }
      if (birthdaySort.key === "birthday") {
        return textValue(desktopBirthdayDateLabel(first.birthdayValue)).localeCompare(
          textValue(desktopBirthdayDateLabel(second.birthdayValue)),
        ) * direction;
      }
      if (birthdaySort.key === "days_left") {
        return ((first.birthdayInfo?.daysLeft ?? 9999) -
          (second.birthdayInfo?.daysLeft ?? 9999)) * direction;
      }
      if (birthdaySort.key === "gifts") {
        return first.giftName.localeCompare(second.giftName) * direction;
      }
      if (birthdaySort.key === "gift_status") {
        return first.giftStatus.localeCompare(second.giftStatus) * direction;
      }
      if (birthdaySort.key === "last_visit") {
        return (dateValue(first.latestVisit) - dateValue(second.latestVisit)) * direction;
      }
      if (birthdaySort.key === "gift_sent") {
        return (dateValue(first.giftSentAt) - dateValue(second.giftSentAt)) * direction;
      }
      if (birthdaySort.key === "source") {
        return first.source.localeCompare(second.source) * direction;
      }
      if (birthdaySort.key === "last_contacted") {
        const firstContacted = contactHistoryForKeys([
          ...(first.lastContactedKeys ?? [first.lastContactedKey]),
          first.lastContactedKey,
          first.sourceId ?? "",
          first.commentCard?.id ?? "",
        ])[0] ?? "";
        const secondContacted = contactHistoryForKeys([
          ...(second.lastContactedKeys ?? [second.lastContactedKey]),
          second.lastContactedKey,
          second.sourceId ?? "",
          second.commentCard?.id ?? "",
        ])[0] ?? "";
        return (dateValue(firstContacted) - dateValue(secondContacted)) * direction;
      }

      return 0;
    });
  }, [birthdayFilter, birthdayRows, birthdaySearch, birthdaySort, birthdayContactHistory, commentContactHistory]);

  const birthdaySummary = useMemo(() => {
    const today = birthdayRows.filter((row) => row.birthdayInfo?.timing === "Today").length;
    const week = birthdayRows.filter((row) => (row.birthdayInfo?.daysLeft ?? 9999) <= 7).length;
    const month = birthdayRows.filter((row) => (row.birthdayInfo?.daysLeft ?? 9999) <= 31).length;
    const giftsSent = birthdayRows.filter((row) => row.giftStatus !== "Not Sent").length;
    const claimedGifts = birthdayRows.filter((row) => row.giftStatus === "Claimed").length;
    const pendingGifts = birthdayRows.filter((row) => row.giftStatus === "Sent").length;

    return { today, week, month, giftsSent, claimedGifts, pendingGifts };
  }, [birthdayRows]);

  const sortedGameLinks = useMemo(() => {
    const direction = gameSort.direction === "asc" ? 1 : -1;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTomorrow = startOfToday + 24 * 60 * 60 * 1000;
    const startOfWeekDate = new Date(now);
    const day = startOfWeekDate.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    startOfWeekDate.setDate(startOfWeekDate.getDate() + mondayOffset);
    startOfWeekDate.setHours(0, 0, 0, 0);
    const startOfWeek = startOfWeekDate.getTime();
    const endOfWeek = startOfWeek + 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    const filtered = createdGameLinks.filter((game) => {
      if (gameSportFilter !== "all" && game.sport.toLowerCase() !== gameSportFilter) return false;
      if (gameTournamentFilter !== "all" && game.tournamentId !== gameTournamentFilter) return false;

      if (gameDateFilter === "all") return true;
      const time = new Date(game.kickoff ?? "").getTime();
      if (!Number.isFinite(time)) return false;
      if (gameDateFilter === "today") return time >= startOfToday && time < startOfTomorrow;
      if (gameDateFilter === "week") return time >= startOfWeek && time < endOfWeek;
      if (gameDateFilter === "month") return time >= startOfMonth && time < endOfMonth;
      return true;
    });

    return filtered.slice().sort((a, b) => {
      const compareText = (first: string, second: string) =>
        first.localeCompare(second) * direction;

      if (gameSort.key === "sport") return compareText(a.sport, b.sport);
      if (gameSort.key === "match") return compareText(a.title, b.title);
      if (gameSort.key === "status") return compareText(a.status, b.status);
      if (gameSort.key === "players")
        return (a.players - b.players) * direction;

      return (
        ((new Date(a.kickoff ?? 0).getTime() || 0) -
          (new Date(b.kickoff ?? 0).getTime() || 0)) *
        direction
      );
    });
  }, [createdGameLinks, gameDateFilter, gameSort, gameSportFilter, gameTournamentFilter]);

  function sortGames(key: "sport" | "match" | "date" | "status" | "players") {
    setGameSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  const clientUsersForReports = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesProfile = filter === "all" ? true : user.role === filter;

      if (!matchesProfile) return false;

      if (!search) return true;

      return [
        user.full_name,
        user.email,
        user.phone,
        user.client_code,
        user.is_active === false ? "inactive deactivated" : "active",
        desktopRoleLabel(user.role),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [users, filter, searchTerm]);

  const customerReportRows = useMemo(() => {
    return clientUsersForReports.map((user) => {
      const clientTxns = visibleActivityTxns.filter(
        (txn) => txn.client_id === user.id,
      );
      const allClientTxns = activityTxns.filter(
        (txn) => txn.client_id === user.id,
      );
      const clientGifts = visibleGiftRows.filter(
        (reward) => reward.client_id === user.id,
      );
      const lastTxn = allClientTxns
        .slice()
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0];

      const giftValueFor = (reward: Reward) => {
        const record = reward as unknown as Record<string, unknown>;
        const categoryId =
          typeof record.category_id === "string" ? record.category_id : "";
        const rewardType = String(record.reward_type ?? "").toLowerCase();

        if (categoryId && categoryAveragePriceById[categoryId] !== undefined) {
          return categoryAveragePriceById[categoryId] ?? 0;
        }

        for (const [categoryName, price] of Object.entries(
          categoryAveragePriceByName,
        )) {
          if (categoryName && rewardType.includes(categoryName)) return price;
        }

        return 0;
      };

      const stampValueFor = (txn: StampTransaction) => {
        const record = txn as unknown as Record<string, unknown>;
        const categoryId =
          typeof record.category_id === "string" ? record.category_id : "";
        const actionType = String(record.action_type ?? "");

        if (actionType.includes("remove")) return 0;

        return categoryAveragePriceById[categoryId] ?? 0;
      };

      const visits = new Set(
        clientTxns
          .map((txn) => desktopVisitDayKey(txn.created_at))
          .filter(Boolean),
      ).size;
      const totalVisits = new Set(
        allClientTxns
          .map((txn) => desktopVisitDayKey(txn.created_at))
          .filter(Boolean),
      ).size;
      const value = clientTxns.reduce(
        (sum, txn) => sum + stampValueFor(txn),
        0,
      );
      const lifetimeValue = allClientTxns.reduce(
        (sum, txn) => sum + stampValueFor(txn),
        0,
      );
      const giftsCount = clientGifts.length;
      const giftsValue = clientGifts.reduce(
        (sum, reward) => sum + giftValueFor(reward),
        0,
      );
      const lastVisit = lastTxn?.created_at ?? null;
      const age = getAgeFromBirthday(getBirthdayValue(user));
      const lastVisitMs = lastVisit ? new Date(lastVisit).getTime() : NaN;
      const daysSinceLastVisit = Number.isFinite(lastVisitMs)
        ? Math.floor((Date.now() - lastVisitMs) / (24 * 60 * 60 * 1000))
        : null;
      const isAtRisk =
        daysSinceLastVisit !== null &&
        daysSinceLastVisit >= 30 &&
        daysSinceLastVisit <= 60;
      const inactive =
        user.is_active === false ||
        !Number.isFinite(lastVisitMs) ||
        Date.now() - lastVisitMs > 30 * 24 * 60 * 60 * 1000;
      const isVip = lifetimeValue >= 200 || totalVisits >= 10;

      const tier =
        totalVisits >= 15
          ? "Gold"
          : totalVisits >= 7
            ? "Silver"
            : totalVisits >= 2
              ? "Bronze"
              : "New";

      return {
        user,
        tier,
        visits,
        totalVisits,
        value,
        lifetimeValue,
        giftsCount,
        giftsValue,
        lastVisit,
        daysSinceLastVisit,
        age,
        inactive,
        isAtRisk,
        isVip,
      };
    });
  }, [
    activityTxns,
    categoryAveragePriceById,
    categoryAveragePriceByName,
    clientUsersForReports,
    visibleActivityTxns,
    visibleGiftRows,
  ]);

  const filteredCustomerReportRows = useMemo(() => {
    return customerReportRows.filter((row) => {
      if (lastVisitFilter === "active" && row.inactive) return false;
      if (lastVisitFilter === "inactive" && !row.inactive) return false;

      if (
        customerStatusFilter === "active" &&
        !(row.daysSinceLastVisit !== null && row.daysSinceLastVisit <= 7)
      )
        return false;
      if (
        customerStatusFilter === "inactive" &&
        !(row.daysSinceLastVisit !== null && row.daysSinceLastVisit >= 31)
      )
        return false;
      if (
        customerStatusFilter === "at_risk" &&
        !(row.daysSinceLastVisit !== null && row.daysSinceLastVisit >= 31)
      )
        return false;
      if (customerStatusFilter === "vip" && !row.isVip) return false;

      if (
        customerGenderFilter !== "all" &&
        String(row.user.gender || "").toLowerCase() !== customerGenderFilter
      ) {
        return false;
      }

      if (customerAgeRangeFilter !== "all") {
        if (row.age === null) return false;
        if (
          customerAgeRangeFilter === "18-24" &&
          (row.age < 18 || row.age > 24)
        )
          return false;
        if (
          customerAgeRangeFilter === "25-34" &&
          (row.age < 25 || row.age > 34)
        )
          return false;
        if (
          customerAgeRangeFilter === "35-44" &&
          (row.age < 35 || row.age > 44)
        )
          return false;
        if (customerAgeRangeFilter === "45+" && row.age < 45) return false;
      }

      if (customerVisitRangeFilter === "0" && row.totalVisits !== 0)
        return false;
      if (
        customerVisitRangeFilter === "1-3" &&
        (row.totalVisits < 1 || row.totalVisits > 3)
      )
        return false;
      if (
        customerVisitRangeFilter === "4-10" &&
        (row.totalVisits < 4 || row.totalVisits > 10)
      )
        return false;
      if (customerVisitRangeFilter === "10+" && row.totalVisits < 10)
        return false;

      if (customerValueRangeFilter === "0" && row.lifetimeValue !== 0)
        return false;
      if (
        customerValueRangeFilter === "1-50" &&
        (row.lifetimeValue < 1 || row.lifetimeValue > 50)
      )
        return false;
      if (
        customerValueRangeFilter === "50-200" &&
        (row.lifetimeValue < 50 || row.lifetimeValue > 200)
      )
        return false;
      if (customerValueRangeFilter === "200+" && row.lifetimeValue < 200)
        return false;

      return true;
    });
  }, [
    customerAgeRangeFilter,
    customerGenderFilter,
    customerReportRows,
    customerStatusFilter,
    customerValueRangeFilter,
    customerVisitRangeFilter,
    lastVisitFilter,
  ]);

  const sortedCustomerReportRows = useMemo(() => {
    const direction = customerSort.direction === "asc" ? 1 : -1;

    return filteredCustomerReportRows.slice().sort((a, b) => {
      const textCompare = (first: string, second: string) =>
        first.localeCompare(second) * direction;

      if (customerSort.key === "name") {
        return textCompare(a.user.full_name || "", b.user.full_name || "");
      }

      if (customerSort.key === "contact") {
        return textCompare(
          a.user.phone || a.user.email || "",
          b.user.phone || b.user.email || "",
        );
      }

      if (customerSort.key === "age") {
        if (a.age === null && b.age === null) return 0;
        if (a.age === null) return 1;
        if (b.age === null) return -1;
        return (a.age - b.age) * direction;
      }

      if (customerSort.key === "gender") {
        return textCompare(a.user.gender || "", b.user.gender || "");
      }

      if (customerSort.key === "lastVisit") {
        return (
          ((new Date(a.lastVisit || 0).getTime() || 0) -
            (new Date(b.lastVisit || 0).getTime() || 0)) *
          direction
        );
      }

      if (customerSort.key === "visits") {
        return (a.totalVisits - b.totalVisits) * direction;
      }

      if (customerSort.key === "value") {
        return (a.value - b.value) * direction;
      }

      if (customerSort.key === "lifetime") {
        return (a.lifetimeValue - b.lifetimeValue) * direction;
      }

      if (customerSort.key === "gifts") {
        return (a.giftsCount - b.giftsCount) * direction;
      }

      if (customerSort.key === "giftValue") {
        return (a.giftsValue - b.giftsValue) * direction;
      }

      return (Number(a.inactive) - Number(b.inactive)) * direction;
    });
  }, [customerSort, filteredCustomerReportRows]);

  function sortCustomerTable(
    key:
      | "name"
      | "contact"
      | "age"
      | "gender"
      | "lastVisit"
      | "visits"
      | "value"
      | "lifetime"
      | "gifts"
      | "giftValue"
      | "status",
  ) {
    setCustomerSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function customerHeaderClass(
    key:
      | "name"
      | "contact"
      | "age"
      | "gender"
      | "lastVisit"
      | "visits"
      | "value"
      | "lifetime"
      | "gifts"
      | "giftValue"
      | "status",
  ) {
    return `text-left ${customerSort.key === key ? "font-black text-[#ffd66b]" : ""}`;
  }

  function daysAgoClass(days: number | null) {
    if (days === null) return "bg-white/12 text-white/48";
    if (days <= 7) return "bg-emerald-400/18 text-emerald-100";
    if (days <= 14) return "bg-[#ffd66b]/22 text-[#ffd66b]";
    if (days <= 30) return "bg-orange-400/20 text-orange-200";
    return "bg-red-500/18 text-red-200";
  }

  function daysAgoStatusLabel(days: number | null) {
    if (days === null) return "No Visit";
    if (days <= 7) return "Recent";
    if (days <= 14) return "Normal";
    if (days <= 30) return "Needs Attention";
    return "At Risk";
  }

  function daysAgoStatusClass(days: number | null) {
    return daysAgoClass(days);
  }

  async function updateCustomerGender(userId: string, gender: string) {
    setUsers((current) =>
      current.map((user) => (user.id === userId ? { ...user, gender } : user)),
    );

    try {
      const response = await fetch("/api/admin/client-gender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, gender }),
      });

      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        flash(json.error ?? "Could not save gender.", "error");
      }
    } catch {
      flash("Could not save gender.", "error");
    }
  }

  function downloadVisibleCustomerTable() {
    const csvEscape = (value: string | number | null | undefined) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const visibleRows = sortedCustomerReportRows.slice(0, 80);
    const headers = [
      "Name",
      "Member ID",
      "Contact",
      "Last Visit",
      "Days Ago",
      "Visits",
      "Lifetime $",
      "Gifts",
      "Status",
      "Last Contacted",
    ];
    const rows = visibleRows.map((row) => {
      const contactKeys = sharedContactKeys(
        row.user.phone,
        row.user.email,
        row.user.full_name || row.user.id,
      );
      return [
        row.user.full_name || "Client",
        row.user.client_code || "",
        row.user.phone || row.user.email || "",
        desktopFormatDateOnly(row.lastVisit),
        row.daysSinceLastVisit ?? "",
        row.totalVisits,
        row.lifetimeValue,
        row.giftsCount,
        row.inactive ? "Inactive" : "Active",
        contactHistoryForKeys(contactKeys).slice(0, 2).join(" | "),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customer-table-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(
        "proscafe_comment_card_contact_history",
      );
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string[]>;
      if (parsed && typeof parsed === "object") {
        setCommentContactHistory(parsed);
      }
    } catch {
      setCommentContactHistory({});
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(
        "proscafe_birthday_contact_history",
      );
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string[]>;
      if (parsed && typeof parsed === "object") {
        setBirthdayContactHistory(parsed);
      }
    } catch {
      setBirthdayContactHistory({});
    }
  }, []);

  const saveCommentContactHistory = (next: Record<string, string[]>) => {
    setCommentContactHistory(next);
    try {
      window.localStorage.setItem(
        "proscafe_comment_card_contact_history",
        JSON.stringify(next),
      );
    } catch {
      // Local storage may be unavailable in private browser modes.
    }
  };

  const saveBirthdayContactHistory = (next: Record<string, string[]>) => {
    setBirthdayContactHistory(next);
    try {
      window.localStorage.setItem(
        "proscafe_birthday_contact_history",
        JSON.stringify(next),
      );
    } catch {
      // Local storage may be unavailable in private browser modes.
    }
  };

  function mergeContactHistoryMaps(
    first: Record<string, string[]>,
    second: Record<string, string[]>,
  ) {
    const merged = { ...first };
    Object.entries(second).forEach(([key, dates]) => {
      merged[key] = mergeContactDates(merged[key], dates);
    });
    return merged;
  }

  async function loadContactHistoryFromSupabase() {
    try {
      const response = await fetch("/api/admin/contact-history", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;

      const history =
        data && typeof data.history === "object" && data.history !== null
          ? (data.history as Record<string, string[]>)
          : {};

      setCommentContactHistory((previous) => {
        const next = mergeContactHistoryMaps(previous, history);
        try {
          window.localStorage.setItem(
            "proscafe_comment_card_contact_history",
            JSON.stringify(next),
          );
        } catch {
          // Local storage may be unavailable in private browser modes.
        }
        return next;
      });

      setBirthdayContactHistory((previous) => {
        const next = mergeContactHistoryMaps(previous, history);
        try {
          window.localStorage.setItem(
            "proscafe_birthday_contact_history",
            JSON.stringify(next),
          );
        } catch {
          // Local storage may be unavailable in private browser modes.
        }
        return next;
      });
    } catch {
      // Keep using local fallback if the database is unavailable.
    }
  }

  async function saveContactHistoryToSupabase(
    keys: string[],
    contactedAt: string,
    source: "Comment Cards" | "Birthdays" | "Gifts" | "Customer behavior",
    sourceId?: string | null,
  ) {
    try {
      await fetch("/api/admin/contact-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keys,
          contacted_at: contactedAt,
          source,
          source_id: sourceId ?? null,
        }),
      });
    } catch {
      // The UI already saved locally, so do not block the admin.
    }
  }

  useEffect(() => {
    void loadContactHistoryFromSupabase();
  }, []);

  function sharedContactKey(
    phone?: string | null,
    email?: string | null,
    fallback?: string | null,
  ) {
    return sharedContactKeys(phone, email, fallback)[0] ?? "contact-unknown";
  }

  function sharedContactKeys(
    phone?: string | null,
    email?: string | null,
    fallback?: string | null,
  ) {
    const keys: string[] = [];
    const phoneKey = normalizePhoneForMatch(phone);
    if (phoneKey) keys.push(`contact-phone-${phoneKey}`);

    const emailKey = (email ?? "").trim().toLowerCase();
    if (emailKey) keys.push(`contact-email-${emailKey}`);

    const fallbackKey = (fallback ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (fallbackKey) keys.push(`contact-name-${fallbackKey}`);

    return Array.from(new Set(keys.length ? keys : ["contact-unknown"]));
  }

  function contactHistoryForKeys(keys: string[]) {
    return mergeContactDates(
      ...keys.flatMap((key) => [
        commentContactHistory[key],
        birthdayContactHistory[key],
      ]),
    );
  }

  function mergeContactDates(...dateGroups: Array<string[] | undefined>) {
    return Array.from(
      new Set(
        dateGroups
          .flatMap((dates) => dates ?? [])
          .filter((date) => typeof date === "string" && date.trim().length > 0),
      ),
    )
      .sort((first, second) => {
        const firstTime = new Date(first).getTime();
        const secondTime = new Date(second).getTime();
        return (Number.isNaN(secondTime) ? 0 : secondTime) -
          (Number.isNaN(firstTime) ? 0 : firstTime);
      })
      .slice(0, 20);
  }

  function commentCardContactKey(card: CommentCardEntry, member?: AdminUser | null) {
    return commentCardContactKeys(card, member)[0] ?? "contact-unknown";
  }

  function commentCardContactKeys(card: CommentCardEntry, member?: AdminUser | null) {
    return sharedContactKeys(
      card.phone || member?.phone || null,
      member?.email || null,
      card.full_name || member?.full_name || card.id,
    );
  }

  function markSharedContacted(
    contactKeys: string | string[],
    source: "Comment Cards" | "Birthdays" | "Gifts" | "Customer behavior",
    legacyKey?: string,
  ) {
    const keys = Array.from(new Set(Array.isArray(contactKeys) ? contactKeys : [contactKeys]));
    const date = new Date().toISOString();
    const previous = mergeContactDates(
      ...keys.flatMap((key) => [
        birthdayContactHistory[key],
        commentContactHistory[key],
      ]),
      legacyKey ? birthdayContactHistory[legacyKey] : undefined,
      legacyKey ? commentContactHistory[legacyKey] : undefined,
    );
    const savedDates = [date, ...previous].slice(0, 20);

    const nextBirthdayHistory = { ...birthdayContactHistory };
    const nextCommentHistory = { ...commentContactHistory };
    keys.forEach((key) => {
      nextBirthdayHistory[key] = savedDates;
      nextCommentHistory[key] = savedDates;
    });
    if (legacyKey) {
      nextBirthdayHistory[legacyKey] = savedDates;
      nextCommentHistory[legacyKey] = savedDates;
    }

    saveBirthdayContactHistory(nextBirthdayHistory);
    saveCommentContactHistory(nextCommentHistory);
    void saveContactHistoryToSupabase(keys, date, source, legacyKey ?? null);
    flash("Contact saved.");
  }

  function markCommentCardContacted(contactKeys: string | string[], legacyCardId?: string) {
    const keys = Array.from(new Set(Array.isArray(contactKeys) ? contactKeys : [contactKeys]));
    const date = new Date().toISOString();
    const previous = mergeContactDates(
      ...keys.flatMap((key) => [
        commentContactHistory[key],
        birthdayContactHistory[key],
      ]),
      legacyCardId ? commentContactHistory[legacyCardId] : undefined,
    );
    const savedDates = [date, ...previous].slice(0, 20);

    const nextCommentHistory = { ...commentContactHistory };
    const nextBirthdayHistory = { ...birthdayContactHistory };
    keys.forEach((key) => {
      nextCommentHistory[key] = savedDates;
      nextBirthdayHistory[key] = savedDates;
    });
    if (legacyCardId) nextCommentHistory[legacyCardId] = savedDates;

    saveCommentContactHistory(nextCommentHistory);
    saveBirthdayContactHistory(nextBirthdayHistory);
    void saveContactHistoryToSupabase(keys, date, "Comment Cards", legacyCardId ?? null);
    flash("Contact saved.");
  }

  function markBirthdayContacted(contactKeys: string | string[], legacyKey?: string) {
    const keys = Array.from(new Set(Array.isArray(contactKeys) ? contactKeys : [contactKeys]));
    const date = new Date().toISOString();
    const previous = mergeContactDates(
      ...keys.flatMap((key) => [
        birthdayContactHistory[key],
        commentContactHistory[key],
      ]),
      legacyKey ? birthdayContactHistory[legacyKey] : undefined,
    );
    const savedDates = [date, ...previous].slice(0, 20);

    const nextBirthdayHistory = { ...birthdayContactHistory };
    const nextCommentHistory = { ...commentContactHistory };
    keys.forEach((key) => {
      nextBirthdayHistory[key] = savedDates;
      nextCommentHistory[key] = savedDates;
    });
    if (legacyKey) nextBirthdayHistory[legacyKey] = savedDates;

    saveBirthdayContactHistory(nextBirthdayHistory);
    saveCommentContactHistory(nextCommentHistory);
    void saveContactHistoryToSupabase(keys, date, "Birthdays", legacyKey ?? null);
    flash("Contact saved.");
  }

  const clientUsersByPhone = useMemo(() => {
    const map = new Map<string, AdminUser>();

    users.forEach((user) => {
      if (user.role !== "client") return;

      const key = normalizePhoneForMatch(user.phone);
      if (!key) return;

      map.set(key, user);
    });

    return map;
  }, [users]);

  const commentCardRows = useMemo(() => {
    const search = commentSearch.trim().toLowerCase();
    const now = new Date();
    const startToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startWeek = new Date(startToday);
    startWeek.setDate(startToday.getDate() - ((startToday.getDay() + 6) % 7));
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const rows = commentCards
      .map((card) => {
        const phoneKey = normalizePhoneForMatch(card.phone);
        const member = phoneKey
          ? (clientUsersByPhone.get(phoneKey) ?? null)
          : null;
        const ratings = [
          card.experience_rating,
          card.food_rating,
          card.service_rating,
          card.cleanliness_rating,
          card.visit_again_rating,
        ].map((value) => (Number.isFinite(Number(value)) ? Number(value) : 0));
        const averageRating = ratings.length
          ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
          : 0;
        const submittedAt = new Date(card.created_at);
        const submittedTime = Number.isNaN(submittedAt.getTime())
          ? null
          : submittedAt;
        const memberCreatedAt = member
          ? String(
              (member as unknown as { created_at?: string | null })
                .created_at ?? "",
            )
          : "";
        const age = getAgeFromBirthday(card.birthday);
        const contactKey = commentCardContactKey(card, member);
        const contactKeys = commentCardContactKeys(card, member);
        const lastContacted = mergeContactDates(
          contactHistoryForKeys(contactKeys),
          commentContactHistory[card.id],
        )[0] ?? "";

        return {
          card,
          member,
          averageRating,
          memberCreatedAt,
          submittedTime,
          age,
          contactKey,
          contactKeys,
          lastContacted,
        };
      })
      .filter((row) => {
        if (commentFilter === "registered" && !row.member) return false;
        if (commentFilter === "not_registered" && row.member) return false;
        if (commentFilter === "five_star" && row.averageRating < 5)
          return false;
        if (commentFilter === "low_rating" && row.averageRating >= 4)
          return false;
        if (commentFilter === "has_comments" && !row.card.comments?.trim())
          return false;
        if (
          commentFilter === "today" &&
          (!row.submittedTime || row.submittedTime < startToday)
        )
          return false;
        if (
          commentFilter === "week" &&
          (!row.submittedTime || row.submittedTime < startWeek)
        )
          return false;
        if (
          commentFilter === "month" &&
          (!row.submittedTime || row.submittedTime < startMonth)
        )
          return false;

        if (!search) return true;

        return [
          row.card.full_name,
          row.card.phone,
          desktopAgeLabel(row.age),
          row.card.heard_about_us,
          row.card.comments,
          row.member?.full_name,
          row.member?.client_code,
          row.member ? "registered member" : "not registered",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);
      });

    const sortedRows = [...rows].sort((first, second) => {
      let result = 0;

      if (commentSort.key === "name") {
        result = compareDesktopValues(
          first.card.full_name,
          second.card.full_name,
        );
      } else if (commentSort.key === "phone") {
        result = compareDesktopValues(first.card.phone, second.card.phone);
      } else if (commentSort.key === "age") {
        result = compareDesktopValues(first.age, second.age);
      } else if (commentSort.key === "rating") {
        result = compareDesktopValues(
          first.averageRating,
          second.averageRating,
        );
      } else if (commentSort.key === "heard_from") {
        result = compareDesktopValues(
          first.card.heard_about_us,
          second.card.heard_about_us,
        );
      } else if (commentSort.key === "comment") {
        result = compareDesktopValues(
          first.card.comments,
          second.card.comments,
        );
      } else if (commentSort.key === "submitted") {
        result = compareDesktopValues(
          first.submittedTime?.getTime() ?? null,
          second.submittedTime?.getTime() ?? null,
        );
      } else if (commentSort.key === "member_since") {
        result = compareDesktopValues(
          first.memberCreatedAt,
          second.memberCreatedAt,
        );
      } else if (commentSort.key === "last_contacted") {
        result = compareDesktopValues(
          first.lastContacted,
          second.lastContacted,
        );
      }

      return commentSort.direction === "asc" ? result : -result;
    });

    return sortedRows;
  }, [
    clientUsersByPhone,
    commentCards,
    birthdayContactHistory,
    commentContactHistory,
    commentFilter,
    commentSearch,
    commentSort,
  ]);

  const commentCardSummary = useMemo(() => {
    const total = commentCardRows.length;
    const registered = commentCardRows.filter((row) => row.member).length;
    const lowRating = commentCardRows.filter(
      (row) => row.averageRating < 4,
    ).length;
    const average = total
      ? (
          commentCardRows.reduce((sum, row) => sum + row.averageRating, 0) /
          total
        ).toFixed(1)
      : "0.0";

    return { total, registered, lowRating, average };
  }, [commentCardRows]);

  const selectedCommentCardRow = useMemo(() => {
    if (!selectedCommentCardId) return null;
    return (
      commentCardRows.find((row) => row.card.id === selectedCommentCardId) ??
      null
    );
  }, [commentCardRows, selectedCommentCardId]);

  const toggleCommentSort = (key: CommentCardSortKey) => {
    setCommentSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const renderCommentSortHeader = (label: string, key: CommentCardSortKey) => {
    const isActive = commentSort.key === key;
    return (
      <button
        type="button"
        onClick={() => toggleCommentSort(key)}
        className={`truncate text-left uppercase transition hover:text-[#ffd66b] ${
          isActive ? "font-black text-[#ffd66b]" : "font-black text-white/58"
        }`}
        title={`Sort by ${label}`}
      >
        {label}
        {isActive ? (commentSort.direction === "asc" ? " ↑" : " ↓") : null}
      </button>
    );
  };


  const toggleBirthdaySort = (key: BirthdaySortKey) => {
    setBirthdaySort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const renderBirthdaySortHeader = (label: string, key: BirthdaySortKey) => {
    const isActive = birthdaySort.key === key;
    return (
      <button
        type="button"
        onClick={() => toggleBirthdaySort(key)}
        className={`truncate text-left uppercase transition hover:text-[#ffd66b] ${
          isActive ? "font-black text-[#ffd66b]" : "font-black text-white/72"
        }`}
        title={`Sort by ${label}`}
      >
        {label}
        {isActive ? (birthdaySort.direction === "asc" ? " ↑" : " ↓") : null}
      </button>
    );
  };

  function downloadCommentCardsTable() {
    const rows = [
      [
        "Name",
        "Phone",
        "Age",
        "Rating",
        "Heard From",
        "Comment",
        "Submitted",
        "Member Since",
        "WhatsApp",
        "Gift",
        "Contacted",
        "Last Contacted",
      ],
      ...commentCardRows.map((row) => {
        const lastContactedDates = (commentContactHistory[row.card.id] ?? [])
          .slice(0, 2)
          .map((date) => desktopFormatContactDate(date))
          .join(" | ");

        return [
          row.card.full_name || "Guest",
          row.card.phone || "",
          desktopAgeLabel(row.age),
          `${row.averageRating.toFixed(1)}/5`,
          row.card.heard_about_us || "",
          row.card.comments?.trim() || "",
          `${desktopFormatDateOnly(row.card.created_at)} ${desktopFormatTimeOnly(row.card.created_at)}`,
          row.member ? desktopFormatDateOnly(row.memberCreatedAt) : "",
          commentCardWhatsappUrl(row.card.phone) || "",
          row.member ? "Available" : row.card.phone ? "Pending available" : "",
          (commentContactHistory[row.card.id] ?? []).length > 0 ? "Yes" : "No",
          lastContactedDates,
        ];
      }),
    ];

    desktopDownloadCsv("comment-cards-table.csv", rows);
    flash("Comment cards table downloaded.");
  }

  function downloadActivityTable() {
    const rows = [
      [
        "Client Name",
        "Category",
        "Issue By",
        "Date",
        "Days Ago",
        "Time",
        "Action",
      ],
      ...filteredActivityRows.map((transaction) => {
        const clientName =
          profileNamesById[transaction.client_id ?? ""] ?? "Client";
        const actorName =
          profileNamesById[transaction.staff_id ?? ""] ||
          (transaction.staff_id ? "Staff user" : "System");
        const categoryName =
          categoryNamesById[transaction.category_id ?? ""] ||
          (transaction.action_type === "reward_redeemed" ? "Gift" : "—");
        const days = desktopDaysAgo(transaction.created_at);

        return [
          clientName,
          categoryName,
          actorName,
          desktopFormatDateOnly(transaction.created_at),
          activityDaysLabel(days),
          desktopFormatTimeOnly(transaction.created_at),
          String(transaction.action_type || ""),
        ];
      }),
    ];

    desktopDownloadCsv("activity-table.csv", rows);
    flash("Activity table downloaded.");
  }

  function downloadBirthdayTable() {
    const rows = [
      [
        "Name",
        "Age",
        "Birthday",
        "Days Left",
        "Gifts",
        "Gift Status",
        "Last Visit",
        "Gift Sent",
        "Source",
        "Last Contacted",
      ],
      ...filteredBirthdayRows.map((row) => {
        const lastContactedDates = contactHistoryForKeys(
          row.lastContactedKeys ?? [row.lastContactedKey],
        )
          .slice(0, 2)
          .map((date) => desktopFormatContactDate(date))
          .join(" | ");

        return [
          row.name,
          desktopAgeLabel(getAgeFromBirthday(row.birthdayValue)),
          desktopBirthdayDateLabel(row.birthdayValue),
          desktopBirthdayDaysCode(row.birthdayValue),
          row.giftName,
          row.giftStatus,
          desktopFormatDateOnly(row.latestVisit),
          desktopFormatDateOnly(row.giftSentAt),
          row.source,
          lastContactedDates,
        ];
      }),
    ];

    desktopDownloadCsv("birthdays-table.csv", rows);
    flash("Birthdays table downloaded.");
  }

  function downloadGiftsTable() {
    const rows = [
      [
        "Client Name",
        "Type",
        "Gifts",
        "Status",
        "Expiry",
        "Days Left",
        "Issued By",
        "Issued Date",
        "Member Since",
        "Source",
        "Last Contacted",
      ],
      ...filteredGiftDashboardRows.map((reward) => {
        const typeInfo = rewardTypeInfo(reward);
        const statusInfo = giftStatusInfo(reward);
        const lastContactedDates = contactHistoryForKeys(giftContactKeys(reward))
          .slice(0, 2)
          .map((date) => desktopFormatContactDate(date))
          .join(" | ");

        return [
          giftClientName(reward),
          typeInfo.type,
          giftDisplayName(reward),
          statusInfo.label,
          desktopFormatDateOnly(rewardExpiryDate(reward)),
          giftLeftInfo(reward).label,
          typeInfo.issuedBy,
          desktopFormatDateOnly(rewardIssueDate(reward)),
          desktopFormatDateOnly(giftMemberSince(reward)),
          typeInfo.source,
          lastContactedDates,
        ];
      }),
    ];

    desktopDownloadCsv("gifts-table.csv", rows);
    flash("Gifts table downloaded.");
  }

  useEffect(() => {
    if (!selectedCommentCardId) return;

    function handleCommentCardModalKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedCommentCardId(null);
      }
    }

    window.addEventListener("keydown", handleCommentCardModalKeyDown);

    return () => {
      window.removeEventListener("keydown", handleCommentCardModalKeyDown);
    };
  }, [selectedCommentCardId]);

  useEffect(() => {
    if (!quickGiftTarget) return;

    function handleQuickGiftModalKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeQuickGift();
      }
    }

    window.addEventListener("keydown", handleQuickGiftModalKeyDown);

    return () => {
      window.removeEventListener("keydown", handleQuickGiftModalKeyDown);
    };
  }, [quickGiftTarget]);

  const newCustomerCount = customerReportRows.filter(
    (row) => row.totalVisits <= 1,
  ).length;
  const returningCustomerCount = customerReportRows.filter(
    (row) => row.totalVisits > 1,
  ).length;
  const clientCustomerRows = customerReportRows.filter(
    (row) => row.user.role === "client",
  );
  const inactiveCustomerCount = clientCustomerRows.filter(
    (row) => row.inactive,
  ).length;
  const activeReportCustomers =
    clientCustomerRows.length - inactiveCustomerCount;
  const atRiskCustomerCount = clientCustomerRows.filter(
    (row) => row.isAtRisk,
  ).length;
  const vipCustomerCount = clientCustomerRows.filter((row) => row.isVip).length;
  const averageVisitsPerCustomer =
    clientCustomerRows.length > 0
      ? (
          clientCustomerRows.reduce((sum, row) => sum + row.totalVisits, 0) /
          clientCustomerRows.length
        ).toFixed(1)
      : "0";

  const totalCustomers = clientCustomerRows.length;
  const newCustomersThisMonth = clientUsersForReports.filter((user) => {
    const createdAt = new Date(
      String(
        (user as unknown as AdminUser & { created_at?: string | null })
          .created_at ?? "",
      ),
    );
    return !Number.isNaN(createdAt.getTime()) && createdAt >= startOfMonth;
  }).length;
  const newCustomersThisWeek = clientUsersForReports.filter((user) => {
    const createdAt = new Date(
      String(
        (user as unknown as AdminUser & { created_at?: string | null })
          .created_at ?? "",
      ),
    );
    return !Number.isNaN(createdAt.getTime()) && createdAt >= startOfWeek;
  }).length;
  const newCustomersForTimeRange = clientUsersForReports.filter((user) => {
    if (timeRange === "all") return user.role === "client";

    const createdAt = new Date(
      String(
        (user as unknown as AdminUser & { created_at?: string | null })
          .created_at ?? "",
      ),
    );
    const rangeStart = getDesktopTimeRangeStart(timeRange);

    return (
      user.role === "client" &&
      Boolean(rangeStart) &&
      !Number.isNaN(createdAt.getTime()) &&
      createdAt >= rangeStart!
    );
  }).length;
  const inactiveRate = desktopPercentage(
    desktopSafeRatio(inactiveCustomerCount, Math.max(1, totalCustomers)),
  );
  const repeatRate = desktopPercentage(
    desktopSafeRatio(returningCustomerCount, Math.max(1, totalCustomers)),
  );
  const redemptionPerformanceRate = desktopPercentage(
    desktopSafeRatio(
      metrics.rewardsRedeemed,
      Math.max(1, visibleGiftRows.length),
    ),
  );
  const giftConversionRate = desktopPercentage(
    desktopSafeRatio(recentRewardClients, Math.max(1, totalCustomers)),
  );
  const overviewCommentCardRating = useMemo(() => {
    const ratings = commentCards
      .map((card) => {
        const values = [
          card.experience_rating,
          card.food_rating,
          card.service_rating,
          card.cleanliness_rating,
          card.visit_again_rating,
        ].map((value) => (Number.isFinite(Number(value)) ? Number(value) : 0));

        return values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0;
      })
      .filter((rating) => rating > 0);

    if (!ratings.length) return "0.0/5";

    const average =
      ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;

    return `${average.toFixed(1)}/5`;
  }, [commentCards]);

  const commentCardsLast24Hours = useMemo(() => {
    const since = Date.now() - 24 * 60 * 60 * 1000;

    return commentCards.filter((card) => {
      const createdAt = new Date(card.created_at).getTime();
      return Number.isFinite(createdAt) && createdAt >= since;
    }).length;
  }, [commentCards]);

  const bestPerformingDay = desktopGetBestPerformingDay(visibleActivityTxns);

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,214,107,0.24),transparent_28%),linear-gradient(135deg,#365665_0%,#263f49_48%,#798673_100%)] text-white"
      style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif" }}
    >
      <Toast message={toast} tone={tone} />

      <div className="flex min-h-screen w-full gap-6 overflow-visible bg-transparent p-6 lg:min-h-screen">
        <aside
          className={`hidden min-h-[calc(100vh-48px)] shrink-0 flex-col overflow-hidden rounded-[30px] bg-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.24)] backdrop-blur-2xl transition-all duration-300 lg:flex ${
            isDesktopSidebarOpen ? "w-[238px]" : "w-[76px]"
          }`}
        >
          <div
            className={`flex h-20 items-center bg-white/5 ${isDesktopSidebarOpen ? "justify-between gap-3 px-5" : "justify-center px-3"}`}
          >
            {isDesktopSidebarOpen ? (
              <div className="min-w-0">
                <div className="text-[19px] font-black leading-none text-white">
                  Dashboard
                </div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#ffd66b]">
                  PRO&apos;s Admin
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setIsDesktopSidebarOpen((current) => !current)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffd66b] text-[20px] font-black text-[#365665] shadow-[0_12px_28px_rgba(255,214,107,0.2)] transition hover:scale-105"
              title={isDesktopSidebarOpen ? "Collapse menu" : "Open menu"}
              aria-label={isDesktopSidebarOpen ? "Collapse menu" : "Open menu"}
            >
              {isDesktopSidebarOpen ? "←" : "☰"}
            </button>
          </div>

          <nav className="flex-1 px-3 py-4">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                title={desktopTabLabel(item)}
                onClick={() => {
                  setTab(item);
                  setSelectedUser(null);
                }}
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black transition ${
                  isDesktopSidebarOpen
                    ? "justify-start px-4"
                    : "justify-center px-0"
                } ${
                  tab === item
                    ? "bg-white/18 text-white shadow-[0_16px_34px_rgba(35,54,47,0.18)]"
                    : "text-white/70 hover:bg-white/12 hover:text-white"
                }`}
              >
                <span
                  className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] ${
                    tab === item
                      ? "bg-[#ffd66b] text-[#365665]"
                      : "bg-white/12 text-white/72"
                  }`}
                >
                  {tabIcon(item)}
                </span>
                {isDesktopSidebarOpen ? desktopTabLabel(item) : null}
              </button>
            ))}
          </nav>

          <div className="border-t border-white/8 px-3 py-5">
            <button
              type="button"
              onClick={() => void logout()}
              className={`mb-4 flex w-full items-center rounded-none bg-transparent py-2 text-left text-[12px] font-black text-white/86 transition hover:text-white ${
                isDesktopSidebarOpen
                  ? "justify-start px-4"
                  : "justify-center px-0"
              }`}
              title="Logout"
            >
              {isDesktopSidebarOpen ? "Logout" : "⎋"}
            </button>

            {isDesktopSidebarOpen ? (
              <div className="space-y-3 text-left">
                <a
                  href="https://wissamdesigns.com"
                  target="_blank"
                  rel="noreferrer"
                  className="block text-left text-[11px] font-black uppercase leading-5 text-[#ffd66b] transition hover:text-white"
                >
                  © WISSAMDESIGNS.COM
                </a>

                {isDesktopVersionEditing ? (
                  <input
                    autoFocus
                    defaultValue={desktopVersionLabel}
                    onBlur={(event) =>
                      saveDesktopVersionLabel(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        saveDesktopVersionLabel(event.currentTarget.value);
                      }
                      if (event.key === "Escape") {
                        setIsDesktopVersionEditing(false);
                      }
                    }}
                    className="block h-8 w-[150px] rounded-[12px] border border-white/18 bg-white px-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#102226] outline-none focus:border-[#ffd66b]"
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => setIsDesktopVersionEditing(true)}
                    className="block rounded-[12px] px-0 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-white/70 transition hover:text-white"
                    title="Double click to edit version"
                  >
                    {desktopVersionLabel}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center text-[14px] font-black text-[#ffd66b]">
                ©
              </div>
            )}
          </div>
        </aside>

        <section
          className={`min-h-[calc(100vh-48px)] min-w-0 flex-1 ${
            tab === "Users"
              ? "overflow-visible"
              : "overflow-hidden rounded-[30px] bg-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.22)] backdrop-blur-2xl"
          }`}
        >
          <div className={tab === "Users" ? "px-0 py-0" : "px-5 py-6 lg:px-8"}>
            {tab === "Overview" ? (
              <section className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[26px] font-black tracking-[-0.04em] text-white">
                      Dashboard Overview
                    </h2>
                    <p className="mt-1 text-[12px] font-bold text-white/70">
                      Track customers, stamps, rewards, feedback, and loyalty
                      performance.
                    </p>
                  </div>

                  <DesktopTimeRangeFilter
                    value={timeRange}
                    onChange={setTimeRange}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatTile
                    value={totalCustomers}
                    label="Total Customers"
                    onClick={() => setTab("Users")}
                  />
                  <StatTile
                    value={activeCustomers}
                    label="Active Customers"
                    onClick={() => setTab("Users")}
                  />
                  <StatTile
                    value={newCustomersForTimeRange}
                    label="New Customers"
                    trend={desktopTimeRangeLabel(timeRange)}
                    onClick={() => setTab("Users")}
                  />
                  <StatTile
                    value={dashboardTotalStamps}
                    label="Total Stamps"
                    onClick={() => {
                      setActivityView("activity");
                      setTab("Activity");
                    }}
                  />
                  <StatTile
                    value={metrics.rewardsRedeemed}
                    label="Gifts Redeemed"
                    trend={redemptionRate}
                    onClick={() => {
                      setActivityView("gifts");
                      setTab("Activity");
                    }}
                  />
                  <StatTile
                    value={overviewCommentCardRating}
                    label="Comment Card Rating"
                    trend={`+${commentCardsLast24Hours}`}
                    onClick={() => setTab("Comment Cards")}
                  />
                  <StatTile
                    value={averageVisitsPerCustomer}
                    label="Average Visits"
                  />
                  <StatTile value={repeatRate} label="Repeat Rate" />
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                  <Panel className="min-h-[330px]">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-[19px] font-black text-white">
                          Activity Overview
                        </h2>
                        <p className="mt-1 text-[12px] font-bold text-white/70">
                          Track stamps, rewards, and customer visits.
                        </p>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-white">
                        {desktopTimeRangeLabel(timeRange)}
                      </span>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/72">
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        Stamps Issued
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        Gifts Redeemed
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        Customer Visits
                      </span>
                    </div>

                    <LineChart />

                    <div className="mt-7 grid grid-cols-3 gap-4 border-t border-white/18 pt-5">
                      <MiniStat
                        label="Stamps Issued"
                        value={visibleStampsIssued}
                      />
                      <MiniStat
                        label="Gifts Redeemed"
                        value={metrics.rewardsRedeemed}
                      />
                      <MiniStat
                        label="Customer Visits"
                        value={activeCustomers}
                      />
                    </div>
                  </Panel>

                  <Panel>
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="text-[18px] font-black text-white">
                        Customer Segments
                      </h2>
                      <span className="text-[11px] font-black text-white/70">
                        Customers
                      </span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] items-center gap-5">
                      <DonutChart
                        value={desktopSafeRatio(
                          activeReportCustomers,
                          Math.max(1, totalCustomers),
                        )}
                      />
                      <div className="space-y-3">
                        <Bar
                          label="Active Customers"
                          value={desktopSafeRatio(
                            activeReportCustomers,
                            Math.max(1, totalCustomers),
                          )}
                        />
                        <Bar
                          label="Repeat Customers"
                          value={desktopSafeRatio(
                            returningCustomerCount,
                            Math.max(1, totalCustomers),
                          )}
                        />
                        <Bar
                          label="Gift Users"
                          value={desktopSafeRatio(
                            recentRewardClients,
                            Math.max(1, totalCustomers),
                          )}
                        />
                        <Bar
                          label="Inactive Customers"
                          value={desktopSafeRatio(
                            inactiveCustomerCount,
                            Math.max(1, totalCustomers),
                          )}
                        />
                      </div>
                    </div>
                  </Panel>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <Panel>
                    <h2 className="mb-5 text-[18px] font-black text-white">
                      Loyalty Performance
                    </h2>
                    <InsightRow label="Repeat Rate" value={repeatRate} />
                    <InsightRow
                      label="Redemption Rate"
                      value={redemptionPerformanceRate}
                    />
                    <InsightRow
                      label="Average Stamps per Customer"
                      value={averageStampsPerCustomer}
                    />
                    <InsightRow
                      label="Average Visits per Customer"
                      value={averageVisitsPerCustomer}
                    />
                    <InsightRow
                      label="Gift Conversion"
                      value={giftConversionRate}
                    />
                  </Panel>

                  <Panel>
                    <h2 className="mb-5 text-[18px] font-black text-white">
                      Top Insights
                    </h2>
                    <InsightRow
                      label="Most Active Category"
                      value={metrics.mostActiveCategoryName || "—"}
                    />
                    <InsightRow
                      label="Top Customer"
                      value={mostActiveCustomer}
                    />
                    <InsightRow
                      label="Most Used Reward"
                      value={
                        topReward === "—" ? "No reward used yet" : topReward
                      }
                    />
                    <InsightRow
                      label="Best Performing Day"
                      value={bestPerformingDay}
                    />
                    <InsightRow
                      label="Customers Needing Attention"
                      value={`${inactiveCustomerCount} inactive customers`}
                    />
                  </Panel>

                  <Panel>
                    <h2 className="mb-5 text-[18px] font-black text-white">
                      Needs Attention
                    </h2>
                    <InsightRow
                      label="No Visits"
                      value={`${inactiveCustomerCount} customers`}
                    />
                    <InsightRow
                      label="At Risk"
                      value={`${atRiskCustomerCount} customers`}
                    />
                    <InsightRow
                      label="Rewards Redeemed"
                      value={`${metrics.rewardsRedeemed} redeemed`}
                    />
                    <InsightRow
                      label="Repeat Customers"
                      value={`${returningCustomerCount} this period`}
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTab("Users");
                          setLastVisitFilter("inactive");
                        }}
                        className="rounded-full bg-[#ffd66b] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#243b42]"
                      >
                        View Inactive
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("Activity")}
                        className="rounded-full bg-white/12 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white"
                      >
                        View Activity
                      </button>
                    </div>
                  </Panel>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <Panel>
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="text-[18px] font-black text-white">
                        Customer Summary
                      </h2>
                      <button
                        type="button"
                        onClick={() => setTab("Users")}
                        className="text-[11px] font-black text-white"
                      >
                        View behavior
                      </button>
                    </div>

                    <div className="overflow-hidden">
                      <AdminUserMetricRow
                        label="Total Customers"
                        value={totalCustomers}
                      />
                      <AdminUserMetricRow
                        label="New Customers This Month"
                        value={newCustomersThisMonth}
                      />
                      <AdminUserMetricRow
                        label="New Customers This Week"
                        value={newCustomersThisWeek}
                      />
                      <AdminUserMetricRow
                        label="Monthly Active Customers"
                        value={monthlyActiveUsers}
                      />
                      <AdminUserMetricRow
                        label="Inactive Customers"
                        value={inactiveCustomerCount}
                        trend={inactiveRate}
                        negative={inactiveCustomerCount > 0}
                      />
                      <AdminUserMetricRow
                        label="VIP Customers"
                        value={vipCustomerCount}
                      />
                      <AdminUserMetricRow
                        label="At Risk Customers"
                        value={atRiskCustomerCount}
                      />
                    </div>
                  </Panel>

                  <Panel>
                    <h2 className="mb-5 text-[18px] font-black text-white">
                      Recent Activity
                    </h2>
                    <div className="space-y-3">
                      {latestActivities.length > 0 ? (
                        latestActivities.slice(0, 5).map((txn) => (
                          <div
                            key={txn.id}
                            className="flex items-center justify-between gap-4 rounded-[16px] bg-white/8 px-4 py-3"
                          >
                            <div>
                              <div className="text-[12px] font-black text-white">
                                {profileNamesById[txn.client_id] ?? "Customer"}{" "}
                                earned 1 stamp
                              </div>
                              <div className="mt-1 text-[11px] font-bold text-white/58">
                                {txn.category_id
                                  ? categoryNamesById[txn.category_id] ?? "Loyalty activity"
                                  : "Loyalty activity"}
                              </div>
                            </div>
                            <div className="text-right text-[10px] font-black uppercase tracking-[0.12em] text-white/58">
                              {formatDateTime(txn.created_at)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[16px] bg-white/8 px-4 py-5 text-[12px] font-bold text-white/62">
                          No recent activity yet.
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              </section>
            ) : null}

            {tab === "Users" ? (
              <section>
                {selectedUser ? (
                  <DesktopClientProfilePanel
                    user={selectedUser}
                    currentUserId={profile.id}
                    categories={selectedCategories}
                    stamps={selectedStamps}
                    rewards={selectedRewards}
                    activities={activityTxns.filter(
                      (txn) =>
                        txn.client_id === selectedUser.id &&
                        txn.action_type !== "manual_adjustment",
                    )}
                    loading={selectedLoading}
                    onBack={() => setSelectedUser(null)}
                    onRoleChange={(role) => void setRole(selectedUser.id, role)}
                    onDeactivate={() => void deactivateUser(selectedUser.id)}
                    onReactivate={(role) =>
                      void reactivateUser(selectedUser.id, role)
                    }
                    onAddStamp={(categoryId) =>
                      void addStampToSelectedClient(categoryId)
                    }
                    onRemoveStamp={(categoryId) =>
                      void removeStampFromSelectedClient(categoryId)
                    }
                    onSendGift={(gift, description) =>
                      void sendGiftToSelectedClient(gift, description)
                    }
                  />
                ) : (
                  <>
                    <div className="mb-4 min-h-[calc(100vh-48px)] w-full rounded-[30px] bg-white/10 p-5 shadow-[0_26px_70px_rgba(35,54,47,0.22)] backdrop-blur-2xl">
                      <div className="mb-4 flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <h2 className="mt-1 shrink-0 text-[24px] font-black tracking-[-0.04em] text-white">
                          Customer behavior
                        </h2>

                        <div className="ml-auto flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
                          <input
                            value={searchTerm}
                            onChange={(event) => {
                              setSearchTerm(event.target.value);
                              setVisibleUserCount(15);
                              setSelectedUser(null);
                            }}
                            placeholder="Search by name, phone, member ID..."
                            onFocus={() => setReportFiltersOpen(false)}
                            className="h-9 min-w-0 rounded-[11px] border border-white/25 bg-white px-3 text-[11px] font-bold text-black outline-none focus:border-[#ffd66b] sm:w-[320px] lg:w-[380px]"
                          />

                          <div ref={reportFilterRef} className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setReportFiltersOpen((current) => !current)
                              }
                              className="h-10 rounded-[12px] border border-white/25 bg-white/12 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/18"
                            >
                              Filter
                            </button>

                            {reportFiltersOpen ? (
                              <div className="absolute right-0 top-12 z-30 w-[300px] rounded-[22px] bg-[#365665] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                                <div className="space-y-4">
                                  <label className="block">
                                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                                      Date Range
                                    </span>
                                    <select
                                      value={timeRange}
                                      onChange={(event) => {
                                        setTimeRange(
                                          event.target
                                            .value as DesktopTimeRange,
                                        );
                                        setReportFiltersOpen(false);
                                      }}
                                      className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                                    >
                                      <option value="today">Today</option>
                                      <option value="week">This week</option>
                                      <option value="month">This month</option>
                                      <option value="all">Show all</option>
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                                      Last Visit
                                    </span>
                                    <select
                                      value={lastVisitFilter}
                                      onChange={(event) => {
                                        setLastVisitFilter(
                                          event.target.value as
                                            | "all"
                                            | "active"
                                            | "inactive",
                                        );
                                        setReportFiltersOpen(false);
                                      }}
                                      className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                                    >
                                      <option value="all">All</option>
                                      <option value="active">
                                        Active recently
                                      </option>
                                      <option value="inactive">
                                        Inactive recently
                                      </option>
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                                      Profile Tab
                                    </span>
                                    <select
                                      value={filter}
                                      onChange={(event) => {
                                        setFilter(
                                          event.target.value as
                                            | "all"
                                            | UserRole,
                                        );
                                        setReportFiltersOpen(false);
                                      }}
                                      className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                                    >
                                      <option value="all">All profiles</option>
                                      <option value="client">Clients</option>
                                      <option value="staff">Staff</option>
                                      <option value="master_admin">
                                        Admin
                                      </option>
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                                      Status
                                    </span>
                                    <select
                                      value={customerStatusFilter}
                                      onChange={(event) =>
                                        setCustomerStatusFilter(
                                          event.target
                                            .value as typeof customerStatusFilter,
                                        )
                                      }
                                      className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                                    >
                                      <option value="all">All status</option>
                                      <option value="active">Recent 0–7</option>
                                      <option value="inactive">
                                        Overdue 31+
                                      </option>
                                      <option value="at_risk">
                                        At Risk 31+
                                      </option>
                                      <option value="vip">VIP</option>
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                                      Gender
                                    </span>
                                    <select
                                      value={customerGenderFilter}
                                      onChange={(event) =>
                                        setCustomerGenderFilter(
                                          event.target
                                            .value as typeof customerGenderFilter,
                                        )
                                      }
                                      className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                                    >
                                      <option value="all">All genders</option>
                                      <option value="male">Male</option>
                                      <option value="female">Female</option>
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                                      Age Range
                                    </span>
                                    <select
                                      value={customerAgeRangeFilter}
                                      onChange={(event) =>
                                        setCustomerAgeRangeFilter(
                                          event.target
                                            .value as typeof customerAgeRangeFilter,
                                        )
                                      }
                                      className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                                    >
                                      <option value="all">All ages</option>
                                      <option value="18-24">18–24</option>
                                      <option value="25-34">25–34</option>
                                      <option value="35-44">35–44</option>
                                      <option value="45+">45+</option>
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                                      Visit Range
                                    </span>
                                    <select
                                      value={customerVisitRangeFilter}
                                      onChange={(event) =>
                                        setCustomerVisitRangeFilter(
                                          event.target
                                            .value as typeof customerVisitRangeFilter,
                                        )
                                      }
                                      className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                                    >
                                      <option value="all">All visits</option>
                                      <option value="0">0 visits</option>
                                      <option value="1-3">1–3 visits</option>
                                      <option value="4-10">4–10 visits</option>
                                      <option value="10+">10+</option>
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                                      Value Range
                                    </span>
                                    <select
                                      value={customerValueRangeFilter}
                                      onChange={(event) =>
                                        setCustomerValueRangeFilter(
                                          event.target
                                            .value as typeof customerValueRangeFilter,
                                        )
                                      }
                                      className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                                    >
                                      <option value="all">All values</option>
                                      <option value="0">$0</option>
                                      <option value="1-50">$1–$50</option>
                                      <option value="50-200">$50–$200</option>
                                      <option value="200+">$200+</option>
                                    </select>
                                  </label>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={downloadVisibleCustomerTable}
                            title="Download table"
                            aria-label="Download table"
                            className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/25 bg-white/12 text-white transition hover:bg-white/18"
                          >
                            <svg
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M12 3v11m0 0 4-4m-4 4-4-4"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M5 17v2.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V17"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div
                        className="mb-4 grid w-full gap-2"
                        style={{
                          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        }}
                      >
                        <DesktopReportMetric
                          label="New Customers"
                          value={newCustomerCount}
                        />
                        <DesktopReportMetric
                          label="Returning"
                          value={returningCustomerCount}
                        />
                        <DesktopReportMetric
                          label="Active"
                          value={activeReportCustomers}
                        />
                        <DesktopReportMetric
                          label="Inactive"
                          value={inactiveCustomerCount}
                        />
                        <DesktopReportMetric
                          label="At Risk"
                          value={atRiskCustomerCount}
                        />
                        <DesktopReportMetric
                          label="VIP"
                          value={vipCustomerCount}
                        />
                        <DesktopReportMetric
                          label="Avg. Visits"
                          value={averageVisitsPerCustomer}
                        />
                      </div>

                      <div className="w-full overflow-hidden rounded-[22px] bg-white/10">
                        <div
                          className="grid gap-4 border-b border-white/14 bg-white/6 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/58"
                          style={{
                            gridTemplateColumns: CUSTOMER_TABLE_GRID,
                            width: "100%",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => sortCustomerTable("name")}
                            className={customerHeaderClass("name")}
                          >
                            Names
                          </button>
                          <button
                            type="button"
                            onClick={() => sortCustomerTable("contact")}
                            className={customerHeaderClass("contact")}
                          >
                            Contact
                          </button>
                          <button
                            type="button"
                            onClick={() => sortCustomerTable("lastVisit")}
                            className={customerHeaderClass("lastVisit")}
                          >
                            Last Visit
                          </button>
                          <div>Days Ago</div>
                          <button
                            type="button"
                            onClick={() => sortCustomerTable("visits")}
                            className={customerHeaderClass("visits")}
                          >
                            Visits
                          </button>
                          <button
                            type="button"
                            onClick={() => sortCustomerTable("lifetime")}
                            className={customerHeaderClass("lifetime")}
                          >
                            Lifetime $
                          </button>
                          <button
                            type="button"
                            onClick={() => sortCustomerTable("gifts")}
                            className={customerHeaderClass("gifts")}
                          >
                            Gifts
                          </button>
                          <button
                            type="button"
                            onClick={() => sortCustomerTable("status")}
                            className={customerHeaderClass("status")}
                          >
                            Status
                          </button>
                          <div className="text-left">Actions</div>
                          <div className="text-left">Last Contacted</div>
                        </div>

                        <div className="max-h-[560px] overflow-auto">
                          {sortedCustomerReportRows.slice(0, 80).map((row) => {
                            const digits = String(row.user.phone || "").replace(
                              /\D/g,
                              "",
                            );
                            const whatsappUrl = digits
                              ? `https://wa.me/${digits}`
                              : "";
                            const contactKeys = sharedContactKeys(
                              row.user.phone,
                              row.user.email,
                              row.user.full_name || row.user.id,
                            );
                            const lastContactedDates = contactHistoryForKeys(contactKeys).slice(0, 2);

                            return (
                              <div
                                key={row.user.id}
                                className="grid gap-4 px-4 py-3 text-[12px] font-bold text-white/78 transition hover:bg-white/10"
                                style={{
                                  gridTemplateColumns: CUSTOMER_TABLE_GRID,
                                  width: "100%",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => void openUserProfile(row.user)}
                                  className="min-w-0 text-left"
                                >
                                  <div className="truncate font-black text-white">
                                    {row.user.full_name || "Client"}
                                  </div>
                                  <div className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#ffd66b]">
                                    {row.user.client_code || "No ID"}
                                  </div>
                                </button>

                                <div className="min-w-0">
                                  <div className="truncate">
                                    {row.user.phone || "—"}
                                  </div>
                                </div>

                                <div>
                                  {desktopFormatDateOnly(row.lastVisit)}
                                </div>
                                <div>
                                  <span
                                    className={`inline-flex min-w-[34px] justify-center rounded-full px-2 py-1 text-[10px] font-black ${daysAgoClass(row.daysSinceLastVisit)}`}
                                  >
                                    {row.daysSinceLastVisit ?? "—"}
                                  </span>
                                </div>
                                <div className="font-black text-white">
                                  {row.totalVisits}
                                </div>
                                <div className="font-black text-white">
                                  {desktopFormatMoney(row.lifetimeValue)}
                                </div>
                                <div className="font-black text-white">
                                  {row.giftsCount}
                                </div>
                                <div>
                                  <span
                                    className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${daysAgoStatusClass(row.daysSinceLastVisit)}`}
                                  >
                                    {daysAgoStatusLabel(row.daysSinceLastVisit)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-start gap-2">
                                  {row.user.role === "client" ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openQuickGift(row.user);
                                      }}
                                      className="rounded-full bg-[#ffd66b] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white"
                                    >
                                      Gift
                                    </button>
                                  ) : (
                                    <span className="text-white/36">—</span>
                                  )}
                                  {whatsappUrl ? (
                                    <a
                                      href={whatsappUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full bg-[#25D366] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white"
                                    >
                                      WA
                                    </a>
                                  ) : (
                                    <span className="text-white/36">—</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      markCustomerContacted(row.user);
                                    }}
                                    className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#365665]"
                                  >
                                    Contacted
                                  </button>
                                </div>
                                <div className="space-y-0.5 text-[11px] font-black text-white/72">
                                  {lastContactedDates.length > 0 ? (
                                    lastContactedDates.map((date) => (
                                      <div key={date}>{desktopFormatDateTime(date)}</div>
                                    ))
                                  ) : (
                                    <span className="text-white/42">—</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {sortedCustomerReportRows.length === 0 ? (
                            <div className="px-4 py-6 text-center text-[13px] font-bold text-white/60">
                              No customer report data for this view.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </section>
            ) : null}

            {tab === "Activity" || tab === "Gifts" ? (
              <section className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[24px] font-black tracking-[-0.04em] text-white">
                      {tab === "Activity" ? "Activity" : "Gifts"}
                    </h2>
                    <p className="mt-1 text-[12px] font-bold text-white/65">
                      {tab === "Activity"
                        ? "Track daily loyalty activity and stamp history."
                        : "Track rewards, sent gifts, expiry, and usage."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={activityGiftSearch}
                      onChange={(event) =>
                        setActivityGiftSearch(event.target.value)
                      }
                      placeholder="Search client name..."
                      className="h-10 w-[280px] shrink-0 rounded-[13px] border-0 bg-white px-4 text-[12px] font-bold text-[#365665] outline-none placeholder:text-[#365665]/45"
                    />

                    <DesktopTimeRangeFilter
                      value={timeRange}
                      onChange={setTimeRange}
                    />

                    <button
                      type="button"
                      onClick={tab === "Activity" ? downloadActivityTable : downloadGiftsTable}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/24 bg-white/5 text-white transition hover:bg-white/12 hover:text-[#ffd66b]"
                      aria-label={tab === "Activity" ? "Download activity table" : "Download gifts table"}
                      title={tab === "Activity" ? "Download activity table" : "Download gifts table"}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3v11" />
                        <path d="m7 10 5 5 5-5" />
                        <path d="M5 21h14" />
                      </svg>
                    </button>
                  </div>
                </div>

                {tab === "Gifts" ? (
                  <div
                    className="grid w-full gap-2"
                    style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
                  >
                    <DesktopGiftSummaryCard
                      label="Gifts sent"
                      value={giftDashboardSummary.giftsSent}
                    />
                    <DesktopGiftSummaryCard
                      label="Redeemed"
                      value={giftDashboardSummary.redeemed}
                    />
                    <DesktopGiftSummaryCard
                      label="Gift value"
                      value={desktopFormatMoney(giftDashboardSummary.giftValue)}
                    />
                    <DesktopGiftSummaryCard
                      label="Expired"
                      value={`${giftDashboardSummary.expiredCount} / ${desktopFormatMoney(giftDashboardSummary.expiredValue)}`}
                    />
                    <DesktopGiftSummaryCard
                      label="Discounts sent"
                      value={giftDashboardSummary.discountsSent}
                    />
                    <DesktopGiftSummaryCard
                      label="Expiring soon"
                      value={giftDashboardSummary.expiringSoon}
                    />
                    <DesktopGiftSummaryCard
                      label="Pending"
                      value={giftDashboardSummary.pendingRegistration}
                    />
                  </div>
                ) : null}

                {tab === "Activity" ? (
                  <div className="w-full overflow-hidden rounded-[24px] bg-white/10 shadow-[0_22px_60px_rgba(0,0,0,0.10)]">
                    <div
                      className="grid gap-4 border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/58"
                      style={{
                        gridTemplateColumns:
                          "1.15fr 1fr 1fr 0.7fr 0.55fr 0.55fr",
                      }}
                    >
                      <div>Client Name</div>
                      <div>Category</div>
                      <div>Issue By</div>
                      <div>Date</div>
                      <div>Days Ago</div>
                      <div>Time</div>
                    </div>

                    <div className="max-h-[560px] overflow-auto">
                      {filteredActivityRows.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[13px] font-bold text-white/60">
                          No activity for this time range.
                        </div>
                      ) : null}

                      {filteredActivityRows.map((transaction) => {
                        const clientName =
                          profileNamesById[transaction.client_id ?? ""] ??
                          "Client";
                        const actorName =
                          profileNamesById[transaction.staff_id ?? ""] ||
                          (transaction.staff_id ? "Staff user" : "System");
                        const categoryName =
                          categoryNamesById[transaction.category_id ?? ""] ||
                          (transaction.action_type === "reward_redeemed"
                            ? "Gift"
                            : "—");
                        const days = desktopDaysAgo(transaction.created_at);

                        return (
                          <div
                            key={transaction.id}
                            className="grid gap-4 border-b border-white/10 px-4 py-3 text-[12px] font-bold text-white/78 transition last:border-b-0 hover:bg-white/10"
                            style={{
                              gridTemplateColumns:
                                "1.15fr 1fr 1fr 0.7fr 0.55fr 0.55fr",
                            }}
                          >
                            <div className="truncate font-black text-white">
                              {clientName}
                            </div>
                            <div className="truncate">{categoryName}</div>
                            <div className="truncate">{actorName}</div>
                            <div>
                              {desktopFormatDateOnly(transaction.created_at)}
                            </div>
                            <div>
                              <span
                                className={`inline-flex min-w-[42px] justify-center rounded-full px-2 py-1 text-[10px] font-black ${activityDaysBadgeClass(days)}`}
                              >
                                {activityDaysLabel(days)}
                              </span>
                            </div>
                            <div>
                              {desktopFormatTimeOnly(transaction.created_at)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {[
                        ["all", "All"],
                        ["loyalty", "Loyalty Rewards"],
                        ["birthday", "Birthday Gifts"],
                        ["sent", "Sent Gifts"],
                        ["comment_cards", "Comment Cards"],
                        ["games", "Games"],
                        ["available", "Available"],
                        ["used", "Used"],
                        ["expired", "Expired"],
                        ["expiring", "Expiring Soon"],
                        ["pending", "Pending Registration"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setGiftFilter(value as typeof giftFilter)
                          }
                          className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                            giftFilter === value
                              ? "bg-[#ffd66b] text-[#365665]"
                              : "bg-white/10 text-white/70 hover:bg-white/16"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="w-full overflow-hidden rounded-[24px] bg-white/10 shadow-[0_22px_60px_rgba(0,0,0,0.10)]">
                      <div
                        className="grid gap-4 border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/58"
                        style={{
                          gridTemplateColumns:
                            "1fr 0.52fr 1.05fr 0.72fr 0.64fr 0.58fr 0.7fr 0.7fr 0.72fr 0.58fr 1fr 0.82fr",
                        }}
                      >
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

                      <div className="max-h-[560px] overflow-auto">
                        {filteredGiftDashboardRows.length === 0 ? (
                          <div className="px-4 py-8 text-center text-[13px] font-bold text-white/60">
                            No gifts for this view.
                          </div>
                        ) : null}

                        {filteredGiftDashboardRows.map((reward) => {
                          const clientName = giftClientName(reward);
                          const typeInfo = rewardTypeInfo(reward);
                          const statusInfo = giftStatusInfo(reward);
                          const leftInfo = giftLeftInfo(reward);
                          const issueDate = rewardIssueDate(reward);
                          const memberSince = giftMemberSince(reward);
                          const expiry = rewardExpiryDate(reward);
                          const whatsappUrl = giftWhatsappUrl(reward);
                          const contactKeys = giftContactKeys(reward);
                          const lastContactedDates = contactHistoryForKeys(contactKeys).slice(0, 2);

                          return (
                            <div
                              key={reward.id}
                              className="grid gap-4 border-b border-white/10 px-4 py-3 text-[12px] font-bold text-white/78 transition last:border-b-0 hover:bg-white/10"
                              style={{
                                gridTemplateColumns:
                                  "1fr 0.52fr 1.05fr 0.72fr 0.64fr 0.58fr 0.7fr 0.7fr 0.72fr 0.58fr 1fr 0.82fr",
                              }}
                            >
                              <div className="truncate font-black text-white">
                                {clientName}
                              </div>
                              <div className="truncate">{typeInfo.type}</div>
                              <div className="truncate">
                                {giftDisplayName(reward)}
                              </div>
                              <div>
                                <span
                                  className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${statusInfo.className}`}
                                >
                                  {statusInfo.label}
                                </span>
                              </div>
                              <div>{desktopFormatDateOnly(expiry)}</div>
                              <div className="font-black text-white">
                                {leftInfo.label}
                              </div>
                              <div className="truncate">
                                {typeInfo.issuedBy}
                              </div>
                              <div>{desktopFormatDateOnly(issueDate)}</div>
                              <div>{desktopFormatDateOnly(memberSince)}</div>
                              <div className="truncate">{typeInfo.source}</div>
                              <div className="flex items-center gap-2">
                                {whatsappUrl ? (
                                  <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-[10px] font-black uppercase tracking-[0.1em] text-white transition hover:scale-[1.03]"
                                    title="Open WhatsApp"
                                    aria-label="Open WhatsApp"
                                  >
                                    WA
                                  </a>
                                ) : (
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[10px] font-black text-white/36">
                                    WA
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => markGiftContacted(reward)}
                                  className="inline-flex h-8 items-center justify-center rounded-full bg-white px-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#365665] transition hover:scale-[1.03]"
                                >
                                  Contacted
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteGiftReward(reward)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700 shadow-[0_10px_24px_rgba(0,0,0,0.10)] transition hover:scale-[1.03] hover:bg-red-200"
                                  title="Delete gift"
                                  aria-label="Delete gift"
                                >
                                  <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    className="h-[18px] w-[18px]"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4h8v2" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v5" />
                                    <path d="M14 11v5" />
                                  </svg>
                                </button>
                              </div>
                              <div className="space-y-0.5 text-[11px] font-black text-white/72">
                                {lastContactedDates.length > 0 ? (
                                  lastContactedDates.map((date) => (
                                    <div key={date}>{desktopFormatDateTime(date)}</div>
                                  ))
                                ) : (
                                  <span className="text-white/42">—</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {giftDashboardOpen ? (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
                    onClick={closeGiftDashboardModal}
                  >
                    <div
                      className="w-full max-w-[480px] rounded-[28px] bg-[#365665]/88 p-5 text-white shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="mb-5 flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ffd66b] p-3">
                          <img
                            src="/gift.png"
                            alt="Gift"
                            className="h-full w-full object-contain"
                          />
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-[22px] font-black tracking-[-0.03em] text-white">
                            Send Gift
                          </h3>
                          <p className="mt-1 text-[12px] font-bold leading-5 text-white/66">
                            Send a gift to any loyalty client.
                          </p>
                        </div>
                      </div>

                      <label className="mb-4 block">
                        <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/66">
                          Client
                        </span>
                        <select
                          value={giftDashboardClientId}
                          onChange={(event) =>
                            setGiftDashboardClientId(event.target.value)
                          }
                          className="h-12 w-full rounded-[16px] border-0 bg-white/12 px-4 text-[13px] font-black text-white outline-none"
                        >
                          {dashboardGiftClientOptions.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.full_name ||
                                client.email ||
                                client.client_code ||
                                "Client"}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="mb-4 block">
                        <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/66">
                          Gifts
                        </span>
                        <select
                          value={giftDashboardCategoryId}
                          onChange={(event) =>
                            setGiftDashboardCategoryId(event.target.value)
                          }
                          className="h-12 w-full rounded-[16px] border-0 bg-white/12 px-4 text-[13px] font-black text-white outline-none"
                        >
                          {dashboardGiftCategoryOptions.map((category) => (
                            <option key={category.id} value={category.id}>
                              Free {category.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="mb-4 block">
                        <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/66">
                          Expiry Date
                        </span>
                        <input
                          type="date"
                          value={giftDashboardExpiry}
                          onChange={(event) =>
                            setGiftDashboardExpiry(event.target.value)
                          }
                          className="h-12 w-full rounded-[16px] border-0 bg-white/12 px-4 text-[13px] font-black text-white outline-none"
                        />
                      </label>

                      <label className="mb-5 block">
                        <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/66">
                          Optional Note
                        </span>
                        <textarea
                          value={giftDashboardNote}
                          onChange={(event) =>
                            setGiftDashboardNote(event.target.value)
                          }
                          rows={2}
                          placeholder="Optional note..."
                          className="w-full rounded-[16px] border-0 bg-white/12 px-4 py-3 text-[13px] font-semibold text-white placeholder:text-white/45 outline-none"
                        />
                      </label>

                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={closeGiftDashboardModal}
                          className="rounded-full bg-white/10 px-5 py-3 text-[12px] font-black text-white transition hover:bg-white/16"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void sendDashboardGift()}
                          className="rounded-full bg-[#ffd66b] px-6 py-3 text-[12px] font-black text-[#365665] transition hover:bg-[#f0cf61]"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {tab === "Birthdays" ? (
              <section className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[24px] font-black tracking-[-0.04em] text-white">
                      Birthdays
                    </h2>
                    <p className="mt-1 text-[12px] font-bold text-white/65">
                      Track customer birthdays, birthday gifts, messages, and claims.
                    </p>
                  </div>

                  <div className="flex w-full max-w-[1120px] flex-nowrap items-center justify-end gap-2 overflow-x-auto lg:ml-auto">
                    {selectedBirthdayRowIds.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={requestSelectedBirthdayGifts}
                          className="shrink-0 rounded-full bg-[#ffd66b] px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#365665] transition hover:bg-[#f0cf61]"
                        >
                          Gift selected ({selectedBirthdayRowIds.length})
                        </button>
                        <button
                          type="button"
                          onClick={requestSelectedBirthdayDelete}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-red-300/35 bg-red-500/18 text-white transition hover:bg-red-500/28"
                          aria-label="Delete selected birthdays"
                          title="Delete selected birthdays"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v5" />
                            <path d="M14 11v5" />
                          </svg>
                        </button>
                      </>
                    ) : null}
                    <input
                      value={birthdaySearch}
                      onChange={(event) => setBirthdaySearch(event.target.value)}
                      placeholder="Search client name..."
                      className="h-10 w-[280px] shrink-0 rounded-[13px] border-0 bg-white px-4 text-[12px] font-bold text-[#365665] outline-none placeholder:text-[#365665]/45"
                    />
                    <button
                      type="button"
                      onClick={openBirthdayCreateModal}
                      className="h-10 shrink-0 rounded-[13px] bg-[#ffd66b] px-5 text-[11px] font-black uppercase tracking-[0.12em] text-[#365665] transition hover:bg-[#f0cf61]"
                    >
                      Create
                    </button>
                    <div className="flex h-10 shrink-0 items-center rounded-[14px] bg-white/10 p-1">
                      {([
                        ["today", "Today"],
                        ["week", "This week"],
                        ["month", "This month"],
                        ["all", "Show all"],
                      ] as Array<[BirthdayFilter, string]>).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBirthdayFilter(value)}
                          className={`h-8 rounded-[11px] px-5 text-[11px] font-black transition ${
                            birthdayFilter === value
                              ? "bg-[#ffd66b] text-[#213f4b]"
                              : "text-white hover:text-[#ffd66b]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={downloadBirthdayTable}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-white/24 bg-white/5 text-white transition hover:bg-white/12 hover:text-[#ffd66b]"
                      aria-label="Download birthdays table"
                      title="Download birthdays table"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3v11" />
                        <path d="m7 10 5 5 5-5" />
                        <path d="M5 21h14" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid w-full gap-2" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
                  <DesktopGiftSummaryCard label="Today’s Birthdays" value={birthdaySummary.today} />
                  <DesktopGiftSummaryCard label="This Week" value={birthdaySummary.week} />
                  <DesktopGiftSummaryCard label="This Month" value={birthdaySummary.month} />
                  <DesktopGiftSummaryCard label="Gifts Sent" value={birthdaySummary.giftsSent} />
                  <DesktopGiftSummaryCard label="Claimed Gifts" value={birthdaySummary.claimedGifts} />
                  <DesktopGiftSummaryCard label="Pending Gifts" value={birthdaySummary.pendingGifts} />
                </div>

                <div className="w-full overflow-hidden rounded-[24px] bg-white/10 shadow-[0_22px_60px_rgba(0,0,0,0.10)]">
                  <div
                    className="grid gap-3 border-b border-white/10 px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-white/72"
                    style={{ gridTemplateColumns: "0.18fr 1.05fr 0.36fr 0.58fr 0.48fr 0.8fr 0.72fr 0.68fr 0.72fr 0.56fr 1.14fr 0.78fr" }}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filteredBirthdayRows.length > 0 && filteredBirthdayRows.every((row) => selectedBirthdayRowIds.includes(row.id))}
                        onChange={toggleAllBirthdayRows}
                        className="h-4 w-4 rounded border-white/30 accent-[#ffd66b]"
                        aria-label="Select all birthday rows"
                      />
                    </div>
                    {renderBirthdaySortHeader("Name", "name")}
                    {renderBirthdaySortHeader("Age", "age")}
                    {renderBirthdaySortHeader("Birthday", "birthday")}
                    {renderBirthdaySortHeader("Days Left", "days_left")}
                    {renderBirthdaySortHeader("Gifts", "gifts")}
                    {renderBirthdaySortHeader("Gift Status", "gift_status")}
                    {renderBirthdaySortHeader("Last Visit", "last_visit")}
                    {renderBirthdaySortHeader("Gift Sent", "gift_sent")}
                    {renderBirthdaySortHeader("Source", "source")}
                    <div>Actions</div>
                    {renderBirthdaySortHeader("Last Contacted", "last_contacted")}
                  </div>

                  <div className="max-h-[570px] overflow-auto">
                    {filteredBirthdayRows.length === 0 ? (
                      <div className="px-4 py-8 text-center text-[13px] font-bold text-white/60">
                        No birthdays match this view.
                      </div>
                    ) : (
                      filteredBirthdayRows.map((row, index) => {
                        const age = getAgeFromBirthday(row.birthdayValue);
                        const lastContactedDates = mergeContactDates(
                          contactHistoryForKeys(row.lastContactedKeys ?? [row.lastContactedKey]),
                          birthdayContactHistory[row.lastContactedKey],
                          commentContactHistory[row.lastContactedKey],
                          row.sourceId ? birthdayContactHistory[row.sourceId] : undefined,
                          row.sourceId ? commentContactHistory[row.sourceId] : undefined,
                          row.commentCard?.id ? birthdayContactHistory[row.commentCard.id] : undefined,
                          row.commentCard?.id ? commentContactHistory[row.commentCard.id] : undefined,
                        )
                          .slice(0, 2)
                          .map((date) => desktopFormatDate(date));
                        const giftAlreadySent = row.giftStatus !== "Not Sent";
                        const isBirthdaySelected = selectedBirthdayRowIds.includes(row.id);

                        return (
                          <div
                            key={row.id}
                            className="grid min-h-[66px] items-center gap-3 border-b border-white/8 px-4 py-3 text-[12px] font-bold text-white last:border-b-0"
                            style={{ gridTemplateColumns: "0.18fr 1.05fr 0.36fr 0.58fr 0.48fr 0.8fr 0.72fr 0.68fr 0.72fr 0.56fr 1.14fr 0.78fr" }}
                          >
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={isBirthdaySelected}
                                onChange={(event) =>
                                  toggleBirthdayRowSelection(row.id, index, (event.nativeEvent as MouseEvent).shiftKey)
                                }
                                className="h-4 w-4 rounded border-white/30 accent-[#ffd66b]"
                                aria-label={`Select ${row.name}`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-black text-white">{row.name}</div>
                              <div className="mt-1 truncate text-[11px] font-bold text-white/58">{row.contact}</div>
                            </div>
                            <div>{desktopAgeLabel(age)}</div>
                            <div>{desktopBirthdayDateLabel(row.birthdayValue)}</div>
                            <div>
                              <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${desktopBirthdayTimingClass(row.birthdayInfo?.timing ?? "Upcoming")}`}>
                                {desktopBirthdayDaysCode(row.birthdayValue)}
                              </span>
                            </div>
                            <div className="truncate">{row.giftName}</div>
                            <div>
                              <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${desktopBirthdayStatusClass(row.giftStatus)}`}>
                                {row.giftStatus}
                              </span>
                            </div>
                            <div>{desktopFormatDateOnly(row.latestVisit)}</div>
                            <div>{desktopFormatDateOnly(row.giftSentAt)}</div>
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/72">
                                {row.source}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={giftAlreadySent}
                                onClick={() => requestBirthdayGift(row)}
                                className={`rounded-full px-3 py-2 text-[10px] font-black uppercase transition ${
                                  giftAlreadySent
                                    ? "cursor-not-allowed bg-white/10 text-white/35"
                                    : "bg-[#ffd66b] text-[#365665] hover:bg-[#f0cf61]"
                                }`}
                              >
                                Gift
                              </button>
                              <button
                                type="button"
                                onClick={() => openBirthdayWhatsApp(row)}
                                className="rounded-full bg-emerald-500 px-3 py-2 text-[10px] font-black uppercase text-white transition hover:bg-emerald-400"
                              >
                                WA
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  markBirthdayContacted(
                                    row.lastContactedKeys ?? [row.lastContactedKey],
                                    row.sourceId ?? row.commentCard?.id ?? row.lastContactedKey,
                                  )
                                }
                                className="rounded-[12px] border border-[#ffd66b]/45 bg-white px-3 py-2 text-[10px] font-black uppercase text-[#365665] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition hover:bg-[#ffd66b]"
                              >
                                Contacted
                              </button>
                            </div>
                            <div className="space-y-1 text-[10px] font-black uppercase tracking-[0.08em] text-white/62">
                              {lastContactedDates.length > 0 ? (
                                lastContactedDates.map((date) => <div key={date}>{date}</div>)
                              ) : (
                                <div>—</div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {birthdayGiftConfirmRows ? (
              <div
                className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
                onMouseDown={() => setBirthdayGiftConfirmRows(null)}
              >
                <div
                  className="w-full max-w-[480px] rounded-[28px] border border-white/14 bg-[#375967] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                    Confirm birthday gifts
                  </div>
                  <h3 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-white">
                    Send 2 birthday gifts?
                  </h3>
                  <p className="mt-2 text-[13px] font-bold leading-6 text-white/70">
                    This will send <span className="text-[#ffd66b]">20% Discount</span> and <span className="text-[#ffd66b]">Free Dessert</span> to {birthdayGiftConfirmRows.length} customer{birthdayGiftConfirmRows.length === 1 ? "" : "s"}.
                  </p>
                  <div className="mt-4 max-h-[180px] overflow-auto rounded-[18px] bg-white/10 p-3">
                    {birthdayGiftConfirmRows.slice(0, 8).map((row) => (
                      <div key={row.id} className="flex items-center justify-between gap-3 border-b border-white/8 py-2 last:border-b-0">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-black text-white">{row.name}</div>
                          <div className="truncate text-[11px] font-bold text-white/55">{row.contact}</div>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">
                          {row.source}
                        </div>
                      </div>
                    ))}
                    {birthdayGiftConfirmRows.length > 8 ? (
                      <div className="pt-3 text-[11px] font-black text-white/60">
                        +{birthdayGiftConfirmRows.length - 8} more
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBirthdayGiftConfirmRows(null)}
                      className="rounded-full bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/16"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmBirthdayGiftSend()}
                      className="rounded-full bg-[#ffd66b] px-5 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#365665] transition hover:bg-[#f0cf61]"
                    >
                      Send gifts
                    </button>
                  </div>
                </div>
              </div>
            ) : null}


            {birthdayCreateOpen ? (
              <div
                className="fixed inset-0 z-[82] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
                onMouseDown={() => setBirthdayCreateOpen(false)}
              >
                <div
                  className="w-full max-w-[500px] rounded-[28px] border border-white/14 bg-[#375967] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                    Add birthday
                  </div>
                  <h3 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-white">
                    Add manual birthday user
                  </h3>
                  <p className="mt-2 text-[13px] font-bold leading-6 text-white/70">
                    This will save the customer in the birthday datasheet with Source = Datasheet.
                  </p>

                  <div className="mt-5 space-y-3">
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/62">
                        Name
                      </span>
                      <input
                        value={birthdayCreateName}
                        onChange={(event) => setBirthdayCreateName(event.target.value)}
                        placeholder="Customer name"
                        className="h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none placeholder:text-[#365665]/45"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/62">
                        Phone
                      </span>
                      <input
                        value={birthdayCreatePhone}
                        onChange={(event) => setBirthdayCreatePhone(event.target.value)}
                        placeholder="Phone number"
                        className="h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none placeholder:text-[#365665]/45"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/62">
                        Birthday
                      </span>
                      <input
                        type="date"
                        value={birthdayCreateDate}
                        onChange={(event) => setBirthdayCreateDate(event.target.value)}
                        className="h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBirthdayCreateOpen(false)}
                      className="rounded-full bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/16"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={birthdayCreateSaving}
                      onClick={() => void saveManualBirthdayDatasheetRow()}
                      className="rounded-full bg-[#ffd66b] px-5 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#365665] transition hover:bg-[#f0cf61] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {birthdayCreateSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}


            {birthdayDeleteConfirmRows ? (
              <div
                className="fixed inset-0 z-[82] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
                onMouseDown={() => setBirthdayDeleteConfirmRows(null)}
              >
                <div
                  className="w-full max-w-[500px] rounded-[28px] border border-white/14 bg-[#375967] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-red-200">
                    Confirm delete
                  </div>
                  <h3 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-white">
                    Delete selected birthday records?
                  </h3>
                  <p className="mt-2 text-[13px] font-bold leading-6 text-white/70">
                    This will remove the selected birthday data from the database. Datasheet rows are deleted. Comment Card and Loyalty rows keep the customer, but clear the birthday field.
                  </p>
                  <div className="mt-4 max-h-[200px] overflow-auto rounded-[18px] bg-white/10 p-3">
                    {birthdayDeleteConfirmRows.slice(0, 10).map((row) => (
                      <div key={row.id} className="flex items-center justify-between gap-3 border-b border-white/8 py-2 last:border-b-0">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-black text-white">{row.name}</div>
                          <div className="truncate text-[11px] font-bold text-white/55">{row.contact}</div>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">
                          {row.source}
                        </div>
                      </div>
                    ))}
                    {birthdayDeleteConfirmRows.length > 10 ? (
                      <div className="pt-3 text-[11px] font-black text-white/60">
                        +{birthdayDeleteConfirmRows.length - 10} more
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBirthdayDeleteConfirmRows(null)}
                      className="rounded-full bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/16"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmBirthdayDelete()}
                      className="rounded-full bg-red-500 px-5 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "Comment Cards" ? (
              <section className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[24px] font-black tracking-[-0.04em] text-white">
                      Comment Cards
                    </h2>
                    <p className="mt-1 text-[12px] font-bold text-white/65">
                      Review feedback, ratings, and follow up with customers.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={commentSearch}
                      onChange={(event) => setCommentSearch(event.target.value)}
                      placeholder="Search name, phone, comment..."
                      className="h-10 w-[320px] rounded-[13px] border-0 bg-white px-4 text-[12px] font-bold text-[#365665] outline-none placeholder:text-[#365665]/45"
                    />

                    <select
                      value={commentFilter}
                      onChange={(event) =>
                        setCommentFilter(
                          event.target.value as CommentCardFilter,
                        )
                      }
                      className="h-10 rounded-[13px] border-0 bg-white px-4 text-[12px] font-black text-[#365665] outline-none"
                    >
                      <option value="all">All Feedback</option>
                      <option value="registered">Registered Members</option>
                      <option value="not_registered">Not Registered</option>
                      <option value="five_star">5 Star Reviews</option>
                      <option value="low_rating">Needs Attention</option>
                      <option value="has_comments">Has Comments</option>
                      <option value="today">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                    </select>

                    <button
                      type="button"
                      onClick={downloadCommentCardsTable}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/24 bg-white/5 text-white transition hover:bg-white/12"
                      aria-label="Download comment cards table"
                      title="Download table"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3v11" />
                        <path d="m7 10 5 5 5-5" />
                        <path d="M5 21h14" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
                >
                  <DesktopGiftSummaryCard
                    label="Total Feedback"
                    value={commentCardSummary.total}
                  />
                  <DesktopGiftSummaryCard
                    label="Registered Members"
                    value={commentCardSummary.registered}
                  />
                  <DesktopGiftSummaryCard
                    label="Average Rating"
                    value={`${commentCardSummary.average}/5`}
                  />
                  <DesktopGiftSummaryCard
                    label="Needs Attention"
                    value={commentCardSummary.lowRating}
                  />
                </div>

                <div className="w-full overflow-hidden rounded-[24px] bg-white/10 shadow-[0_22px_60px_rgba(0,0,0,0.10)]">
                  <div
                    className="grid gap-4 border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/58"
                    style={{
                      gridTemplateColumns:
                        "0.85fr 0.6fr 0.36fr 0.45fr 0.62fr 0.72fr 0.68fr 0.66fr 1.45fr 0.72fr",
                    }}
                  >
                    {renderCommentSortHeader("Name", "name")}
                    {renderCommentSortHeader("Phone", "phone")}
                    {renderCommentSortHeader("Age", "age")}
                    {renderCommentSortHeader("Rating", "rating")}
                    {renderCommentSortHeader("Heard From", "heard_from")}
                    {renderCommentSortHeader("Comment", "comment")}
                    {renderCommentSortHeader("Submitted", "submitted")}
                    {renderCommentSortHeader("Member Since", "member_since")}
                    <div>Actions</div>
                    {renderCommentSortHeader(
                      "Last Contacted",
                      "last_contacted",
                    )}
                  </div>

                  <div className="max-h-[620px] overflow-auto">
                    {commentCardRows.length === 0 ? (
                      <div className="px-4 py-8 text-center text-[13px] font-bold text-white/60">
                        No comment cards found.
                      </div>
                    ) : null}

                    {commentCardRows.map((row) => {
                      const whatsappUrl = commentCardWhatsappUrl(
                        row.card.phone,
                      );
                      const lastContactedDates = mergeContactDates(
                        contactHistoryForKeys(row.contactKeys ?? [row.contactKey]),
                        commentContactHistory[row.card.id],
                      ).slice(0, 2);

                      return (
                        <div
                          key={row.card.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedCommentCardId(row.card.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedCommentCardId(row.card.id);
                            }
                          }}
                          className="grid w-full cursor-pointer gap-4 border-b border-white/10 px-4 py-3 text-left text-[12px] font-bold text-white/78 transition last:border-b-0 hover:bg-white/10"
                          style={{
                            gridTemplateColumns:
                              "0.85fr 0.6fr 0.36fr 0.45fr 0.62fr 0.72fr 0.68fr 0.66fr 1.45fr 0.72fr",
                          }}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-black text-white">
                              {row.card.full_name || "Guest"}
                            </div>
                          </div>
                          <div className="truncate">
                            {row.card.phone || "—"}
                          </div>
                          <div className="truncate">{desktopAgeLabel(row.age)}</div>
                          <div
                            className={`font-black ${commentRatingColorClass(row.averageRating)}`}
                          >
                            ★ {row.averageRating.toFixed(1)}
                          </div>
                          <div className="truncate">
                            {row.card.heard_about_us || "—"}
                          </div>
                          <div
                            className="truncate"
                            title={row.card.comments || ""}
                          >
                            {compactCommentPreview(row.card.comments)}
                          </div>
                          <div>
                            <div>
                              {desktopFormatDateOnly(row.card.created_at)}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/48">
                              {desktopFormatTimeOnly(row.card.created_at)}
                            </div>
                          </div>
                          <div>
                            {row.member
                              ? desktopFormatDateOnly(row.memberCreatedAt)
                              : "—"}
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openPendingCommentCardGift({
                                  card: row.card,
                                  member: row.member,
                                });
                              }}
                              className="inline-flex h-8 min-w-[50px] items-center justify-center rounded-full bg-[#ffd66b] px-4 text-[10px] font-black uppercase tracking-[0.08em] text-[#365665] shadow-[0_10px_24px_rgba(0,0,0,0.10)] transition hover:brightness-105"
                              title={
                                row.member
                                  ? "Send gift"
                                  : "Save gift for when this phone number registers"
                              }
                            >
                              Gift
                            </button>
                            {whatsappUrl ? (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex h-8 min-w-[50px] items-center justify-center rounded-full bg-[#25d366] px-4 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.10)] transition hover:brightness-105"
                              >
                                WA
                              </a>
                            ) : (
                              <span className="inline-flex h-8 min-w-[50px] items-center justify-center rounded-full bg-white/8 px-4 text-[10px] font-black uppercase tracking-[0.08em] text-white/34">
                                —
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                markCommentCardContacted(row.contactKeys ?? [row.contactKey], row.card.id);
                              }}
                              className="inline-flex h-8 min-w-[86px] items-center justify-center rounded-[12px] border border-[#ffd66b]/45 bg-white px-4 text-[10px] font-black uppercase tracking-[0.08em] text-[#365665] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition hover:bg-[#ffd66b]"
                            >
                              Contacted
                            </button>
                          </div>
                          <div className="space-y-0.5 text-[10px] font-black leading-tight text-white/68">
                            {lastContactedDates.length > 0 ? (
                              lastContactedDates.map((date) => (
                                <div key={date}>
                                  {desktopFormatContactDate(date)}
                                </div>
                              ))
                            ) : (
                              <span className="text-white/34">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedCommentCardRow ? (
                  <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-6 py-8 backdrop-blur-sm"
                    onClick={() => setSelectedCommentCardId(null)}
                  >
                    <div
                      className="w-full max-w-[760px] rounded-[30px] border border-white/16 bg-[#5f6e68] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.35)]"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                            Comment Card Details
                          </p>
                          <h3 className="mt-2 text-[26px] font-black tracking-[-0.04em] text-white">
                            {selectedCommentCardRow.card.full_name || "Guest"}
                          </h3>
                          <p className="mt-1 text-[12px] font-bold text-white/58">
                            Submitted{" "}
                            {desktopFormatDateOnly(
                              selectedCommentCardRow.card.created_at,
                            )}{" "}
                            at{" "}
                            {desktopFormatTimeOnly(
                              selectedCommentCardRow.card.created_at,
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedCommentCardId(null)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white transition hover:bg-white/20"
                          aria-label="Close comment card details"
                        >
                          ×
                        </button>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 text-[12px] font-bold text-white/74">
                        <div className="rounded-[18px] bg-white/10 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                            Phone
                          </div>
                          <div className="mt-1 text-white">
                            {selectedCommentCardRow.card.phone || "—"}
                          </div>
                        </div>
                        <div className="rounded-[18px] bg-white/10 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                            Heard From
                          </div>
                          <div className="mt-1 text-white">
                            {selectedCommentCardRow.card.heard_about_us || "—"}
                          </div>
                        </div>
                        <div className="rounded-[18px] bg-white/10 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                            Age
                          </div>
                          <div className="mt-1 text-white">
                            {desktopAgeLabel(selectedCommentCardRow.age)}
                          </div>
                        </div>
                        <div className="rounded-[18px] bg-white/10 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                            Member Since
                          </div>
                          <div className="mt-1 text-white">
                            {selectedCommentCardRow.member
                              ? desktopFormatDateOnly(
                                  selectedCommentCardRow.memberCreatedAt,
                                )
                              : "—"}
                          </div>
                        </div>
                        <div className="rounded-[18px] bg-white/10 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                            Average Rating
                          </div>
                          <div className="mt-1 text-[#ffd66b]">
                            ★ {selectedCommentCardRow.averageRating.toFixed(1)}
                            /5
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[11px] font-black text-white">
                        <div className="rounded-[16px] bg-white/10 p-3">
                          <span className="block text-white/45">
                            Experience
                          </span>
                          {selectedCommentCardRow.card.experience_rating}/5
                        </div>
                        <div className="rounded-[16px] bg-white/10 p-3">
                          <span className="block text-white/45">Food</span>
                          {selectedCommentCardRow.card.food_rating}/5
                        </div>
                        <div className="rounded-[16px] bg-white/10 p-3">
                          <span className="block text-white/45">Service</span>
                          {selectedCommentCardRow.card.service_rating}/5
                        </div>
                        <div className="rounded-[16px] bg-white/10 p-3">
                          <span className="block text-white/45">
                            Cleanliness
                          </span>
                          {selectedCommentCardRow.card.cleanliness_rating}/5
                        </div>
                        <div className="rounded-[16px] bg-white/10 p-3">
                          <span className="block text-white/45">
                            Visit Again
                          </span>
                          {selectedCommentCardRow.card.visit_again_rating}/5
                        </div>
                      </div>

                      <div className="mt-3 rounded-[20px] bg-white/10 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                          Comment
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[14px] font-bold leading-relaxed text-white">
                          {selectedCommentCardRow.card.comments?.trim() || "—"}
                        </p>
                      </div>

                      <div className="mt-3 rounded-[20px] bg-white/10 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                          Last Contacted
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[12px] font-black text-white/72">
                          {mergeContactDates(
                            commentContactHistory[selectedCommentCardRow.contactKey],
                            commentContactHistory[selectedCommentCardRow.card.id],
                            birthdayContactHistory[selectedCommentCardRow.contactKey],
                          ).slice(0, 2).length > 0 ? (
                            mergeContactDates(
                              commentContactHistory[selectedCommentCardRow.contactKey],
                              commentContactHistory[selectedCommentCardRow.card.id],
                              birthdayContactHistory[selectedCommentCardRow.contactKey],
                            )
                              .slice(0, 2)
                              .map((date) => (
                                <span
                                  key={date}
                                  className="rounded-full bg-white/12 px-3 py-2"
                                >
                                  {desktopFormatContactDate(date)}
                                </span>
                              ))
                          ) : (
                            <span className="text-white/45">—</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <div>
                          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                            Actions
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                openPendingCommentCardGift({
                                  card: selectedCommentCardRow.card,
                                  member: selectedCommentCardRow.member,
                                });
                                setSelectedCommentCardId(null);
                              }}
                              className="inline-flex h-9 min-w-[56px] items-center justify-center rounded-full bg-[#ffd66b] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#365665] shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition hover:brightness-105"
                              title={
                                selectedCommentCardRow.member
                                  ? "Send gift"
                                  : "Save gift for when this phone number registers"
                              }
                            >
                              Gift
                            </button>
                            {commentCardWhatsappUrl(
                              selectedCommentCardRow.card.phone,
                            ) ? (
                              <a
                                href={commentCardWhatsappUrl(
                                  selectedCommentCardRow.card.phone,
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-9 min-w-[56px] items-center justify-center rounded-full bg-[#25d366] px-5 text-[11px] font-black uppercase tracking-[0.1em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition hover:brightness-105"
                              >
                                WA
                              </a>
                            ) : null}
                            <button
                              type="button"
                              onClick={() =>
                                markCommentCardContacted(
                                  selectedCommentCardRow.contactKeys ?? [selectedCommentCardRow.contactKey],
                                  selectedCommentCardRow.card.id,
                                )
                              }
                              className="inline-flex h-9 min-w-[96px] items-center justify-center rounded-[12px] border border-[#ffd66b]/45 bg-white px-5 text-[11px] font-black uppercase tracking-[0.1em] text-[#365665] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition hover:bg-[#ffd66b]"
                            >
                              Contacted
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedCommentCardId(null)}
                          className="rounded-full bg-white/10 px-5 py-3 text-[12px] font-black text-white transition hover:bg-white/16"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {quickGiftTarget ? (
                  <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-6 py-8 backdrop-blur-sm"
                    onClick={closeQuickGift}
                  >
                    <div
                      className="w-full max-w-[480px] rounded-[28px] bg-[#071113]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.55)]"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#ffd66b] text-[24px]">
                          🎁
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[24px] font-black tracking-[-0.04em] text-white">
                            Send Gift
                          </h3>
                          <p className="mt-2 text-[12px] font-bold text-white/78">
                            Send a gift to{" "}
                            {quickGiftTargetName(quickGiftTarget)}.
                          </p>
                        </div>
                      </div>

                      <div className="mt-6">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/76">
                          Type
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setQuickGiftType("gift")}
                            className={`h-11 rounded-[14px] text-[11px] font-black uppercase tracking-[0.14em] transition ${
                              quickGiftType === "gift"
                                ? "bg-[#ffd66b] text-[#365665]"
                                : "bg-transparent text-white"
                            }`}
                          >
                            Gift
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickGiftType("discount")}
                            className={`h-11 rounded-[14px] text-[11px] font-black uppercase tracking-[0.14em] transition ${
                              quickGiftType === "discount"
                                ? "bg-[#ffd66b] text-[#365665]"
                                : "bg-transparent text-white"
                            }`}
                          >
                            Discount
                          </button>
                        </div>
                      </div>

                      {quickGiftType === "gift" ? (
                        <div className="mt-5">
                          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-white/76">
                            Gift
                          </label>
                          <select
                            value={quickGiftCategoryId}
                            onChange={(event) =>
                              setQuickGiftCategoryId(event.target.value)
                            }
                            className="mt-3 h-12 w-full rounded-[14px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none"
                          >
                            {quickGiftCategoryOptions.map((category) => (
                              <option key={category.id} value={category.id}>
                                Free {category.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="mt-5">
                          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-white/76">
                            Discount
                          </label>
                          <input
                            value={quickDiscountValue}
                            onChange={(event) =>
                              setQuickDiscountValue(event.target.value)
                            }
                            placeholder="Example: 10%"
                            className="mt-3 h-12 w-full rounded-[14px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none placeholder:text-[#365665]/35"
                          />
                        </div>
                      )}

                      {quickGiftTarget.kind === "pending_comment_card" ? (
                        <div className="mt-5 rounded-[18px] bg-white/10 p-4 text-[12px] font-bold leading-relaxed text-white/76">
                          This customer is not registered yet. The gift will be
                          saved with the phone number and added automatically
                          when the customer registers using the same phone
                          number.
                        </div>
                      ) : null}

                      <div className="mt-5">
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-white/76">
                          Description
                        </label>
                        <textarea
                          value={quickGiftDescription}
                          onChange={(event) =>
                            setQuickGiftDescription(event.target.value)
                          }
                          rows={3}
                          className="mt-3 w-full resize-none rounded-[14px] border-0 bg-white px-4 py-3 text-[13px] font-bold text-[#365665] outline-none placeholder:text-[#365665]/35"
                          placeholder="Optional note..."
                        />
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={closeQuickGift}
                          className="rounded-full bg-white/14 px-6 py-3 text-[12px] font-black text-white transition hover:bg-white/20"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void sendQuickGift()}
                          className="rounded-full bg-[#ffd66b] px-7 py-3 text-[12px] font-black text-[#365665] transition hover:bg-[#f0cf61]"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {tab === "Loyalty Program" ? (
              <section>
                <LoyaltyProgramPanel />
              </section>
            ) : null}

            {tab === "Create Game" ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-[26px] font-black tracking-[-0.04em] text-white">
                      Create Game
                    </h2>
                    <p className="mt-1 text-[12px] font-bold text-white/65">
                      Manage links, QR codes, players, scores, and leaderboards.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTournamentPopupOpen(true)}
                      className="rounded-full bg-white/14 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/20"
                    >
                      Add Tournament
                    </button>
                    <button
                      type="button"
                      onClick={() => setGameCreateOpen(true)}
                      className="rounded-full bg-[#ffd66b] px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#365665] shadow-[0_18px_40px_rgba(255,214,107,0.20)] transition hover:bg-[#f0cf61]"
                    >
                      Create Link
                    </button>
                  </div>
                </div>

                <Panel className="!p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {([
                        ["all", "Show all"],
                        ["today", "Today"],
                        ["week", "This week"],
                        ["month", "This month"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setGameDateFilter(value)}
                          className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                            gameDateFilter === value
                              ? "bg-[#ffd66b] text-[#365665]"
                              : "bg-white/10 text-white/70 hover:bg-white/16 hover:text-[#ffd66b]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={gameSportFilter}
                        onChange={(event) => setGameSportFilter(event.target.value as "all" | "football" | "basketball")}
                        className="h-10 rounded-full border border-white/20 bg-white px-4 text-[11px] font-black text-[#365665] outline-none"
                      >
                        <option value="all">All sports</option>
                        <option value="football">Football</option>
                        <option value="basketball">Basketball</option>
                      </select>
                      <select
                        value={gameTournamentFilter}
                        onChange={(event) => setGameTournamentFilter(event.target.value)}
                        className="h-10 rounded-full border border-white/20 bg-white px-4 text-[11px] font-black text-[#365665] outline-none"
                      >
                        <option value="all">All tournaments</option>
                        {predictionTournaments.map((tournament) => (
                          <option key={tournament.id} value={tournament.id}>
                            {tournament.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {sortedGameLinks.length === 0 ? (
                    <p className="rounded-[18px] border border-white/18 bg-white/10 p-4 text-[13px] font-bold text-white/70">
                      No created games yet.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-[22px] border border-white/18 bg-white/8">
                      <div className="grid grid-cols-[0.7fr_1fr_1.35fr_0.9fr_0.7fr_0.5fr_0.48fr_0.48fr_0.48fr] gap-3 border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/58">
                        <button
                          type="button"
                          onClick={() => sortGames("sport")}
                          className="text-left"
                        >
                          Sport
                        </button>
                        <div className="text-left">Tournament</div>
                        <button
                          type="button"
                          onClick={() => sortGames("match")}
                          className="text-left"
                        >
                          Match Name
                        </button>
                        <button
                          type="button"
                          onClick={() => sortGames("date")}
                          className="text-left"
                        >
                          Date
                        </button>
                        <button
                          type="button"
                          onClick={() => sortGames("status")}
                          className="text-left"
                        >
                          Status
                        </button>
                        <button
                          type="button"
                          onClick={() => sortGames("players")}
                          className="text-left"
                        >
                          Players
                        </button>
                        <div>Copy</div>
                        <div>QR</div>
                        <div>Open</div>
                      </div>

                      <div className="max-h-[560px] overflow-auto">
                        {sortedGameLinks.map((game) => (
                          <div
                            key={game.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              window.location.href = `/admin/game-links/${game.id}`;
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                window.location.href = `/admin/game-links/${game.id}`;
                              }
                            }}
                            className="grid cursor-pointer grid-cols-[0.7fr_1fr_1.35fr_0.9fr_0.7fr_0.5fr_0.48fr_0.48fr_0.48fr] items-center gap-3 border-b border-white/10 px-4 py-4 text-[12px] font-bold text-white/78 transition last:border-b-0 hover:bg-white/10"
                          >
                            <div className="font-black text-[#ffd66b]">
                              {game.sport}
                            </div>
                            <div className="truncate text-white/70">
                              {game.tournamentName ?? "—"}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[14px] font-black text-white">
                                {game.title}
                              </div>
                              <div className="truncate text-[10px] font-bold text-white/46">
                                {game.matchLabel}
                              </div>
                            </div>
                            <div>{desktopFormatDate(game.kickoff)}</div>
                            <div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                                  game.status === "Open"
                                    ? "bg-[#ffd66b] text-[#365665]"
                                    : game.status === "Closed"
                                      ? "bg-red-500/16 text-red-100"
                                      : "bg-white/14 text-white"
                                }`}
                              >
                                {game.status}
                              </span>
                            </div>
                            <div className="font-black text-white">
                              {game.players}
                            </div>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void copyGamePredictionLink(game.code);
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[15px] text-white transition hover:bg-white/20"
                              title="Copy link"
                            >
                              ⧉
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void downloadGameQr(game.code, game.title);
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[15px] text-white transition hover:bg-white/20"
                              title="Download QR"
                            >
                              ▣
                            </button>
                            <a
                              href={predictionLinkFor(game.code)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[15px] font-black text-white transition hover:bg-white/20"
                              title="Open prediction"
                            >
                              ↗
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Panel>

                {tournamentPopupOpen ? (
                  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-5 backdrop-blur-sm lg:items-center lg:pb-0">
                    <div className="w-full max-w-xl rounded-[30px] border border-white/18 bg-[#61716b] p-5 shadow-2xl">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffd66b]">Tournament</div>
                          <h3 className="mt-1 text-[23px] font-black tracking-[-0.04em] text-white">Add Tournament</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTournamentPopupOpen(false)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white"
                        >
                          ×
                        </button>
                      </div>

                      <label className="block">
                        <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-white/86">Tournament name</span>
                        <input
                          value={tournamentForm.name}
                          onChange={(event) => setTournamentForm((current) => ({ ...current, name: event.target.value }))}
                          className="h-11 w-full rounded-[14px] border border-white/20 bg-white px-4 text-[13px] font-black text-[#24352f] outline-none focus:border-[#ffd66b]"
                          placeholder="World Cup 2026"
                        />
                      </label>

                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-[16px] bg-white/10 p-1">
                        {(["football", "basketball"] as const).map((sport) => (
                          <button
                            key={sport}
                            type="button"
                            onClick={() => setTournamentForm((current) => ({ ...current, sport_type: sport }))}
                            className={`h-9 rounded-[13px] text-[10px] font-black uppercase tracking-[0.18em] transition ${
                              tournamentForm.sport_type === sport
                                ? "bg-[#ffd66b] text-[#365665]"
                                : "text-white/72 hover:bg-white/10"
                            }`}
                          >
                            {sport === "football" ? "Football" : "Basketball"}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => void createPredictionTournament()}
                        disabled={tournamentSaving}
                        className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-[#ffd66b] px-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#365665] transition hover:bg-[#f0cf61] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {tournamentSaving ? "Creating..." : "Create Tournament"}
                      </button>

                      <div className="mt-5 max-h-[260px] space-y-2 overflow-auto">
                        {predictionTournaments.length === 0 ? (
                          <div className="rounded-[16px] bg-white/10 p-4 text-[12px] font-bold text-white/70">No tournaments yet.</div>
                        ) : null}
                        {predictionTournaments.map((tournament) => (
                          <div key={tournament.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-white/10 px-4 py-3">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-black text-white">{tournament.name}</div>
                              <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#ffd66b]">{tournament.sport_type}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTournamentDeleteId(tournament.id)}
                              className="rounded-full bg-red-400/18 px-3 py-2 text-[11px] font-black text-red-100 transition hover:bg-red-400/26"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {tournamentDeleteId ? (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-[26px] border border-white/18 bg-[#61716b] p-5 shadow-2xl">
                      <h3 className="text-[20px] font-black text-white">Delete tournament?</h3>
                      <p className="mt-2 text-[13px] font-bold leading-relaxed text-white/68">
                        This will delete the tournament and remove it from linked games. This action cannot be undone.
                      </p>
                      <div className="mt-5 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setTournamentDeleteId(null)}
                          className="rounded-full bg-white/12 px-5 py-3 text-[11px] font-black text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePredictionTournament(tournamentDeleteId)}
                          className="rounded-full bg-red-300 px-5 py-3 text-[11px] font-black text-red-950"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {gameCreateOpen ? (
                  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-5 backdrop-blur-sm lg:items-center lg:pb-0">
                    <div className="w-full max-w-2xl rounded-[30px] border border-white/18 bg-[#61716b] p-5 shadow-2xl">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffd66b]">
                            Admin
                          </div>
                          <h3 className="mt-1 text-[23px] font-black tracking-[-0.04em] text-white">
                            Create{" "}
                            <span className="text-[#ffd66b]">Game</span>
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => setGameCreateOpen(false)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white"
                        >
                          ×
                        </button>
                      </div>

                      <div className="mb-4 grid grid-cols-2 gap-2 rounded-[16px] bg-white/10 p-1">
                        {(["football", "basketball"] as const).map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => setGameKind(kind)}
                            className={`h-9 rounded-[13px] text-[10px] font-black uppercase tracking-[0.18em] transition ${
                              gameKind === kind
                                ? "bg-[#ffd66b] text-[#365665]"
                                : "text-white/72 hover:bg-white/10"
                            }`}
                          >
                            {kind === "football" ? "Football" : "Basketball"}
                          </button>
                        ))}
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <label className="block lg:col-span-2">
                          <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-white/86">
                            Tournament
                          </span>
                          <select
                            value={gameForm.tournament_id}
                            onChange={(event) => setGameForm((current) => ({ ...current, tournament_id: event.target.value }))}
                            className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#24352f] outline-none focus:border-[#ffd66b]"
                          >
                            <option value="">No tournament</option>
                            {gameTournamentOptions.map((tournament) => (
                              <option key={tournament.id} value={tournament.id}>
                                {tournament.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <AdminGameInput
                          label={
                            gameKind === "basketball" ? "Team 1" : "Home Team"
                          }
                          value={gameForm.home_team}
                          onChange={(value) =>
                            setGameForm((current) => ({
                              ...current,
                              home_team: value,
                            }))
                          }
                        />
                        <AdminGameInput
                          label={
                            gameKind === "basketball" ? "Team 2" : "Away Team"
                          }
                          value={gameForm.away_team}
                          onChange={(value) =>
                            setGameForm((current) => ({
                              ...current,
                              away_team: value,
                            }))
                          }
                        />
                        <AdminGameInput
                          label="Game Label"
                          value={gameForm.match_label}
                          onChange={(value) =>
                            setGameForm((current) => ({
                              ...current,
                              match_label: value,
                            }))
                          }
                        />
                        <AdminGameInput
                          label="Description"
                          value={gameForm.venue}
                          onChange={(value) =>
                            setGameForm((current) => ({
                              ...current,
                              venue: value,
                            }))
                          }
                        />
                        <AdminGameInput
                          type="datetime-local"
                          label="Match Timing"
                          value={gameForm.kickoff_at}
                          onChange={setGameKickoffWithDefaultWindow}
                        />
                        <AdminGameInput
                          type="datetime-local"
                          label="Open Time"
                          value={gameForm.opens_at}
                          onChange={(value) =>
                            setGameForm((current) => ({
                              ...current,
                              opens_at: value,
                            }))
                          }
                        />
                        <AdminGameInput
                          type="datetime-local"
                          label="Close Time"
                          value={gameForm.closes_at}
                          onChange={(value) =>
                            setGameForm((current) => ({
                              ...current,
                              closes_at: value,
                            }))
                          }
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => void createGameLinkFromDesktop()}
                        disabled={gameSaving}
                        className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-[#ffd66b] px-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#365665] transition hover:bg-[#f0cf61] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {gameSaving ? "Creating..." : "Create Game"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminGameInput({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-white/86">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#24352f] outline-none focus:border-[#ffd66b]"
      />
    </label>
  );
}

function DesktopTimeRangeFilter({
  value,
  onChange,
}: {
  value: DesktopTimeRange;
  onChange: (value: DesktopTimeRange) => void;
}) {
  const options: Array<{ label: string; value: DesktopTimeRange }> = [
    { label: "Today", value: "today" },
    { label: "This week", value: "week" },
    { label: "This month", value: "month" },
    { label: "Show all", value: "all" },
  ];

  return (
    <div className="grid grid-cols-4 gap-1 rounded-[14px] bg-white/10 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-[11px] px-3 py-2 text-[11px] font-black transition ${
            value === option.value
              ? "bg-[#ffd66b] text-[#253a35] shadow-[0_10px_24px_rgba(255,214,107,0.22)]"
              : "text-white/72 hover:bg-[#ffd66b]/18 hover:text-[#ffd66b]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DesktopGiftSummaryCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="h-[66px] min-w-0 rounded-[14px] bg-white/10 px-3 py-2.5">
      <div className="truncate text-[11px] font-normal normal-case tracking-normal text-white/66">
        {label}
      </div>
      <div className="mt-1.5 text-[18px] font-black tracking-[-0.04em] text-white">
        {value}
      </div>
    </div>
  );
}

function DesktopReportMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="h-[64px] min-w-0 rounded-[14px] bg-white/10 px-2.5 py-2.5">
      <div className="truncate text-[11px] font-normal normal-case tracking-normal text-white/66">
        {label}
      </div>
      <div className="mt-1.5 text-[18px] font-black tracking-[-0.04em] text-white">
        {value}
      </div>
    </div>
  );
}

function AdminUserMetricRow({
  label,
  value,
  trend,
  negative = false,
}: {
  label: string;
  value: number | string;
  trend?: string;
  negative?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-white/10 px-4 py-3 last:border-b-0">
      <div className="text-[12px] font-bold text-white/82">{label}</div>
      {trend ? (
        <div
          className={`text-[10px] font-black ${negative ? "text-[#ff6b6b]" : "text-[#2ee887]"}`}
        >
          {trend}
        </div>
      ) : (
        <div />
      )}
      <div className="min-w-[62px] text-right text-[12px] font-black tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] bg-white/10 p-5 text-white shadow-[0_24px_70px_rgba(35,54,47,0.20)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </div>
  );
}

function StatTile({
  value,
  label,
  trend,
  onClick,
}: {
  value: number | string;
  label: string;
  trend?: string;
  onClick?: () => void;
}) {
  const content = (
    <Panel
      className={
        onClick ? "transition hover:-translate-y-0.5 hover:bg-white/14" : ""
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[34px] font-black leading-none tracking-[-0.04em] text-white">
            {value}
          </div>
          <div className="mt-2 text-[12px] font-bold text-white/70">
            {label}
          </div>
        </div>
        {trend ? (
          <span className="rounded-full bg-[#365665] px-2.5 py-1 text-[10px] font-black text-[#ffd66b]">
            {trend}
          </span>
        ) : null}
      </div>
    </Panel>
  );

  if (!onClick) return content;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-[26px] text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#ffd66b]/80"
      aria-label={`Open ${label}`}
    >
      {content}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[21px] font-black leading-none text-white">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-bold text-white/70">{label}</div>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-3 last:border-0">
      <div className="text-[13px] font-bold text-white/72">{label}</div>
      <div className="text-right text-[13px] font-black text-white">
        {value}
      </div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] font-black text-white/72">
        <span>{label}</span>
        <span>{desktopPercentage(safeValue)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/28">
        <div
          className="h-full rounded-full bg-[#ffd66b]"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function DonutChart({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const dash = `${safeValue} ${100 - safeValue}`;

  return (
    <div className="relative h-[112px] w-[112px]">
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
        <circle
          cx="21"
          cy="21"
          r="15.915"
          fill="transparent"
          stroke="#eee8dc"
          strokeWidth="8"
        />
        <circle
          cx="21"
          cy="21"
          r="15.915"
          fill="transparent"
          stroke={D_BRAND_GREEN}
          strokeWidth="8"
          strokeDasharray={dash}
          strokeLinecap="round"
        />
        <circle
          cx="21"
          cy="21"
          r="15.915"
          fill="transparent"
          stroke={D_BRAND_YELLOW}
          strokeWidth="8"
          strokeDasharray={`${Math.max(0, 100 - safeValue)} ${safeValue}`}
          strokeDashoffset={-safeValue}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[19px] font-black text-white">
          {desktopPercentage(safeValue)}
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.12em] text-white/70">
          Active
        </div>
      </div>
    </div>
  );
}

function LineChart() {
  const points =
    "0,95 55,88 110,84 165,62 220,56 275,42 330,48 385,36 440,44 500,24";
  const rewardPoints =
    "0,126 55,118 110,112 165,123 220,94 275,86 330,82 385,88 440,76 500,90";

  return (
    <div className="relative h-[190px] rounded-[22px] bg-white/92 p-4">
      <div className="absolute left-4 right-4 top-4 space-y-[30px]">
        {[0, 1, 2, 3, 4].map((line) => (
          <div key={line} className="h-px bg-[#e8e1d5]" />
        ))}
      </div>
      <svg
        viewBox="0 0 500 150"
        className="relative z-10 h-full w-full overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke={D_BRAND_GREEN}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={rewardPoints}
          fill="none"
          stroke={D_BRAND_YELLOW}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="275"
          cy="42"
          r="6"
          fill={D_BRAND_GREEN}
          stroke="#fff"
          strokeWidth="4"
        />
        <circle
          cx="275"
          cy="86"
          r="6"
          fill={D_BRAND_YELLOW}
          stroke="#fff"
          strokeWidth="4"
        />
      </svg>
      <div className="absolute bottom-3 left-5 right-5 flex justify-between text-[10px] font-black uppercase tracking-[0.14em] text-[#8a8579]">
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
      </div>
    </div>
  );
}

function ActivityRow({
  action,
  title,
  meta,
}: {
  action: StampTransaction["action_type"];
  title: string;
  meta: string;
}) {
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <DesktopActionBadge action={action} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-black text-white">
            {title}
          </div>
          <div className="mt-1 text-[12px] font-bold text-white/70">{meta}</div>
        </div>
      </div>
    </Panel>
  );
}

function DesktopProfileMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="h-[64px] min-w-0 rounded-[14px] bg-white/10 px-2.5 py-2.5">
      <div className="truncate text-[11px] font-normal normal-case tracking-normal text-white/66">
        {label}
      </div>
      <div className="mt-1.5 text-[18px] font-black tracking-[-0.04em] text-white">
        {value}
      </div>
    </div>
  );
}

function DesktopClientProfilePanel({
  user,
  currentUserId,
  categories,
  stamps,
  rewards,
  activities,
  loading,
  onBack,
  onRoleChange,
  onDeactivate,
  onReactivate,
  onAddStamp,
  onRemoveStamp,
  onSendGift,
}: {
  user: AdminUser;
  currentUserId: string;
  categories: AdminCategory[];
  stamps: AdminClientStamp[];
  rewards: Reward[];
  activities: StampTransaction[];
  loading: boolean;
  onBack: () => void;
  onRoleChange: (role: UserRole) => void;
  onDeactivate: () => void;
  onReactivate: (role: UserRole) => void;
  onAddStamp: (categoryId: string) => void;
  onRemoveStamp: (categoryId: string) => void;
  onSendGift: (gift: string, description: string) => void;
}) {
  const [giftPopupOpen, setGiftPopupOpen] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [stampsOpen, setStampsOpen] = useState(false);
  const [visitsLogOpen, setVisitsLogOpen] = useState(false);
  const [profileTimeRange, setProfileTimeRange] = useState<
    "week" | "month" | "all"
  >("week");
  const [giftType, setGiftType] = useState<"gift" | "discount">("gift");
  const [selectedGiftCategoryId, setSelectedGiftCategoryId] = useState("");
  const [discountValue, setDiscountValue] = useState("10%");
  const [giftDescription, setGiftDescription] = useState("");

  const age = getAgeFromBirthday(getBirthdayValue(user));

  const stampByCategory = useMemo(() => {
    const map = new Map<string, number>();

    stamps.forEach((stamp) => {
      map.set(stamp.category_id, stamp.stamp_count ?? 0);
    });

    return map;
  }, [stamps]);

  const priceByCategoryId = useMemo(() => {
    const map = new Map<string, number>();

    categories.forEach((category) => {
      map.set(category.id, parseMoneyValue(category.average_price));
    });

    return map;
  }, [categories]);

  const priceByCategoryName = useMemo(() => {
    const map = new Map<string, number>();

    categories.forEach((category) => {
      const name = (
        category.name === "Desserts 2" ? "Hooka" : category.name
      ).toLowerCase();
      map.set(name, parseMoneyValue(category.average_price));
    });

    return map;
  }, [categories]);

  const availableGiftCategories = useMemo(
    () =>
      categories.map((category) => ({
        id: category.id,
        name: category.name === "Desserts 2" ? "Hooka" : category.name,
      })),
    [categories],
  );

  useEffect(() => {
    if (selectedGiftCategoryId || availableGiftCategories.length === 0) return;

    setSelectedGiftCategoryId(availableGiftCategories[0].id);
  }, [availableGiftCategories, selectedGiftCategoryId]);

  const selectedGiftCategoryName =
    availableGiftCategories.find(
      (category) => category.id === selectedGiftCategoryId,
    )?.name ??
    availableGiftCategories[0]?.name ??
    "";

  const sendGiftLabel =
    giftType === "discount"
      ? `Discount ${discountValue}`
      : selectedGiftCategoryName
        ? `Free ${selectedGiftCategoryName}`
        : "";

  const filteredActivities = useMemo(() => {
    return activities.filter((txn) =>
      isWithinDesktopTimeRange(txn.created_at, profileTimeRange),
    );
  }, [activities, profileTimeRange]);

  const filteredRewards = useMemo(() => {
    return rewards.filter((reward) =>
      isWithinDesktopTimeRange(
        reward.earned_at ?? reward.created_at,
        profileTimeRange,
      ),
    );
  }, [profileTimeRange, rewards]);

  const stampValueFor = (txn: StampTransaction) => {
    const record = txn as unknown as Record<string, unknown>;
    const categoryId =
      typeof record.category_id === "string" ? record.category_id : "";
    const actionType = String(record.action_type ?? "");

    if (actionType.includes("remove")) return 0;

    return priceByCategoryId.get(categoryId) ?? 0;
  };

  const giftValueFor = (reward: Reward) => {
    const record = reward as unknown as Record<string, unknown>;
    const categoryId =
      typeof record.category_id === "string" ? record.category_id : "";
    const rewardType = String(reward.reward_type ?? "").toLowerCase();

    if (categoryId && priceByCategoryId.has(categoryId)) {
      return priceByCategoryId.get(categoryId) ?? 0;
    }

    for (const [categoryName, price] of priceByCategoryName.entries()) {
      if (categoryName && rewardType.includes(categoryName)) return price;
    }

    return 0;
  };

  const visits = useMemo(
    () =>
      new Set(
        filteredActivities
          .map((txn) => desktopVisitDayKey(txn.created_at))
          .filter(Boolean),
      ).size,
    [filteredActivities],
  );

  const value = useMemo(
    () => filteredActivities.reduce((sum, txn) => sum + stampValueFor(txn), 0),
    [filteredActivities, priceByCategoryId],
  );

  const lifetime = useMemo(
    () => activities.reduce((sum, txn) => sum + stampValueFor(txn), 0),
    [activities, priceByCategoryId],
  );

  const giftsValue = useMemo(
    () =>
      filteredRewards.reduce((sum, reward) => sum + giftValueFor(reward), 0),
    [filteredRewards, priceByCategoryId, priceByCategoryName],
  );

  const visitLogRows = useMemo(() => {
    const byDay = new Map<string, string>();

    activities.forEach((txn) => {
      if (!isWithinDesktopTimeRange(txn.created_at, profileTimeRange)) return;

      const key = desktopVisitDayKey(txn.created_at);
      if (!key) return;

      const existing = byDay.get(key);
      if (
        !existing ||
        new Date(txn.created_at).getTime() > new Date(existing).getTime()
      ) {
        byDay.set(key, txn.created_at);
      }
    });

    return Array.from(byDay.entries())
      .map(([day, date]) => ({ day, date }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activities, profileTimeRange]);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="px-0 py-2 text-[12px] font-black text-white transition hover:text-[#ffd66b]"
      >
        ← Back to users
      </button>

      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70">
              Member Profile
            </div>
            <h2 className="mt-2 truncate text-[25px] font-black leading-none text-white">
              {user.full_name || "Client"}
            </h2>
            <div className="mt-2 text-[12px] font-semibold leading-5 text-white/72">
              {user.email || "No email"}
              {user.phone ? (
                <>
                  <br />
                  {user.phone}
                  {age !== null ? (
                    <span className="text-white/52"> · Age {age}</span>
                  ) : null}
                </>
              ) : age !== null ? (
                <>
                  <br />
                  Age {age}
                </>
              ) : null}
            </div>
            {user.client_code ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  {user.client_code}
                </div>

                {user.role === "client" ? (
                  <button
                    type="button"
                    onClick={() => setGiftPopupOpen(true)}
                    className="rounded-full bg-[#ffd66b] px-4 py-2 text-[11px] font-black text-[#365665] transition hover:bg-[#f0cf61]"
                  >
                    Send Gift
                  </button>
                ) : null}
              </div>
            ) : user.role === "client" ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setGiftPopupOpen(true)}
                  className="rounded-full bg-[#ffd66b] px-4 py-2 text-[11px] font-black text-[#365665] transition hover:bg-[#f0cf61]"
                >
                  Send Gift
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <select
              value={user.is_active === false ? "deactivated" : user.role}
              onChange={(event) => {
                const value = event.target.value;

                if (value === "deactivated") {
                  onDeactivate();
                  return;
                }

                if (user.is_active === false) {
                  onReactivate(value as UserRole);
                  return;
                }

                onRoleChange(value as UserRole);
              }}
              disabled={user.id === currentUserId}
              className={`shrink-0 rounded-full border-0 bg-white px-3 py-2 text-[11px] font-black outline-none disabled:opacity-55 ${
                user.is_active === false ? "text-red-600" : "text-[#365665]"
              }`}
            >
              <option value="client">Client</option>
              <option value="staff">Staff</option>
              <option value="master_admin">Admin</option>
              <option value="deactivated">Deactivate</option>
            </select>

            <select
              value={profileTimeRange}
              onChange={(event) =>
                setProfileTimeRange(
                  event.target.value as "week" | "month" | "all",
                )
              }
              className="rounded-full border-0 bg-white px-3 py-2 text-[11px] font-black text-white outline-none"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {user.is_active === false ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-black text-red-600">
            This account is deactivated.
          </div>
        ) : null}

        {user.role === "client" ? (
          <div
            className="mt-5 grid w-full gap-2"
            style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
          >
            <DesktopProfileMetric label="Visits" value={visits} />
            <DesktopProfileMetric
              label="Value"
              value={desktopFormatMoney(value)}
            />
            <DesktopProfileMetric
              label="Lifetime $"
              value={desktopFormatMoney(lifetime)}
            />
            <DesktopProfileMetric
              label="Gifts"
              value={filteredRewards.length}
            />
            <DesktopProfileMetric
              label="Gift value"
              value={desktopFormatMoney(giftsValue)}
            />
          </div>
        ) : null}
      </Panel>

      <Panel>
        <button
          type="button"
          onClick={() => setStampsOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <h2 className="text-[18px] font-black text-white">Stamps</h2>
            <p className="mt-1 text-[11px] font-bold text-white/72">
              {stampsOpen ? "Visible" : "Closed by default"}
            </p>
          </div>

          <span className="rounded-full bg-white px-4 py-2 text-[11px] font-black text-white">
            {stampsOpen ? "Hide" : "Show"}
          </span>
        </button>

        {stampsOpen ? (
          <div className="mt-4">
            {loading ? <DesktopEmptyState text="Loading profile..." /> : null}

            {!loading && user.role !== "client" ? (
              <DesktopEmptyState text="This account is not a client, so there are no loyalty stamps." />
            ) : null}

            {!loading && user.role === "client" ? (
              <div className="space-y-3">
                {categories.length === 0 ? (
                  <DesktopEmptyState text="No stamp categories found." />
                ) : null}

                {categories.map((category) => {
                  const count = Math.max(
                    0,
                    Math.min(5, stampByCategory.get(category.id) ?? 0),
                  );

                  return (
                    <div
                      key={category.id}
                      className="rounded-[16px] bg-white/10 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-black text-white">
                            {category.name === "Desserts 2"
                              ? "Hooka"
                              : category.name}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-white/70">
                            {count}/5 stamps
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onRemoveStamp(category.id)}
                            disabled={loading || count <= 0}
                            className="rounded-full bg-white px-4 py-2 text-[11px] font-black text-[#365665] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Remove
                          </button>

                          <button
                            type="button"
                            onClick={() => onAddStamp(category.id)}
                            disabled={loading || count >= 5}
                            className="rounded-full bg-[#365665] px-4 py-2 text-[11px] font-black text-white transition hover:bg-[#27464f] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Stamp It!
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <div
                            key={index}
                            className={`h-2 rounded-full ${
                              index < count ? "bg-[#ffd66b]" : "bg-white/25"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel>
        <button
          type="button"
          onClick={() => setVisitsLogOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <h2 className="text-[18px] font-black text-white">Visits Log</h2>
            <p className="mt-1 text-[11px] font-bold text-white/72">
              {visitLogRows.length} visit date
              {visitLogRows.length === 1 ? "" : "s"}
            </p>
          </div>

          <span className="rounded-full bg-white px-4 py-2 text-[11px] font-black text-white">
            {visitsLogOpen ? "Hide" : "Show"}
          </span>
        </button>

        {visitsLogOpen ? (
          <div className="mt-4 space-y-2">
            {visitLogRows.length === 0 ? (
              <DesktopEmptyState text="No visits found for this time range." />
            ) : null}

            {visitLogRows.map((visit) => (
              <div
                key={visit.day}
                className="flex items-center justify-between rounded-[14px] bg-white/10 px-4 py-3"
              >
                <div className="text-[13px] font-black text-white">
                  {desktopFormatDateOnly(visit.date)}
                </div>
                <div className="text-[11px] font-bold text-white/60">
                  {desktopFormatTimeOnly(visit.date)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

      <Panel>
        <button
          type="button"
          onClick={() => setGiftsOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <h2 className="text-[18px] font-black text-white">Gifts</h2>
            <p className="mt-1 text-[11px] font-bold text-white/72">
              {rewards.length} gift{rewards.length === 1 ? "" : "s"}
            </p>
          </div>

          <span className="rounded-full bg-white px-4 py-2 text-[11px] font-black text-white">
            {giftsOpen ? "Hide" : "Show"}
          </span>
        </button>

        {giftsOpen ? (
          <div className="mt-4">
            {loading ? null : rewards.length === 0 ? (
              <DesktopEmptyState text="No gifts for this client yet." />
            ) : null}

            <div className="space-y-3">
              {rewards.map((reward) => (
                <div key={reward.id} className="rounded-[16px] bg-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-black text-white">
                        {desktopNormalizeRewardText(reward.reward_type)}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold leading-5 text-white/72">
                        Earned {desktopFormatDate(reward.earned_at)}
                        {reward.redeemed_at ? (
                          <>
                            {" "}
                            · Confirmed {desktopFormatDate(reward.redeemed_at)}
                          </>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                        reward.status === "available"
                          ? "bg-[#ffd66b] text-[#365665]"
                          : reward.status === "redeemed" ||
                              reward.status === "claimed"
                            ? "bg-[#365665] text-white"
                            : "bg-white/28 text-white/72"
                      }`}
                    >
                      {String(reward.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>

      {giftPopupOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
          onClick={() => setGiftPopupOpen(false)}
        >
          <div
            className="h-[480px] max-h-[86vh] w-full max-w-[480px] overflow-y-auto rounded-[28px] bg-[#365665]/88 p-5 text-white shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ffd66b] p-3">
                <img
                  src="/gift.png"
                  alt="Gift"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="min-w-0">
                <h3 className="text-[22px] font-black tracking-[-0.03em] text-white">
                  Send Gift
                </h3>
                <p className="mt-1 text-[12px] font-bold leading-5 text-white/66">
                  Send a gift to {user.full_name || "this client"}.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/66">
                Type
              </span>
              <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-white/12 p-1">
                {(["gift", "discount"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setGiftType(type)}
                    className={`h-11 rounded-[14px] text-[12px] font-black uppercase tracking-[0.12em] transition ${
                      giftType === type
                        ? "bg-[#ffd66b] text-[#365665] shadow-[0_10px_24px_rgba(255,214,107,0.2)]"
                        : "text-white/58"
                    }`}
                  >
                    {type === "gift" ? "Gift" : "Discount"}
                  </button>
                ))}
              </div>
            </div>

            {giftType === "gift" ? (
              <label className="mb-4 block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/66">
                  Gift
                </span>
                <select
                  value={selectedGiftCategoryId}
                  onChange={(event) =>
                    setSelectedGiftCategoryId(event.target.value)
                  }
                  className="h-12 w-full rounded-[16px] border-0 bg-white/12 px-4 text-[13px] font-black text-white outline-none"
                >
                  {availableGiftCategories.length === 0 ? (
                    <option value="">No categories found</option>
                  ) : null}

                  {availableGiftCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      Free {category.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="mb-4 block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/66">
                  Discount
                </span>
                <select
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  className="h-12 w-full rounded-[16px] border-0 bg-white/12 px-4 text-[13px] font-black text-white outline-none"
                >
                  {["10%", "15%", "20%", "25%", "30%"].map((discount) => (
                    <option key={discount} value={discount}>
                      {discount}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="mb-5 block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/66">
                Description
              </span>
              <textarea
                value={giftDescription}
                onChange={(event) => setGiftDescription(event.target.value)}
                rows={2}
                placeholder="Optional note..."
                className="w-full rounded-[16px] border-0 bg-white/12 px-4 py-3 text-[13px] font-semibold text-white placeholder:text-white/45 outline-none"
              />
            </label>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setGiftPopupOpen(false)}
                className="rounded-full bg-white/10 px-5 py-3 text-[12px] font-black text-white transition hover:bg-white/16"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!sendGiftLabel) return;

                  onSendGift(sendGiftLabel, giftDescription);
                  setGiftType("gift");
                  setSelectedGiftCategoryId(
                    availableGiftCategories[0]?.id ?? "",
                  );
                  setDiscountValue("10%");
                  setGiftDescription("");
                  setGiftPopupOpen(false);
                }}
                disabled={!sendGiftLabel}
                className="rounded-full bg-[#ffd66b] px-6 py-3 text-[12px] font-black text-[#365665] transition hover:bg-[#f0cf61] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesktopActionBadge({
  action,
}: {
  action: StampTransaction["action_type"];
}) {
  const styles: Record<string, string> = {
    add_stamp: "bg-emerald-400/18 text-emerald-100",
    remove_stamp: "bg-red-500/18 text-red-200",
    reward_earned: "bg-[#ffd66b]/22 text-[#ffd66b]",
    reward_redeemed: "bg-slate-400/18 text-slate-100",
    manual_adjustment: "bg-white/12 text-white/62",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${styles[action] ?? "bg-white/12 text-white/62"}`}
    >
      {String(action || "activity").replace(/_/g, " ")}
    </span>
  );
}

function desktopLabelForAction(
  action: StampTransaction["action_type"],
  actorName?: string,
): string {
  if (action === "add_stamp") {
    return `Stamp added by ${actorName || "Staff"}`;
  }

  if (action === "reward_redeemed") {
    return `Gift confirmed by ${actorName || "Staff"}`;
  }

  return (
    {
      reward_earned: "Gift earned",
      manual_adjustment: "",
    }[action] ?? "Activity updated"
  );
}

function DesktopEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-white/22 bg-white/12 p-5 text-center text-[14px] font-bold text-white/70 shadow-[0_18px_46px_rgba(54,86,101,0.08)]">
      {text}
    </div>
  );
}

export function AdminDashboard(props: Props) {
  const [mounted, setMounted] = useState(false);
  const [isDesktopView, setIsDesktopView] = useState(false);

  useEffect(() => {
    setMounted(true);

    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    function updateView() {
      setIsDesktopView(mediaQuery.matches);
    }

    updateView();
    mediaQuery.addEventListener("change", updateView);

    return () => mediaQuery.removeEventListener("change", updateView);
  }, []);

  if (!mounted) {
    return (
      <div
        className="min-h-screen bg-[#eeeae0]"
        style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif" }}
      />
    );
  }

  if (isDesktopView) {
    return <DesktopAdminDashboard {...props} />;
  }

  return <MobileAdminDashboard {...props} />;
}

export default AdminDashboard;
