"use client";

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

type AdminUser = Profile & { is_active?: boolean | null };

type AdminCategory = {
  id: string;
  name: string;
  sort_order?: number | null;
};

type AdminClientStamp = {
  id?: string;
  client_id: string;
  category_id: string;
  stamp_count: number;
  updated_at?: string | null;
};

interface Props {
  profile: Profile;
  users?: AdminUser[];
  recentTxns?: StampTransaction[];
  recentRewards?: Reward[];
  metrics: Metrics;
}

const TABS = ["Overview", "Users", "Activity", "Gifts", "Loyalty Program", "Game Links"] as const;
type Tab = (typeof TABS)[number];

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";
const GLASS_CARD_LIGHT =
  "linear-gradient(145deg, rgba(255,255,255,0.88), rgba(255,255,255,0.72))";
const BRAND_YELLOW = "#ffd66b";
const BRAND_GREEN = "#365665";

function shortName(name?: string | null) {
  return (name || "Admin").trim().split(/\s+/)[0] || "Admin";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function roleLabel(role: UserRole) {
  if (role === "master_admin") return "Admin";
  if (role === "staff") return "Staff";
  return "Client";
}

function normalizeRewardText(value?: string | null) {
  return String(value || "Reward").replace(/ Item$/i, "").trim();
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

function getMostActiveCustomer(users: Profile[], recentTxns: StampTransaction[]) {
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

  return users.find((user) => user.id === topClientId)?.full_name ?? (topClientId ? `Client ${topClientId.slice(0, 6)}` : "—");
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
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [activityTxns, setActivityTxns] = useState<StampTransaction[]>(recentTxns ?? []);
  const [giftRows, setGiftRows] = useState<Reward[]>(recentRewards ?? []);
  const [profileNamesById, setProfileNamesById] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | UserRole>("staff");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleUserCount, setVisibleUserCount] = useState(15);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<AdminCategory[]>([]);
  const [selectedStamps, setSelectedStamps] = useState<AdminClientStamp[]>([]);
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
  const [mobileGameKind, setMobileGameKind] = useState<"football" | "basketball">("basketball");
  const [mobileGameSaving, setMobileGameSaving] = useState(false);
  const [mobileGameForm, setMobileGameForm] = useState({
    home_team: "",
    away_team: "",
    venue: "",
    match_label: "",
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
      anchor.download = `${title}-qr.png`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
      const response = await fetch("/api/admin/prediction-matches", { method: "GET" });
      const text = await response.text();
      const json = text
        ? (JSON.parse(text) as {
            matches?: Array<{
              id: string;
              sport_type?: string | null;
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
      Number.isInteger(basketballWinBy) && basketballWinBy >= 1 && basketballWinBy <= 99;

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
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      const json = text ? (JSON.parse(text) as { match?: { id: string }; error?: string }) : {};

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
      flash(error instanceof Error ? error.message : "Could not create game link.", "error");
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

      const rewards = ((rewardResult.data ?? []) as Reward[]);

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
            ...rewards.flatMap((reward) => [reward.client_id, reward.redeemed_by]),
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
          names[row.id] = row.full_name || row.email || row.client_code || "Unknown";
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

  async function setRole(userId: string, role: UserRole) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)));

    if (selectedUser?.id === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, role } : prev));
    }

    flash("Role updated.");
  }

  async function deactivateUser(userId: string) {
    const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", userId);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, is_active: false } : user)),
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
      setSelectedUser((prev) => (prev ? { ...prev, is_active: true, role } : prev));
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
          <img src="/client-main-card.png"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-[128%] translate-x-8 scale-[1.06] object-cover object-right opacity-55" />

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.34em] text-white/80">
                Admin Dashboard
              </p>

              <h1 className="text-[30px] font-black leading-[1.02] tracking-[-0.04em] text-white">
                Hello,
                <br />
                <span className="text-[#ffd66b]">{shortName(profile.full_name)}</span>
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
                <MetricCard label="Total Customers" value={metrics.totalClients} />
                <MetricCard label="Active Customers" value={activeCustomers} />
                <MetricCard label="Stamps Issued" value={metrics.stampsIssued} />
                <MetricCard label="Gifts Redeemed" value={metrics.rewardsRedeemed} />
              </div>
            </DashboardGroup>

            <DashboardGroup title="Performance">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label={<>Redemption<br />Rate</>} value={redemptionRate} />
                <MetricCard label="Average Stamps per Customer" value={averageStampsPerCustomer} />
                <MetricCard label="Repeat Customers" value={repeatCustomers} />
              </div>
            </DashboardGroup>

            <DashboardGroup title="Insights">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Most Active Category" value={metrics.mostActiveCategoryName || "—"} />
                <MetricCard label="Top Reward" value={topReward} />
                <MetricCard label="Most Active Customer" value={mostActiveCustomer} />
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
                onReactivate={(role) => void reactivateUser(selectedUser.id, role)}
              />
            ) : (
              <>
                <div className="mb-4 flex gap-1 rounded-full border border-white/14 bg-white/12 p-1 text-[11px] backdrop-blur-xl">
                  {(["all", "client", "staff", "master_admin"] as const).map((item) => (
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
                      {item === "all" ? "All" : item === "master_admin" ? "Admin" : item === "staff" ? "Staff" : "Clients"}
                    </button>
                  ))}
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
                          value={user.is_active === false ? "deactivated" : user.role}
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
                            user.is_active === false ? "text-red-600" : "text-[#365665]"
                          }`}
                          title={user.id === profile.id ? "You cannot change your own role" : ""}
                        >
                          <option value="client">Client</option>
                          <option value="staff">Staff</option>
                          <option value="master_admin">Admin</option>
                          <option value="deactivated" className="font-black text-red-600">
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
            {visibleActivityTxns.length === 0 ? <EmptyState text="No activity in the last 5 days." /> : null}

            {visibleActivityTxns.map((transaction) => {
              const clientName = profileNamesById[transaction.client_id ?? ""] ?? "Client";
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
                          <span className="font-black text-[#ffd66b]">Claimed</span>
                          {" by "}
                          <span className="font-black text-white">{actorName}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-black text-[#ffd66b]">{clientName}</span>
                        </>
                      )}
                      {" · "}
                      {formatDate(transaction.created_at)}
                      {transaction.stamp_count_before !== null &&
                      transaction.stamp_count_after !== null ? (
                        <> · {transaction.stamp_count_before} → {transaction.stamp_count_after}</>
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
            {(giftRows ?? []).length === 0 ? <EmptyState text="No gifts yet." /> : null}

            {(giftRows ?? []).map((reward) => {
              const clientName = profileNamesById[reward.client_id] ?? "Client";
              const confirmedByName = reward.redeemed_by
                ? profileNamesById[reward.redeemed_by] ?? "Staff user"
                : null;
              const isBirthdayGift =
                /birthday|20%|discount|dessert/i.test(reward.reward_type || "");

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
                            <span className="font-black text-[#ffd66b]">Claimed</span>
                            {" by "}
                            <span className="font-black text-white">{clientName}</span>
                          </>
                        ) : null}

                        {reward.redeemed_at ? (
                          <>
                            {" · "}
                            <span className="font-black text-[#ffd66b]">Confirmed</span>
                            {confirmedByName ? (
                              <>
                                {" by "}
                                <span className="font-black text-white">{confirmedByName}</span>
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
                          : reward.status === "redeemed" || reward.status === "claimed"
                            ? "bg-white/16 text-[#ffd66b]"
                            : "bg-white/102 text-[#365665]"
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

        {tab === "Game Links" && (
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
                      label={mobileGameKind === "basketball" ? "Team 1" : "Home Team"}
                      value={mobileGameForm.home_team}
                      onChange={(value) => setMobileGameForm((current) => ({ ...current, home_team: value }))}
                    />
                    <MobileGameInput
                      label={mobileGameKind === "basketball" ? "Team 2" : "Away Team"}
                      value={mobileGameForm.away_team}
                      onChange={(value) => setMobileGameForm((current) => ({ ...current, away_team: value }))}
                    />
                    <MobileGameInput
                      label="Tournament"
                      value={mobileGameForm.match_label}
                      onChange={(value) => setMobileGameForm((current) => ({ ...current, match_label: value }))}
                    />
                    <MobileGameInput
                      label="Description"
                      value={mobileGameForm.venue}
                      onChange={(value) => setMobileGameForm((current) => ({ ...current, venue: value }))}
                    />
                    <MobileGameInput
                      type="datetime-local"
                      label="Match Timing"
                      value={mobileGameForm.kickoff_at}
                      onChange={(value) => setMobileGameForm((current) => ({ ...current, kickoff_at: value }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <MobileGameInput
                        type="datetime-local"
                        label="Open Time"
                        value={mobileGameForm.opens_at}
                        onChange={(value) => setMobileGameForm((current) => ({ ...current, opens_at: value }))}
                      />
                      <MobileGameInput
                        type="datetime-local"
                        label="Close Time"
                        value={mobileGameForm.closes_at}
                        onChange={(value) => setMobileGameForm((current) => ({ ...current, closes_at: value }))}
                      />
                    </div>

                    {mobileGameKind === "football" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <MobileGameInput
                          label="Home Score"
                          value={mobileGameForm.home_score}
                          onChange={(value) => setMobileGameForm((current) => ({ ...current, home_score: value }))}
                        />
                        <MobileGameInput
                          label="Away Score"
                          value={mobileGameForm.away_score}
                          onChange={(value) => setMobileGameForm((current) => ({ ...current, away_score: value }))}
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
                              onChange={(event) => setMobileGameForm((current) => ({ ...current, basketball_winner: event.target.value }))}
                              className="h-11 w-full rounded-[16px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                            >
                              <option value="home">{mobileGameForm.home_team || "Team 1"}</option>
                              <option value="away">{mobileGameForm.away_team || "Team 2"}</option>
                            </select>
                          </label>

                          <MobileGameInput
                            label="Final Win By"
                            value={mobileGameForm.basketball_win_by}
                            onChange={(value) => setMobileGameForm((current) => ({ ...current, basketball_win_by: value }))}
                          />
                        </div>

                        <p className="mt-3 text-[11px] font-semibold leading-5 text-white/58">
                          Leave final winner and win-by empty when creating the link. Add them after the game result is known.
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

            {mobileGameLinks.length === 0 ? <EmptyState text="No games created yet." /> : null}

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
                      {game.title.split(" vs ")[0]} <span className="text-[#ffd66b]">vs</span>{" "}
                      {game.title.split(" vs ")[1] ?? ""}
                    </div>
                    <div className="mt-3 text-[12px] font-bold leading-5 text-white/78">
                      {game.sportType === "basketball" ? "Tip off" : "Kickoff"} {game.kickoff ? formatDate(game.kickoff) : "—"}
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
                    className="flex h-11 items-center justify-center rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.18em] text-[#365665]"
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
};

function parseMoneyValue(value: string | number | null | undefined) {
  const numberValue = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatLoyaltyMoney(value: number, currency: string) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${currency || "$"}${safeValue.toFixed(2)}`;
}

