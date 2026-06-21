"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminMobileFloatingMenu } from "@/components/AdminMobileFloatingMenu";
import { AdminSidebar } from "@/components/AdminSidebar";
import type { Profile, Reward, StampTransaction } from "@/types";

interface Metrics {
  totalClients: number;
  stampsIssued: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  mostActiveCategoryName: string;
}

type AdminUser = Profile & {
  is_active?: boolean | null;
  created_at?: string | null;
  last_visit_at?: string | null;
};

interface Props {
  profile: Profile;
  users?: AdminUser[];
  recentTxns?: StampTransaction[];
  recentRewards?: Reward[];
  metrics: Metrics;
  initialTab?: string;
}

type DashboardPeriod = "today" | "week" | "month" | "all";

type InsightRow = {
  label: string;
  value: string | number;
  tone?: "normal" | "warning";
};

const PAGE_BG =
  "radial-gradient(circle at top left, rgba(255,214,107,0.18), transparent 28%), linear-gradient(135deg, #365665 0%, #2f4b55 42%, #798673 100%)";
const PANEL_BG =
  "linear-gradient(145deg, rgba(255,255,255,0.17), rgba(255,255,255,0.075))";
const BRAND_YELLOW = "#ffd66b";
const BRAND_GREEN = "#365665";

const PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "Show all" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function shortName(name?: string | null) {
  return (name || "Admin").trim().split(/\s+/)[0] || "Admin";
}

function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | null) {
  const date = validDate(value);
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function startOfWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return start.getTime();
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function isInPeriod(value: string | null | undefined, period: DashboardPeriod) {
  if (period === "all") return true;
  const date = validDate(value);
  if (!date) return false;

  const time = date.getTime();
  const todayStart = startOfToday();

  if (period === "today")
    return time >= todayStart && time < todayStart + 86400000;
  if (period === "week")
    return time >= startOfWeek() && time < todayStart + 86400000;
  if (period === "month")
    return time >= startOfMonth() && time < todayStart + 86400000;
  return true;
}

function safeRatio(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function percentage(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter(Boolean)).size;
}

function rewardDate(reward: Reward) {
  const record = asRecord(reward);
  return String(
    reward.redeemed_at ??
      reward.earned_at ??
      reward.created_at ??
      record.claimed_at ??
      "",
  );
}

function rewardName(reward: Reward) {
  return (
    String(reward.reward_type || "Gift")
      .replace(/ Item$/i, "")
      .trim() || "Gift"
  );
}

function isRedeemedReward(reward: Reward) {
  const status = String(reward.status ?? "").toLowerCase();
  return Boolean(reward.redeemed_at) || /redeemed|claimed|used/.test(status);
}

function getStampQuantity(txn: StampTransaction) {
  const record = asRecord(txn);
  const candidates = [
    record.stamp_delta,
    record.quantity,
    record.stamp_count,
    record.stamps,
    record.amount,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric !== 0) return Math.abs(numeric);
  }

  return 1;
}

function isStampIssued(txn: StampTransaction) {
  const record = asRecord(txn);
  const action = String(record.action_type ?? "").toLowerCase();
  const delta = Number(record.stamp_delta);

  if (Number.isFinite(delta)) return delta > 0;
  return (
    /add|added|earn|earned|issue|issued|stamp/.test(action) &&
    !/remove|deduct|redeem|delete/.test(action)
  );
}

function actionLabel(txn: StampTransaction) {
  const record = asRecord(txn);
  const action = String(record.action_type ?? "activity").toLowerCase();
  const count = getStampQuantity(txn);

  if (/remove|deduct/.test(action))
    return `had ${count} stamp${count === 1 ? "" : "s"} removed`;
  if (/redeem/.test(action)) return "redeemed a gift";
  if (/gift|reward/.test(action)) return "received a gift";
  return `earned ${count} stamp${count === 1 ? "" : "s"}`;
}

function getClientName(
  clientId: string | null | undefined,
  users: AdminUser[],
) {
  const user = users.find((item) => item.id === clientId);
  return user?.full_name || user?.client_code || "Client";
}

