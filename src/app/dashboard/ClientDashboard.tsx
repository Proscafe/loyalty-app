"use client";

import Image from "next/image";
import QRCode from "react-qr-code";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
type Profile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  client_code?: string | null;
  role?: string | null;
};

type LoyaltyCategory = {
  id?: string;
  name?: string;
};

type ClientStamp = {
  id?: string;
  category_id?: string | null;
  stamp_count?: number | null;
};

type ClientReward = {
  id: string;
  client_id?: string | null;
  category_id?: string | null;
  reward_type?: string | null;
  status?: "available" | "claimed" | "redeemed" | string;
  created_at?: string | null;
  earned_at?: string | null;
  redeemed_at?: string | null;
  claimed_at?: string | null;
  expires_at?: string | null;
  is_birthday_reward?: boolean;
  gift_icon?: string;
};

type AnyRecord = Record<string, any>;

type ClientDashboardProps = {
  profile: Profile;
  categories?: unknown[];
  initialStamps?: unknown[];
  initialRewards?: unknown[];
  stamps?: unknown[];
  rewards?: unknown[];
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

  for (const category of (categories ?? []) as LoyaltyCategory[]) {
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
      asset: "/star-blue.png",
    };
  }

  if (lower.includes("coffee")) {
    return {
      fill: "rgba(95, 135, 156, 0.24)",
      stroke: "#5f879c",
      asset: "/star-green.png",
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
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="relative flex aspect-square w-[clamp(54px,13.5vw,76px)] shrink-0 items-center justify-center">
      {filled && !imageFailed ? (
        <img
          src={theme.asset}
          alt={`${categoryName} stamp`}
          className="relative z-10 h-full w-full object-contain"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      ) : filled ? (
        <svg
          viewBox="0 0 100 100"
          className="relative z-10 h-full w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.18)]"
          aria-label={`${categoryName} stamp`}
        >
          <polygon
            points="50,5 61,36 94,36 67,56 78,89 50,69 22,89 33,56 6,36 39,36"
            fill={theme.stroke}
            stroke={theme.stroke}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </svg>
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

function isBirthdayToday(birthday?: string | null) {
  if (!birthday) return false;

  const today = new Date();
  const raw = String(birthday);

  const monthDayMatch = raw.match(/(?:^\d{4}-)?(\d{2})-(\d{2})/);
  if (monthDayMatch) {
    const month = Number(monthDayMatch[1]);
    const day = Number(monthDayMatch[2]);

    return today.getMonth() + 1 === month && today.getDate() === day;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return false;

  return today.getMonth() === parsed.getMonth() && today.getDate() === parsed.getDate();
}

function getTodayStorageDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getBirthdayPopupStorageKey(profileId: string) {
  return `pros-birthday-popup-shown-${profileId}-${getTodayStorageDate()}`;
}

const BIRTHDAY_REWARD_TYPES = ["20% Discount", "Free Dessert"];

function isBirthdayRewardType(value?: string | null) {
  return BIRTHDAY_REWARD_TYPES.includes(String(value || ""));
}

function makeBirthdayRewards(profile: Profile): ClientReward[] {
  const today = new Date().toISOString();

  return [
    {
      id: `birthday-discount-${profile.id}`,
      reward_type: "20% Discount",
      status: "available",
      created_at: today,
      earned_at: today,
      is_birthday_reward: true,
      gift_icon: "/birthday-cake.png",
    },
    {
      id: `birthday-dessert-${profile.id}`,
      reward_type: "Free Dessert",
      status: "available",
      created_at: today,
      earned_at: today,
      is_birthday_reward: true,
      gift_icon: "/birthday-cake.png",
    },
  ];
}

function getRewardState(reward: ClientReward) {
  if (reward.status === "available") return { label: "Ready to claim", action: "Claim" };
  if (reward.status === "claimed") return { label: "Your gift is on its way.", action: "Pending" };
  if (reward.status === "expired") return { label: "Expired", action: "Expired" };
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

function rewardExpiryDate(reward: ClientReward) {
  const expiresAt = reward.expires_at
    ? new Date(reward.expires_at).getTime()
    : new Date(reward.earned_at || reward.created_at || Date.now()).getTime() + 30 * 24 * 60 * 60 * 1000;

  return Number.isNaN(expiresAt) ? null : expiresAt;
}

function isExpiredRewardStillVisible(reward: ClientReward) {
  if (reward.status !== "expired") return true;

  const expiresAt = rewardExpiryDate(reward);
  if (!expiresAt) return false;

  return Date.now() - expiresAt < 2 * 60 * 60 * 1000;
}

function getValidityLabel(reward: ClientReward) {
  if (reward.is_birthday_reward) return null;
  if (reward.status === "redeemed") return null;

  const expiresAt = rewardExpiryDate(reward);
  if (!expiresAt) return null;

  const now = Date.now();

  if (reward.status === "expired" || now > expiresAt) {
    return "Expired";
  }

  const msLeft = expiresAt - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

  if (daysLeft > 5) return null;
  if (daysLeft <= 1) return "Expires today";

  return `Valid for ${daysLeft} days`;
}

function isExpiryUrgent(label: string | null) {
  return label === "Expires today" || label === "Expired";
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
  const isBirthdayReward = Boolean(reward.is_birthday_reward || isBirthdayRewardType(reward.reward_type));
  const title = isBirthdayReward
    ? reward.reward_type || "Birthday Gift"
    : `Free ${getSingularCategory(categoryName)}`;
  const giftIcon = isBirthdayReward ? "/birthday-cake.png" : reward.gift_icon || "/gift.png";
  const validityLabel = getValidityLabel(reward);
  const urgentValidity = isExpiryUrgent(validityLabel);

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

      {validityLabel ? (
        <div
          className={`absolute right-2 top-2 z-10 rounded-[9px] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.06em] ${
            urgentValidity ? "bg-[#ef4444] text-white" : "bg-white/16 text-white"
          }`}
        >
          {validityLabel}
        </div>
      ) : null}

      <div className="relative mt-0 flex h-[82px] w-[82px] items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#f0cf61]/22 blur-md" />
        <div className="absolute h-[70px] w-[70px] rounded-full bg-white/14 shadow-inner" />
        <Image
          src={giftIcon}
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
  onClaim,
}: {
  reward: ClientReward;
  categoryMap: Map<string, string>;
  onClose: () => void;
  onClaim: (rewardId: string) => void;
}) {
  const categoryName = extractCategoryName(reward, categoryMap, 0);
  const giftName = getSingularCategory(categoryName);
  const isBirthdayReward = Boolean(reward.is_birthday_reward || isBirthdayRewardType(reward.reward_type));
  const birthdayGiftName = reward.reward_type || "birthday gift";
  const modalIcon = isBirthdayReward ? "/birthday-cake.png" : reward.gift_icon || "/gift.png";

  const confettiPieces = [
    ["8%", "-120px", "0s", "#f0cf61"],
    ["18%", "-80px", "0.08s", "#ffffff"],
    ["28%", "-150px", "0.16s", "#798673"],
    ["38%", "-60px", "0.24s", "#f0cf61"],
    ["48%", "-130px", "0.32s", "#ffffff"],
    ["58%", "90px", "0.4s", "#5f879c"],
    ["68%", "130px", "0.48s", "#f0cf61"],
    ["78%", "70px", "0.56s", "#ffffff"],
    ["88%", "150px", "0.64s", "#798673"],
    ["13%", "120px", "0.72s", "#f0cf61"],
    ["33%", "40px", "0.8s", "#ffffff"],
    ["53%", "-40px", "0.88s", "#5f879c"],
    ["73%", "-110px", "0.96s", "#f0cf61"],
    ["93%", "110px", "1.04s", "#ffffff"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <style>{`
        @keyframes confettiPop {
          0% {
            transform: translate3d(0, -80px, 0) rotate(0deg) scale(0.6);
            opacity: 0;
          }
          12% {
            opacity: 1;
            transform: translate3d(0, -20px, 0) rotate(80deg) scale(1);
          }
          100% {
            transform: translate3d(var(--x), 105vh, 0) rotate(980deg) scale(0.85);
            opacity: 0;
          }
        }

        .confetti-piece {
          position: fixed;
          top: -24px;
          left: var(--l);
          z-index: 60;
          width: 9px;
          height: 16px;
          border-radius: 2px;
          background: var(--c);
          animation: confettiPop 1.45s cubic-bezier(0.18, 0.78, 0.28, 1) infinite;
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

      <div className="pointer-events-none fixed inset-0 z-[60] overflow-visible">
        {confettiPieces.map(([left, x, delay, color], index) => (
          <span
            key={index}
            className="confetti-piece"
            style={
              {
                "--l": left,
                "--x": x,
                "--d": delay,
                "--c": color,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div
        className="relative z-[55] w-full max-w-[330px] overflow-hidden px-6 py-8 text-center backdrop-blur-2xl"
        style={{
          borderRadius: 22,
          background:
            "linear-gradient(145deg, rgba(207,133,124,0.84), rgba(146,83,76,0.8))",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage: "url('/client-main-card.png'), url('/client main card.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            transform: "scale(1.16)",
            transformOrigin: "center",
          }}
        />

        <div className="relative z-10">
          <div className="mx-auto flex h-[112px] w-[112px] items-center justify-center">
            <div className="absolute h-[104px] w-[104px] rounded-full bg-[#f0cf61]/24 blur-xl" />
            <Image
              src={modalIcon}
              alt="Gift"
              width={100}
              height={100}
              className="relative h-[100px] w-[100px] object-contain drop-shadow-[0_20px_26px_rgba(0,0,0,0.32)]"
            />
          </div>

          {isBirthdayReward ? (
            <div className="mt-5">
              <h2 className="text-[28px] font-black leading-tight text-white">
                Happy birthday!
              </h2>
              <p className="mt-3 text-[17px] font-bold leading-6 text-white/85">
                You unlocked a {birthdayGiftName} gift.
              </p>
            </div>
          ) : (
            <h2 className="mt-5 text-[28px] font-black leading-tight text-white">
              You earned a free {giftName}
            </h2>
          )}

          <button
            type="button"
            onClick={() => {
              if (isBirthdayReward) {
                onClaim(reward.id);
                onClose();
                return;
              }

              onClose();
            }}
            className="mt-7 w-full rounded-[12px] bg-[#f0cf61] px-4 py-3 text-[14px] font-black text-[#1c2530]"
          >
            {isBirthdayReward ? "Claim gift" : "Congratulations"}
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
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenRewardIdsRef = useRef<Set<string>>(
    new Set(((rewards ?? initialRewards ?? []) as ClientReward[]).map((reward) => reward.id))
  );

  useEffect(() => {
    setLocalRewards((rewards ?? initialRewards ?? []) as ClientReward[]);
  }, [rewards, initialRewards]);

  useEffect(() => {
    let lastRefresh = Date.now();

    function refreshWhenActive() {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();

      if (now - lastRefresh < 30000) return;

      lastRefresh = now;
      router.refresh();
    }

    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [router]);

  const categoryMap = useMemo(
    () => makeCategoryMap((categories ?? []) as LoyaltyCategory[]),
    [categories],
  );
  const stampRows = (stamps ?? initialStamps ?? []) as ClientStamp[];

  const totalStamps = useMemo(() => {
    return stampRows.reduce((sum, item) => sum + Math.max(0, Number((item as AnyRecord).stamp_count ?? 0)), 0);
  }, [stampRows]);

  const displayName = toTitleCase(profile.full_name || "Client");
  const hasBirthdayToday = isBirthdayToday((profile as AnyRecord).birthday as string | null | undefined);

  const visibleRewards = useMemo(() => {
    const baseRewards = localRewards.filter(
      (reward) =>
        ["available", "claimed", "redeemed", "expired"].includes(reward.status ?? "") &&
        isRedeemedRewardStillVisible(reward) &&
        isExpiredRewardStillVisible(reward)
    );

    if (!hasBirthdayToday) return baseRewards;

    const existingBirthdayRewards = new Set(
      baseRewards
        .filter((reward) => reward.is_birthday_reward || isBirthdayRewardType(reward.reward_type))
        .map((reward) => String(reward.reward_type || "")),
    );

    const birthdayRewards = makeBirthdayRewards(profile).filter(
      (reward) => !existingBirthdayRewards.has(String(reward.reward_type || "")),
    );

    return [...birthdayRewards, ...baseRewards];
  }, [hasBirthdayToday, localRewards, profile]);

  useEffect(() => {
    const birthdayPopupKey = getBirthdayPopupStorageKey(profile.id);
    const birthdayPopupAlreadyShown =
      typeof window !== "undefined" && window.localStorage.getItem(birthdayPopupKey) === "true";

    const newestReward = visibleRewards.find((reward) => {
      const isNew = !seenRewardIdsRef.current.has(reward.id);

      if (!isNew || (reward.status !== "available" && reward.status !== "claimed")) {
        return false;
      }

      if (reward.is_birthday_reward && birthdayPopupAlreadyShown) {
        return false;
      }

      return true;
    });

    visibleRewards.forEach((reward) => seenRewardIdsRef.current.add(reward.id));

    if (!newestReward) return;

    if (newestReward.is_birthday_reward && typeof window !== "undefined") {
      window.localStorage.setItem(birthdayPopupKey, "true");
    }

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
  }, [profile.id, visibleRewards]);

  async function handleClaim(rewardId: string) {
    if (rewardId.startsWith("birthday-")) {
      const birthdayReward = makeBirthdayRewards(profile).find((reward) => reward.id === rewardId);

      if (!birthdayReward) return;

      setLocalRewards((current) => [
        { ...birthdayReward, status: "claimed" },
        ...current.filter((reward) => reward.id !== rewardId && reward.reward_type !== birthdayReward.reward_type),
      ]);

      try {
        const response = await fetch("/api/reward/birthday-claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reward_type: birthdayReward.reward_type }),
        });

        const json = await response.json().catch(() => null);

        if (!response.ok || !json?.reward) {
          throw new Error(json?.error ?? "Failed to claim birthday reward");
        }

        setLocalRewards((current) => [
          {
            ...(json.reward as ClientReward),
            is_birthday_reward: true,
            gift_icon: "/birthday-cake.png",
          },
          ...current.filter((reward) => reward.id !== rewardId && reward.reward_type !== birthdayReward.reward_type),
        ]);

        router.refresh();
      } catch {
        setLocalRewards((current) =>
          current.filter((reward) => reward.id !== rewardId && reward.reward_type !== birthdayReward.reward_type),
        );
      }

      return;
    }

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

  async function sendFeedback() {
    const message = feedbackMessage.trim();

    if (!message) {
      setFeedbackStatus("Please write your feedback first.");
      return;
    }

    setIsSendingFeedback(true);
    setFeedbackStatus(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          client_id: profile.id,
          client_name: profile.full_name,
          client_email: profile.email,
          client_phone: profile.phone,
          client_code: profile.client_code,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(json?.error || "Could not send feedback.");
      }

      setFeedbackMessage("");
      setFeedbackStatus("Feedback sent! Thanks for sharing.");
      window.setTimeout(() => {
        setIsFeedbackOpen(false);
        setFeedbackStatus(null);
      }, 5000);
    } catch (error) {
      setFeedbackStatus(error instanceof Error ? error.message : "Could not send feedback.");
    } finally {
      setIsSendingFeedback(false);
    }
  }


  return (
    <AppShell
      title="Loyalty Program"
      roleLabel=""
      headerBackground={HEADER_BG}
      pageBackground={PAGE_BG}
      logoSrc="/pros-logo-basic.png"
      logoAlt="PRO's Logo"
    >
      <style>{`
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

      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-12 pt-4 font-raleway">
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
                {hasBirthdayToday ? (
                  <h1 className="text-[24px] font-black leading-tight text-white">
                    Happy Birthday
                    <br />
                    <span className="text-[#f0cf61]">{displayName}</span>
                  </h1>
                ) : (
                  <>
                    <h1 className="text-[24px] font-black leading-tight text-white">
                      Hello, <span className="text-[#f0cf61]">{displayName}</span>
                    </h1>
                    <p className="mt-2 text-[15px] font-medium text-white/70">
                      Let&apos;s earn more stamps!
                    </p>
                  </>
                )}
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
              onClick={() => {
                setIsFeedbackOpen(true);
                setFeedbackStatus(null);
              }}
              className="mt-5 inline-flex items-center justify-center rounded-[10px] bg-[#f0cf61] px-5 py-3 font-raleway text-[15px] font-bold text-[#1c2530]"
            >
              Your Feedback
            </button>
          </div>
        </section>

        <section
          role="button"
          tabIndex={0}
          onClick={() => router.push("/world-cup")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push("/world-cup");
            }
          }}
          className="relative mt-6 cursor-pointer overflow-hidden border border-white/15 px-4 py-4 shadow-[0_22px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl transition active:scale-[0.99]"
          style={{
            borderRadius: 18,
            minHeight: 150,
            background:
              "linear-gradient(135deg, rgba(121, 134, 115, 0.96) 0%, rgba(104, 116, 104, 0.94) 45%, rgba(88, 98, 86, 0.96) 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-58"
            style={{
              backgroundImage: "url('/WC-branding.png')",
              backgroundSize: "auto 92%",
              backgroundPosition: "right bottom",
              backgroundRepeat: "no-repeat",
            }}
            aria-hidden="true"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#586256]/12 via-transparent to-transparent" />

          <div className="relative z-10 flex min-h-[118px] items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-raleway text-[23px] font-black leading-[1.08] tracking-[0.01em] text-white">
                Predict the scores
                <br />
                <span className="text-[#f0cf61]">&amp; win rewards</span>
              </h2>

              <div className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-[#f0cf61] px-5 py-3 font-raleway text-[15px] font-bold text-[#1c2530] shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
                Play Now
              </div>
            </div>

            <div className="flex h-[122px] w-[92px] shrink-0 items-center justify-center">
              <Image
                src="/WC-logo.png"
                alt="World Cup"
                width={96}
                height={122}
                className="h-[122px] w-[96px] object-contain drop-shadow-[0_18px_34px_rgba(0,0,0,0.26)]"
                priority={false}
              />
            </div>
          </div>
        </section>

        {visibleRewards.length > 0 && (
          <section className="mt-10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[22px] font-black leading-none text-white">
                My Gifts
              </h2>

            </div>

            <div className="-mx-4 overflow-x-auto overflow-y-visible px-4 pb-2 hide-scrollbar touch-auto overscroll-x-contain snap-x snap-mandatory" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
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
            onClaim={handleClaim}
          />
        ) : null}

        {isFeedbackOpen ? (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
            onClick={() => {
              setIsFeedbackOpen(false);
              setFeedbackStatus(null);
            }}
          >
            <div
              className="relative w-full max-w-sm border border-white/20 p-5 font-raleway shadow-[0_28px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
              style={{ borderRadius: 24, background: GLASS_CARD_DARK }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setIsFeedbackOpen(false);
                  setFeedbackStatus(null);
                }}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/14 text-[18px] font-black text-white/80"
                aria-label="Close feedback"
              >
                ×
              </button>

              <h3 className="pr-9 text-[24px] font-black leading-tight text-[#f0cf61]">
                Your Feedback
              </h3>
              <p className="mt-3 text-[16px] font-medium leading-5 text-white">
                What&apos;s on your mind?
              </p>

              <textarea
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                placeholder="Write your feedback here..."
                rows={5}
                className="mt-4 w-full resize-none rounded-[16px] border border-white/18 bg-white px-4 py-3 font-raleway text-[14px] font-semibold text-[#243744] outline-none placeholder:text-[#243744]/40 focus:border-[#f0cf61]"
              />

              {feedbackStatus ? (
                <div
                  className={`mt-3 rounded-2xl px-4 py-3 text-[12px] font-bold text-white ${
                    feedbackStatus === "Feedback sent! Thanks for sharing."
                      ? "bg-emerald-500/24"
                      : "bg-white/12"
                  }`}
                >
                  {feedbackStatus}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void sendFeedback()}
                disabled={isSendingFeedback}
                className={`mt-4 inline-flex h-12 w-full items-center justify-center rounded-[10px] px-5 py-3 font-raleway text-[15px] font-bold text-[#1c2530] disabled:opacity-60 ${
                  feedbackStatus === "Feedback sent! Thanks for sharing."
                    ? "bg-emerald-400"
                    : "bg-[#f0cf61]"
                }`}
              >
                {isSendingFeedback
                  ? "Sending..."
                  : feedbackStatus === "Feedback sent! Thanks for sharing."
                    ? "Feedback sent"
                    : "Send Feedback"}
              </button>
            </div>
          </div>
        ) : null}

      </div>
    </AppShell>
  );
}

export default ClientDashboard;