function LoyaltyProgramPanel({ compact = false }: { compact?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_LOYALTY_SETTINGS);
  const [categories, setCategories] = useState<LoyaltyProgramCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [showDisableWarning, setShowDisableWarning] = useState(false);

  const estimatedGiftCost = useMemo(
    () => parseMoneyValue(settings.average_stamp_cost) * Math.max(1, Number(settings.stamps_per_gift) || 5),
    [settings.average_stamp_cost, settings.stamps_per_gift],
  );

  function showMessage(text: string, tone: "success" | "error" = "success") {
    setMessage({ text, tone });
    setTimeout(() => setMessage(null), 2400);
  }

  async function loadLoyaltyProgram() {
    setLoading(true);

    try {
      const [settingsResult, categoryResult] = await Promise.all([
        supabase.from("loyalty_program_settings").select("*").limit(1),
        supabase.from("loyalty_categories").select("*").order("sort_order", { ascending: true }),
      ]);

      if (!settingsResult.error && settingsResult.data && settingsResult.data.length > 0) {
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
        console.warn("Loyalty settings table not ready:", settingsResult.error.message);
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
        program_name: nextSettings.program_name.trim() || DEFAULT_LOYALTY_SETTINGS.program_name,
        stamp_name: nextSettings.stamp_name.trim() || DEFAULT_LOYALTY_SETTINGS.stamp_name,
        gift_name: nextSettings.gift_name.trim() || DEFAULT_LOYALTY_SETTINGS.gift_name,
        is_enabled: nextSettings.is_enabled,
        average_stamp_cost: parseMoneyValue(nextSettings.average_stamp_cost),
        stamps_per_gift: Math.max(1, Number(nextSettings.stamps_per_gift) || 5),
        currency: nextSettings.currency.trim() || "$",
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("loyalty_program_settings")
        .upsert(payload)
        .select("*")
        .limit(1);

      if (error) {
        showMessage("Run the Loyalty Program SQL first, then save again.", "error");
        console.error(error);
        return;
      }

      if (data && data.length > 0) {
        const saved = data[0] as Partial<LoyaltySettings>;
        setSettings((current) => ({ ...current, ...saved, id: String(saved.id || current.id) }));
      } else {
        setSettings(nextSettings);
      }

      showMessage(nextSettings.is_enabled ? "Loyalty program saved." : "Loyalty program disabled.");
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
        setCategories((current) => [...current, data[0] as LoyaltyProgramCategory]);
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

  async function updateCategory(category: LoyaltyProgramCategory, updates: Partial<LoyaltyProgramCategory>) {
    setSavingCategoryId(category.id);

    try {
      const payload: Record<string, unknown> = {};

      if (typeof updates.name === "string") {
        payload.name = updates.name.trim() || category.name;
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

      const updatedCategory = (data && data.length > 0 ? data[0] : { ...category, ...updates }) as LoyaltyProgramCategory;

      setCategories((current) =>
        current.map((item) => (item.id === category.id ? updatedCategory : item)),
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
    const confirmed = window.confirm(`Remove ${category.name}? Disable it instead if clients already have stamps in this category.`);

    if (!confirmed) return;

    setSavingCategoryId(category.id);

    try {
      const { error } = await supabase.from("loyalty_categories").delete().eq("id", category.id);

      if (error) {
        showMessage(error.message, "error");
        return;
      }

      setCategories((current) => current.filter((item) => item.id !== category.id));
      showMessage("Category removed.");
    } catch (error) {
      console.error(error);
      showMessage("Could not remove category.", "error");
    } finally {
      setSavingCategoryId(null);
    }
  }

  const mainGridClass = compact ? "grid gap-3" : "grid gap-3 lg:grid-cols-[1.2fr_0.75fr_0.75fr_auto]";

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
              onChange={(value) => setSettings((current) => ({ ...current, program_name: value }))}
              placeholder="PRO’s Club"
            />
            <LoyaltyNumberInput
              label="Avg. Cost / Stamp"
              value={String(settings.average_stamp_cost)}
              onChange={(value) => setSettings((current) => ({ ...current, average_stamp_cost: parseMoneyValue(value) }))}
              placeholder="0"
            />
            <LoyaltyNumberInput
              label="Stamps Needed"
              value={String(settings.stamps_per_gift)}
              onChange={(value) => setSettings((current) => ({ ...current, stamps_per_gift: Number(value) || 1 }))}
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

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[18px] border border-white/14 bg-white/10 p-4">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/52">
                Estimated Gift Cost
              </div>
              <div className="mt-1 text-[26px] font-black leading-none text-[#ffd66b]">
                {formatLoyaltyMoney(estimatedGiftCost, settings.currency)}
              </div>
            </div>
            <div className="rounded-[18px] border border-white/14 bg-white/10 p-4 md:col-span-2">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/52">
                Calculation
              </div>
              <p className="mt-1 text-[12px] font-bold leading-5 text-white/68">
                Avg. cost per stamp × stamps needed = estimated gift cost.
              </p>
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

          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="New category name"
              className="h-12 flex-1 rounded-[14px] border border-white/25 bg-white px-4 text-[13px] font-bold text-black outline-none focus:border-[#ffd66b]"
            />
            <button
              type="button"
              onClick={() => void addCategory()}
              disabled={savingCategoryId === "new"}
              className="h-12 rounded-[14px] bg-[#ffd66b] px-5 text-[11px] font-black uppercase tracking-[0.16em] text-[#365665] disabled:opacity-55"
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
                  onSave={(name) => void updateCategory(category, { name })}
                  onToggle={() => void updateCategory(category, { is_active: category.is_active === false })}
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
              Staff will not be able to add new stamps while the program is disabled. Clients can still view their profile and existing gifts.
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
  onSave: (name: string) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(category.name);

  useEffect(() => {
    setName(category.name);
  }, [category.name]);

  const isActive = category.is_active !== false;
  const isDirty = name.trim() !== category.name;

  return (
    <div className="rounded-[18px] border border-white/16 bg-white/10 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 w-full rounded-[14px] border border-white/18 bg-white px-3 text-[13px] font-black text-[#365665] outline-none focus:border-[#ffd66b]"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
            <span className={isActive ? "text-emerald-100" : "text-red-100"}>
              {isActive ? "Active" : "Disabled"}
            </span>
            <span className="text-white/36">•</span>
            <span className="text-white/52">Category ID: {category.id.slice(0, 8)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSave(name)}
            disabled={saving || !isDirty}
            className="rounded-full bg-[#ffd66b] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#365665] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={saving}
            className="rounded-full bg-white/14 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white disabled:opacity-45"
          >
            {isActive ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            className="rounded-full bg-red-500/16 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-red-100 disabled:opacity-45"
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
        className="h-11 w-full rounded-[16px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none focus:border-[#ffd66b]"
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
              user.is_active === false ? "text-red-600" : "text-[#365665]"
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
            {categories.length === 0 ? <EmptyState text="No stamp categories found." /> : null}

            {categories.map((category) => {
              const count = Math.max(0, Math.min(5, stampByCategory.get(category.id) ?? 0));

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
        {loading ? null : rewards.length === 0 ? <EmptyState text="No gifts for this client yet." /> : null}

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
                    {reward.redeemed_at ? <> · Confirmed {formatDate(reward.redeemed_at)}</> : null}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                    reward.status === "available"
                      ? "bg-[#ffd66b] text-[#365665]"
                      : reward.status === "redeemed" || reward.status === "claimed"
                        ? "bg-white/16 text-[#ffd66b]"
                        : "bg-white/102 text-[#365665]"
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

function MetricCard({ label, value }: { label: React.ReactNode; value: number | string }) {
  const isLongText = typeof value === "string" && value.length > 8 && !value.includes("%");

  return (
    <div
      className="border border-white/20 p-4 shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
      style={{ borderRadius: 24, background: GLASS_CARD }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
        {label}
      </div>
      <div
        className={`mt-2 font-black leading-tight text-[#ffd66b] ${
          isLongText ? "text-[20px]" : "text-[32px] tabular-nums"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: StampTransaction["action_type"] }) {
  const map: Record<
    StampTransaction["action_type"],
    { className: string; icon: React.ReactNode }
  > = {
    add_stamp: {
      className: "bg-[#ffd66b] text-[#365665]",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
    },
    reward_earned: {
      className: "bg-white/106 text-[#365665]",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12v8H4v-8" />
          <path d="M2 7h20v5H2z" />
          <path d="M12 22V7" />
          <path d="M12 7H7.5a2.5 2.5 0 1 1 2.2-3.7L12 7Z" />
          <path d="M12 7h4.5a2.5 2.5 0 1 0-2.2-3.7L12 7Z" />
        </svg>
      ),
    },
    reward_redeemed: {
      className: "bg-[#365665] text-white",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ),
    },
    manual_adjustment: {
      className: "bg-white/18 text-[#ffd66b]",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h10" />
          <path d="M4 17h16" />
          <path d="M17 4v6" />
          <path d="M14 7h6" />
          <path d="M9 14v6" />
          <path d="M6 17h6" />
        </svg>
      ),
    },
  };

  const item = map[action] ?? map.manual_adjustment;

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.className}`}>
      {item.icon}
    </div>
  );
}

function labelForAction(action: StampTransaction["action_type"], actorName?: string): string {
  if (action === "add_stamp") {
    return `Stamp added by ${actorName || "Staff"}`;
  }

  if (action === "reward_redeemed") {
    return `Gift confirmed by ${actorName || "Staff"}`;
  }

  return {
    reward_earned: "Gift earned",
    manual_adjustment: "",
  }[action] ?? "Activity updated";
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

function desktopRoleLabel(role: UserRole) {
  if (role === "master_admin") return "Admin";
  if (role === "staff") return "Staff";
  return "Client";
}

function desktopNormalizeRewardText(value?: string | null) {
  return String(value || "Reward").replace(/ Item$/i, "").trim();
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

function desktopGetMostActiveCustomer(users: Profile[], recentTxns: StampTransaction[]) {
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

  return users.find((user) => user.id === topClientId)?.full_name ?? (topClientId ? `Client ${topClientId.slice(0, 6)}` : "—");
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

  const birthday = new Date(value);
  if (Number.isNaN(birthday.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();

  const birthdayPassedThisYear =
    today.getMonth() > birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate());

  if (!birthdayPassedThisYear) age -= 1;

  return age >= 0 ? age : null;
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
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}

function isWithinDesktopTimeRange(value: string | null | undefined, range: DesktopTimeRange) {
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
  const [activityTxns, setActivityTxns] = useState<StampTransaction[]>(recentTxns ?? []);
  const [giftRows, setGiftRows] = useState<Reward[]>(recentRewards ?? []);
  const [profileNamesById, setProfileNamesById] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | UserRole>("client");
  const [timeRange, setTimeRange] = useState<DesktopTimeRange>("week");
  const [reportFiltersOpen, setReportFiltersOpen] = useState(false);
  const [lastVisitFilter, setLastVisitFilter] = useState<"all" | "active" | "inactive">("all");
  const [customerSort, setCustomerSort] = useState<{
    key: "name" | "contact" | "age" | "lastVisit" | "visits" | "status";
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });
  const reportFilterRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleUserCount, setVisibleUserCount] = useState(15);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<AdminCategory[]>([]);
  const [selectedStamps, setSelectedStamps] = useState<AdminClientStamp[]>([]);
  const [selectedRewards, setSelectedRewards] = useState<Reward[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");
  const [gameKind, setGameKind] = useState<"football" | "basketball">("basketball");
  const [gameForm, setGameForm] = useState({
    home_team: "",
    away_team: "",
    venue: "",
    match_label: "",
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
  const [createdGameLinks, setCreatedGameLinks] = useState<Array<{ id: string; title: string; code: string; meta?: string }>>([]);

  function flash(message: string, t: "success" | "error" = "success") {
    setTone(t);
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function predictionLinkFor(code: string) {
    if (typeof window === "undefined") return `/predict/${code}`;
    return `${window.location.origin}/predict/${code}`;
  }

  async function refreshDesktopGameLinks() {
    try {
      const response = await fetch("/api/admin/prediction-matches", { method: "GET" });
      const text = await response.text();
      const json = text
        ? (JSON.parse(text) as {
            matches?: Array<{
              id: string;
              home_team: string | null;
              away_team: string | null;
              secret_code: string;
              match_label: string | null;
              kickoff_at: string | null;
            }>;
            error?: string;
          })
        : {};

      if (!response.ok) {
        flash(json.error ?? "Could not load game links.", "error");
        return;
      }

      setCreatedGameLinks(
        (json.matches ?? []).map((match) => ({
          id: match.id,
          title: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
          code: match.secret_code,
          meta: `${match.match_label || "World Cup"} · ${desktopFormatDate(match.kickoff_at)}`,
        })),
      );
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not load game links.", "error");
    }
  }

  async function createGameLinkFromDesktop() {
    if (!gameForm.home_team.trim() || !gameForm.away_team.trim()) {
      flash("Add both teams first.", "error");
      return;
    }

    setGameSaving(true);

    const basketballWinBy = Number(gameForm.basketball_win_by);
    const hasBasketballResult =
      Number.isInteger(basketballWinBy) && basketballWinBy >= 1 && basketballWinBy <= 99;

    const payload =
      gameKind === "basketball"
        ? {
            ...gameForm,
            sport_type: "basketball",
            match_label: gameForm.match_label.trim() || "Basket",
            venue:
              gameForm.venue.trim() ||
              "Basketball rule: client chooses the winner, with bonus for exact win margin.",
            home_score: hasBasketballResult && gameForm.basketball_winner === "home" ? String(basketballWinBy) : "",
            away_score: hasBasketballResult && gameForm.basketball_winner === "away" ? String(basketballWinBy) : "",
          }
        : {
            ...gameForm,
            sport_type: "football",
            match_label: gameForm.match_label.trim() || "World Cup",
          };

    try {
      const response = await fetch("/api/admin/prediction-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      const json = text ? (JSON.parse(text) as { match?: { id: string; home_team: string; away_team: string; secret_code: string }; error?: string }) : {};

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
      flash(error instanceof Error ? error.message : "Could not create game link.", "error");
    } finally {
      setGameSaving(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAdminData() {
      const [txnResult, rewardResult] = await Promise.all([
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
      void refreshDesktopGameLinks();

      const ids = Array.from(
        new Set(
          [
            ...txns.flatMap((txn) => [txn.client_id, txn.staff_id]),
            ...rewards.flatMap((reward) => [reward.client_id, reward.redeemed_by]),
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
          names[row.id] = row.full_name || row.email || row.client_code || "Unknown";
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
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)));

    if (selectedUser?.id === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, role } : prev));
    }

    flash("Role updated.");
  }

  async function deactivateUser(userId: string) {
    const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", userId);

    if (error) {
      flash(error.message, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, is_active: false } : user)),
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
      setSelectedUser((prev) => (prev ? { ...prev, is_active: true, role } : prev));
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

    const currentRow = selectedStamps.find((stamp) => stamp.category_id === categoryId);
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
        selectedCategories.find((category) => category.id === categoryId)?.name?.toLowerCase() ?? "";

      const rewardType = categoryName.includes("sandwich")
        ? "Free Sandwich"
        : categoryName.includes("main")
          ? "Free Main Course"
          : categoryName.includes("dessert")
            ? "Free Dessert"
            : categoryName.includes("coffee")
              ? "Free Coffee"
              : categoryName.includes("hooka") || categoryName.includes("hookah")
                ? "Free Hooka"
                : "Free Reward";

      const { error: rewardError } = await supabase.from("rewards").insert({
        client_id: selectedUser.id,
        category_id: categoryId,
        reward_type: rewardType,
        status: "available",
        earned_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
      await openUserProfile(selectedUser);
      return;
    }

    flash("Stamp added.");
    await openUserProfile(selectedUser);
  }


  async function removeStampFromSelectedClient(categoryId: string) {
    if (!selectedUser) return;

    const currentRow = selectedStamps.find((stamp) => stamp.category_id === categoryId);
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
          (rewardName.includes("dessert") && categoryName.includes("dessert")) ||
          (rewardName.includes("sandwich") && categoryName.includes("sandwich")) ||
          (rewardName.includes("coffee") && categoryName.includes("coffee")) ||
          (rewardName.includes("main") && categoryName.includes("main"))
        );
      }) ?? selectedCategories[0];

    if (!matchedCategory?.id) {
      flash("No loyalty category found for this gift.", "error");
      return;
    }

    setSelectedLoading(true);

    const rewardType = giftDescription ? `${giftName} · ${giftDescription}` : giftName;

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
      const createdAt = (user as AdminUser & { created_at?: string | null }).created_at;
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

  const visibleGiftRows = useMemo(() => {
    return giftRows.filter((reward) =>
      isWithinDesktopTimeRange(reward.earned_at ?? reward.created_at, timeRange),
    );
  }, [giftRows, timeRange]);

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
    if (!metrics.totalClients) return "0";
    return (metrics.stampsIssued / metrics.totalClients).toFixed(1);
  }, [metrics.stampsIssued, metrics.totalClients]);

  const redemptionRate = useMemo(
    () => desktopPercentage(desktopSafeRatio(metrics.rewardsRedeemed, metrics.rewardsEarned)),
    [metrics.rewardsEarned, metrics.rewardsRedeemed],
  );

  const topReward = useMemo(() => desktopGetTopReward(visibleGiftRows), [visibleGiftRows]);
  const mostActiveCustomer = useMemo(
    () => desktopGetMostActiveCustomer(users, visibleActivityTxns),
    [visibleActivityTxns, users],
  );

  const totalUsers = users.length;
  const totalStaff = users.filter((user) => user.role === "staff").length;
  const totalAdmins = users.filter((user) => user.role === "master_admin").length;
  const totalDeactivated = users.filter((user) => user.is_active === false).length;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const newUsersThisMonth = users.filter((user) => {
    const createdAt = new Date(String((user as AdminUser & { created_at?: string | null }).created_at ?? ""));
    return !Number.isNaN(createdAt.getTime()) && createdAt >= startOfMonth;
  }).length;

  const newUsersThisWeek = users.filter((user) => {
    const createdAt = new Date(String((user as AdminUser & { created_at?: string | null }).created_at ?? ""));
    return !Number.isNaN(createdAt.getTime()) && createdAt >= startOfWeek;
  }).length;

  const monthlyActiveUsers = activeCustomers;
  const latestActivities = visibleActivityTxns.slice(0, 5);
  const latestGifts = visibleGiftRows.slice(0, 50);
  const recentRewardClients = desktopUniqueCount(visibleGiftRows.map((reward) => reward.client_id));

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
      const clientTxns = visibleActivityTxns.filter((txn) => txn.client_id === user.id);
      const allClientTxns = activityTxns.filter((txn) => txn.client_id === user.id);
      const lastTxn = allClientTxns
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      const visits = clientTxns.length;
      const totalVisits = allClientTxns.length;
      const lastVisit = lastTxn?.created_at ?? null;
      const age = getAgeFromBirthday(getBirthdayValue(user));
      const lastVisitMs = lastVisit ? new Date(lastVisit).getTime() : NaN;
      const inactive =
        user.is_active === false ||
        !Number.isFinite(lastVisitMs) ||
        Date.now() - lastVisitMs > 30 * 24 * 60 * 60 * 1000;

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
        lastVisit,
        age,
        inactive,
      };
    });
  }, [activityTxns, clientUsersForReports, visibleActivityTxns]);

  const filteredCustomerReportRows = useMemo(() => {
    return customerReportRows.filter((row) => {
      if (lastVisitFilter === "active") return !row.inactive;
      if (lastVisitFilter === "inactive") return row.inactive;
      return true;
    });
  }, [customerReportRows, lastVisitFilter]);

  const sortedCustomerReportRows = useMemo(() => {
    const direction = customerSort.direction === "asc" ? 1 : -1;

    return filteredCustomerReportRows.slice().sort((a, b) => {
      const textCompare = (first: string, second: string) =>
        first.localeCompare(second) * direction;

      if (customerSort.key === "name") {
        return textCompare(a.user.full_name || "", b.user.full_name || "");
      }

      if (customerSort.key === "contact") {
        return textCompare(a.user.phone || a.user.email || "", b.user.phone || b.user.email || "");
      }

      if (customerSort.key === "age") {
        if (a.age === null && b.age === null) return 0;
        if (a.age === null) return 1;
        if (b.age === null) return -1;
        return (a.age - b.age) * direction;
      }

      if (customerSort.key === "lastVisit") {
        return ((new Date(a.lastVisit || 0).getTime() || 0) - (new Date(b.lastVisit || 0).getTime() || 0)) * direction;
      }

      if (customerSort.key === "visits") {
        return (a.totalVisits - b.totalVisits) * direction;
      }

      return (Number(a.inactive) - Number(b.inactive)) * direction;
    });
  }, [customerSort, filteredCustomerReportRows]);

  function sortCustomerTable(key: "name" | "contact" | "age" | "lastVisit" | "visits" | "status") {
    setCustomerSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function downloadVisibleCustomerTable() {
    const csvEscape = (value: string | number | null | undefined) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const visibleRows = sortedCustomerReportRows.slice(0, 80);
    const headers = ["Name", "Member ID", "Contact", "Age", "Last Visit", "Visits", "Status"];
    const rows = visibleRows.map((row) => [
      row.user.full_name || "Client",
      row.user.client_code || "",
      row.user.phone || "",
      row.age ?? "",
      desktopFormatDateOnly(row.lastVisit),
      row.totalVisits,
      row.inactive ? "Inactive" : "Active",
    ]);

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

  const newCustomerCount = customerReportRows.filter((row) => row.totalVisits <= 1).length;
  const returningCustomerCount = customerReportRows.filter((row) => row.totalVisits > 1).length;
  const clientCustomerRows = customerReportRows.filter((row) => row.user.role === "client");
  const inactiveCustomerCount = clientCustomerRows.filter((row) => row.inactive).length;
  const activeReportCustomers = clientCustomerRows.length - inactiveCustomerCount;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,214,107,0.24),transparent_28%),linear-gradient(135deg,#365665_0%,#263f49_48%,#798673_100%)] text-white" style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif" }}>
      <Toast message={toast} tone={tone} />

      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] gap-6 overflow-visible bg-transparent p-6 lg:min-h-screen">
        <aside className="hidden w-[238px] shrink-0 flex-col overflow-hidden rounded-[30px] border border-white/24 bg-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.24)] backdrop-blur-2xl lg:flex">
          <div className="flex h-20 items-center gap-3 border-b border-white/14 px-7">
            <img src="/pros-logo-basic.png" alt="PRO's" className="h-10 w-auto object-contain" />
            <div>
              <div className="text-[17px] font-black leading-none text-white">PRO&apos;s</div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ffd66b]">Admin</div>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setTab(item);
                  setSelectedUser(null);
                }}
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] px-4 text-left text-[13px] font-black transition ${
                  tab === item
                    ? "bg-white/18 text-white shadow-[0_16px_34px_rgba(35,54,47,0.18)]"
                    : "text-white/70 hover:bg-white/12 hover:text-white"
                }`}
              >
                <span className={`mr-3 h-2.5 w-2.5 rounded-full ${tab === item ? "bg-[#ffd66b]" : "bg-white/30"}`} />
                {item}
              </button>
            ))}

          </nav>

          <div className="border-t border-white/14 px-4 py-5">
            <button
              type="button"
              onClick={() => void logout()}
              className="mb-4 flex w-full items-center justify-start rounded-none bg-transparent px-4 py-2 text-left text-[12px] font-black text-white/86 transition hover:text-white"
            >
              Logout
            </button>

            <a
              href="https://wissamdesigns.com"
              target="_blank"
              rel="noreferrer"
              className="block text-center text-[11px] font-bold leading-5 text-white/72 transition hover:text-white"
            >
              Powered by wissamdesigns.com
            </a>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-hidden rounded-[30px] border border-white/24 bg-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.22)] backdrop-blur-2xl">
          <div className="px-5 py-6 lg:px-8">
            {tab === "Overview" ? (
              <section className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
                  <Panel className="min-h-[330px]">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-[19px] font-black text-white">Transactions & Rewards</h2>
                        <p className="mt-1 text-[12px] font-bold text-white/70">Overview for the last activity period</p>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-white">This week</span>
                    </div>

                    <LineChart />

                    <div className="mt-7 grid grid-cols-3 gap-4 border-t border-white/18 pt-5">
                      <MiniStat label="Stamps issued" value={metrics.stampsIssued} />
                      <MiniStat label="Gifts earned" value={metrics.rewardsEarned} />
                      <MiniStat label="Gifts redeemed" value={metrics.rewardsRedeemed} />
                    </div>
                  </Panel>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <StatTile value={metrics.stampsIssued} label="Total stamps" trend="+5.4%" />
                    <StatTile value={metrics.rewardsRedeemed} label="Gifts redeemed" trend={redemptionRate} />
                    <Panel>
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-[18px] font-black text-white">Demographics</h2>
                        <span className="text-[11px] font-black text-white/70">Clients</span>
                      </div>
                      <div className="grid grid-cols-[120px_1fr] items-center gap-5">
                        <DonutChart value={desktopSafeRatio(activeCustomers, Math.max(1, metrics.totalClients))} />
                        <div className="space-y-3">
                          <Bar label="Active" value={desktopSafeRatio(activeCustomers, Math.max(1, metrics.totalClients))} />
                          <Bar label="Repeat" value={desktopSafeRatio(repeatCustomers, Math.max(1, metrics.totalClients))} />
                          <Bar label="Gift users" value={desktopSafeRatio(recentRewardClients, Math.max(1, metrics.totalClients))} />
                        </div>
                      </div>
                    </Panel>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Panel>
                    <h2 className="mb-5 text-[18px] font-black text-white">Top Insights</h2>
                    <InsightRow label="Most active category" value={metrics.mostActiveCategoryName || "—"} />
                    <InsightRow label="Top reward" value={topReward} />
                    <InsightRow label="Most active client" value={mostActiveCustomer} />
                  </Panel>

                  <Panel className="lg:col-span-2">
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="text-[18px] font-black text-white">Users</h2>
                      <button type="button" onClick={() => setTab("Users")} className="text-[11px] font-black text-white">
                        All users
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-[14px] border border-white/18">
                      <AdminUserMetricRow label="Total User" value={totalUsers} />
                      <AdminUserMetricRow label="New Users(this month)" value={newUsersThisMonth} trend="+ 5.48%" />
                      <AdminUserMetricRow label="New Users(this week)" value={newUsersThisWeek} trend="- 1.34%" negative />
                      <AdminUserMetricRow label="Monthly Active User" value={monthlyActiveUsers} trend="+ 20.30%" />
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
                    loading={selectedLoading}
                    onBack={() => setSelectedUser(null)}
                    onRoleChange={(role) => void setRole(selectedUser.id, role)}
                    onDeactivate={() => void deactivateUser(selectedUser.id)}
                    onReactivate={(role) => void reactivateUser(selectedUser.id, role)}
                    onAddStamp={(categoryId) => void addStampToSelectedClient(categoryId)}
                    onRemoveStamp={(categoryId) => void removeStampFromSelectedClient(categoryId)}
                    onSendGift={(gift, description) => void sendGiftToSelectedClient(gift, description)}
                  />
                ) : (
                  <>
                    <Panel className="mb-4">
                      <div className="mb-4">
                        <h2 className="mt-1 text-[24px] font-black tracking-[-0.04em] text-white">
                          Customer behavior
                        </h2>
                      </div>

                      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                        <input
                          value={searchTerm}
                          onChange={(event) => {
                            setSearchTerm(event.target.value);
                            setVisibleUserCount(15);
                            setSelectedUser(null);
                          }}
                          placeholder="Search by name, phone, member ID..."
                          onFocus={() => setReportFiltersOpen(false)}
                          className="h-12 w-full rounded-[14px] border border-white/25 bg-white px-4 text-[13px] font-bold text-black outline-none focus:border-[#ffd66b]"
                        />

                        <div ref={reportFilterRef} className="relative">
                          <button
                            type="button"
                            onClick={() => setReportFiltersOpen((current) => !current)}
                            className="h-12 rounded-[14px] border border-white/25 bg-white/12 px-5 text-[12px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/18"
                          >
                            Filter
                          </button>

                          {reportFiltersOpen ? (
                            <div className="absolute right-0 top-14 z-30 w-[280px] rounded-[22px] border border-white/24 bg-[#365665] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                              <div className="space-y-4">
                                <label className="block">
                                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                                    Date Range
                                  </span>
                                  <select
                                    value={timeRange}
                                    onChange={(event) => {
                                      setTimeRange(event.target.value as DesktopTimeRange);
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
                                      setLastVisitFilter(event.target.value as "all" | "active" | "inactive");
                                      setReportFiltersOpen(false);
                                    }}
                                    className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                                  >
                                    <option value="all">All</option>
                                    <option value="active">Active recently</option>
                                    <option value="inactive">Inactive recently</option>
                                  </select>
                                </label>

                                <label className="block">
                                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                                    Profile Tab
                                  </span>
                                  <select
                                    value={filter}
                                    onChange={(event) => {
                                      setFilter(event.target.value as "all" | UserRole);
                                      setReportFiltersOpen(false);
                                    }}
                                    className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                                  >
                                    <option value="all">All profiles</option>
                                    <option value="client">Clients</option>
                                    <option value="staff">Staff</option>
                                    <option value="master_admin">Admin</option>
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
                          className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-white/25 bg-white/12 text-white transition hover:bg-white/18"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 3v11m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M5 17v2.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>

                      <div className="mb-4 grid gap-3 lg:grid-cols-4">
                        <DesktopReportMetric label="New Customers" value={newCustomerCount} />
                        <DesktopReportMetric label="Returning" value={returningCustomerCount} />
                        <DesktopReportMetric label="Active" value={activeReportCustomers} />
                        <DesktopReportMetric label="Inactive" value={inactiveCustomerCount} />
                      </div>

                      <div className="overflow-hidden rounded-[22px] border border-white/18 bg-white/10">
                        <div className="grid grid-cols-[1.15fr_0.9fr_0.35fr_0.85fr_0.6fr_0.55fr_0.55fr] gap-6 border-b border-white/18 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/58">
                          <button type="button" onClick={() => sortCustomerTable("name")} className="text-left">Names</button>
                          <button type="button" onClick={() => sortCustomerTable("contact")} className="text-left">Contact</button>
                          <button type="button" onClick={() => sortCustomerTable("age")} className="text-left">Age</button>
                          <button type="button" onClick={() => sortCustomerTable("lastVisit")} className="text-left">Last Visit</button>
                          <button type="button" onClick={() => sortCustomerTable("visits")} className="pl-5 text-left">Visits</button>
                          <button type="button" onClick={() => sortCustomerTable("status")} className="text-left">Status</button>
                          <div>WA</div>
                        </div>

                        <div className="max-h-[560px] overflow-auto">
                          {sortedCustomerReportRows.slice(0, 80).map((row) => {
                            const digits = String(row.user.phone || "").replace(/\D/g, "");
                            const whatsappUrl = digits ? `https://wa.me/${digits}` : "";

                            return (
                              <div
                                key={row.user.id}
                                className="grid grid-cols-[1.15fr_0.9fr_0.35fr_0.85fr_0.6fr_0.55fr_0.55fr] gap-6 border-b border-white/10 px-4 py-3 text-[12px] font-bold text-white/78 transition last:border-b-0 hover:bg-white/10"
                              >
                                <button
                                  type="button"
                                  onClick={() => void openUserProfile(row.user)}
                                  className="min-w-0 text-left"
                                >
                                  <div className="truncate font-black text-white">{row.user.full_name || "Client"}</div>
                                  <div className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#ffd66b]">
                                    {row.user.client_code || "No ID"}
                                  </div>
                                </button>

                                <div className="min-w-0">
                                  <div className="truncate">{row.user.phone || "—"}</div>
                                </div>

                                <div>{row.age ?? "—"}</div>
                                <div>{desktopFormatDateOnly(row.lastVisit)}</div>
                                <div className="pl-5 font-black text-white">{row.totalVisits}</div>
                                <div>
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                                    row.inactive ? "bg-red-500/16 text-red-200" : "bg-emerald-400/16 text-emerald-100"
                                  }`}>
                                    {row.inactive ? "Inactive" : "Active"}
                                  </span>
                                </div>
                                <div>
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
                    </Panel>

                  </>
                )}
              </section>
            ) : null}

            {tab === "Activity" ? (
              <section className="space-y-3">
                <div className="flex flex-col gap-3 rounded-[20px] border border-white/22 bg-white/12 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.10)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-white">Activity</h2>
                    <p className="mt-1 text-[12px] font-bold text-white/70">Showing {desktopTimeRangeLabel(timeRange)}</p>
                  </div>
                  <DesktopTimeRangeFilter value={timeRange} onChange={setTimeRange} />
                </div>

                {visibleActivityTxns.length === 0 ? <DesktopEmptyState text="No activity for this time range." /> : null}

                {latestActivities.map((transaction) => {
                  const clientName = profileNamesById[transaction.client_id ?? ""] ?? "Client";
                  const actorName =
                    profileNamesById[transaction.staff_id ?? ""] ||
                    (transaction.staff_id ? "Staff user" : "System");

                  return (
                    <ActivityRow
                      key={transaction.id}
                      action={transaction.action_type}
                      title={desktopLabelForAction(transaction.action_type, actorName)}
                      meta={
                        transaction.action_type === "reward_redeemed"
                          ? `Claimed by ${actorName} · ${desktopFormatDate(transaction.created_at)}`
                          : `${clientName} · ${desktopFormatDate(transaction.created_at)}`
                      }
                    />
                  );
                })}
              </section>
            ) : null}

            {tab === "Gifts" ? (
              <section className="space-y-3">
                <div className="flex flex-col gap-3 rounded-[20px] border border-white/22 bg-white/12 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.10)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-white">Gifts</h2>
                    <p className="mt-1 text-[12px] font-bold text-white/70">Showing {desktopTimeRangeLabel(timeRange)}</p>
                  </div>
                  <DesktopTimeRangeFilter value={timeRange} onChange={setTimeRange} />
                </div>

                {latestGifts.length === 0 ? <DesktopEmptyState text="No gifts for this time range." /> : null}

                {latestGifts.map((reward) => {
                  const clientName = profileNamesById[reward.client_id] ?? "Client";
                  const confirmedByName = reward.redeemed_by
                    ? profileNamesById[reward.redeemed_by] ?? "Staff user"
                    : null;

                  return (
                    <Panel key={reward.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[17px] font-black text-white">
                            {desktopNormalizeRewardText(reward.reward_type)}
                          </div>
                          <div className="mt-1 text-[12px] font-black text-white/70">{clientName}</div>
                          <div className="mt-1 text-[11px] font-bold leading-5 text-white/72">
                            Earned {desktopFormatDate(reward.earned_at)}
                            {reward.redeemed_at ? <> · Confirmed {desktopFormatDate(reward.redeemed_at)} {confirmedByName ? `by ${confirmedByName}` : ""}</> : null}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                            reward.status === "available"
                              ? "bg-[#ffd66b] text-[#365665]"
                              : reward.status === "redeemed" || reward.status === "claimed"
                                ? "bg-[#365665]/10 text-white"
                                : "bg-white/28 text-white/72"
                          }`}
                        >
                          {String(reward.status)}
                        </span>
                      </div>
                    </Panel>
                  );
                })}
              </section>
            ) : null}


            {tab === "Loyalty Program" ? (
              <section>
                <LoyaltyProgramPanel />
              </section>
            ) : null}

            {tab === "Game Links" ? (
              <section className="space-y-4">
                <Panel className="!p-3">
                  <button
                    type="button"
                    onClick={() => setGameCreateOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/65">
                        Admin
                      </div>
                      <h2 className="mt-1 text-[19px] font-black leading-none tracking-[-0.04em] text-white">
                        Create <span className="text-[#ffd66b]">Game Link</span>
                      </h2>
                    </div>

                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white">
                      {gameCreateOpen ? "−" : "+"}
                    </div>
                  </button>

                  {gameCreateOpen ? (
                    <div className="mt-4 border-t border-white/16 pt-4">
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

                      <div className="grid gap-2 lg:grid-cols-2">
                        <AdminGameInput label={gameKind === "basketball" ? "Team 1" : "Home Team"} value={gameForm.home_team} onChange={(value) => setGameForm((current) => ({ ...current, home_team: value }))} />
                        <AdminGameInput label={gameKind === "basketball" ? "Team 2" : "Away Team"} value={gameForm.away_team} onChange={(value) => setGameForm((current) => ({ ...current, away_team: value }))} />
                        <AdminGameInput className="lg:col-span-2" label="Description" value={gameForm.venue} onChange={(value) => setGameForm((current) => ({ ...current, venue: value }))} />
                        <AdminGameInput className="lg:col-span-2" label="Tournament" value={gameForm.match_label} onChange={(value) => setGameForm((current) => ({ ...current, match_label: value }))} />
                        <AdminGameInput type="datetime-local" className="lg:col-span-2" label="Match Timing" value={gameForm.kickoff_at} onChange={(value) => setGameForm((current) => ({ ...current, kickoff_at: value }))} />
                        <AdminGameInput type="datetime-local" label="Open Time" value={gameForm.opens_at} onChange={(value) => setGameForm((current) => ({ ...current, opens_at: value }))} />
                        <AdminGameInput type="datetime-local" label="Close Time" value={gameForm.closes_at} onChange={(value) => setGameForm((current) => ({ ...current, closes_at: value }))} />

                        {gameKind === "football" ? (
                          <>
                            <AdminGameInput label="Home Score" value={gameForm.home_score} onChange={(value) => setGameForm((current) => ({ ...current, home_score: value }))} />
                            <AdminGameInput label="Away Score" value={gameForm.away_score} onChange={(value) => setGameForm((current) => ({ ...current, away_score: value }))} />
                          </>
                        ) : (
                          <>
                            <label className="block">
                              <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-white/86">
                                Final Winning Team
                              </span>
                              <select
                                value={gameForm.basketball_winner}
                                onChange={(event) => setGameForm((current) => ({ ...current, basketball_winner: event.target.value }))}
                                className="h-11 w-full rounded-[14px] border border-white/20 bg-white px-3 text-[13px] font-black text-[#24352f] outline-none focus:border-[#ffd66b]"
                              >
                                <option value="home">{gameForm.home_team || "Team 1"}</option>
                                <option value="away">{gameForm.away_team || "Team 2"}</option>
                              </select>
                            </label>
                            <AdminGameInput label="Final Win By" value={gameForm.basketball_win_by} onChange={(value) => setGameForm((current) => ({ ...current, basketball_win_by: value }))} />
                            <p className="lg:col-span-2 text-[11px] font-bold leading-5 text-white/62">
                              Leave these empty when creating the link. Add the final winner and win-by after the game result is known.
                            </p>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void createGameLinkFromDesktop()}
                        disabled={gameSaving}
                        className="mt-3 flex h-10 w-full items-center justify-center rounded-full bg-[#ffd66b] px-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#365665] transition hover:bg-[#f0cf61] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {gameSaving ? "Creating..." : gameKind === "basketball" ? "Create Basketball Link" : "Create Football Link"}
                      </button>
                    </div>
                  ) : null}
                </Panel>

                <Panel className="!p-4">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-[20px] font-black text-white">Created Games</h2>
                      <p className="mt-1 text-[12px] font-bold text-white/65">
                        View and copy all created game links from the web admin.
                      </p>
                    </div>
                    <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-black text-white">
                      {createdGameLinks.length}
                    </span>
                  </div>

                  {createdGameLinks.length === 0 ? (
                    <p className="rounded-[18px] border border-white/18 bg-white/10 p-4 text-[13px] font-bold text-white/70">
                      No created games yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {createdGameLinks.map((game) => (
                        <div key={game.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-white/18 bg-white/10 p-4">
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-black text-white">{game.title}</div>
                            {game.meta ? (
                              <div className="mt-1 truncate text-[11px] font-bold text-white/60">{game.meta}</div>
                            ) : null}
                            <div className="mt-1 truncate text-[11px] font-bold text-white/65">{predictionLinkFor(game.code)}</div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <a
                              href={predictionLinkFor(game.code)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full bg-[#ffd66b] px-4 py-2 text-[11px] font-black text-[#365665] transition hover:bg-[#f0cf61]"
                            >
                              Open
                            </a>
                            <button
                              type="button"
                              onClick={() => void navigator.clipboard.writeText(predictionLinkFor(game.code))}
                              className="rounded-full bg-white/14 px-4 py-2 text-[11px] font-black text-white transition hover:bg-white/22"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
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
        className="h-11 w-full rounded-[14px] border border-white/20 bg-white px-3 text-[13px] font-black text-[#24352f] outline-none focus:border-[#ffd66b]"
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
            value === option.value ? "bg-[#365665] text-white" : "text-white/72 hover:bg-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DesktopReportMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[18px] border border-white/16 bg-white/10 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/54">{label}</div>
      <div className="mt-2 text-[22px] font-black tracking-[-0.04em] text-white">{value}</div>
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
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-white/18 px-4 py-3 last:border-b-0">
      <div className="text-[12px] font-semibold text-[#4c574f]">{label}</div>
      {trend ? (
        <div className={`text-[10px] font-black ${negative ? "text-red-500" : "text-emerald-600"}`}>
          {trend}
        </div>
      ) : (
        <div />
      )}
      <div className="min-w-[62px] text-right text-[12px] font-black tabular-nums text-white">{value}</div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white/24 bg-white/10 p-5 text-white shadow-[0_24px_70px_rgba(35,54,47,0.20)] backdrop-blur-2xl ${className}`}>
      {children}
    </div>
  );
}

function StatTile({ value, label, trend }: { value: number | string; label: string; trend?: string }) {
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[34px] font-black leading-none tracking-[-0.04em] text-white">
            {value}
          </div>
          <div className="mt-2 text-[12px] font-bold text-white/70">{label}</div>
        </div>
        {trend ? (
          <span className="rounded-full bg-[#365665] px-2.5 py-1 text-[10px] font-black text-[#ffd66b]">
            {trend}
          </span>
        ) : null}
      </div>
    </Panel>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[21px] font-black leading-none text-white">{value}</div>
      <div className="mt-1 text-[11px] font-bold text-white/70">{label}</div>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/18 py-3 last:border-0">
      <div className="text-[13px] font-bold text-white/72">{label}</div>
      <div className="text-right text-[13px] font-black text-white">{value}</div>
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
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eee8dc" strokeWidth="8" />
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke={D_BRAND_GREEN} strokeWidth="8" strokeDasharray={dash} strokeLinecap="round" />
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke={D_BRAND_YELLOW} strokeWidth="8" strokeDasharray={`${Math.max(0, 100 - safeValue)} ${safeValue}`} strokeDashoffset={-safeValue} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[19px] font-black text-white">{desktopPercentage(safeValue)}</div>
        <div className="text-[9px] font-black uppercase tracking-[0.12em] text-white/70">Active</div>
      </div>
    </div>
  );
}

function LineChart() {
  const points = "0,95 55,88 110,84 165,62 220,56 275,42 330,48 385,36 440,44 500,24";
  const rewardPoints = "0,126 55,118 110,112 165,123 220,94 275,86 330,82 385,88 440,76 500,90";

  return (
    <div className="relative h-[190px] rounded-[22px] bg-white/92 p-4">
      <div className="absolute left-4 right-4 top-4 space-y-[30px]">
        {[0, 1, 2, 3, 4].map((line) => (
          <div key={line} className="h-px bg-[#e8e1d5]" />
        ))}
      </div>
      <svg viewBox="0 0 500 150" className="relative z-10 h-full w-full overflow-visible">
        <polyline points={points} fill="none" stroke={D_BRAND_GREEN} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={rewardPoints} fill="none" stroke={D_BRAND_YELLOW} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="275" cy="42" r="6" fill={D_BRAND_GREEN} stroke="#fff" strokeWidth="4" />
        <circle cx="275" cy="86" r="6" fill={D_BRAND_YELLOW} stroke="#fff" strokeWidth="4" />
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

function ActivityRow({ action, title, meta }: { action: StampTransaction["action_type"]; title: string; meta: string }) {
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <DesktopActionBadge action={action} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-black text-white">{title}</div>
          <div className="mt-1 text-[12px] font-bold text-white/70">{meta}</div>
        </div>
      </div>
    </Panel>
  );
}

function DesktopClientProfilePanel({
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
  onAddStamp,
  onRemoveStamp,
  onSendGift,
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
  onAddStamp: (categoryId: string) => void;
  onRemoveStamp: (categoryId: string) => void;
  onSendGift: (gift: string, description: string) => void;
}) {
  const [giftPopupOpen, setGiftPopupOpen] = useState(false);
  const [giftName, setGiftName] = useState("");
  const [giftDescription, setGiftDescription] = useState("");

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
        className="rounded-full bg-[#365665] px-4 py-2 text-[12px] font-black text-white"
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
                </>
              ) : null}
            </div>
            {user.client_code ? (
              <div className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                {user.client_code}
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
              className={`shrink-0 rounded-full border border-white/25 bg-white px-3 py-2 text-[11px] font-black outline-none disabled:opacity-55 ${
                user.is_active === false ? "text-red-600" : "text-white"
              }`}
            >
              <option value="client">Client</option>
              <option value="staff">Staff</option>
              <option value="master_admin">Admin</option>
              <option value="deactivated">Deactivate</option>
            </select>

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
        </div>

        {user.is_active === false ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-black text-red-600">
            This account is deactivated.
          </div>
        ) : null}
      </Panel>

      <Panel>
        <h2 className="mb-4 text-[18px] font-black text-white">Stamps</h2>

        {loading ? <DesktopEmptyState text="Loading profile..." /> : null}

        {!loading && user.role !== "client" ? (
          <DesktopEmptyState text="This account is not a client, so there are no loyalty stamps." />
        ) : null}

        {!loading && user.role === "client" ? (
          <div className="space-y-3">
            {categories.length === 0 ? <DesktopEmptyState text="No stamp categories found." /> : null}

            {categories.map((category) => {
              const count = Math.max(0, Math.min(5, stampByCategory.get(category.id) ?? 0));

              return (
                <div key={category.id} className="rounded-[16px] bg-white/10 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-black text-white">
                        {category.name === "Desserts 2" ? "Hooka" : category.name}
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
                        className="rounded-full border border-white/25 bg-white px-4 py-2 text-[11px] font-black text-white transition hover:border-[#365665] disabled:cursor-not-allowed disabled:opacity-45"
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
      </Panel>

      <Panel>
        <h2 className="mb-4 text-[18px] font-black text-white">Gifts</h2>
        {loading ? null : rewards.length === 0 ? <DesktopEmptyState text="No gifts for this client yet." /> : null}

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
                    {reward.redeemed_at ? <> · Confirmed {desktopFormatDate(reward.redeemed_at)}</> : null}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                    reward.status === "available"
                      ? "bg-[#ffd66b] text-[#365665]"
                      : reward.status === "redeemed" || reward.status === "claimed"
                        ? "bg-[#365665]/10 text-white"
                        : "bg-white/28 text-white/72"
                  }`}
                >
                  {String(reward.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {giftPopupOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          onClick={() => setGiftPopupOpen(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-[26px] bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.25)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ffd66b] text-[#365665]">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 12v8H4v-8" />
                  <path d="M2 7h20v5H2z" />
                  <path d="M12 22V7" />
                  <path d="M12 7H7.5a2.5 2.5 0 1 1 2.2-3.7L12 7Z" />
                  <path d="M12 7h4.5a2.5 2.5 0 1 0-2.2-3.7L12 7Z" />
                </svg>
              </div>

              <div className="min-w-0">
                <h3 className="text-[22px] font-black tracking-[-0.03em] text-white">Send Gift</h3>
                <p className="mt-1 text-[12px] font-bold leading-5 text-white/70">
                  Send a manual gift to {user.full_name || "this client"}.
                </p>
              </div>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                Description
              </span>
              <textarea
                value={giftDescription}
                onChange={(event) => setGiftDescription(event.target.value)}
                rows={3}
                placeholder="Example: Birthday gift, VIP compensation..."
                className="w-full rounded-[16px] border border-white/25 bg-white/10 px-4 py-3 text-[13px] font-semibold text-white outline-none focus:border-[#ffd66b]"
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                Gift
              </span>
              <input
                value={giftName}
                onChange={(event) => setGiftName(event.target.value)}
                placeholder="Example: Free Dessert"
                className="h-12 w-full rounded-[16px] border border-white/25 bg-white/10 px-4 text-[13px] font-semibold text-white outline-none focus:border-[#ffd66b]"
              />
            </label>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setGiftPopupOpen(false)}
                className="rounded-full border border-white/25 px-5 py-3 text-[12px] font-black text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSendGift(giftName, giftDescription);
                  setGiftName("");
                  setGiftDescription("");
                  setGiftPopupOpen(false);
                }}
                className="rounded-full bg-[#365665] px-6 py-3 text-[12px] font-black text-white transition hover:bg-[#27464f]"
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

function DesktopActionBadge({ action }: { action: StampTransaction["action_type"] }) {
  const map: Record<
    StampTransaction["action_type"],
    { className: string; icon: ReactNode }
  > = {
    add_stamp: {
      className: "bg-[#ffd66b] text-[#365665]",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
    },
    reward_earned: {
      className: "bg-[#365665] text-white",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12v8H4v-8" />
          <path d="M2 7h20v5H2z" />
          <path d="M12 22V7" />
          <path d="M12 7H7.5a2.5 2.5 0 1 1 2.2-3.7L12 7Z" />
          <path d="M12 7h4.5a2.5 2.5 0 1 0-2.2-3.7L12 7Z" />
        </svg>
      ),
    },
    reward_redeemed: {
      className: "bg-[#798673] text-white",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ),
    },
    manual_adjustment: {
      className: "bg-white/10 text-white",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h10" />
          <path d="M4 17h16" />
          <path d="M17 4v6" />
          <path d="M14 7h6" />
          <path d="M9 14v6" />
          <path d="M6 17h6" />
        </svg>
      ),
    },
  };

  const item = map[action] ?? map.manual_adjustment;

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.className}`}>
      {item.icon}
    </div>
  );
}

function desktopLabelForAction(action: StampTransaction["action_type"], actorName?: string): string {
  if (action === "add_stamp") {
    return `Stamp added by ${actorName || "Staff"}`;
  }

  if (action === "reward_redeemed") {
    return `Gift confirmed by ${actorName || "Staff"}`;
  }

  return {
    reward_earned: "Gift earned",
    manual_adjustment: "",
  }[action] ?? "Activity updated";
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
