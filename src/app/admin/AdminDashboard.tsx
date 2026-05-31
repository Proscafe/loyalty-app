"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/AppShell";
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

interface Props {
  profile: Profile;
  users?: AdminUser[];
  recentTxns?: StampTransaction[];
  recentRewards?: Reward[];
  metrics: Metrics;
}

const TABS = ["Overview", "Users", "Activity", "Gifts"] as const;
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

export function AdminDashboard({
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
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");

  function flash(message: string, t: "success" | "error" = "success") {
    setTone(t);
    setToast(message);
    setTimeout(() => setToast(null), 2200);
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
    flash("Account reactivated.");
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
    <AppShell title="Admin" role={profile.role} pageBackground={PAGE_BG}>
      <Toast message={toast} tone={tone} />

      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-5 font-raleway text-white">
        <section
          className="relative mb-5 overflow-hidden border border-white/20 px-5 py-5 shadow-[0_24px_70px_rgba(35,48,39,0.22)] backdrop-blur-2xl"
          style={{ borderRadius: 18, background: GLASS_CARD, minHeight: 154 }}
        >
          <Image
            src="/client-main-card.png"
            alt=""
            width={420}
            height={210}
            priority
            className="pointer-events-none absolute inset-0 h-full w-[128%] translate-x-8 scale-[1.06] object-cover object-right opacity-55"
          />

          <div className="relative z-10">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.34em] text-white/80">
              Admin Dashboard
            </p>

            <h1 className="text-[30px] font-black leading-[1.02] tracking-[-0.04em] text-white">
              Hello,
              <br />
              <span className="text-[#ffd66b]">{shortName(profile.full_name)}</span>
            </h1>
          </div>
        </section>

        <div className="mb-3 flex gap-1 rounded-full border border-white/14 bg-white/12 p-1 backdrop-blur-xl">
          {TABS.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
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
          <div className="mb-5">
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setVisibleUserCount(15);
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
            <div className="mb-4 flex gap-1 rounded-full border border-white/14 bg-white/12 p-1 text-[11px] backdrop-blur-xl">
              {(["all", "client", "staff", "master_admin"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setFilter(item);
                    setVisibleUserCount(15);
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
                  className="border border-white/20 p-4 shadow-[0_16px_44px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
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
                      onChange={(event) => {
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
              Showing the newest users first. Use search to find older customers faster.
            </p>
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
      </div>
    </AppShell>
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

export default AdminDashboard;
