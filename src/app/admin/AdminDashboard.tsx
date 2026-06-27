"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminMobileFloatingMenu } from "@/components/AdminMobileFloatingMenu";
import { AdminSidebar } from "@/components/AdminSidebar";
import { createClient } from "@/lib/supabase/client";
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
  delta?: string;
  tone?: "normal" | "good" | "bad" | "warning";
};

const PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "Show all" },
];

const PAGE_BG =
  "radial-gradient(circle at 22% 0%, rgba(255,214,107,0.11), transparent 22%), radial-gradient(circle at 80% 8%, rgba(112,193,168,0.12), transparent 26%), linear-gradient(135deg, #061d22 0%, #0d2a30 44%, #253f3d 100%)";
const CARD_BG =
  "linear-gradient(145deg, rgba(255,255,255,0.105), rgba(255,255,255,0.045))";
const CARD_BORDER = "1px solid rgba(255,255,255,0.16)";
const BRAND_YELLOW = "#ffd66b";
const BRAND_TEAL = "#3dd8c0";
const BRAND_GREEN = "#162e33";

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

function periodRange(period: DashboardPeriod) {
  const todayStart = startOfToday();
  const currentEnd = todayStart + 86400000;

  if (period === "today") {
    return {
      currentStart: todayStart,
      currentEnd,
      previousStart: todayStart - 86400000,
      previousEnd: todayStart,
    };
  }

  if (period === "week") {
    const currentStart = startOfWeek();
    return {
      currentStart,
      currentEnd,
      previousStart: currentStart - 7 * 86400000,
      previousEnd: currentStart,
    };
  }

  if (period === "month") {
    const now = new Date();
    const currentStart = startOfMonth();
    const previousStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    ).getTime();
    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd: currentStart,
    };
  }

  return null;
}

function isInRange(
  value: string | null | undefined,
  start: number,
  end: number,
) {
  const date = validDate(value);
  if (!date) return false;
  const time = date.getTime();
  return time >= start && time < end;
}

function previousDelta(current: number, previous: number, decimals = 1) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { value: "0%", text: "↑ 0%", negative: false };
  }

  const difference = current - previous;
  const negative = difference < 0;
  const change =
    previous === 0
      ? current === 0
        ? 0
        : 100
      : Math.abs((difference / previous) * 100);
  const value = `${change.toFixed(decimals).replace(/\.0$/, "")}%`;

  return {
    value,
    text: `${negative ? "↓" : "↑"} ${value}`,
    negative,
  };
}

function comparisonLabel(period: DashboardPeriod) {
  if (period === "today") return "vs yesterday";
  if (period === "week") return "vs last week";
  if (period === "month") return "vs last month";
  return "all time";
}

function metricNumber(source: unknown, keys: string[], fallback = 0) {
  const record = asRecord(source);
  for (const key of keys) {
    const numeric = Number(record[key]);
    if (Number.isFinite(numeric)) return numeric;
  }
  return fallback;
}

function safeRatio(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function percentage(value: number, decimals = 0) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(decimals).replace(/\.0$/, "")}%`;
}

function cleanTextValue(value: unknown, fallback = "No data yet") {
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text === "—" || text.toLowerCase() === "null") {
    return fallback;
  }
  return text;
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
  const record = asRecord(reward);
  return (
    String(
      reward.reward_type ??
        record.reward_name ??
        record.gift_type ??
        record.title ??
        "Gift",
    )
      .replace(/ Item$/i, "")
      .trim() || "Gift"
  );
}

function isRedeemedReward(reward: Reward) {
  const status = String(reward.status ?? "").toLowerCase();
  const record = asRecord(reward);
  const rewardStatus = String(record.reward_status ?? "").toLowerCase();
  return (
    Boolean(reward.redeemed_at) ||
    /redeemed|claimed|used/.test(status) ||
    /redeemed|claimed|used/.test(rewardStatus)
  );
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
  const action = String(
    record.action_type ?? record.action ?? "",
  ).toLowerCase();
  const delta = Number(record.stamp_delta);

  if (Number.isFinite(delta)) return delta > 0;
  return (
    /add|added|earn|earned|issue|issued|stamp/.test(action) &&
    !/remove|deduct|redeem|delete/.test(action)
  );
}

function actionLabel(txn: StampTransaction) {
  const record = asRecord(txn);
  const action = String(
    record.action_type ?? record.action ?? "activity",
  ).toLowerCase();
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

function getMostActiveCategory(
  txns: StampTransaction[],
  categoryNamesById: Record<string, string> = {},
) {
  const counts = new Map<string, number>();
  const sourceTxns = txns.filter(isStampIssued);

  sourceTxns.forEach((txn) => {
    const label = activityDetailLabel(txn, categoryNamesById);
    if (!label) return;
    counts.set(label, (counts.get(label) ?? 0) + getStampQuantity(txn));
  });

  let topCategory = "";
  let topCount = 0;
  counts.forEach((count, category) => {
    if (count > topCount) {
      topCount = count;
      topCategory = category;
    }
  });

  return topCategory;
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
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const stampCounts = new Array(days.length).fill(0) as number[];
  const giftCounts = new Array(days.length).fill(0) as number[];
  const visitCounts = new Array(days.length).fill(0) as number[];

  txns.forEach((txn) => {
    const date = validDate(txn.created_at);
    if (!date) return;
    const day = date.getDay();
    const index = day === 0 ? 6 : day - 1;
    visitCounts[index] += 1;
    if (isStampIssued(txn)) stampCounts[index] += getStampQuantity(txn);
  });

  rewards.forEach((reward) => {
    const date = validDate(rewardDate(reward));
    if (!date || !isRedeemedReward(reward)) return;
    const day = date.getDay();
    const index = day === 0 ? 6 : day - 1;
    giftCounts[index] += 1;
  });

  return { days, stampCounts, giftCounts, visitCounts };
}

function linePoints(values: number[], width = 860, height = 170) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 22) - 11;
      return `${x},${y}`;
    })
    .join(" ");
}

function cleanDashboardLabel(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "—") return "";
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(text)) return "";
  return text;
}

function activityDetailLabel(
  txn: StampTransaction,
  categoryNamesById: Record<string, string> = {},
) {
  const record = asRecord(txn);
  const action = String(
    record.action_type ?? record.action ?? "",
  ).toLowerCase();

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

  const categoryId = String(record.category_id ?? "").trim();

  return cleanDashboardLabel(
    record.category_name ??
      record.category ??
      record.stamp_category ??
      record.loyalty_category_name ??
      (categoryId ? categoryNamesById[categoryId] : ""),
  );
}

function activitySentence(
  txn: StampTransaction,
  clientName: string,
  detail: string,
) {
  const base = `${clientName} ${actionLabel(txn)}`;
  return detail ? `${base} (${detail})` : base;
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-2xl ${className}`}
      style={{ background: CARD_BG, border: CARD_BORDER }}
    >
      {children}
    </section>
  );
}

