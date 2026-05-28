"use client";

import Image from "next/image";
import QRCode from "react-qr-code";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { ClientStamp, LoyaltyCategory, Profile } from "@/types";

type AnyRecord = Record<string, any>;

type DashboardReward = {
  id: string;
  status: "available" | "claimed" | "redeemed" | string;
  created_at?: string | null;
  earned_at?: string | null;
  redeemed_at?: string | null;
  reward_type?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  category?: { name?: string | null } | null;
  loyalty_categories?: { name?: string | null } | null;
  categories?: { name?: string | null } | null;
  loyalty_category?: { name?: string | null } | null;
};


type ClientDashboardProps = {
  profile: Profile;
  categories?: LoyaltyCategory[];
  initialStamps?: ClientStamp[];
  initialRewards?: DashboardReward[];
  stamps?: ClientStamp[];
  rewards?: DashboardReward[];
};

const PAGE_BG = "rgba(121, 134, 115, 0.24)";
const MAIN_CARD_COLOR = "#92534C";
const TITLE_COLOR = "#92534C";
const CARD_RADIUS = 10;

const DEFAULT_CATEGORY_ORDER = [
  "Sandwiches",
  "Main Courses",
  "Desserts",
  "Coffee",
  "Hooka",
];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pluralizeUpper(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}S`}`;
}

function normalizeCategoryName(name?: string | null) {
  const safeName = cleanText(name);
  const lower = safeName.toLowerCase();

  if (lower === "sandwich" || lower === "sandwiches") return "Sandwiches";
  if (lower === "main course" || lower === "main courses" || lower === "maincourse") return "Main Courses";
  if (lower === "dessert" || lower === "desserts") return "Desserts";
  if (lower === "coffee" || lower === "coffees") return "Coffee";
  if (lower === "desserts 2" || lower === "hooka" || lower === "hookah" || lower === "hookas" || lower === "hookahs") return "Hooka";

  return safeName || "Reward";
}

function makeCategoryMap(categories?: LoyaltyCategory[]) {
  const map = new Map<string, string>();

  for (const category of categories ?? []) {
    const record = category as AnyRecord;
    const id = cleanText(record.id);
    const name = normalizeCategoryName(record.name);
    if (id && name) map.set(id, name);
  }

  return map;
}

function extractCategoryName(item: unknown, categoryMap: Map<string, string>, fallbackIndex = 0) {
  const record = (item ?? {}) as AnyRecord;

  const categoryId = cleanText(record.category_id);
  if (categoryId && categoryMap.has(categoryId)) {
    return categoryMap.get(categoryId) || DEFAULT_CATEGORY_ORDER[fallbackIndex] || "Reward";
  }

  const directName =
    cleanText(record.category_name) ||
    cleanText(record.name) ||
    cleanText(record.category?.name) ||
    cleanText(record.loyalty_categories?.name) ||
    cleanText(record.categories?.name) ||
    cleanText(record.loyalty_category?.name);

  if (directName) return normalizeCategoryName(directName);

  const rewardType = cleanText(record.reward_type);
  if (rewardType) {
    return normalizeCategoryName(
      rewardType
        .replace(/^1\s+Free\s+/i, "")
        .replace(/^Free\s+/i, "")
        .replace(/\s+Item$/i, "")
        .trim()
    );
  }

  return DEFAULT_CATEGORY_ORDER[fallbackIndex] || "Reward";
}

function getSingularCategory(name: string) {
  const normalized = normalizeCategoryName(name);
  const map: Record<string, string> = {
    Sandwiches: "Sandwich",
    "Main Courses": "Main Course",
    Desserts: "Dessert",
    Coffee: "Coffee",
    Hooka: "Hooka",
  };
  return map[normalized] ?? normalized;
}

function getStampIcon(categoryName: string) {
  const lower = normalizeCategoryName(categoryName).toLowerCase();

  if (lower.includes("sandwich")) return "/sandwich.png";
  if (lower.includes("main course")) return "/main course.png";
  if (lower.includes("coffee")) return "/coffee.png";
  if (lower.includes("hooka") || lower.includes("hookah")) return "/hooka.png";
  if (lower.includes("dessert")) return "/gift.png";

  return "/gift.png";
}

