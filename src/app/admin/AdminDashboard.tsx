"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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

const TABS = ["Overview", "Users", "Activity", "Gifts", "Game Links"] as const;
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
      status: string;
      code: string;
      kickoff: string | null;
    }>
  >([]);

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
                          className={`shrink-0 rounded-full border border-white/30 bg-white/88 px-3 py-2 text-[11px] font-black outline-none disabled:opacity-55 ${
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
                            : "bg-white/82 text-[#365665]"
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

        {tab === "Game Links" && (
          <section className="mb-12 space-y-4">
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
                      Kickoff {game.kickoff ? formatDate(game.kickoff) : "—"}
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
            className={`shrink-0 rounded-full border border-white/30 bg-white/88 px-3 py-2 text-[11px] font-black outline-none disabled:opacity-55 ${
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
                        : "bg-white/82 text-[#365665]"
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
      className: "bg-white/86 text-[#365665]",
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
  const [filter, setFilter] = useState<"all" | UserRole>("staff");
  const [timeRange, setTimeRange] = useState<DesktopTimeRange>("week");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleUserCount, setVisibleUserCount] = useState(15);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<AdminCategory[]>([]);
  const [selectedStamps, setSelectedStamps] = useState<AdminClientStamp[]>([]);
  const [selectedRewards, setSelectedRewards] = useState<Reward[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");
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

    try {
      const response = await fetch("/api/admin/prediction-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gameForm),
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
  }, [users, filter, searchTerm]);

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
                      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-[12px] font-black uppercase tracking-[0.18em] text-white/70">
                          Showing {desktopTimeRangeLabel(timeRange)}
                        </div>
                        <DesktopTimeRangeFilter value={timeRange} onChange={setTimeRange} />
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                        <input
                          value={searchTerm}
                          onChange={(event) => {
                            setSearchTerm(event.target.value);
                            setVisibleUserCount(15);
                            setSelectedUser(null);
                          }}
                          placeholder="Search customers, staff, admin..."
                          className="h-12 w-full rounded-[14px] border border-white/25 bg-white px-4 text-[13px] font-bold text-black outline-none focus:border-[#ffd66b]"
                        />

                        <div className="grid grid-cols-4 gap-1 rounded-[14px] bg-white/10 p-1">
                          {(["all", "client", "staff", "master_admin"] as const).map((item) => (
                            <button
                              type="button"
                              key={item}
                              onClick={() => {
                                setFilter(item);
                                setVisibleUserCount(15);
                                setSelectedUser(null);
                              }}
                              className={`rounded-[11px] px-3 py-2 text-[11px] font-black transition ${
                                filter === item ? "bg-[#365665] text-white" : "text-white/72"
                              }`}
                            >
                              {item === "all" ? "All" : item === "master_admin" ? "Admin" : item === "staff" ? "Staff" : "Clients"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </Panel>

                    <div className="overflow-hidden rounded-[28px] border border-white/24 bg-white/10 shadow-[0_24px_70px_rgba(35,54,47,0.18)] backdrop-blur-2xl">
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
                          className="grid cursor-pointer gap-3 border-b border-white/18 px-5 py-4 transition hover:bg-white/14 lg:grid-cols-[1.1fr_1fr_auto]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-black text-white">{user.full_name}</div>
                            <div className="mt-1 truncate text-[12px] font-bold text-white/70">{user.email || "No email"}</div>
                          </div>

                          <div className="min-w-0 text-[12px] font-bold text-white/72">
                            {user.phone ? <div>{user.phone}</div> : null}
                            {user.client_code ? <div className="font-black text-white">{user.client_code}</div> : null}
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
                            className={`h-10 rounded-full border border-white/25 bg-white px-3 text-[11px] font-black outline-none disabled:opacity-55 ${
                              user.is_active === false ? "text-red-600" : "text-white"
                            }`}
                          >
                            <option value="client">Client</option>
                            <option value="staff">Staff</option>
                            <option value="master_admin">Admin</option>
                            <option value="deactivated">Deactivate</option>
                          </select>
                        </div>
                      ))}
                    </div>

                    {filteredUsers.length === 0 ? <DesktopEmptyState text="No users in this view." /> : null}

                    {filteredUsers.length > visibleUsers.length ? (
                      <button
                        type="button"
                        onClick={() => setVisibleUserCount((count) => count + 15)}
                        className="mt-4 rounded-full bg-[#365665] px-6 py-3 text-[12px] font-black text-white"
                      >
                        Load more
                      </button>
                    ) : null}
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

            {tab === "Game Links" ? (
              <section className="space-y-4">
                <Panel className="!p-4">
                  <button
                    type="button"
                    onClick={() => setGameCreateOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
                        Admin
                      </div>
                      <h2 className="mt-1 text-[22px] font-black leading-none tracking-[-0.04em] text-white">
                        Create <span className="text-[#ffd66b]">Game Link</span>
                      </h2>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-[20px] font-black text-white">
                      {gameCreateOpen ? "−" : "+"}
                    </div>
                  </button>

                  {gameCreateOpen ? (
                    <div className="mt-5 border-t border-white/18 pt-5">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <AdminGameInput label="Home Team" value={gameForm.home_team} onChange={(value) => setGameForm((current) => ({ ...current, home_team: value }))} />
                        <AdminGameInput label="Away Team" value={gameForm.away_team} onChange={(value) => setGameForm((current) => ({ ...current, away_team: value }))} />
                        <AdminGameInput className="lg:col-span-2" label="Description" value={gameForm.venue} onChange={(value) => setGameForm((current) => ({ ...current, venue: value }))} />
                        <AdminGameInput className="lg:col-span-2" label="Tournament" value={gameForm.match_label} onChange={(value) => setGameForm((current) => ({ ...current, match_label: value }))} />
                        <AdminGameInput type="datetime-local" className="lg:col-span-2" label="Match Timing" value={gameForm.kickoff_at} onChange={(value) => setGameForm((current) => ({ ...current, kickoff_at: value }))} />
                        <AdminGameInput type="datetime-local" label="Open Time" value={gameForm.opens_at} onChange={(value) => setGameForm((current) => ({ ...current, opens_at: value }))} />
                        <AdminGameInput type="datetime-local" label="Close Time" value={gameForm.closes_at} onChange={(value) => setGameForm((current) => ({ ...current, closes_at: value }))} />
                        <AdminGameInput label="Home Score" value={gameForm.home_score} onChange={(value) => setGameForm((current) => ({ ...current, home_score: value }))} />
                        <AdminGameInput label="Away Score" value={gameForm.away_score} onChange={(value) => setGameForm((current) => ({ ...current, away_score: value }))} />
                      </div>

                      <button
                        type="button"
                        onClick={() => void createGameLinkFromDesktop()}
                        disabled={gameSaving}
                        className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-[#ffd66b] px-5 text-[11px] font-black uppercase tracking-[0.22em] text-[#365665] transition hover:bg-[#f0cf61] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {gameSaving ? "Creating..." : "Create Game Link"}
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
                    <p className="rounded-[18px] border border-white/18 bg-white/8 p-4 text-[13px] font-bold text-white/70">
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
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-white">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-14 w-full rounded-[18px] border border-white/20 bg-white px-4 text-[14px] font-black text-[#24352f] outline-none focus:border-[#ffd66b]"
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