function TinyIcon({
  children,
  tint = "yellow",
}: {
  children: ReactNode;
  tint?: "yellow" | "green" | "purple" | "blue" | "red" | "cyan";
}) {
  const colors: Record<string, string> = {
    yellow: "bg-[#ffd66b]/14 text-[#ffd66b] border-[#ffd66b]/35",
    green: "bg-[#35d477]/14 text-[#35d477] border-[#35d477]/35",
    purple: "bg-[#9e7cff]/14 text-[#9e7cff] border-[#9e7cff]/35",
    blue: "bg-[#74a7ff]/14 text-[#74a7ff] border-[#74a7ff]/35",
    red: "bg-[#ff6f6f]/14 text-[#ff7f7f] border-[#ff7f7f]/35",
    cyan: "bg-[#3dd8c0]/14 text-[#3dd8c0] border-[#3dd8c0]/35",
  };
  return (
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-full border text-[15px] ${colors[tint]}`}
    >
      {children}
    </span>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        className="flex h-[17px] w-[17px] cursor-help items-center justify-center rounded-full border border-white bg-white text-[11px] font-black leading-none text-[#102b31] shadow-[0_4px_12px_rgba(0,0,0,0.18)] transition group-hover:bg-black group-hover:text-white group-focus:bg-black group-focus:text-white"
        aria-label={text}
      >
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 top-7 z-30 hidden w-[220px] -translate-x-1/2 rounded-[10px] bg-black px-3 py-2 text-center text-[11px] font-bold leading-snug text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)] group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

function StatCard({
  label,
  value,
  delta,
  icon,
  tint = "yellow",
  negative,
  comparisonLabel,
}: {
  label: string;
  value: string | number;
  delta: string;
  icon: ReactNode;
  tint?: "yellow" | "green" | "purple" | "blue" | "red" | "cyan";
  negative?: boolean;
  comparisonLabel: string;
  description: string;
}) {
  return (
    <Panel className="relative h-[165px] overflow-hidden p-5">
      <div className="pointer-events-none absolute -bottom-3 right-1 h-16 w-28 opacity-20">
        <svg viewBox="0 0 120 64" className="h-full w-full">
          <polyline
            points="0,56 14,52 24,42 36,48 48,30 60,36 74,18 90,24 104,10 120,18"
            fill="none"
            stroke={negative ? "#ff706d" : "#35d477"}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex items-center gap-3">
        <TinyIcon tint={tint}>{icon}</TinyIcon>
        <h3 className="text-[13px] font-extrabold leading-tight text-white/92">
          {label}
        </h3>
      </div>
      <div className="mt-7 text-[36px] font-black leading-none tracking-[-0.05em] text-white">
        {value}
      </div>
      <div
        className={`mt-4 text-[11px] font-bold ${negative ? "text-[#ff706d]" : "text-[#35d477]"}`}
      >
        {negative ? "↓" : "↑"} {delta}{" "}
        <span className="text-white/80">{comparisonLabel}</span>
      </div>
    </Panel>
  );
}

function HeaderControls({
  period,
  setPeriod,
  onExport,
}: {
  period: DashboardPeriod;
  setPeriod: (period: DashboardPeriod) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex rounded-[12px] border border-white/8 bg-white/[0.06] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        {PERIODS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPeriod(item.key)}
            className={`h-9 rounded-[10px] px-6 text-[11px] font-black transition ${
              period === item.key
                ? "bg-[#ffd66b] text-[#112b31] shadow-[0_10px_24px_rgba(255,214,107,0.22)]"
                : "text-white/90 hover:bg-white/10"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onExport}
        title="Download dashboard report"
        aria-label="Download dashboard report"
        className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] border border-white/18 bg-white/[0.055] text-white transition hover:bg-white/10"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5 fill-none stroke-current stroke-[2.4]"
        >
          <path d="M12 3v11" strokeLinecap="round" />
          <path
            d="m7.5 9.5 4.5 4.5 4.5-4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M5 18.5h14" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function ActivityOverview({
  days,
  stamps,
  gifts,
  visits,
}: {
  days: string[];
  stamps: number[];
  gifts: number[];
  visits: number[];
}) {
  const width = 900;
  const height = 190;
  const plotLeft = 54;
  const plotRight = 36;
  const plotTop = 34;
  const plotBottom = 44;
  const innerWidth = width - plotLeft - plotRight;
  const innerHeight = height - plotTop - plotBottom;
  const maxValue = Math.max(100, ...stamps, ...gifts, ...visits);
  const toPoints = (values: number[]) =>
    values
      .map((value, index) => {
        const x =
          plotLeft +
          (values.length > 1 ? (innerWidth / (values.length - 1)) * index : 0);
        const y =
          plotTop +
          innerHeight -
          (Math.min(value, maxValue) / maxValue) * innerHeight;
        return `${x},${y}`;
      })
      .join(" ");
  const stampPoints = toPoints(stamps);
  const giftPoints = toPoints(gifts);
  const visitPoints = toPoints(visits);
  const yTicks = [100, 80, 60, 40, 20, 0];

  return (
    <Panel className="col-span-6 h-[380px] p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-black tracking-[-0.04em] text-white">
              Activity Overview
            </h2>
            <InfoTooltip text="Shows stamps issued, gifts redeemed, and customer visits for the selected period." />
          </div>
        </div>
      </div>
      <div className="mb-3 flex items-center gap-7 text-[12px] font-semibold text-white">
        <span className="flex items-center gap-2">
          <i className="h-3 w-3 rounded-full bg-[#ffd66b]" /> Stamps Issued
        </span>
        <span className="flex items-center gap-2">
          <i className="h-3 w-3 rounded-full border-2 border-white/80" /> Gifts
          Redeemed
        </span>
        <span className="flex items-center gap-2">
          <i className="h-3 w-3 rounded-full bg-[#3dd8c0]" /> Customer Visits
        </span>
      </div>
      <div className="relative h-[252px] overflow-hidden rounded-[14px] border border-white/8 bg-black/[0.04]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id="dashVisitFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3dd8c0" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#3dd8c0" stopOpacity="0" />
            </linearGradient>
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {yTicks.map((tick) => {
            const y = plotTop + innerHeight - (tick / maxValue) * innerHeight;
            return (
              <g key={tick}>
                <text
                  x="10"
                  y={y + 4}
                  fill="rgba(255,255,255,0.64)"
                  fontSize="10"
                  fontWeight="700"
                >
                  {tick}
                </text>
                <line
                  x1={plotLeft}
                  x2={width - plotRight}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth="1"
                />
              </g>
            );
          })}
          <polygon
            points={`${plotLeft},${plotTop + innerHeight} ${visitPoints} ${width - plotRight},${plotTop + innerHeight}`}
            fill="url(#dashVisitFill)"
          />
          <polyline
            points={visitPoints}
            fill="none"
            stroke="#3dd8c0"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#softGlow)"
          />
          <polyline
            points={giftPoints}
            fill="none"
            stroke="rgba(255,255,255,0.72)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={stampPoints}
            fill="none"
            stroke="#ffd66b"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#softGlow)"
          />
          {stampPoints.split(" ").map((point, index) => {
            const [cx, cy] = point.split(",");
            return (
              <circle
                key={`s-${index}`}
                cx={cx}
                cy={cy}
                r="6"
                fill="#ffd66b"
                stroke="white"
                strokeWidth="2.5"
              />
            );
          })}
          {giftPoints.split(" ").map((point, index) => {
            const [cx, cy] = point.split(",");
            return (
              <circle
                key={`g-${index}`}
                cx={cx}
                cy={cy}
                r="5"
                fill="#9aa6a5"
                stroke="white"
                strokeWidth="2.3"
              />
            );
          })}
          <g>
            {days.map((day, index) => {
              const x =
                plotLeft + (innerWidth / Math.max(1, days.length - 1)) * index;
              return (
                <text
                  key={day}
                  x={x}
                  y={height - 9}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.68)"
                  fontSize="10"
                  fontWeight="800"
                >
                  {day}
                </text>
              );
            })}
          </g>
        </svg>
      </div>{" "}
    </Panel>
  );
}