function getRewardState(reward: DashboardReward) {
  if (reward.status === "available") return { label: "YOUR GIFT IS ON ITS WAY.", action: "CLAIM" };
  if (reward.status === "claimed") return { label: "YOUR GIFT IS ON ITS WAY.", action: "PENDING" };
  return { label: "CONFIRMED", action: "CONFIRMED" };
}

function isRedeemedRewardStillVisible(reward: DashboardReward) {
  if (reward.status !== "redeemed") return true;
  if (!reward.redeemed_at) return false;

  const redeemedAt = new Date(reward.redeemed_at).getTime();
  if (Number.isNaN(redeemedAt)) return false;
  return Date.now() - redeemedAt < 2 * 60 * 60 * 1000;
}

function rewardPalette(index: number) {
  const palettes = [
    { bg: "#798673", text: "#ffffff", subText: "#eef3ec", pillBg: "#f0cf61", pillText: "#1c2530" },
    { bg: "#c7867d", text: "#1c2530", subText: "#fff7f1", pillBg: "#f0cf61", pillText: "#1c2530" },
    { bg: "#5f879c", text: "#ffffff", subText: "#eef7fb", pillBg: "#f0cf61", pillText: "#1c2530" },
  ];

  return palettes[index % palettes.length];
}

function RewardCard({
  reward,
  index,
  categoryMap,
  onClaim,
}: {
  reward: DashboardReward;
  index: number;
  categoryMap: Map<string, string>;
  onClaim: (rewardId: string) => void;
}) {
  const palette = rewardPalette(index);
  const categoryName = extractCategoryName(reward, categoryMap, index);
  const state = getRewardState(reward);

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: CARD_RADIUS, background: palette.bg, minHeight: 100 }}
    >
      <div
        className="absolute left-0 top-1/2 h-[128px] w-[128px] -translate-x-[62%] -translate-y-1/2 rounded-full bg-white"
        aria-hidden="true"
      />

      <div className="relative flex min-h-[100px] items-center justify-between gap-4 py-4 pl-[92px] pr-4">
        <div className="absolute left-5 top-1/2 -translate-y-1/2">
          <Image src="/gift.png" alt="Gift" width={64} height={64} className="h-[64px] w-[64px] object-contain" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[18px] font-semibold uppercase" style={{ color: palette.text }}>
            {`1 FREE ${getSingularCategory(categoryName).toUpperCase()}`}
          </h3>
          <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.04em]" style={{ color: palette.subText }}>
            {state.label}
          </p>
        </div>

        <div className="shrink-0">
          {reward.status === "available" ? (
            <button
              type="button"
              onClick={() => onClaim(reward.id)}
              className="inline-flex min-w-[112px] items-center justify-center rounded-[10px] px-4 py-3 text-[14px] font-bold uppercase"
              style={{ background: palette.pillBg, color: palette.pillText }}
            >
              {state.action}
            </button>
          ) : (
            <div
              className="inline-flex min-w-[112px] items-center justify-center rounded-[10px] px-4 py-3 text-[14px] font-bold uppercase"
              style={{ background: palette.pillBg, color: palette.pillText }}
            >
              {state.action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StampRow({ item, index, categoryMap }: { item: ClientStamp; index: number; categoryMap: Map<string, string> }) {
  const count = Math.max(0, Math.min(5, Number((item as AnyRecord).stamp_count ?? 0)));
  const categoryName = extractCategoryName(item, categoryMap, index);
  const iconSrc = getStampIcon(categoryName);
  const lastActiveIndex = count > 0 ? count - 1 : -1;

  return (
    <div>
      <h3 className="text-[18px] font-semibold uppercase text-[#0f2b3a]">{categoryName}</h3>

      <div className="mt-4 flex gap-3">
        {Array.from({ length: 5 }).map((_, stampIndex) => {
          const filled = stampIndex < count;
          const isLastActive = stampIndex === lastActiveIndex && count > 0;

          return (
            <div
              key={stampIndex}
              className={`flex h-[60px] w-[60px] items-center justify-center rounded-full border ${
                filled
                  ? isLastActive
                    ? "border-[#d1645f] bg-[#fff6e6]"
                    : "border-transparent bg-[#fff6e6]"
                  : "border-[#d9d9d9] border-dashed bg-white"
              }`}
            >
              {filled ? (
                <Image src={iconSrc} alt={categoryName} width={34} height={34} className="h-[34px] w-[34px] object-contain" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ClientDashboard({
  profile,
  categories = [],
  initialStamps,
  initialRewards,
  stamps,
  rewards,
}: ClientDashboardProps) {
  const [localRewards, setLocalRewards] = useState<DashboardReward[]>((rewards ?? initialRewards ?? []) as DashboardReward[]);

  useEffect(() => {
    setLocalRewards((rewards ?? initialRewards ?? []) as DashboardReward[]);
  }, [rewards, initialRewards]);

  const categoryMap = useMemo(() => makeCategoryMap(categories), [categories]);
  const stampRows = (stamps ?? initialStamps ?? []) as ClientStamp[];

  const totalStamps = useMemo(() => {
    return stampRows.reduce((sum, item) => sum + Math.max(0, Number((item as AnyRecord).stamp_count ?? 0)), 0);
  }, [stampRows]);

  const visibleRewards = useMemo(() => {
    return localRewards.filter(
      (reward) => ["available", "claimed", "redeemed"].includes(reward.status) && isRedeemedRewardStillVisible(reward)
    );
  }, [localRewards]);

  async function handleClaim(rewardId: string) {
    setLocalRewards((current) => current.map((reward) => (reward.id === rewardId ? { ...reward, status: "claimed" } : reward)));

    try {
      const response = await fetch("/api/reward/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId }),
      });

      if (!response.ok) throw new Error("Failed to claim reward");
    } catch {
      setLocalRewards((current) => current.map((reward) => (reward.id === rewardId ? { ...reward, status: "available" } : reward)));
    }
  }

  const displayName = (profile.full_name || "CLIENT").toUpperCase();

  return (
    <AppShell
      title="Loyalty Program"
      roleLabel=""
      headerBackground={PAGE_BG}
      pageBackground={PAGE_BG}
      logoSrc="/pros-logo-basic.png"
      logoAlt="PRO's Logo"
    >
      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-4">
        <section
          className="relative overflow-hidden px-5 py-5"
          style={{ borderRadius: CARD_RADIUS, backgroundColor: MAIN_CARD_COLOR, minHeight: 230 }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "url('/client-main-card.png'), url('/client main card.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              transform: "scale(1.08)",
              transformOrigin: "center",
            }}
            aria-hidden="true"
          />

          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 pt-0.5">
                <p className="text-[18px] font-light uppercase tracking-[0.03em] text-white">HELLO</p>
                <h1 className="mt-1 truncate text-[22px] font-black uppercase text-[#f0cf61]">{displayName},</h1>
              </div>

              <div className="shrink-0 bg-white p-2" style={{ borderRadius: 8 }}>
                <QRCode value={profile.client_code || profile.id} size={82} bgColor="transparent" fgColor="#243744" />
              </div>
            </div>

            <div className="flex min-h-[98px] flex-col justify-center gap-3">
              <div className="flex items-center gap-2 text-[16px] font-medium uppercase text-white">
                <Image src="/medal.png" alt="Rewards" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                <span>{pluralizeUpper(visibleRewards.length, "REWARD")}</span>
              </div>

              <div className="flex items-center gap-2 text-[16px] font-medium uppercase text-white">
                <Image src="/approved.png" alt="Stamps" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                <span>{pluralizeUpper(totalStamps, "STAMP")}</span>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-[10px] bg-[#f0cf61] px-5 py-3 text-[15px] font-bold uppercase text-[#1c2530]"
            >
              MESSAGE US
            </button>
          </div>
        </section>

        {visibleRewards.length > 0 && (
          <section className="mt-10">
            <div className="mb-5">
              <h2 className="text-[28px] font-black uppercase leading-none" style={{ color: TITLE_COLOR }}>
                MY GIFTS
              </h2>
            </div>

            <div className="space-y-6">
              {visibleRewards.map((reward, index) => (
                <RewardCard key={reward.id} reward={reward} index={index} categoryMap={categoryMap} onClaim={handleClaim} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-[28px] font-black uppercase leading-none" style={{ color: TITLE_COLOR }}>
              MY STAMPS
            </h2>
          </div>

          <div className="bg-white px-5 py-5" style={{ borderRadius: CARD_RADIUS }}>
            <div className="space-y-6">
              {stampRows.map((item, index) => (
                <StampRow key={(item as AnyRecord).category_id || (item as AnyRecord).id || index} item={item} index={index} categoryMap={categoryMap} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default ClientDashboard;
