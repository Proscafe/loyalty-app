"use client";

import Image from "next/image";
import QRCode from "react-qr-code";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import type { ClientReward, ClientStamp, LoyaltyCategory, Profile } from "@/types";

type AnyRecord = Record<string, any>;

type ClientDashboardProps = {
  profile: Profile;
  categories?: LoyaltyCategory[];
  initialStamps?: ClientStamp[];
  initialRewards?: ClientReward[];
  stamps?: ClientStamp[];
  rewards?: ClientReward[];
};

const PAGE_BG =
  "radial-gradient(circle at 16% 0%, rgba(207, 133, 124, 0.96) 0, rgba(207, 133, 124, 0.72) 30%, rgba(207, 133, 124, 0) 56%), radial-gradient(circle at 70% 78%, rgba(146, 83, 76, 0.98) 0, rgba(146, 83, 76, 0.78) 34%, rgba(146, 83, 76, 0) 62%), linear-gradient(155deg, #cf857c 0%, #b76d66 45%, #92534C 100%)";
const HEADER_BG = "rgba(146, 83, 76, 0.72)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))";
const GLASS_CARD_DARK =
  "linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.045))";
const BRAND_YELLOW = "#f0cf61";
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

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function pluralizeTitle(count: number, singular: string, plural?: string) {
  const label = count === 1 ? singular : plural ?? `${singular}s`;
  return `${count} ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function normalizeCategoryName(name?: string | null) {
  const safeName = cleanText(name);
  const lower = safeName.toLowerCase();

  if (lower === "sandwich" || lower === "sandwiches") return "Sandwiches";
  if (lower === "main course" || lower === "main courses" || lower === "maincourse") return "Main Courses";
  if (lower === "dessert" || lower === "desserts") return "Desserts";
  if (lower === "coffee" || lower === "coffees") return "Coffee";
  if (
    lower === "desserts 2" ||
    lower === "hooka" ||
    lower === "hookah" ||
    lower === "hookas" ||
    lower === "hookahs"
  ) {
    return "Hooka";
  }

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

function getStampTheme(categoryName: string) {
  const lower = normalizeCategoryName(categoryName).toLowerCase();

  if (lower.includes("sandwich")) {
    return {
      fill: "rgba(240, 207, 97, 0.22)",
      stroke: "#f0cf61",
      asset: "/star.png",
    };
  }

  if (lower.includes("main course")) {
    return {
      fill: "rgba(146, 83, 76, 0.22)",
      stroke: "#92534C",
      asset: "/star (3).png",
    };
  }

  if (lower.includes("dessert")) {
    return {
      fill: "rgba(121, 134, 115, 0.24)",
      stroke: "#798673",
      asset: "/star 2.png",
    };
  }

  if (lower.includes("coffee")) {
    return {
      fill: "rgba(95, 135, 156, 0.24)",
      stroke: "#5f879c",
      asset: "/star (1).png",
    };
  }

  if (lower.includes("hooka") || lower.includes("hookah")) {
    return {
      fill: "rgba(240, 207, 97, 0.22)",
      stroke: "#f0cf61",
      asset: "/star.png",
    };
  }

  return {
    fill: "rgba(255, 255, 255, 0.16)",
    stroke: "#ffffff",
    asset: "/star.png",
  };
}

function StampStar({
  filled,
  categoryName,
}: {
  filled: boolean;
  categoryName: string;
}) {
  const theme = getStampTheme(categoryName);

  return (
    <div className="relative flex aspect-square w-[clamp(54px,13.5vw,76px)] shrink-0 items-center justify-center">
      {filled ? (
        <img
          src={theme.asset}
          alt={`${categoryName} stamp`}
          className="relative z-10 h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <polygon
            points="50,5 61,36 94,36 67,56 78,89 50,69 22,89 33,56 6,36 39,36"
            fill="transparent"
            stroke="rgba(255,255,255,0.48)"
            strokeWidth={2.4}
            strokeDasharray="4 4"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

function getRewardState(reward: ClientReward) {
  if (reward.status === "available") return { label: "Ready to claim", action: "Claim" };
  if (reward.status === "claimed") return { label: "Your gift is on its way.", action: "Pending" };
  return { label: "Confirmed", action: "Confirmed" };
}

function ConfirmedGiftCheck() {
  return (
    <div className="flex h-[38px] w-full items-center justify-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#14a66b] shadow-[0_10px_30px_rgba(20,166,107,0.26)]">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
    </div>
  );
}

function isRedeemedRewardStillVisible(reward: ClientReward) {
  if (reward.status !== "redeemed") return true;
  if (!reward.redeemed_at) return false;

  const redeemedAt = new Date(reward.redeemed_at).getTime();
  if (Number.isNaN(redeemedAt)) return false;
  return Date.now() - redeemedAt < 2 * 60 * 60 * 1000;
}

function GiftCarouselCard({
  reward,
  index,
  categoryMap,
  onClaim,
}: {
  reward: ClientReward;
  index: number;
  categoryMap: Map<string, string>;
  onClaim: (rewardId: string) => void;
}) {
  const categoryName = extractCategoryName(reward, categoryMap, index);
  const state = getRewardState(reward);
  const title = `Free ${getSingularCategory(categoryName)}`;

  return (
    <div
      className="relative flex h-[205px] w-[184px] shrink-0 snap-start flex-col items-center overflow-hidden border border-white/15 px-4 py-4 backdrop-blur-xl"
      style={{
        borderRadius: 18,
        background: GLASS_CARD,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04) 48%, rgba(255,255,255,0.02))",
        }}
      />

      <div className="relative mt-0 flex h-[82px] w-[82px] items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#f0cf61]/22 blur-md" />
        <div className="absolute h-[70px] w-[70px] rounded-full bg-white/14 shadow-inner" />
        <Image
          src="/gift.png"
          alt="Gift"
          width={72}
          height={72}
          className="relative h-[72px] w-[72px] object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.34)]"
        />
      </div>

      <div className="relative mt-2 flex h-[40px] w-full items-center justify-center">
        {reward.status === "available" ? (
          <button
            type="button"
            onClick={() => onClaim(reward.id)}
            className="w-full rounded-[10px] bg-[#f0cf61] px-3 py-2.5 text-[13px] font-bold text-[#1c2530]"
          >
            {state.action}
          </button>
        ) : reward.status === "redeemed" ? (
          <ConfirmedGiftCheck />
        ) : (
          <div className="w-full rounded-[10px] bg-[#f0cf61] px-3 py-2.5 text-center text-[13px] font-bold text-[#1c2530]">
            {state.action}
          </div>
        )}
      </div>

      <div className="relative mt-3 w-full text-center">
        <h3 className="truncate text-[16px] font-bold text-white">
          {title}
        </h3>
        {reward.status !== "redeemed" ? (
          <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-tight text-white/75">
            {state.label}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StampRow({ item, index, categoryMap }: { item: ClientStamp; index: number; categoryMap: Map<string, string> }) {
  const count = Math.max(0, Math.min(5, Number((item as AnyRecord).stamp_count ?? 0)));
  const categoryName = extractCategoryName(item, categoryMap, index);

  return (
    <div>
      <h3 className="text-[18px] font-semibold text-white">{categoryName}</h3>

      <div className="mt-4 flex w-full items-center justify-between gap-2">
        {Array.from({ length: 5 }).map((_, stampIndex) => {
          const filled = stampIndex < count;
          return (
            <StampStar
              key={stampIndex}
              filled={filled}
              categoryName={categoryName}
            />
          );
        })}
      </div>
    </div>
  );
}


function RewardCelebrationModal({
  reward,
  categoryMap,
  onClose,
}: {
  reward: ClientReward;
  categoryMap: Map<string, string>;
  onClose: () => void;
}) {
  const categoryName = extractCategoryName(reward, categoryMap, 0);
  const giftName = getSingularCategory(categoryName);

  const confettiPieces = [
    ["44%", "-150px", "-80px", "0s", "#f0cf61"],
    ["48%", "-95px", "-120px", "0.05s", "#ffffff"],
    ["52%", "-40px", "-145px", "0.1s", "#798673"],
    ["56%", "35px", "-135px", "0.15s", "#f0cf61"],
    ["50%", "105px", "-105px", "0.2s", "#ffffff"],
    ["46%", "150px", "-70px", "0.25s", "#5f879c"],
    ["54%", "-130px", "5px", "0.3s", "#f0cf61"],
    ["42%", "120px", "15px", "0.35s", "#ffffff"],
    ["58%", "-80px", "70px", "0.4s", "#798673"],
    ["50%", "80px", "85px", "0.45s", "#f0cf61"],
    ["47%", "-20px", "120px", "0.5s", "#ffffff"],
    ["53%", "25px", "130px", "0.55s", "#5f879c"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <style jsx>{`
        @keyframes confettiBurstBehindGift {
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg) scale(0.4);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          55% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--x), var(--y), 0) rotate(760deg) scale(1);
            opacity: 0;
          }
        }

        .gift-confetti-piece {
          position: absolute;
          top: 96px;
          left: var(--l);
          z-index: 1;
          width: 8px;
          height: 15px;
          border-radius: 2px;
          background: var(--c);
          animation: confettiBurstBehindGift 1.15s cubic-bezier(0.18, 0.78, 0.28, 1) infinite;
          animation-delay: var(--d);
          will-change: transform, opacity;
        }
      `}</style>

      <button
        type="button"
        aria-label="Close celebration"
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative z-[55] w-full max-w-[330px] overflow-visible px-6 py-8 text-center backdrop-blur-2xl"
        style={{
          borderRadius: 22,
          background:
            "linear-gradient(145deg, rgba(207,133,124,0.84), rgba(146,83,76,0.8))",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden opacity-45"
          style={{
            borderRadius: 22,
            backgroundImage: "url('/client-main-card.png'), url('/client main card.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            transform: "scale(1.16)",
            transformOrigin: "center",
          }}
        />

        <div className="pointer-events-none absolute inset-0 z-[1] overflow-visible">
          {confettiPieces.map(([left, x, y, delay, color], index) => (
            <span
              key={index}
              className="gift-confetti-piece"
              style={
                {
                  "--l": left,
                  "--x": x,
                  "--y": y,
                  "--d": delay,
                  "--c": color,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="relative mx-auto flex h-[112px] w-[112px] items-center justify-center">
            <div className="absolute h-[104px] w-[104px] rounded-full bg-[#f0cf61]/24 blur-xl" />
            <Image
              src="/gift.png"
              alt="Gift"
              width={100}
              height={100}
              className="relative z-20 h-[100px] w-[100px] object-contain drop-shadow-[0_20px_26px_rgba(0,0,0,0.32)]"
            />
          </div>

          <h2 className="mt-5 text-[28px] font-black leading-tight text-white">
            You earned a free {giftName}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="mt-7 w-full rounded-[12px] bg-[#f0cf61] px-4 py-3 text-[14px] font-black text-[#1c2530]"
          >
            Congratulations
          </button>
        </div>
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
  const router = useRouter();
  const [localRewards, setLocalRewards] = useState<ClientReward[]>((rewards ?? initialRewards ?? []) as ClientReward[]);
  const [celebrationReward, setCelebrationReward] = useState<ClientReward | null>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenRewardIdsRef = useRef<Set<string>>(
    new Set((rewards ?? initialRewards ?? []).map((reward) => reward.id))
  );

  useEffect(() => {
    setLocalRewards((rewards ?? initialRewards ?? []) as ClientReward[]);
  }, [rewards, initialRewards]);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      router.refresh();
    }, 5000);

    return () => window.clearInterval(refreshInterval);
  }, [router]);

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

  useEffect(() => {
    const newestReward = visibleRewards.find((reward) => {
      const isNew = !seenRewardIdsRef.current.has(reward.id);
      return isNew && (reward.status === "available" || reward.status === "claimed");
    });

    visibleRewards.forEach((reward) => seenRewardIdsRef.current.add(reward.id));

    if (!newestReward) return;

    setCelebrationReward(newestReward);

    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current);
    }

    celebrationTimerRef.current = setTimeout(() => {
      setCelebrationReward(null);
    }, 8000);

    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
    };
  }, [visibleRewards]);

  async function handleClaim(rewardId: string) {
    setLocalRewards((current) => current.map((reward) => (reward.id === rewardId ? { ...reward, status: "claimed" } : reward)));

    try {
      const response = await fetch("/api/reward/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reward_id: rewardId, rewardId }),
      });

      if (!response.ok) throw new Error("Failed to claim reward");
    } catch {
      setLocalRewards((current) => current.map((reward) => (reward.id === rewardId ? { ...reward, status: "available" } : reward)));
    }
  }

  const displayName = toTitleCase(profile.full_name || "Client");

  return (
    <AppShell
      title="Loyalty Program"
      roleLabel=""
      headerBackground={HEADER_BG}
      pageBackground={PAGE_BG}
      logoSrc="/pros-logo-basic.png"
      logoAlt="PRO's Logo"
    >
      <style jsx global>{`
        @keyframes prosGradientFloat {
          0% {
            transform: translate3d(-2%, -1%, 0) scale(1.04);
          }
          50% {
            transform: translate3d(3%, 2%, 0) scale(1.1);
          }
          100% {
            transform: translate3d(-2%, -1%, 0) scale(1.04);
          }
        }

        .pros-client-moving-bg {
          position: fixed;
          inset: -18%;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 18% 8%, rgba(207, 133, 124, 0.95) 0, rgba(207, 133, 124, 0.7) 24%, rgba(207, 133, 124, 0) 45%),
            radial-gradient(circle at 58% 72%, rgba(146, 83, 76, 0.98) 0, rgba(146, 83, 76, 0.78) 28%, rgba(146, 83, 76, 0) 52%),
            linear-gradient(145deg, #cf857c 0%, #b76d66 45%, #92534c 100%);
          animation: prosGradientFloat 14s ease-in-out infinite;
          will-change: transform;
        }

        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="pros-client-moving-bg" aria-hidden="true" />

      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-12 pt-4">
        <section
          className="relative overflow-hidden border border-white/15 px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl"
          style={{ borderRadius: 18, background: GLASS_CARD_DARK, minHeight: 236 }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage: "url('/client-main-card.png'), url('/client main card.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              transform: "scale(1.14)",
              transformOrigin: "center",
            }}
            aria-hidden="true"
          />

          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 pt-0.5">
                <h1 className="text-[24px] font-black leading-tight text-white">
                  Hello, <span className="text-[#f0cf61]">{displayName}</span>
                </h1>
                <p className="mt-2 text-[15px] font-medium text-white/70">
                  Let&apos;s earn more stamps!
                </p>
              </div>

              <div className="shrink-0 bg-white/95 p-2" style={{ borderRadius: 8 }}>
                <QRCode value={profile.client_code || profile.id} size={82} bgColor="transparent" fgColor="#243744" />
              </div>
            </div>

            <div className="mt-6 flex min-h-[58px] flex-col justify-center gap-3">
              <div className="flex items-center gap-2 text-[15px] font-medium text-white/90">
                <Image src="/medal.png" alt="Rewards" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                <span>{pluralizeTitle(visibleRewards.length, "reward")}</span>
              </div>

              <div className="flex items-center gap-2 text-[15px] font-medium text-white/90">
                <Image src="/approved.png" alt="Stamps" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                <span>{pluralizeTitle(totalStamps, "stamp")}</span>
              </div>
            </div>

            <button
              type="button"
              className="mt-5 inline-flex items-center justify-center rounded-[10px] bg-[#f0cf61] px-5 py-3 text-[15px] font-bold text-[#1c2530]"
            >
              Message Us
            </button>
          </div>
        </section>

        {visibleRewards.length > 0 && (
          <section className="mt-10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[22px] font-black leading-none text-white">
                My Gifts
              </h2>

            </div>

            <div className="-mx-4 overflow-x-scroll px-4 pb-2 hide-scrollbar touch-pan-x overscroll-x-contain snap-x snap-mandatory" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="flex w-max gap-4">
                {visibleRewards.map((reward, index) => (
                  <GiftCarouselCard
                    key={reward.id}
                    reward={reward}
                    index={index}
                    categoryMap={categoryMap}
                    onClaim={handleClaim}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-[22px] font-black leading-none text-white">
              My Stamps
            </h2>
          </div>

          <div
            className="border border-white/15 px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl"
            style={{ borderRadius: 18, background: GLASS_CARD }}
          >
            <div className="space-y-6">
              {stampRows.map((item, index) => (
                <StampRow key={(item as AnyRecord).category_id || (item as AnyRecord).id || index} item={item} index={index} categoryMap={categoryMap} />
              ))}
            </div>
          </div>
        </section>
        {celebrationReward ? (
          <RewardCelebrationModal
            reward={celebrationReward}
            categoryMap={categoryMap}
            onClose={() => setCelebrationReward(null)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

export default ClientDashboard;