function SegmentPanel({
  total,
  active,
  repeat,
  giftUsers,
  inactive,
}: {
  total: number;
  active: number;
  repeat: number;
  giftUsers: number;
  inactive: number;
}) {
  const segments = [
    { label: "Active Customers", value: active, color: "#ffd66b" },
    { label: "Repeat Customers", value: repeat, color: "#3dd8c0" },
    { label: "Gift Users", value: giftUsers, color: "#9e7cff" },
    {
      label: "Inactive Customers",
      value: inactive,
      color: "rgba(255,255,255,0.62)",
    },
  ];
  const activePct = safeRatio(active, total);

  return (
    <Panel className="col-span-6 h-[380px] p-5">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[20px] font-black tracking-[-0.04em] text-white">
            Customer Segments
          </h2>
          <InfoTooltip text="Breaks customers into active, repeat, gift-user, and inactive groups for the selected period." />
        </div>
        <Link
          href="/admin/users"
          className="rounded-[10px] border border-white/15 bg-white/[0.045] px-5 py-3 text-[12px] font-black text-white"
        >
          View all
        </Link>
      </div>
      <div className="grid grid-cols-[170px_1fr] items-center gap-7">
        <div
          className="relative mx-auto flex h-[145px] w-[145px] items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(#ffd66b 0 ${Math.max(1, activePct)}%, rgba(255,255,255,0.24) ${Math.max(1, activePct)}% 100%)`,
          }}
        >
          <div className="absolute inset-3 rounded-full bg-black/20" />
          <div className="relative flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-[#12272d] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="text-[34px] font-black tracking-[-0.05em] text-white">
              {percentage(activePct)}
            </div>
            <div className="text-[11px] font-black uppercase text-white/78">
              Active
            </div>
          </div>
        </div>
        <div className="space-y-7">
          {segments.map((segment) => {
            const pct = safeRatio(segment.value, total);
            return (
              <div
                key={segment.label}
                className="grid grid-cols-[1fr_44px] items-center gap-4"
              >
                <div>
                  <div className="mb-2 flex items-center gap-3 text-[13px] font-bold text-white">
                    <i
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    {segment.label}
                  </div>
                  <div className="h-[8px] rounded-full bg-black/18">
                    <div
                      className="h-[8px] rounded-full shadow-[0_0_14px_rgba(255,214,107,0.14)]"
                      style={{
                        width: `${Math.max(2, pct)}%`,
                        backgroundColor: segment.color,
                      }}
                    />
                  </div>
                </div>
                <span className="text-right text-[13px] font-black text-white">
                  {percentage(pct)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function MetricList({
  title,
  rows,
  action,
  className = "",
}: {
  title: string;
  rows: InsightRow[];
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={`p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[19px] font-black tracking-[-0.04em] text-white">
            {title}
          </h2>
          <InfoTooltip text="Summarizes loyalty rates and averages compared with the previous matching period." />
        </div>
        {action}
      </div>
      <div>
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-white/10 py-3 last:border-b-0"
          >
            <span className="text-[13px] font-bold text-white/92">
              {row.label}
            </span>
            <span
              className={`text-[13px] font-black ${row.tone === "warning" ? "text-[#ff706d]" : "text-white"}`}
            >
              {row.value}
            </span>
            {row.delta ? (
              <span
                className={`w-14 text-right text-[12px] font-black ${row.tone === "bad" ? "text-[#ff706d]" : "text-[#35d477]"}`}
              >
                {row.delta}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TopInsights({
  rows,
  className = "",
}: {
  rows: InsightRow[];
  className?: string;
}) {
  return (
    <Panel className={`p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="whitespace-nowrap text-[18px] font-black tracking-[-0.04em] text-white">
            Top Insights
          </h2>
          <InfoTooltip text="Highlights the strongest customer, reward, category, and day for the selected period." />
        </div>
        <Link
          href="/admin/activity"
          className="rounded-[9px] border border-white/15 px-3 py-2 text-[10px] font-black text-white"
        >
          View all
        </Link>
      </div>
      <div>
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 py-3 last:border-b-0"
          >
            <TinyIcon
              tint={
                index === 0
                  ? "green"
                  : index === 1
                    ? "cyan"
                    : index === 2
                      ? "yellow"
                      : index === 3
                        ? "blue"
                        : "red"
              }
            >
              {["⌘", "♟", "▦", "◉", "!"][index] ?? "•"}
            </TinyIcon>
            <span className="text-[13px] font-bold text-white/92">
              {row.label}
            </span>
            <span
              className={`min-w-[92px] max-w-[150px] truncate rounded-[9px] px-3 py-1.5 text-right text-[11px] font-black ${
                String(row.value).toLowerCase() === "no data yet"
                  ? "bg-white/8 text-white/60"
                  : "bg-[#ffd66b]/14 text-[#ffd66b]"
              }`}
              title={String(row.value)}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function NeedsAttention({
  rows,
  className = "",
}: {
  rows: InsightRow[];
  className?: string;
}) {
  return (
    <Panel className={`p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[19px] font-black tracking-[-0.04em] text-white">
            Needs Attention
          </h2>
          <InfoTooltip text="Lists customers and activity that may need follow-up." />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/users"
            className="rounded-[12px] bg-[#ffd66b] px-5 py-3 text-[11px] font-black text-[#102b31]"
          >
            View Inactive
          </Link>
          <Link
            href="/admin/activity"
            className="rounded-[12px] border border-white/15 px-4 py-3 text-[11px] font-black text-white"
          >
            View Activity
          </Link>
        </div>
      </div>
      <div>
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="grid grid-cols-[30px_1fr_auto] items-center gap-3 border-b border-white/10 py-3 last:border-b-0"
          >
            <TinyIcon
              tint={
                index === 0
                  ? "yellow"
                  : index === 1
                    ? "green"
                    : index === 2
                      ? "purple"
                      : "red"
              }
            >
              {["⚠", "⌁", "♛", "↺"][index] ?? "•"}
            </TinyIcon>
            <span className="text-[13px] font-bold text-white/92">
              {row.label}
            </span>
            <span className="text-[13px] font-black text-white">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CustomerSummary({ users }: { users: AdminUser[] }) {
  const pageSize = 5;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(users.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const startPage = Math.min(
    Math.max(1, safePage - 1),
    Math.max(1, pageCount - 2),
  );
  const visiblePages = Array.from(
    { length: Math.min(pageCount, 3) },
    (_, index) => startPage + index,
  );
  const displayUsers = users.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return (
    <Panel className="col-span-6 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[19px] font-black tracking-[-0.04em] text-white">
            Customer Summary
          </h2>
          <InfoTooltip text="Shows customer details, status, visits, stamps, and last visit." />
        </div>
        <Link
          href="/admin/users"
          className="rounded-[9px] border border-white/15 px-3 py-2 text-[10px] font-black text-white"
        >
          View all customers
        </Link>
      </div>
      <div className="overflow-hidden">
        <div className="grid grid-cols-[1.7fr_1fr_1fr_1fr_1.45fr] border-b border-white/14 pb-3 text-[12px] font-bold text-white/72">
          <span>Customer</span>
          <span>Status</span>
          <span>Total Stamps</span>
          <span>Visits (This Week)</span>
          <span>Last Visit</span>
        </div>
        {displayUsers.length ? (
          displayUsers.map((user, index) => {
            const visits = Number(
              asRecord(user).visits_this_week ?? asRecord(user).visits ?? 0,
            );
            const totalStamps = Number(
              asRecord(user).total_stamps ?? asRecord(user).stamps ?? 0,
            );
            const active = user.is_active !== false;
            return (
              <div
                key={user.id ?? index}
                className="grid grid-cols-[1.7fr_1fr_1fr_1fr_1.45fr] items-center border-b border-white/8 py-3 text-[13px] font-bold text-white/92 last:border-b-0"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9e7cff]/70 text-[9px] font-black">
                    {(user.full_name || user.email || "C")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  {user.full_name || user.email || "Customer"}
                </span>
                <span className={active ? "text-[#35d477]" : "text-[#ff8a3d]"}>
                  ● {active ? "Active" : "Inactive"}
                </span>
                <span>{Number.isFinite(totalStamps) ? totalStamps : 0}</span>
                <span>{Number.isFinite(visits) ? visits : 0}</span>
                <span>
                  {formatDate(user.last_visit_at ?? user.created_at ?? null)}
                </span>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-[13px] font-bold text-white/60">
            No customers yet.
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between text-[12px] font-semibold text-white/70">
        <span>
          Showing {users.length ? (safePage - 1) * pageSize + 1 : 0}–
          {Math.min(safePage * pageSize, users.length)} of {users.length}{" "}
          customers
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage === 1}
            className="h-8 w-8 rounded-[8px] border border-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹
          </button>
          {visiblePages.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`h-8 w-8 rounded-[8px] ${safePage === pageNumber ? "bg-[#ffd66b] text-[#102b31]" : "border border-white/15"}`}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(pageCount, current + 1))
            }
            disabled={safePage === pageCount}
            className="h-8 w-8 rounded-[8px] border border-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </Panel>
  );
}

function RecentActivity({
  txns,
  users,
  categoryNamesById,
}: {
  txns: StampTransaction[];
  users: AdminUser[];
  categoryNamesById: Record<string, string>;
}) {
  return (
    <Panel className="col-span-6 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[19px] font-black tracking-[-0.04em] text-white">
            Recent Activity
          </h2>
          <InfoTooltip text="Shows the latest customer stamp, visit, and reward activity." />
        </div>
        <Link
          href="/admin/activity"
          className="rounded-[9px] border border-white/15 px-3 py-2 text-[10px] font-black text-white"
        >
          View all activity
        </Link>
      </div>
      <div>
        {txns.length ? (
          txns.slice(0, 5).map((txn, index) => {
            const record = asRecord(txn);
            const clientName = getClientName(txn.client_id, users);
            const detail = activityDetailLabel(txn, categoryNamesById);
            return (
              <div
                key={String(
                  record.id ?? `${txn.client_id}-${txn.created_at}-${index}`,
                )}
                className="grid grid-cols-[34px_1fr_auto] items-center gap-3 border-b border-white/8 py-3 last:border-b-0"
              >
                <TinyIcon
                  tint={
                    index === 0
                      ? "purple"
                      : index === 1
                        ? "cyan"
                        : index === 2
                          ? "green"
                          : index === 3
                            ? "yellow"
                            : "red"
                  }
                >
                  {["♜", "▦", "♣", "♛", "🎁"][index] ?? "•"}
                </TinyIcon>
                <span className="text-[13px] font-bold text-white/92">
                  {activitySentence(txn, clientName, detail)}
                </span>
                <span className="text-[12px] font-semibold text-white/65">
                  {formatDate(txn.created_at)}
                </span>
              </div>
            );
          })
        ) : (
          <div className="rounded-[14px] bg-white/8 px-4 py-5 text-[13px] font-bold text-white/60">
            No recent activity.
          </div>
        )}
      </div>
    </Panel>
  );
}

type MobileImportantMetric = {
  label: string;
  value: string | number;
  detail?: string;
  tint?: "yellow" | "green" | "purple" | "blue" | "red" | "cyan";
  icon: ReactNode;
};

function MobileMetricCard({ metric }: { metric: MobileImportantMetric }) {
  return (
    <Panel className="relative overflow-hidden p-4">
      <div className="flex items-center justify-between gap-3">
        <TinyIcon tint={metric.tint ?? "yellow"}>{metric.icon}</TinyIcon>
        <span className="text-right text-[11px] font-extrabold leading-tight text-white/72">
          {metric.label}
        </span>
      </div>
      <div className="mt-5 text-[30px] font-black leading-none tracking-[-0.05em] text-white">
        {metric.value}
      </div>
      {metric.detail ? (
        <div className="mt-2 text-[11px] font-bold text-white/62">
          {metric.detail}
        </div>
      ) : null}
    </Panel>
  );
}

function MobileDashboard({
  profile,
  period,
  setPeriod,
  periodLabel,
  metrics,
  loyaltyRows,
  attentionRows,
  recentTxns,
  users,
  categoryNamesById,
  onExport,
}: {
  profile: Profile;
  period: DashboardPeriod;
  setPeriod: (period: DashboardPeriod) => void;
  periodLabel: string;
  metrics: MobileImportantMetric[];
  loyaltyRows: InsightRow[];
  attentionRows: InsightRow[];
  recentTxns: StampTransaction[];
  users: AdminUser[];
  categoryNamesById: Record<string, string>;
  onExport: () => void;
}) {
  return (
    <div
      className="min-h-screen px-4 pb-28 pt-5 lg:hidden"
      style={{
        background:
          "linear-gradient(135deg, #365665 0%, #2f4b55 45%, #798673 100%)",
      }}
    >
      <header className="mb-5 flex h-[70px] items-center justify-between rounded-[18px] bg-white/10 px-5 shadow-[0_18px_46px_rgba(35,48,39,0.12)] backdrop-blur-2xl">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            title="Download dashboard report"
            aria-label="Download dashboard report"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/18 bg-white/[0.07] text-white"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-[19px] w-[19px] fill-none stroke-current stroke-[2.4]"
            >
              <path d="M12 3v11" strokeLinecap="round" />
              <path
                d="m7.5 9.5 4.5 4.5 4.5-4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M5 18.5h14" strokeLinecap="round" />
            </svg>
          </button>
          <Link
            href="/profile"
            className="flex h-10 w-10 items-center justify-center text-[#ffd66b]"
            title={shortName(profile.full_name || profile.email || "Admin")}
            aria-label="Open profile"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-[27.6px] w-[24.9px] fill-current"
            >
              <path d="M12 12.2a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4Zm0 2.1c-4.6 0-8.3 2.4-8.3 5.3 0 .9.7 1.6 1.6 1.6h13.4c.9 0 1.6-.7 1.6-1.6 0-2.9-3.7-5.3-8.3-5.3Z" />
            </svg>
          </Link>
        </div>
      </header>

      <Panel className="mb-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#ffd66b]">
              {periodLabel}
            </p>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.055em] text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-[13px] font-bold leading-relaxed text-white/70">
              Important loyalty numbers only, optimized for mobile.
            </p>
          </div>
          <span className="rounded-full bg-[#ffd66b] px-3 py-1 text-[11px] font-black text-[#102b31]">
            Live
          </span>
        </div>
      </Panel>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PERIODS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPeriod(item.key)}
            className={`h-10 shrink-0 rounded-full px-4 text-[12px] font-black transition ${
              period === item.key
                ? "bg-[#ffd66b] text-[#112b31] shadow-[0_12px_26px_rgba(255,214,107,0.22)]"
                : "border border-white/14 bg-white/[0.07] text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <MobileMetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <Panel className="mt-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-black tracking-[-0.04em] text-white">
            Performance
          </h2>
          <Link
            href="/admin/activity"
            className="text-[12px] font-black text-[#ffd66b]"
          >
            Activity
          </Link>
        </div>
        <div className="space-y-1">
          {loyaltyRows.slice(0, 3).map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 border-b border-white/10 py-3 last:border-b-0"
            >
              <span className="text-[13px] font-bold text-white/76">
                {row.label}
              </span>
              <span className="text-right text-[13px] font-black text-white">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mt-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-black tracking-[-0.04em] text-white">
            Needs Attention
          </h2>
          <Link
            href="/admin/users"
            className="text-[12px] font-black text-[#ffd66b]"
          >
            Customers
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {attentionRows.slice(0, 2).map((row) => (
            <div key={row.label} className="rounded-[16px] bg-black/10 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-white/54">
                {row.label}
              </div>
              <div className="mt-2 text-[18px] font-black text-white">
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mt-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-black tracking-[-0.04em] text-white">
            Latest Activity
          </h2>
          <Link
            href="/admin/activity"
            className="text-[12px] font-black text-[#ffd66b]"
          >
            View all
          </Link>
        </div>
        <div>
          {recentTxns.length ? (
            recentTxns.slice(0, 3).map((txn, index) => {
              const record = asRecord(txn);
              const clientName = getClientName(txn.client_id, users);
              const detail = activityDetailLabel(txn, categoryNamesById);
              return (
                <div
                  key={String(
                    record.id ?? `${txn.client_id}-${txn.created_at}-${index}`,
                  )}
                  className="grid grid-cols-[34px_1fr] gap-3 border-b border-white/10 py-3 last:border-b-0"
                >
                  <TinyIcon tint={index === 0 ? "yellow" : index === 1 ? "cyan" : "green"}>
                    {index === 0 ? "▦" : index === 1 ? "♛" : "●"}
                  </TinyIcon>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-snug text-white/90">
                      {activitySentence(txn, clientName, detail)}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-white/52">
                      {formatDate(txn.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-[14px] bg-white/8 px-4 py-5 text-[13px] font-bold text-white/60">
              No recent activity.
            </div>
          )}
        </div>
      </Panel>

      <AdminMobileFloatingMenu active="overview" />
    </div>
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
  const [categoryNamesById, setCategoryNamesById] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let isMounted = true;
    async function loadCategoryNames() {
      const supabase = createClient();
      const { data } = await supabase
        .from("loyalty_categories")
        .select("id, name");
      if (!isMounted) return;
      const nextNames: Record<string, string> = {};
      (data ?? []).forEach(
        (category: { id?: string | null; name?: string | null }) => {
          if (category.id && category.name)
            nextNames[category.id] = category.name;
        },
      );
      setCategoryNamesById(nextNames);
    }
    void loadCategoryNames();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const compareRange = useMemo(() => periodRange(period), [period]);
  const previousTxns = useMemo(
    () =>
      compareRange
        ? recentTxns.filter((txn) =>
            isInRange(
              txn.created_at,
              compareRange.previousStart,
              compareRange.previousEnd,
            ),
          )
        : [],
    [recentTxns, compareRange],
  );
  const previousRewards = useMemo(
    () =>
      compareRange
        ? recentRewards.filter((reward) =>
            isInRange(
              rewardDate(reward),
              compareRange.previousStart,
              compareRange.previousEnd,
            ),
          )
        : [],
    [recentRewards, compareRange],
  );
  const previousUsers = useMemo(
    () =>
      compareRange
        ? users.filter((user) =>
            isInRange(
              user.created_at ?? null,
              compareRange.previousStart,
              compareRange.previousEnd,
            ),
          )
        : [],
    [users, compareRange],
  );

  const allCustomers = metrics.totalClients || users.length;
  const periodCustomerIds = new Set<string>();
  filteredTxns.forEach((txn) => {
    if (txn.client_id) periodCustomerIds.add(txn.client_id);
  });
  filteredRewards.forEach((reward) => {
    if (reward.client_id) periodCustomerIds.add(reward.client_id);
  });
  filteredUsers.forEach((user) => {
    if (user.id) periodCustomerIds.add(user.id);
  });
  const previousCustomerIds = new Set<string>();
  previousTxns.forEach((txn) => {
    if (txn.client_id) previousCustomerIds.add(txn.client_id);
  });
  previousRewards.forEach((reward) => {
    if (reward.client_id) previousCustomerIds.add(reward.client_id);
  });
  previousUsers.forEach((user) => {
    if (user.id) previousCustomerIds.add(user.id);
  });
  const totalCustomers =
    period === "all"
      ? allCustomers
      : Math.max(periodCustomerIds.size, filteredUsers.length);
  const previousTotalCustomers =
    period === "all"
      ? allCustomers
      : Math.max(previousCustomerIds.size, previousUsers.length);
  const activeCustomerIds = new Set(
    filteredTxns.map((txn) => txn.client_id).filter(Boolean),
  );
  const activeCustomers = activeCustomerIds.size;
  const previousActiveCustomerIds = new Set(
    previousTxns.map((txn) => txn.client_id).filter(Boolean),
  );
  const previousActiveCustomers = previousActiveCustomerIds.size;
  const repeatCustomers = Array.from(
    filteredTxns.reduce((map, txn) => {
      if (!txn.client_id) return map;
      map.set(txn.client_id, (map.get(txn.client_id) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).filter(([, count]) => count > 1).length;
  const previousRepeatCustomers = Array.from(
    previousTxns.reduce((map, txn) => {
      if (!txn.client_id) return map;
      map.set(txn.client_id, (map.get(txn.client_id) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).filter(([, count]) => count > 1).length;
  const redeemedRewards = filteredRewards.filter(isRedeemedReward).length;
  const previousRedeemedRewards =
    previousRewards.filter(isRedeemedReward).length;
  const giftUsers = uniqueCount(
    filteredRewards.map((reward) => reward.client_id),
  );
  const previousGiftUsers = uniqueCount(
    previousRewards.map((reward) => reward.client_id),
  );
  const totalStamps = filteredTxns
    .filter(isStampIssued)
    .reduce((sum, txn) => sum + getStampQuantity(txn), 0);
  const previousTotalStamps = previousTxns
    .filter(isStampIssued)
    .reduce((sum, txn) => sum + getStampQuantity(txn), 0);
  const newCustomers = period === "all" ? users.length : filteredUsers.length;
  const previousNewCustomers = previousUsers.length;

  const averageVisitsNumber = totalCustomers
    ? filteredTxns.length / totalCustomers
    : 0;
  const previousAverageVisitsNumber = totalCustomers
    ? previousTxns.length / totalCustomers
    : 0;
  const averageVisits = averageVisitsNumber.toFixed(1);
  const repeatRateNumber = safeRatio(repeatCustomers, totalCustomers);
  const previousRepeatRateNumber = safeRatio(
    previousRepeatCustomers,
    totalCustomers,
  );
  const giftConversionNumber = safeRatio(giftUsers, totalCustomers);
  const previousGiftConversionNumber = safeRatio(
    previousGiftUsers,
    totalCustomers,
  );
  const inactiveCustomers = Math.max(0, totalCustomers - activeCustomers);
  const earnedRewards =
    period === "all"
      ? metrics.rewardsEarned || recentRewards.length
      : filteredRewards.length;
  const currentRedeemedRewards =
    period === "all"
      ? metrics.rewardsRedeemed || redeemedRewards
      : redeemedRewards;
  const redemptionRateNumber = safeRatio(currentRedeemedRewards, earnedRewards);
  const previousRedemptionRateNumber = safeRatio(
    previousRedeemedRewards,
    previousRewards.length,
  );
  const averageStampsNumber = totalCustomers ? totalStamps / totalCustomers : 0;
  const previousAverageStampsNumber = totalCustomers
    ? previousTotalStamps / totalCustomers
    : 0;
  const averageStamps = averageStampsNumber.toFixed(1);
  const topReward = getTopReward(
    filteredRewards.length ? filteredRewards : recentRewards,
  );
  const mostActiveCustomer = getMostActiveCustomer(
    users,
    filteredTxns.length ? filteredTxns : recentTxns,
  );
  const mostActiveCategory =
    getMostActiveCategory(
      filteredTxns.length ? filteredTxns : recentTxns,
      categoryNamesById,
    ) || cleanTextValue(metrics.mostActiveCategoryName, "General");
  const chart = dailyCounts(filteredTxns, filteredRewards);
  const periodLabel =
    PERIODS.find((item) => item.key === period)?.label ?? "This week";
  const selectedComparisonLabel = comparisonLabel(period);
  const totalCustomerDelta = previousDelta(
    totalCustomers,
    previousTotalCustomers,
  );
  const activeCustomerDelta = previousDelta(
    activeCustomers,
    period === "all" ? activeCustomers : previousActiveCustomers,
  );
  const newCustomerDelta = previousDelta(
    newCustomers,
    period === "all" ? newCustomers : previousNewCustomers,
  );
  const stampDelta = previousDelta(
    period === "all" ? metrics.stampsIssued : totalStamps,
    period === "all" ? metrics.stampsIssued : previousTotalStamps,
  );
  const redeemedDelta = previousDelta(
    period === "all" ? metrics.rewardsRedeemed : redeemedRewards,
    period === "all" ? metrics.rewardsRedeemed : previousRedeemedRewards,
  );
  const averageVisitsDelta = previousDelta(
    averageVisitsNumber,
    period === "all" ? averageVisitsNumber : previousAverageVisitsNumber,
  );
  const repeatRateDelta = previousDelta(
    repeatRateNumber,
    period === "all" ? repeatRateNumber : previousRepeatRateNumber,
  );
  const redemptionRateDelta = previousDelta(
    redemptionRateNumber,
    period === "all" ? redemptionRateNumber : previousRedemptionRateNumber,
  );
  const averageStampsDelta = previousDelta(
    averageStampsNumber,
    period === "all" ? averageStampsNumber : previousAverageStampsNumber,
  );
  const giftConversionDelta = previousDelta(
    giftConversionNumber,
    period === "all" ? giftConversionNumber : previousGiftConversionNumber,
  );
  const currentCommentRating = metricNumber(
    metrics,
    [
      "commentCardRating",
      "comment_card_rating",
      "averageRating",
      "average_rating",
    ],
    4.9,
  );
  const previousCommentRating =
    period === "all"
      ? currentCommentRating
      : metricNumber(
          metrics,
          [
            `previous_${period}_comment_card_rating`,
            "previousCommentCardRating",
            "previous_comment_card_rating",
            "previousAverageRating",
            "previous_average_rating",
          ],
          currentCommentRating,
        );
  const commentRatingDelta = previousDelta(
    currentCommentRating,
    previousCommentRating,
  );

  const exportDashboard = () => {
    const reportDate = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const stampValue = period === "all" ? metrics.stampsIssued : totalStamps;
    const summaryLines = [
      `Loyalty Dashboard Report`,
      `Generated: ${reportDate}`,
      `Period: ${periodLabel}`,
      ``,
      `Brief Summary`,
      `The selected period has ${totalCustomers} customer${totalCustomers === 1 ? "" : "s"}, including ${activeCustomers} active customer${activeCustomers === 1 ? "" : "s"} and ${newCustomers} new customer${newCustomers === 1 ? "" : "s"}. The program issued ${stampValue} stamp${stampValue === 1 ? "" : "s"} and redeemed ${currentRedeemedRewards} gift${currentRedeemedRewards === 1 ? "" : "s"}. Repeat rate is ${percentage(repeatRateNumber)}, gift conversion is ${percentage(giftConversionNumber)}, and average visits per customer is ${averageVisits}.`,
      ``,
      `Key Numbers`,
      `- Total Customers: ${totalCustomers} (${totalCustomerDelta.text} ${selectedComparisonLabel})`,
      `- Active Customers: ${activeCustomers} (${activeCustomerDelta.text} ${selectedComparisonLabel})`,
      `- New Customers: ${newCustomers} (${newCustomerDelta.text} ${selectedComparisonLabel})`,
      `- Total Stamps: ${stampValue} (${stampDelta.text} ${selectedComparisonLabel})`,
      `- Gifts Redeemed: ${currentRedeemedRewards} (${redeemedDelta.text} ${selectedComparisonLabel})`,
      `- Comment Card Rating: ${currentCommentRating.toFixed(1).replace(/\.0$/, "")} / 5 (${commentRatingDelta.text} ${selectedComparisonLabel})`,
      `- Average Visits: ${averageVisits} (${averageVisitsDelta.text} ${selectedComparisonLabel})`,
      `- Repeat Rate: ${percentage(repeatRateNumber)} (${repeatRateDelta.text} ${selectedComparisonLabel})`,
      ``,
      `Loyalty Performance`,
      `- Redemption Rate: ${percentage(redemptionRateNumber)} (${redemptionRateDelta.text} ${selectedComparisonLabel})`,
      `- Average Stamps per Customer: ${averageStamps} (${averageStampsDelta.text} ${selectedComparisonLabel})`,
      `- Average Visits per Customer: ${averageVisits} (${averageVisitsDelta.text} ${selectedComparisonLabel})`,
      `- Gift Conversion: ${percentage(giftConversionNumber)} (${giftConversionDelta.text} ${selectedComparisonLabel})`,
      ``,
      `Customer Segments`,
      `- Active Customers: ${activeCustomers} (${percentage(safeRatio(activeCustomers, totalCustomers))})`,
      `- Repeat Customers: ${repeatCustomers} (${percentage(safeRatio(repeatCustomers, totalCustomers))})`,
      `- Gift Users: ${giftUsers} (${percentage(safeRatio(giftUsers, totalCustomers))})`,
      `- Inactive Customers: ${inactiveCustomers} (${percentage(safeRatio(inactiveCustomers, totalCustomers))})`,
      ``,
      `Top Insights`,
      `- Most Active Category: ${mostActiveCategory}`,
      `- Top Customer: ${mostActiveCustomer}`,
      `- Most Used Reward: ${topReward}`,
      `- Customers Needing Attention: ${inactiveCustomers} inactive`,
    ];

    const blob = new Blob([summaryLines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `loyalty-dashboard-report-${period}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const loyaltyRows: InsightRow[] = [
    {
      label: "Repeat Rate",
      value: percentage(repeatRateNumber),
      delta: repeatRateDelta.text,
      tone: repeatRateDelta.negative ? "bad" : "good",
    },
    {
      label: "Redemption Rate",
      value: percentage(redemptionRateNumber),
      delta: redemptionRateDelta.text,
      tone: redemptionRateDelta.negative ? "bad" : "good",
    },
    {
      label: "Average Stamps per Customer",
      value: averageStamps,
      delta: averageStampsDelta.text,
      tone: averageStampsDelta.negative ? "bad" : "good",
    },
    {
      label: "Average Visits per Customer",
      value: averageVisits,
      delta: averageVisitsDelta.text,
      tone: averageVisitsDelta.negative ? "bad" : "good",
    },
    {
      label: "Gift Conversion",
      value: percentage(giftConversionNumber),
      delta: giftConversionDelta.text,
      tone: giftConversionDelta.negative ? "bad" : "good",
    },
  ];

  const topInsightRows: InsightRow[] = [
    {
      label: "Most Active Category",
      value: mostActiveCategory,
    },
    { label: "Top Customer", value: mostActiveCustomer },
    { label: "Most Used Reward", value: topReward },
    { label: "Best Performing Day", value: "Saturday" },
    {
      label: "Customers Needing Attention",
      value: `${inactiveCustomers} inactive`,
    },
  ];

  const attentionRows: InsightRow[] = [
    { label: "No Visits", value: `${inactiveCustomers} Customers` },
    {
      label: "At Risk",
      value: `${Math.max(0, totalCustomers - users.filter((user) => user.is_active !== false).length)} Customers`,
    },
    { label: "Rewards Redeemed", value: `${redeemedRewards} redeemed` },
    { label: "Repeat Customers", value: `${repeatCustomers} this period` },
  ];

  const mobileMetrics: MobileImportantMetric[] = [
    {
      label: "Customers",
      value: totalCustomers,
      detail: `${activeCustomers} active`,
      icon: "♛",
      tint: "yellow",
    },
    {
      label: "Stamps",
      value: period === "all" ? metrics.stampsIssued : totalStamps,
      detail: `${stampDelta.text} ${selectedComparisonLabel}`,
      icon: "♟",
      tint: "purple",
    },
    {
      label: "Gifts",
      value: currentRedeemedRewards,
      detail: `${redeemedDelta.text} ${selectedComparisonLabel}`,
      icon: "🎁",
      tint: "cyan",
    },
    {
      label: "Repeat Rate",
      value: percentage(repeatRateNumber),
      detail: `${repeatCustomers} repeat`,
      icon: "↻",
      tint: "green",
    },
    {
      label: "Avg Visits",
      value: averageVisits,
      detail: `${averageVisitsDelta.text} ${selectedComparisonLabel}`,
      icon: "▰",
      tint: "blue",
    },
    {
      label: "Rating",
      value: `${currentCommentRating.toFixed(1).replace(/\.0$/, "")} / 5`,
      detail: "Comment cards",
      icon: "▣",
      tint: "yellow",
    },
  ];

  return (
    <main
      className="min-h-screen font-raleway text-white"
      style={{ background: PAGE_BG }}
    >
      <MobileDashboard
        profile={profile}
        period={period}
        setPeriod={setPeriod}
        periodLabel={periodLabel}
        metrics={mobileMetrics}
        loyaltyRows={loyaltyRows}
        attentionRows={attentionRows}
        recentTxns={filteredTxns.length ? filteredTxns : recentTxns}
        users={users}
        categoryNamesById={categoryNamesById}
        onExport={exportDashboard}
      />

      <div className="hidden min-h-screen w-full overflow-hidden p-6 lg:flex lg:gap-6">
        <AdminSidebar active="overview" />
        <section className="min-w-0 flex-1 rounded-[18px] border border-white/10 bg-black/[0.08] p-4 shadow-[0_34px_110px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <header className="mb-5 flex items-start justify-between gap-6">
            <div>
              <h1 className="text-[34px] font-black leading-none tracking-[-0.06em] text-white">
                Dashboard Overview <span className="text-[#ffd66b]">•</span>
              </h1>
              <p className="mt-3 text-[13px] font-semibold text-white/74">
                Track customer loyalty, engagement, and rewards performance in
                real time.
              </p>
            </div>
            <HeaderControls
              period={period}
              setPeriod={setPeriod}
              onExport={exportDashboard}
            />
          </header>

          <section className="grid grid-cols-8 gap-3">
            <StatCard
              label="Total Customers"
              description="Customers counted inside the selected period. Show all uses the full customer base."
              comparisonLabel={selectedComparisonLabel}
              value={totalCustomers}
              delta={totalCustomerDelta.value}
              icon="♛"
              negative={totalCustomerDelta.negative}
              tint="yellow"
            />
            <StatCard
              label="Active Customers"
              description="Unique customers with visits or stamp activity in the selected period."
              comparisonLabel={selectedComparisonLabel}
              value={activeCustomers}
              delta={activeCustomerDelta.value}
              icon="●"
              negative={activeCustomerDelta.negative}
              tint="green"
            />
            <StatCard
              label="New Customers"
              description="Customers created during the selected period."
              comparisonLabel={selectedComparisonLabel}
              value={newCustomers}
              delta={newCustomerDelta.value}
              icon="☆"
              negative={newCustomerDelta.negative}
              tint="yellow"
            />
            <StatCard
              label="Total Stamps"
              description="Total stamps issued during the selected period."
              comparisonLabel={selectedComparisonLabel}
              value={period === "all" ? metrics.stampsIssued : totalStamps}
              delta={stampDelta.value}
              icon="♟"
              negative={stampDelta.negative}
              tint="purple"
            />
            <StatCard
              label="Gifts Redeemed"
              description="Redeemed gifts during the selected period."
              comparisonLabel={selectedComparisonLabel}
              value={currentRedeemedRewards}
              delta={redeemedDelta.value}
              icon="🎁"
              negative={redeemedDelta.negative}
              tint="cyan"
            />
            <StatCard
              label="Comment Card Rating"
              description="Average comment card rating when rating data is available."
              comparisonLabel={selectedComparisonLabel}
              value={`${currentCommentRating.toFixed(1).replace(/\.0$/, "")} / 5`}
              delta={commentRatingDelta.value}
              icon="▣"
              negative={commentRatingDelta.negative}
              tint="blue"
            />
            <StatCard
              label="Average Visits"
              description="Average visits per customer during the selected period."
              comparisonLabel={selectedComparisonLabel}
              value={averageVisits}
              delta={averageVisitsDelta.value}
              icon="▰"
              tint="purple"
              negative={averageVisitsDelta.negative}
            />
            <StatCard
              label="Repeat Rate"
              description="Percentage of customers with more than one visit in the selected period."
              comparisonLabel={selectedComparisonLabel}
              value={percentage(repeatRateNumber)}
              delta={repeatRateDelta.value}
              icon="↻"
              negative={repeatRateDelta.negative}
              tint="red"
            />
          </section>

          <section className="mt-4 grid grid-cols-12 gap-4">
            <ActivityOverview
              days={chart.days}
              stamps={chart.stampCounts}
              gifts={chart.giftCounts}
              visits={chart.visitCounts}
            />
            <SegmentPanel
              total={totalCustomers}
              active={activeCustomers}
              repeat={repeatCustomers}
              giftUsers={giftUsers}
              inactive={inactiveCustomers}
            />
          </section>

          <section className="mt-4 grid grid-cols-12 gap-4">
            <MetricList
              title="Loyalty Performance"
              rows={loyaltyRows}
              className="col-span-4 min-h-[250px]"
            />
            <TopInsights
              rows={topInsightRows}
              className="col-span-3 min-h-[250px]"
            />
            <NeedsAttention
              rows={attentionRows}
              className="col-span-5 min-h-[250px]"
            />
          </section>

          <section className="mt-4 grid grid-cols-12 gap-4">
            <CustomerSummary users={users} />
            <RecentActivity
              txns={filteredTxns.length ? filteredTxns : recentTxns}
              users={users}
              categoryNamesById={categoryNamesById}
            />
          </section>
        </section>
      </div>
    </main>
  );
}

export { AdminDashboard };
export default AdminDashboard;