function getTopReward(rewards: Reward[] = []) {
  const counts = new Map<string, number>();

  rewards.forEach((reward) => {
    const name = rewardName(reward);
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

function getMostActiveCustomer(users: AdminUser[], txns: StampTransaction[]) {
  const counts = new Map<string, number>();

  txns.forEach((txn) => {
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

  return users.find((user) => user.id === topClientId)?.full_name ?? "—";
}

function dailyCounts(txns: StampTransaction[], rewards: Reward[]) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const stampCounts = new Array(days.length).fill(0) as number[];
  const giftCounts = new Array(days.length).fill(0) as number[];

  txns.forEach((txn) => {
    const date = validDate(txn.created_at);
    if (!date || !isStampIssued(txn)) return;
    const day = date.getDay();
    if (day >= 1 && day <= 5) stampCounts[day - 1] += getStampQuantity(txn);
  });

  rewards.forEach((reward) => {
    const date = validDate(rewardDate(reward));
    if (!date || !isRedeemedReward(reward)) return;
    const day = date.getDay();
    if (day >= 1 && day <= 5) giftCounts[day - 1] += 1;
  });

  return { days, stampCounts, giftCounts };
}

function polylineFor(values: number[], width = 720, height = 150) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 24) - 12;
      return `${x},${y}`;
    })
    .join(" ");
}

function DashboardCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 shadow-[0_26px_70px_rgba(20,35,35,0.18)] backdrop-blur-2xl ${className}`}
      style={{ background: PANEL_BG }}
    >
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: string | number;
  badge?: string;
}) {
  return (
    <DashboardCard className="relative min-h-[88px] px-3 py-4 lg:min-h-[112px] lg:px-6 lg:py-5">
      {badge ? (
        <span className="absolute right-3 top-3 rounded-full bg-[#365665] px-2 py-1 text-[8px] font-black text-[#ffd66b] lg:right-5 lg:top-5 lg:px-3 lg:text-[10px]">
          {badge}
        </span>
      ) : null}
      <div className="text-[24px] font-black leading-none tracking-[-0.06em] text-white lg:text-[36px]">
        {value}
      </div>
      <div className="mt-2 text-[9px] font-black leading-tight text-white/72 lg:mt-3 lg:text-[12px]">
        {label}
      </div>
    </DashboardCard>
  );
}

function FilterPill({
  period,
  selected,
  onSelect,
}: {
  period: { key: DashboardPeriod; label: string };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`h-9 rounded-[12px] px-5 text-[11px] font-black transition ${
        selected
          ? "bg-[#ffd66b] text-[#365665] shadow-[0_8px_18px_rgba(255,214,107,0.24)]"
          : "text-white hover:bg-white/10"
      }`}
    >
      {period.label}
    </button>
  );
}

function ActivityChart({
  stamps,
  gifts,
  days,
}: {
  stamps: number[];
  gifts: number[];
  days: string[];
}) {
  const width = 720;
  const height = 150;
  const stampLine = polylineFor(stamps, width, height);
  const giftLine = polylineFor(gifts, width, height);
  const stampTotal = stamps.reduce((sum, value) => sum + value, 0);
  const giftTotal = gifts.reduce((sum, value) => sum + value, 0);
  const visitTotal = Math.max(
    stampTotal,
    uniqueCount(
      stamps.map((value, index) => (value > 0 ? String(index) : undefined)),
    ),
  );

  return (
    <DashboardCard className="px-5 py-5 lg:col-span-7 lg:px-6 lg:py-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-black tracking-[-0.04em] text-white">
            Activity Overview
          </h2>
          <p className="mt-2 text-[12px] font-bold text-white/70">
            Track stamps, rewards, and customer visits.
          </p>
        </div>
        <span className="rounded-full bg-white/12 px-4 py-2 text-[11px] font-black text-white">
          Today
        </span>
      </div>

      <div className="mb-7 flex flex-wrap gap-2">
        {["Stamps Issued", "Gifts Redeemed", "Customer Visits"].map((item) => (
          <span
            key={item}
            className="rounded-full bg-white/13 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="relative h-[240px] overflow-hidden px-4 pt-2">
        <div className="absolute inset-x-4 top-0 h-px bg-white/55" />
        <div className="absolute inset-x-4 top-[44px] h-px bg-white/55" />
        <div className="absolute inset-x-4 top-[88px] h-px bg-white/55" />
        <div className="absolute inset-x-4 top-[132px] h-px bg-white/55" />
        <div className="absolute inset-x-4 top-[176px] h-px bg-white/55" />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-x-10 top-10 h-[150px] w-[calc(100%-80px)] overflow-visible"
        >
          <polyline
            points={stampLine}
            fill="none"
            stroke="#365665"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.92"
          />
          <polyline
            points={giftLine}
            fill="none"
            stroke="#ffd66b"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {stamps.map((value, index) => {
            if (value <= 0) return null;
            const points = polylineFor(stamps, width, height).split(" ");
            const [cx, cy] = points[index].split(",");
            return (
              <circle
                key={`stamp-${index}`}
                cx={cx}
                cy={cy}
                r="7"
                fill="#365665"
                stroke="white"
                strokeWidth="4"
              />
            );
          })}
          {gifts.map((value, index) => {
            if (value <= 0) return null;
            const points = polylineFor(gifts, width, height).split(" ");
            const [cx, cy] = points[index].split(",");
            return (
              <circle
                key={`gift-${index}`}
                cx={cx}
                cy={cy}
                r="7"
                fill="#ffd66b"
                stroke="white"
                strokeWidth="4"
              />
            );
          })}
        </svg>
        <div className="absolute bottom-8 left-6 right-6 grid grid-cols-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#9b9272]">
          {days.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
      </div>

      <div className="mt-1 grid grid-cols-3 border-t border-white/65 pt-5 text-white">
        <div>
          <div className="text-[22px] font-black leading-none">
            {stampTotal}
          </div>
          <div className="mt-2 text-[11px] font-black text-white/68">
            Stamps Issued
          </div>
        </div>
        <div>
          <div className="text-[22px] font-black leading-none">{giftTotal}</div>
          <div className="mt-2 text-[11px] font-black text-white/68">
            Gifts Redeemed
          </div>
        </div>
        <div>
          <div className="text-[22px] font-black leading-none">
            {visitTotal}
          </div>
          <div className="mt-2 text-[11px] font-black text-white/68">
            Customer Visits
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}

function SegmentBars({
  active,
  repeat,
  giftUsers,
  inactive,
}: {
  active: number;
  repeat: number;
  giftUsers: number;
  inactive: number;
}) {
  const segments = [
    { label: "Active Customers", value: active },
    { label: "Repeat Customers", value: repeat },
    { label: "Gift Users", value: giftUsers },
    { label: "Inactive Customers", value: inactive },
  ];

  return (
    <DashboardCard className="px-5 py-5 lg:col-span-5 lg:px-6 lg:py-6">
      <div className="mb-7 flex items-start justify-between">
        <h2 className="text-[22px] font-black tracking-[-0.04em] text-white">
          Customer Segments
        </h2>
        <span className="text-[11px] font-black text-white/75">Customers</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[120px_1fr] lg:items-center">
        <div className="mx-auto flex h-[120px] w-[120px] items-center justify-center rounded-full border-[24px] border-[#ffd66b] bg-white/10 text-center">
          <div>
            <div className="text-[24px] font-black leading-none text-white">
              {percentage(active)}
            </div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/72">
              Active
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {segments.map((segment) => (
            <div key={segment.label}>
              <div className="mb-1 flex items-center justify-between text-[12px] font-black text-white">
                <span>{segment.label}</span>
                <span>{percentage(segment.value)}</span>
              </div>
              <div className="h-3 rounded-full bg-white/12">
                <div
                  className="h-3 rounded-full bg-[#ffd66b]"
                  style={{
                    width: `${Math.max(2, Math.min(100, segment.value))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function InsightTable({
  title,
  rows,
  action,
}: {
  title: string;
  rows: InsightRow[];
  action?: ReactNode;
}) {
  return (
    <DashboardCard className="px-5 py-5 lg:px-6 lg:py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-black tracking-[-0.04em] text-white">
          {title}
        </h2>
        {action}
      </div>
      <div className="space-y-0">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-6 border-b border-white/10 py-3 last:border-b-0"
          >
            <span className="text-[13px] font-black text-white/86">
              {row.label}
            </span>
            <span
              className={`text-right text-[13px] font-black ${row.tone === "warning" ? "text-red-300" : "text-white"}`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function cleanDashboardLabel(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "—") return "";
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(text)) return "";
  return text;
}

function activityDetailLabel(txn: StampTransaction) {
  const record = asRecord(txn);
  const action = String(record.action_type ?? "").toLowerCase();

  if (/redeem|redeemed|claim|claimed|gift|reward/.test(action)) {
    return cleanDashboardLabel(
      record.reward_label ??
        record.reward_name ??
        record.reward_type ??
        record.gift_type ??
        record.title ??
        record.item_label,
    );
  }

  return cleanDashboardLabel(
    record.category_name ?? record.category ?? record.stamp_category,
  );
}

function RecentActivity({
  txns,
  users,
}: {
  txns: StampTransaction[];
  users: AdminUser[];
}) {
  return (
    <DashboardCard className="px-5 py-5 lg:col-span-6 lg:px-6 lg:py-6">
      <h2 className="mb-7 text-[22px] font-black tracking-[-0.04em] text-white">
        Recent Activity
      </h2>
      <div className="space-y-6">
        {txns.length === 0 ? (
          <div className="rounded-[18px] bg-white/10 px-4 py-4 text-[13px] font-black text-white/70">
            No recent activity.
          </div>
        ) : (
          txns.slice(0, 5).map((txn) => {
            const record = asRecord(txn);
            const clientName = getClientName(txn.client_id, users);
            const detail = activityDetailLabel(txn);
            return (
              <div
                key={String(record.id ?? `${txn.client_id}-${txn.created_at}`)}
                className="grid gap-2 text-white sm:grid-cols-[1fr_auto] sm:items-start"
              >
                <div>
                  <div className="text-[14px] font-black leading-tight">
                    {clientName} {actionLabel(txn)}
                  </div>
                  {detail ? (
                    <div className="mt-2 text-[11px] font-black text-white/76">
                      {detail}
                    </div>
                  ) : null}
                </div>
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-white/90">
                  {formatDate(txn.created_at)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardCard>
  );
}

function AdminDashboard({
  profile,
  users = [],
  recentTxns = [],
  recentRewards = [],
  metrics,
}: Props) {
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const filteredTxns = useMemo(
    () => recentTxns.filter((txn) => isInPeriod(txn.created_at, period)),
    [recentTxns, period],
  );
  const filteredRewards = useMemo(
    () =>
      recentRewards.filter((reward) => isInPeriod(rewardDate(reward), period)),
    [recentRewards, period],
  );
  const filteredUsers = useMemo(
    () => users.filter((user) => isInPeriod(user.created_at ?? null, period)),
    [users, period],
  );

  const totalCustomers = metrics.totalClients || users.length;
  const activeCustomerIds = new Set(
    filteredTxns.map((txn) => txn.client_id).filter(Boolean),
  );
  const activeCustomers = activeCustomerIds.size;
  const repeatCustomers = Array.from(
    filteredTxns.reduce((map, txn) => {
      if (!txn.client_id) return map;
      map.set(txn.client_id, (map.get(txn.client_id) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).filter(([, count]) => count > 1).length;
  const redeemedRewards = filteredRewards.filter(isRedeemedReward).length;
  const giftUsers = uniqueCount(
    filteredRewards.map((reward) => reward.client_id),
  );
  const totalStamps = filteredTxns
    .filter(isStampIssued)
    .reduce((sum, txn) => sum + getStampQuantity(txn), 0);
  const newCustomers = period === "all" ? users.length : filteredUsers.length;
  const averageVisits = totalCustomers
    ? (filteredTxns.length / totalCustomers).toFixed(1)
    : "0";
  const repeatRateNumber = safeRatio(repeatCustomers, totalCustomers);
  const activeRateNumber = safeRatio(activeCustomers, totalCustomers);
  const giftConversionNumber = safeRatio(giftUsers, totalCustomers);
  const inactiveCustomers = Math.max(0, totalCustomers - activeCustomers);
  const inactiveRateNumber = safeRatio(inactiveCustomers, totalCustomers);
  const redemptionRateNumber = safeRatio(
    redeemedRewards || metrics.rewardsRedeemed,
    filteredRewards.length || metrics.rewardsEarned,
  );
  const averageStamps = totalCustomers
    ? (totalStamps / totalCustomers).toFixed(1)
    : "0";
  const topReward = getTopReward(
    filteredRewards.length ? filteredRewards : recentRewards,
  );
  const mostActiveCustomer = getMostActiveCustomer(
    users,
    filteredTxns.length ? filteredTxns : recentTxns,
  );
  const chart = dailyCounts(filteredTxns, filteredRewards);

  const loyaltyRows: InsightRow[] = [
    { label: "Repeat Rate", value: percentage(repeatRateNumber) },
    { label: "Redemption Rate", value: percentage(redemptionRateNumber) },
    { label: "Average Stamps per Customer", value: averageStamps },
    { label: "Average Visits per Customer", value: averageVisits },
    { label: "Gift Conversion", value: percentage(giftConversionNumber) },
  ];

  const topInsightRows: InsightRow[] = [
    {
      label: "Most Active Category",
      value: metrics.mostActiveCategoryName || "—",
    },
    { label: "Top Customer", value: mostActiveCustomer },
    { label: "Most Used Reward", value: topReward },
    { label: "Best Performing Day", value: "Saturday" },
    {
      label: "Customers Needing Attention",
      value: `${inactiveCustomers} inactive customers`,
    },
  ];

  const attentionRows: InsightRow[] = [
    { label: "No Visits", value: `${inactiveCustomers} customers` },
    {
      label: "At Risk",
      value: `${Math.max(0, totalCustomers - users.filter((user) => user.is_active !== false).length)} customers`,
    },
    { label: "Rewards Redeemed", value: `${redeemedRewards} redeemed` },
    { label: "Repeat Customers", value: `${repeatCustomers} this period` },
  ];

  const customerRows: InsightRow[] = [
    { label: "Total Customers", value: totalCustomers },
    {
      label: "New Customers This Month",
      value: users.filter((user) =>
        isInPeriod(user.created_at ?? null, "month"),
      ).length,
    },
    {
      label: "New Customers This Week",
      value: users.filter((user) => isInPeriod(user.created_at ?? null, "week"))
        .length,
    },
    {
      label: "Monthly Active Customers",
      value: uniqueCount(
        recentTxns
          .filter((txn) => isInPeriod(txn.created_at, "month"))
          .map((txn) => txn.client_id),
      ),
    },
    { label: "Inactive Customers", value: inactiveCustomers, tone: "warning" },
    { label: "VIP Customers", value: giftUsers },
    {
      label: "At Risk Customers",
      value: Math.max(
        0,
        totalCustomers -
          users.filter((user) => user.is_active !== false).length,
      ),
    },
  ];

  return (
    <main
      className="min-h-screen font-raleway text-white"
      style={{ background: PAGE_BG }}
    >
      <div className="flex min-h-screen w-full gap-0 lg:p-6">
        <AdminSidebar active="overview" />

        <div className="min-w-0 flex-1 px-4 pb-28 pt-5 lg:px-6 lg:py-0">
          <header className="mb-5 flex h-[70px] items-center justify-between rounded-[18px] bg-white/10 px-5 shadow-[0_18px_46px_rgba(35,48,39,0.12)] backdrop-blur-2xl lg:hidden">
            <Link
              href="/admin"
              className="flex items-center"
              aria-label="Go to admin overview"
            >
              <img
                src="/pros-logo-basic.png"
                alt="PRO's Cafe"
                className="h-[46px] w-auto object-contain"
                draggable={false}
              />
            </Link>

            <Link
              href="/profile"
              className="flex h-10 w-10 items-center justify-center text-[#ffd66b]"
              title={shortName(profile.full_name || profile.email || "Admin")}
              aria-label="Open profile"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-9 w-9 fill-current"
              >
                <path d="M12 12.2a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4Zm0 2.1c-4.6 0-8.3 2.4-8.3 5.3 0 .9.7 1.6 1.6 1.6h13.4c.9 0 1.6-.7 1.6-1.6 0-2.9-3.7-5.3-8.3-5.3Z" />
              </svg>
            </Link>
          </header>

          <section className="mb-5 flex items-center justify-between gap-3 rounded-[28px] bg-white/10 px-5 py-5 backdrop-blur-2xl lg:flex-row lg:items-start lg:px-7 lg:py-7">
            <div className="min-w-0">
              <h1 className="text-[28px] font-black tracking-[-0.05em] text-white lg:text-[30px]">
                Dashboard<span className="hidden lg:inline"> Overview</span>
              </h1>
              <p className="mt-2 hidden text-[12px] font-black text-white/68 lg:block">
                Track customers, stamps, rewards, feedback, and loyalty
                performance.
              </p>
            </div>

            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setMobileFilterOpen((open) => !open)}
                className="flex h-10 min-w-[118px] items-center justify-between gap-3 rounded-[15px] bg-[#ffd66b] px-4 text-[11px] font-black text-[#365665]"
                aria-expanded={mobileFilterOpen}
              >
                <span>{PERIODS.find((item) => item.key === period)?.label}</span>
                <span className={`text-[10px] transition ${mobileFilterOpen ? "rotate-180" : ""}`}>⌄</span>
              </button>
            </div>

            <div className="hidden flex-wrap items-center gap-1 rounded-[14px] bg-white/10 p-1 lg:flex">
              {PERIODS.map((item) => (
                <FilterPill
                  key={item.key}
                  period={item}
                  selected={period === item.key}
                  onSelect={() => setPeriod(item.key)}
                />
              ))}
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2 lg:grid-cols-4 lg:gap-4">
            <StatCard label="Total Customers" value={totalCustomers} />
            <StatCard label="Active Customers" value={activeCustomers} />
            <StatCard
              label="New Customers"
              value={newCustomers}
              badge={PERIODS.find((item) => item.key === period)?.label}
            />
            <StatCard
              label="Total Stamps"
              value={period === "all" ? metrics.stampsIssued : totalStamps}
            />
            <StatCard
              label="Gifts Redeemed"
              value={
                period === "all" ? metrics.rewardsRedeemed : redeemedRewards
              }
              badge={percentage(redemptionRateNumber)}
            />
            <StatCard label="Comment Card Rating" value="4.9 / 5" badge="∞" />
            <StatCard label="Average Visits" value={averageVisits} />
            <StatCard
              label="Repeat Rate"
              value={percentage(repeatRateNumber)}
            />
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-12">
            <ActivityChart
              days={chart.days}
              stamps={chart.stampCounts}
              gifts={chart.giftCounts}
            />
            <SegmentBars
              active={activeRateNumber}
              repeat={repeatRateNumber}
              giftUsers={giftConversionNumber}
              inactive={inactiveRateNumber}
            />
          </section>

          <section className="mt-5 grid gap-4 xl:grid-cols-3">
            <InsightTable title="Loyalty Performance" rows={loyaltyRows} />
            <InsightTable title="Top Insights" rows={topInsightRows} />
            <InsightTable
              title="Needs Attention"
              rows={attentionRows}
              action={
                <div className="hidden gap-3 lg:flex">
                  <Link
                    href="/admin/users"
                    className="rounded-full bg-[#ffd66b] px-5 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#365665]"
                  >
                    View inactive
                  </Link>
                  <Link
                    href="/admin/activity"
                    className="rounded-full px-5 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white hover:bg-white/10"
                  >
                    View activity
                  </Link>
                </div>
              }
            />
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <InsightTable
                title="Customer Summary"
                rows={customerRows}
                action={
                  <Link
                    href="/admin/users"
                    className="text-[11px] font-black text-white"
                  >
                    View behavior
                  </Link>
                }
              />
            </div>
            <RecentActivity
              txns={filteredTxns.length ? filteredTxns : recentTxns}
              users={users}
            />
          </section>
        </div>
      </div>


      {mobileFilterOpen ? (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-5 backdrop-blur-md lg:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setMobileFilterOpen(false)}
        >
          <div
            className="w-full max-w-[300px] rounded-[28px] border border-white/18 bg-[#365665]/98 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/62">
              Filter dashboard
            </div>
            <div className="grid gap-2">
              {PERIODS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setPeriod(item.key);
                    setMobileFilterOpen(false);
                  }}
                  className={`flex h-11 w-full items-center justify-center rounded-[16px] px-4 text-[11px] font-black transition ${
                    period === item.key
                      ? "bg-[#ffd66b] text-[#365665]"
                      : "bg-white/14 text-white hover:bg-white/20"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <AdminMobileFloatingMenu active="overview" />
    </main>
  );
}

export { AdminDashboard };
export default AdminDashboard;
