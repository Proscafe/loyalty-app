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
  is_active?: boolean | null;
  sort_order?: number | null;
  average_price?: number | null;
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
  description?: string | null;
  status?: "available" | "claimed" | "redeemed" | string;
  created_at?: string | null;
  earned_at?: string | null;
  redeemed_at?: string | null;
  claimed_at?: string | null;
  expires_at?: string | null;
  is_birthday_reward?: boolean;
  is_birthday?: boolean | null;
  birthday_reward?: boolean | null;
  source?: string | null;
  reward_source?: string | null;
  gift_icon?: string;
};

type AnyRecord = Record<string, any>;

type ClientDashboardBanner = {
  id: string;
  image_url: string;
  link_url?: string | null;
  sort_order: number;
};

type ClientDashboardProps = {
  profile: Profile;
  banners?: ClientDashboardBanner[];
  categories?: unknown[];
  initialStamps?: unknown[];
  initialRewards?: unknown[];
  stamps?: unknown[];
  rewards?: unknown[];
  isLoyaltyProgramEnabled?: boolean;
  previewStreak?: number;
  previewAllTimeStamps?: number;
  previewGiftsEarned?: number;
};

const PAGE_BG = "radial-gradient(circle at 18% 6%, rgba(130,164,139,0.30), transparent 48%), radial-gradient(circle at 86% 68%, rgba(121,27,42,0.22), transparent 55%), linear-gradient(155deg, #183f34, #102e29 54%, #193c32)";
const HEADER_BG = "rgba(24, 63, 52, 0.92)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.045))";
const GLASS_CARD_DARK =
  "linear-gradient(145deg, rgba(255,255,255,0.13), rgba(255,255,255,0.05))";
const BRAND_YELLOW = "#e9c46a";
const CARD_RADIUS = 10;

const DEFAULT_CATEGORY_ORDER = [
  "Sandwiches",
  "Main Course",
  "Desserts",
  "Coffee",
  "Hooka",
];

const DASHBOARD_GREETINGS = [
  "WELCOME BACK",
  "GOOD TO SEE YOU",
  "LOOK WHO'S HERE",
  "HELLO AGAIN",
  "READY FOR MORE?",
  "YOUR HAPPY PLACE",
  "GREAT TO HAVE YOU",
  "KEEP IT GOING",
  "ANOTHER GREAT DAY",
  "BACK FOR MORE?",
  "GOOD VIBES ONLY",
  "THE FUN CONTINUES",
] as const;

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

function firstNameOnly(value?: string | null) {
  const cleanName = cleanText(value);
  const firstName = cleanName.split(/\s+/).filter(Boolean)[0];

  return toTitleCase(firstName || "Client");
}

function pluralizeTitle(count: number, singular: string, plural?: string) {
  const label = count === 1 ? singular : plural ?? `${singular}s`;
  return `${count} ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function normalizeCategoryName(name?: string | null) {
  const safeName = cleanText(name);
  const lower = safeName.toLowerCase();

  if (lower === "sandwich" || lower === "sandwiches") return "Sandwiches";
  if (lower === "main course" || lower === "main courses" || lower === "maincourse") return "Main Course";
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
    "Main Course": "Main Course",
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

function getStampTheme(_categoryName: string) {
  return {
    fill: "rgba(240, 207, 97, 0.22)",
    stroke: "#f0cf61",
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

function getRewardPopupStorageKey(profileId: string) {
  return `pros-reward-popup-shown-${profileId}`;
}

function getGameGiftPopupStorageKey(profileId: string) {
  return `pros-game-gift-popup-shown-${profileId}`;
}

function readStoredIdSet(key: string) {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function saveStoredId(key: string, id: string) {
  if (typeof window === "undefined") return;

  try {
    const current = readStoredIdSet(key);
    current.add(id);
    window.localStorage.setItem(key, JSON.stringify([...current].slice(-120)));
  } catch {
    // Local storage is only used to avoid repeating the popup.
  }
}

function getShownRewardPopupIds(profileId: string) {
  return readStoredIdSet(getRewardPopupStorageKey(profileId));
}

function saveShownRewardPopupId(profileId: string, rewardId: string) {
  saveStoredId(getRewardPopupStorageKey(profileId), rewardId);
}

function getShownGameGiftPopupIds(profileId: string) {
  return readStoredIdSet(getGameGiftPopupStorageKey(profileId));
}

function saveShownGameGiftPopupId(profileId: string, rewardId: string) {
  saveStoredId(getGameGiftPopupStorageKey(profileId), rewardId);
}

function isAutoGameGiftReward(reward: ClientReward) {
  const rewardType = cleanText(reward.reward_type).toLowerCase();
  const description = cleanText(reward.description).toLowerCase();

  return (
    rewardType === "free dessert" &&
    !reward.is_birthday_reward &&
    (
      description.includes("prediction_match:") ||
      description.includes("exact score winner") ||
      description.includes("football prediction") ||
      description.includes("basketball prediction") ||
      description.includes("game winner") ||
      description.includes("match winner")
    )
  );
}

const BIRTHDAY_REWARD_TYPES = ["20% Discount"];

function isBirthdayRewardType(value?: string | null) {
  return BIRTHDAY_REWARD_TYPES.includes(String(value || ""));
}

function isBirthdayReward(reward: ClientReward) {
  const sourceText = `${cleanText(reward.source)} ${cleanText(reward.reward_source)} ${cleanText(
    reward.description,
  )}`.toLowerCase();

  return Boolean(
    reward.is_birthday_reward ||
      reward.is_birthday ||
      reward.birthday_reward ||
      String(reward.id || "").startsWith("birthday-") ||
      sourceText.includes("birthday") ||
      (isBirthdayRewardType(reward.reward_type) &&
        cleanText(reward.description).toLowerCase().includes("birthday"))
  );
}

function getRewardIcon(reward: ClientReward) {
  return isBirthdayReward(reward) ? "/birthday-cake.png" : "/gift.png";
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

function getClaimCountdownLabel(reward: ClientReward) {
  if (reward.status === "claimed") return "Claim request sent — waiting for confirmation";
  if (reward.status !== "available") return null;

  const expiresAt = rewardExpiryDate(reward);
  if (!expiresAt) return "Ready to claim";

  const msLeft = expiresAt - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

  if (daysLeft <= 0) return "Expires today";
  if (daysLeft === 1) return "Expires in 1 day";
  return `Expires in ${daysLeft} days`;
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
  const isBirthday = isBirthdayReward(reward);
  const title = isBirthday
    ? reward.reward_type || "Birthday Gift"
    : `Free ${getSingularCategory(categoryName)}`;
  const giftIcon = getRewardIcon(reward);
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



function DisabledLoyaltyProgramCard() {
  return (
    <div
      className="relative overflow-hidden rounded-[10px] bg-[#626262] px-4 py-4 shadow-[0_18px_42px_rgba(0,0,0,0.16)]"
      style={{ minHeight: 246 }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "url('/Disabled.gif')",
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
          opacity: 0.3,
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-[300px] pt-1">
        <h3 className="font-raleway text-[22px] font-black leading-[1.18] text-white drop-shadow-sm">
          Sorry, the loyalty program
          <br />
          <span className="text-[#f0cf61]">is currently disabled.</span>
        </h3>
      </div>
    </div>
  );
}

function StampRow({
  item,
  index,
  categoryMap,
  isLoyaltyProgramEnabled,
}: {
  item: ClientStamp & { category_name?: string; is_active?: boolean | null };
  index: number;
  categoryMap: Map<string, string>;
  isLoyaltyProgramEnabled: boolean;
}) {
  const count = Math.max(0, Math.min(5, Number((item as AnyRecord).stamp_count ?? 0)));
  const categoryName = extractCategoryName(item, categoryMap, index);
  const isDisabled = item.is_active === false;

  return (
    <div className="relative overflow-hidden rounded-[14px]">
      <div className={isDisabled ? "pointer-events-none blur-[2px] opacity-45" : ""}>
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

      {isDisabled ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[14px] bg-[#92534C]/55 px-4 text-center backdrop-blur-[2px]">
          <p className="text-[13px] font-black leading-5 text-white drop-shadow">
            Sorry, Our Loyalty Card Is Currently Disabled.
          </p>
        </div>
      ) : null}
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
  const isBirthday = isBirthdayReward(reward);
  const birthdayGiftName = reward.reward_type || "birthday gift";
  const modalIcon = getRewardIcon(reward);
  const isDiscountPrize = /^(10|15)% Discount$/i.test(cleanText(reward.reward_type));

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

          {isBirthday ? (
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
              {isDiscountPrize ? `You won ${reward.reward_type}!` : `You earned a free ${giftName}`}
            </h2>
          )}

          <button
            type="button"
            onClick={() => {
              if (isBirthdayReward(reward)) {
                onClaim(reward.id);
                onClose();
                return;
              }

              onClose();
            }}
            className="mt-7 w-full rounded-[12px] bg-[#f0cf61] px-4 py-3 text-[14px] font-black text-[#1c2530]"
          >
            {isBirthday ? "Claim gift" : "Congratulations"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChristmasDashboard({
  profile,
  banners = [],
  categories = [],
  initialStamps,
  initialRewards,
  stamps,
  rewards,
  isLoyaltyProgramEnabled = true,
  previewStreak = 0,
  previewAllTimeStamps,
  previewGiftsEarned,
}: ClientDashboardProps) {
  const router = useRouter();
  const [localRewards, setLocalRewards] = useState<ClientReward[]>((rewards ?? initialRewards ?? []) as ClientReward[]);
  const [claimingRewardIds, setClaimingRewardIds] = useState<Set<string>>(() => new Set());
  const [celebrationReward, setCelebrationReward] = useState<ClientReward | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrFrameRef = useRef<number | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScannerStatus, setQrScannerStatus] = useState<string | null>(null);
  const [showGameScanCard, setShowGameScanCard] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [dashboardGreeting, setDashboardGreeting] = useState<string>(DASHBOARD_GREETINGS[0]);
  const visibleBanners = useMemo(
    () =>
      [...banners]
        .filter((banner) => Boolean(banner.image_url))
        .sort((a, b) => a.sort_order - b.sort_order)
        .slice(0, 3),
    [banners],
  );

  useEffect(() => {
    if (bannerIndex >= visibleBanners.length) {
      setBannerIndex(0);
    }
  }, [bannerIndex, visibleBanners.length]);

  useEffect(() => {
    if (visibleBanners.length <= 1) return;

    const timer = window.setInterval(() => {
      setBannerIndex((current) => (current + 1) % visibleBanners.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [visibleBanners.length]);

  useEffect(() => {
    const storageKey = "pros-christmas-dashboard-greeting";
    const lastGreeting = typeof window !== "undefined" ? window.sessionStorage.getItem(storageKey) : null;
    const pool = DASHBOARD_GREETINGS.filter((item) => item !== lastGreeting);
    const nextGreeting = pool[Math.floor(Math.random() * pool.length)] || DASHBOARD_GREETINGS[0];
    setDashboardGreeting(nextGreeting);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, nextGreeting);
    }
  }, []);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenRewardIdsRef = useRef<Set<string>>(
    new Set(
      ((rewards ?? initialRewards ?? []) as ClientReward[])
        .filter((reward) => !isAutoGameGiftReward(reward))
        .map((reward) => reward.id),
    ),
  );

  useEffect(() => {
    setLocalRewards((rewards ?? initialRewards ?? []) as ClientReward[]);
  }, [rewards, initialRewards]);


  useEffect(() => {
    let isMounted = true;

    async function refreshRewards() {
      try {
        const response = await fetch("/api/client/rewards", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as { rewards?: ClientReward[] | null };
        if (!isMounted || !Array.isArray(payload.rewards)) return;

        setLocalRewards(payload.rewards);
      } catch {
        // Keep the current rewards if refresh fails.
      }
    }

    void refreshRewards();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshRewards();
    }, 15000);

    window.addEventListener("focus", refreshRewards);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshRewards);
    };
  }, []);

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

  function stopQrScanner() {
    if (qrFrameRef.current !== null) {
      window.cancelAnimationFrame(qrFrameRef.current);
      qrFrameRef.current = null;
    }

    qrStreamRef.current?.getTracks().forEach((track) => track.stop());
    qrStreamRef.current = null;
  }

  function closeQrScanner() {
    stopQrScanner();
    setIsQrScannerOpen(false);
    setQrScannerStatus(null);
  }

  function openPredictionLinkFromQr(value: string) {
    const scanned = cleanText(value);
    if (!scanned) return false;

    try {
      const url = new URL(scanned, window.location.origin);
      const path = `${url.pathname}${url.search}${url.hash}`;

      if (url.pathname.startsWith("/predict/")) {
        closeQrScanner();
        router.push(path);
        return true;
      }
    } catch {
      // Continue with plain-text parsing below.
    }

    const predictMatch = scanned.match(/(?:^|\/)predict\/([A-Za-z0-9_-]+)/);
    const code = predictMatch?.[1] || (scanned.length <= 64 ? scanned : "");

    if (code) {
      closeQrScanner();
      router.push(`/predict/${encodeURIComponent(code)}`);
      return true;
    }

    return false;
  }

  function loadJsQrScript(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).jsQR) { resolve(); return; }
      const existing = document.getElementById("pros-jsqr-script") as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(), { once: true });
        return;
      }
      const s = document.createElement("script");
      s.id = "pros-jsqr-script";
      s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject();
      document.head.appendChild(s);
    });
  }

  async function openQrScanner() {
    if (typeof window === "undefined") return;

    // Full reset so re-opening always works cleanly
    stopQrScanner();
    setIsQrScannerOpen(true);
    setQrScannerStatus("Opening camera\u2026");

    if (!navigator.mediaDevices?.getUserMedia) {
      setQrScannerStatus("Camera not supported on this browser. Please use your phone camera app.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      qrStreamRef.current = stream;
      const video = qrVideoRef.current;

      if (!video) {
        setQrScannerStatus("Scanner view not ready \u2014 please try again.");
        return;
      }

      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();

      const NativeBD = (window as any).BarcodeDetector;

      if (NativeBD) {
        // Path A: native BarcodeDetector (Chrome / Android WebView)
        const detector = new NativeBD({ formats: ["qr_code"] });
        setQrScannerStatus("Point your camera at the QR code.");

        const scanFrame = async () => {
          const activeVideo = qrVideoRef.current;
          if (!activeVideo || activeVideo.readyState < 2 || activeVideo.paused) {
            qrFrameRef.current = requestAnimationFrame(scanFrame);
            return;
          }
          try {
            const barcodes = await detector.detect(activeVideo);
            const value = cleanText(barcodes?.[0]?.rawValue);
            if (value && openPredictionLinkFromQr(value)) return;
          } catch {
            // Some frames fail while focusing — keep going
          }
          qrFrameRef.current = requestAnimationFrame(scanFrame);
        };
        qrFrameRef.current = requestAnimationFrame(scanFrame);
      } else {
        // Path B: jsQR canvas decode (Safari / Firefox)
        setQrScannerStatus("Loading QR engine\u2026");
        try {
          await loadJsQrScript();
        } catch {
          setQrScannerStatus("QR engine failed to load. Try refreshing the page.");
          return;
        }

        const canvas = document.createElement("canvas");
        setQrScannerStatus("Point your camera at the QR code.");

        const scanFrame = () => {
          const activeVideo = qrVideoRef.current;
          if (!activeVideo || activeVideo.readyState < 2 || activeVideo.paused) {
            qrFrameRef.current = requestAnimationFrame(scanFrame);
            return;
          }
          const vw = activeVideo.videoWidth;
          const vh = activeVideo.videoHeight;
          if (vw && vh) {
            canvas.width = vw;
            canvas.height = vh;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(activeVideo, 0, 0, vw, vh);
              const imageData = ctx.getImageData(0, 0, vw, vh);
              const result = (window as any).jsQR?.(imageData.data, vw, vh, {
                inversionAttempts: "dontInvert",
              });
              if (result?.data && openPredictionLinkFromQr(result.data)) return;
            }
          }
          qrFrameRef.current = requestAnimationFrame(scanFrame);
        };
        qrFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch {
      setQrScannerStatus("Camera permission blocked. Allow camera access and try again.");
    }
  }

  useEffect(() => {
    return () => stopQrScanner();
  }, []);

  useEffect(() => {
    let isMounted = true;

    function parseMatchTime(value: unknown) {
      const text = cleanText(value);
      if (!text) return null;

      const parsed = Date.parse(text.replace(" ", "T"));
      return Number.isFinite(parsed) ? parsed : null;
    }

    function isOpenMatch(match: AnyRecord, nowMs: number) {
      if (!match || match.is_active === false) return false;

      const status = cleanText(match.status).toLowerCase();
      if (["closed", "inactive", "disabled", "draft"].includes(status)) return false;
      if (status === "open") return true;

      const closesAt = parseMatchTime(match.closes_at ?? match.close_at);
      if (closesAt !== null && nowMs > closesAt) return false;

      const opensAt = parseMatchTime(match.opens_at ?? match.open_at);
      if (opensAt !== null && nowMs < opensAt) return false;

      return true;
    }

    async function refreshGameScanCard() {
      try {
        const response = await fetch("/api/matches/open", {
          cache: "no-store",
        });

        if (!response.ok) {
          return; // Keep card state unchanged on API errors
        }

        const payload = (await response.json()) as { matches?: AnyRecord[] | null };
        const matches = payload.matches ?? [];
        const nowMs = Date.now();

        const hasOpenGame = matches.some((match: AnyRecord) => {
          if (!match || match.is_active === false) return false;
          const opensAt = parseMatchTime(match.opens_at ?? match.open_at);
          const closesAt = parseMatchTime(match.closes_at ?? match.close_at);
          if (opensAt !== null && closesAt !== null) return nowMs >= opensAt && nowMs <= closesAt;
          return match.is_active === true;
        });

        if (isMounted) setShowGameScanCard(hasOpenGame);
      } catch {
        // Don't hide the card on network errors — keep showing if already visible
      }
    }

    void refreshGameScanCard();

    const interval = window.setInterval(() => {
      void refreshGameScanCard();
    }, 30000);

    window.addEventListener("focus", refreshGameScanCard);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshGameScanCard);
    };
  }, []);

  const categoryMap = useMemo(
    () => makeCategoryMap((categories ?? []) as LoyaltyCategory[]),
    [categories],
  );

  const rawStampRows = useMemo(
    () => ((stamps ?? initialStamps ?? []) as ClientStamp[]),
    [stamps, initialStamps],
  );

  const stampRows = useMemo(() => {
    const rowsByCategory = new Map<string, ClientStamp>();

    rawStampRows.forEach((stamp, index) => {
      const record = stamp as AnyRecord;
      const categoryId = cleanText(record.category_id);
      const categoryName = extractCategoryName(stamp, categoryMap, index);
      const key = categoryId || normalizeCategoryName(categoryName);

      rowsByCategory.set(key, stamp);
    });

    const categoryRows =
      ((categories ?? []) as LoyaltyCategory[])
        .map((category, index) => {
          const record = category as AnyRecord;
          const categoryId = cleanText(record.id);
          const categoryName = normalizeCategoryName(record.name);
          const key = categoryId || categoryName;

          return {
            id: `empty-${key || index}`,
            category_id: categoryId || null,
            category_name: categoryName || DEFAULT_CATEGORY_ORDER[index] || "Reward",
            stamp_count: 0,
            is_active: record.is_active !== false,
          } as ClientStamp & { category_name: string; is_active?: boolean | null };
        })
        .filter((row) => normalizeCategoryName((row as AnyRecord).category_name) !== "Reward");

    const fallbackRows = DEFAULT_CATEGORY_ORDER.map((name, index) => ({
      id: `default-${name}`,
      category_id: null,
      category_name: name,
      stamp_count: 0,
      sort_order: index,
      is_active: true,
    })) as Array<ClientStamp & { category_name: string; is_active?: boolean | null }>;

    const baseRows = categoryRows.length > 0 ? categoryRows : fallbackRows;

    const mergedRows = baseRows.map((row, index) => {
      const record = row as AnyRecord;
      const categoryId = cleanText(record.category_id);
      const categoryName = normalizeCategoryName(record.category_name || record.name);
      const key = categoryId || categoryName;
      const existingRow = rowsByCategory.get(key);

      if (existingRow) {
        return {
          ...row,
          ...existingRow,
          category_name: categoryName,
          is_active: record.is_active !== false,
        } as ClientStamp & { category_name: string; is_active?: boolean | null };
      }

      return {
        ...row,
        category_name: categoryName || DEFAULT_CATEGORY_ORDER[index] || "Reward",
        stamp_count: 0,
        is_active: record.is_active !== false,
      } as ClientStamp & { category_name: string; is_active?: boolean | null };
    });

    rawStampRows.forEach((stamp, index) => {
      const record = stamp as AnyRecord;
      const categoryId = cleanText(record.category_id);
      const categoryName = extractCategoryName(stamp, categoryMap, index);
      const normalizedName = normalizeCategoryName(categoryName);
      const exists = mergedRows.some((row) => {
        const rowRecord = row as AnyRecord;
        return (
          (categoryId && cleanText(rowRecord.category_id) === categoryId) ||
          normalizeCategoryName(rowRecord.category_name || rowRecord.name) === normalizedName
        );
      });

      if (!exists) {
        mergedRows.push({
          ...(stamp as ClientStamp),
          category_name: normalizedName || DEFAULT_CATEGORY_ORDER[index] || "Reward",
        } as ClientStamp & { category_name: string; is_active?: boolean | null });
      }
    });

    return mergedRows.sort((a, b) => {
      const countA = Math.max(0, Number((a as AnyRecord).stamp_count ?? 0));
      const countB = Math.max(0, Number((b as AnyRecord).stamp_count ?? 0));
      if (countA !== countB) return countB - countA;

      const nameA = normalizeCategoryName(String((a as AnyRecord).category_name || (a as AnyRecord).name || ""));
      const nameB = normalizeCategoryName(String((b as AnyRecord).category_name || (b as AnyRecord).name || ""));
      return DEFAULT_CATEGORY_ORDER.indexOf(nameA) - DEFAULT_CATEGORY_ORDER.indexOf(nameB);
    });
  }, [categories, categoryMap, rawStampRows]);

  const totalStamps = useMemo(() => {
    return stampRows.reduce((sum, item) => sum + Math.max(0, Number((item as AnyRecord).stamp_count ?? 0)), 0);
  }, [stampRows]);

  const displayName = firstNameOnly(profile.full_name);
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
        .filter((reward) => isBirthdayReward(reward))
        .map((reward) => String(reward.reward_type || "")),
    );

    const birthdayRewards = makeBirthdayRewards(profile).filter(
      (reward) => !existingBirthdayRewards.has(String(reward.reward_type || "")),
    );

    return [...birthdayRewards, ...baseRewards];
  }, [hasBirthdayToday, localRewards, profile]);

  const activeGiftByCategory = useMemo(() => {
    const gifts = new Map<string, ClientReward>();

    visibleRewards.forEach((reward, index) => {
      if (!["available", "claimed"].includes(String(reward.status || ""))) return;
      if (isBirthdayReward(reward)) return;

      const categoryName = normalizeCategoryName(
        extractCategoryName(reward, categoryMap, index),
      );

      if (categoryName && !gifts.has(categoryName)) {
        gifts.set(categoryName, reward);
      }
    });

    return gifts;
  }, [categoryMap, visibleRewards]);

  const displayedStampRows = useMemo(() => {
    return [...stampRows].sort((a, b) => {
      const nameA = normalizeCategoryName(
        String((a as AnyRecord).category_name || (a as AnyRecord).name || ""),
      );
      const nameB = normalizeCategoryName(
        String((b as AnyRecord).category_name || (b as AnyRecord).name || ""),
      );
      const hasGiftA = activeGiftByCategory.has(nameA);
      const hasGiftB = activeGiftByCategory.has(nameB);

      if (hasGiftA !== hasGiftB) return hasGiftA ? -1 : 1;

      const countA = Math.max(0, Number((a as AnyRecord).stamp_count ?? 0));
      const countB = Math.max(0, Number((b as AnyRecord).stamp_count ?? 0));
      if (countA !== countB) return countB - countA;

      return DEFAULT_CATEGORY_ORDER.indexOf(nameA) - DEFAULT_CATEGORY_ORDER.indexOf(nameB);
    });
  }, [activeGiftByCategory, stampRows]);

  useEffect(() => {
    const birthdayPopupKey = getBirthdayPopupStorageKey(profile.id);
    const birthdayPopupAlreadyShown =
      typeof window !== "undefined" && window.localStorage.getItem(birthdayPopupKey) === "true";
    const shownRewardPopupIds = getShownRewardPopupIds(profile.id);
    const shownGameGiftPopupIds = getShownGameGiftPopupIds(profile.id);

    function canShowRewardPopup(reward: ClientReward) {
      const isAutoGameGift = isAutoGameGiftReward(reward);
      const alreadyShownGameGift = isAutoGameGift && shownGameGiftPopupIds.has(reward.id);
      const alreadyShownRegular = !isAutoGameGift && shownRewardPopupIds.has(reward.id);
      const isNew = !seenRewardIdsRef.current.has(reward.id);

      if (reward.status !== "available" && reward.status !== "claimed") return false;
      if (isAutoGameGift && alreadyShownGameGift) return false;
      if (!isAutoGameGift && alreadyShownRegular) return false;
      if (!isAutoGameGift && !isNew) return false;
      if (isBirthdayReward(reward) && birthdayPopupAlreadyShown) return false;

      return true;
    }

    const newestReward =
      visibleRewards.find((reward) => isAutoGameGiftReward(reward) && canShowRewardPopup(reward)) ||
      visibleRewards.find((reward) => canShowRewardPopup(reward));

    visibleRewards.forEach((reward) => {
      const isAutoGameGift = isAutoGameGiftReward(reward);
      const shown = isAutoGameGift ? shownGameGiftPopupIds.has(reward.id) : shownRewardPopupIds.has(reward.id);
      if (!isAutoGameGift || shown) {
        seenRewardIdsRef.current.add(reward.id);
      }
    });

    if (!newestReward) return;

    if (isBirthdayReward(newestReward) && typeof window !== "undefined") {
      window.localStorage.setItem(birthdayPopupKey, "true");
    }

    if (isAutoGameGiftReward(newestReward)) {
      saveShownGameGiftPopupId(profile.id, newestReward.id);
    } else {
      saveShownRewardPopupId(profile.id, newestReward.id);
    }

    seenRewardIdsRef.current.add(newestReward.id);
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

  async function sendStaffClaimAlert(rewardId?: string | null) {
    const cleanRewardId = String(rewardId ?? "").trim();
    if (!cleanRewardId || cleanRewardId.startsWith("birthday-")) return;

    try {
      await fetch("/api/notifications/claim-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: cleanRewardId }),
      });
    } catch {
      // Do not block the client claim if the staff push alert fails.
    }
  }

  async function handleClaim(rewardId: string) {
    if (claimingRewardIds.has(rewardId)) return;

    const existingReward = localRewards.find((reward) => reward.id === rewardId);
    if (!existingReward || existingReward.status !== "available") return;

    setClaimingRewardIds((current) => {
      const next = new Set(current);
      next.add(rewardId);
      return next;
    });

    setCelebrationReward(null);

    await new Promise((resolve) => window.setTimeout(resolve, 350));

    setLocalRewards((current) =>
      current.map((reward) =>
        reward.id === rewardId
          ? {
              ...reward,
              status: "claimed",
              claimed_at: new Date().toISOString(),
            }
          : reward,
      ),
    );

    setClaimingRewardIds((current) => {
      const next = new Set(current);
      next.delete(rewardId);
      return next;
    });
  }


  function previewRewardTitle(reward: ClientReward, index: number) {
    if (isBirthdayReward(reward)) return reward.reward_type || "Birthday Gift";
    const categoryName = extractCategoryName(reward, categoryMap, index);
    return reward.reward_type || `Free ${getSingularCategory(categoryName)}`;
  }

  async function sendFeedback() {
    const message = feedbackMessage.trim();

    if (!message) {
      setFeedbackStatus("Please write your feedback first.");
      return;
    }

    setIsSendingFeedback(true);
    setFeedbackStatus(null);

    await new Promise((resolve) => window.setTimeout(resolve, 450));

    setFeedbackMessage("");
    setFeedbackStatus("Preview only — feedback was not saved.");

    window.setTimeout(() => {
      setIsFeedbackOpen(false);
      setFeedbackStatus(null);
    }, 1800);

    setIsSendingFeedback(false);
  }


  const allTimeStampCount =
    previewAllTimeStamps ??
    stampRows.reduce(
      (sum, item) =>
        sum + Math.max(0, Number((item as AnyRecord).stamp_count ?? 0)),
      0,
    );

  const giftsEarnedCount =
    previewGiftsEarned ??
    localRewards.filter((reward) =>
      ["available", "claimed", "redeemed", "expired"].includes(
        String(reward.status || ""),
      ),
    ).length;

  const displayStreakCount = previewStreak;
  // Read the same authenticated leaderboard API used by the Santa game.
  // The dashboard never guesses rankings or exposes private profile records.
  const [santaRanking, setSantaRanking] = useState<{
    myRank: number | null;
    myBest: number;
    loaded: boolean;
  }>({ myRank: null, myBest: 0, loaded: false });

  useEffect(() => {
    let alive = true;
    const loadSantaRank = async () => {
      try {
        const response = await fetch("/api/christmas/santa-leaderboard", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { myRank?: number | null; myBest?: number };
        if (alive) setSantaRanking({
          myRank: typeof data.myRank === "number" && data.myRank > 0 ? data.myRank : null,
          myBest: typeof data.myBest === "number" ? data.myBest : 0,
          loaded: true,
        });
      } catch {
        // Keep generic game invitation while the leaderboard is unavailable.
      }
    };
    void loadSantaRank();
    window.addEventListener("focus", loadSantaRank);
    return () => { alive = false; window.removeEventListener("focus", loadSantaRank); };
  }, []);

  const santaRankLabel = santaRanking.myRank !== null
    ? `YOUR RANK: #${santaRanking.myRank}`
    : "CHRISTMAS CHALLENGE";
  const santaRankMessage = santaRanking.myRank === 1
    ? "You're leading!"
    : santaRanking.myRank !== null && santaRanking.myRank <= 10
      ? "You're in the Top 10!"
      : santaRanking.myRank !== null
        ? "Keep climbing!"
        : "Your adventure starts here!";
  const [snowEnabled, setSnowEnabled] = useState(true);
  const [snowflakes, setSnowflakes] = useState<Array<{left:number;size:number;delay:number;duration:number;opacity:number;drift:number}>>([]);
  const [daysUntilChristmas, setDaysUntilChristmas] = useState(() => {
    const now = new Date();
    const thisChristmas = new Date(now.getFullYear(), 11, 25);
    const target = now.getTime() > new Date(now.getFullYear(), 11, 25, 23, 59, 59).getTime()
      ? new Date(now.getFullYear() + 1, 11, 25)
      : thisChristmas;
    return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
  });
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const christmas = new Date(now.getFullYear(), 11, 25);
      const target = now.getTime() > new Date(now.getFullYear(), 11, 25, 23, 59, 59).getTime()
        ? new Date(now.getFullYear() + 1, 11, 25)
        : christmas;
      setDaysUntilChristmas(Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000)));
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    setSnowflakes(Array.from({ length: 34 }, (_, i) => ({
      left: ((i * 73 + 11) % 101),
      size: 2 + ((i * 7) % 6),
      delay: -((i * 13) % 190) / 10,
      duration: 11 + ((i * 11) % 130) / 10,
      opacity: 0.2 + ((i * 3) % 6) / 10,
      drift: (i % 2 ? 1 : -1) * (15 + (i * 9) % 50),
    })));
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;

    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-preview-reveal]"));
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px 48px 0px" },
    );

    elements.forEach((element) => observer.observe(element));

    const fallback = window.setTimeout(() => {
      elements.forEach((element) => element.classList.add("is-visible"));
    }, 900);

    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, [stampRows.length, visibleRewards.length]);

  return (
    <AppShell
      title="Christmas Preview"
      roleLabel=""
      headerBackground={HEADER_BG}
      pageBackground={PAGE_BG}
      logoSrc="/pros-logo-basic.png"
      logoAlt="PRO's Logo"
    >
      <style>{`
        button {
          text-transform: uppercase;
        }

        .preview-hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .preview-hide-scrollbar::-webkit-scrollbar {
          display: none;
        }

        @keyframes previewFadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes previewCtaBlink {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 10px 24px rgba(255, 214, 107, 0.18);
          }
          50% {
            transform: scale(1.025);
            box-shadow: 0 12px 30px rgba(255, 214, 107, 0.42);
          }
        }

        .preview-card-animate {
          opacity: 0;
          animation: previewFadeUp 520ms ease-out forwards;
        }

        .preview-card-animate:nth-of-type(2) { animation-delay: 70ms; }
        .preview-card-animate:nth-of-type(3) { animation-delay: 140ms; }
        .preview-card-animate:nth-of-type(4) { animation-delay: 210ms; }
        .preview-card-animate:nth-of-type(5) { animation-delay: 280ms; }
        .preview-card-animate:nth-of-type(6) { animation-delay: 350ms; }

        .preview-cta-blink {
          animation: previewCtaBlink 1.9s ease-in-out infinite;
        }

        .preview-reveal {
          opacity: 1;
          transform: translateY(0);
        }

        .preview-reveal.is-visible {
          animation: previewFadeUp 560ms ease-out both;
        }

        @keyframes christmasSnowfall {
          0% { transform: translate3d(0, -12vh, 0); }
          100% { transform: translate3d(var(--snow-drift), 110vh, 0); }
        }
        @keyframes christmasShimmer {
          0%, 100% { box-shadow: 0 0 0 rgba(233,196,106,0); }
          50% { box-shadow: 0 0 30px rgba(233,196,106,.12); }
        }

        /* Glossy red Christmas button inspired by the supplied CodePen.
           White icing/snow is drawn with CSS; no external assets required. */
        .christmas-frost-button {
          position: relative;
          isolation: isolate;
          min-height: 58px;
          border: 1px solid #5b151b;
          border-radius: 15px;
          color: #fff9ee;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 19px;
          font-weight: 800;
          letter-spacing: .015em;
          text-shadow: 0 2px 2px rgba(53,0,0,.55);
          background: linear-gradient(180deg,#d55b4d 0%,#b52c29 43%,#861b21 100%);
          box-shadow: inset 0 2px 1px rgba(255,255,255,.42), inset 0 -7px 13px rgba(76,7,12,.35), 0 7px 0 #5b1820, 0 15px 24px rgba(0,0,0,.23);
          transition: transform .18s ease, filter .18s ease, box-shadow .18s ease;
        }
        .christmas-frost-button::before {
          content: "";
          position: absolute;
          pointer-events: none;
          z-index: 1;
          top: -5px;
          left: 8px;
          right: 8px;
          height: 15px;
          border-radius: 11px 11px 45% 45%;
          background: radial-gradient(ellipse at 15% 85%,#fff 0 8px,transparent 8.5px),radial-gradient(ellipse at 45% 85%,#fff 0 9px,transparent 9.5px),radial-gradient(ellipse at 76% 85%,#fff 0 7px,transparent 7.5px),linear-gradient(#fff,#e5f1eb);
          box-shadow: 0 2px 3px rgba(27,65,59,.15);
        }
        .christmas-frost-button:not(:disabled):hover { filter: brightness(1.09); transform: translateY(-2px); }
        .christmas-frost-button:not(:disabled):active { transform: translateY(5px); box-shadow: inset 0 2px 1px rgba(255,255,255,.35),inset 0 -4px 10px rgba(76,7,12,.25),0 2px 0 #5b1820,0 7px 15px rgba(0,0,0,.2); }
        .christmas-frost-button:disabled { cursor: not-allowed; filter: saturate(.58); opacity: .78; }
        .christmas-frost-button:focus-visible { outline: 3px solid #f5d77e; outline-offset: 4px; }
        /* Faithful compact adaptation of the supplied VIRU CodePen Christmas button. */
        .christmas-feedback-button {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          min-height: 41px;
          border-radius: 13px;
          border: 1px solid #4c0300;
          background: #5e0d0c;
          color: #fff;
          font-family: inherit;
          font-size: 13px;
          font-style: normal;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: .01em;
          text-transform: uppercase !important;
          text-shadow: 0 1px 2px rgba(0,0,0,.75);
          box-shadow: inset 1px 1px 0 rgba(255,255,255,.25), inset 0 0 6px #a23227, inset 0 80px 80px -40px #ac3223, 1px 2px 3px rgba(0,0,0,.75);
          transition: background .2s ease, box-shadow .2s ease, transform .15s ease;
          white-space: nowrap;
        }
        .christmas-feedback-button::before {
          content: "";
          position: absolute;
          top: -6px;
          left: -3px;
          right: 0;
          height: 20px;
          background-image: url('/christmas/christmas-button-snow-left.png'), url('/christmas/christmas-button-snow-middle.png'), url('/christmas/christmas-button-snow-right.png');
          background-repeat: no-repeat;
          background-position: left top, center top, right top;
          background-size: 42px 20px, 76px 20px, 32px 20px;
          box-shadow: none;
          pointer-events: none;
        }
        .christmas-feedback-button:not(:disabled):hover {
          background: #a61715;
          transform: none;
          filter: none;
          text-shadow: 0 1px 2px rgba(0,0,0,.75),0 0 25px #fff;
          box-shadow: inset 1px 1px 0 rgba(255,255,255,.25),inset 0 0 6px #da3b2c,inset 0 80px 80px -40px #dd4330,1px 1px 3px rgba(0,0,0,.75);
        }
        .christmas-feedback-button:not(:disabled):active {
          transform: translateY(1px);
          box-shadow: inset 1px 1px 0 rgba(255,255,255,.25),inset 0 0 6px #da3b2c,inset 0 80px 80px -40px #dd4330,0 1px 0 rgba(255,255,255,.25);
        }

        @keyframes christmasCtaPulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.07); filter: brightness(1.18); }
        }
        @keyframes christmasCtaGlow {
          0%, 100% { box-shadow: inset 1px 1px 0 rgba(255,255,255,.25), inset 0 0 6px #a23227, inset 0 80px 80px -40px #ac3223, 1px 2px 3px rgba(0,0,0,.75), 0 0 0 rgba(255,214,107,0); }
          50% { box-shadow: inset 1px 1px 0 rgba(255,255,255,.25), inset 0 0 6px #da3b2c, inset 0 80px 80px -40px #dd4330, 1px 2px 3px rgba(0,0,0,.75), 0 0 18px rgba(255,214,107,.65); }
        }
        .christmas-cta-pulse { animation: christmasCtaPulse 1.6s ease-in-out infinite, christmasCtaGlow 1.6s ease-in-out infinite; }
        .christmas-cta-pulse { min-height: 0; border-radius: 9px; }
        .christmas-cta-pulse::before { top: -6px; left: -2px; height: 19px; background-size: 41px 19px, 73px 19px, 31px 19px; }
        .christmas-cta-pulse:hover { animation-play-state: paused; }
        .christmas-snowflake { animation: christmasSnowfall var(--snow-duration) linear infinite; animation-delay: var(--snow-delay); }
        .christmas-gift { opacity: 1; animation: christmasShimmer 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .christmas-snowflake,.christmas-gift,.christmas-cta-pulse { animation: none !important; } }
        @media (prefers-reduced-motion: reduce) {
          .preview-card-animate,
          .preview-cta-blink {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" style={{ display: snowEnabled ? "block" : "none" }}>
        {snowflakes.map((flake, index) => (
          <span key={index} className="christmas-snowflake absolute top-0 rounded-full bg-white" style={{
            left: `${flake.left}%`, width: flake.size, height: flake.size,
            opacity: flake.opacity,
            ["--snow-duration" as string]: `${flake.duration}s`,
            ["--snow-delay" as string]: `${flake.delay}s`,
            ["--snow-drift" as string]: `${flake.drift}px`,
          }} />
        ))}
      </div>

      <main className="mx-auto w-full max-w-md px-4 pb-10 pt-4 font-raleway text-white">

        <section
          className="preview-card-animate relative overflow-hidden border border-white/10 px-5 py-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)] backdrop-blur-2xl"
          style={{ borderRadius: 24, background: GLASS_CARD_DARK }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              src="/client-main-card.png"
              alt=""
              className="absolute inset-y-0 right-[-15%] h-full w-[130%] max-w-none object-cover object-right opacity-78"
              draggable={false}
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(55,74,60,0.84)_0%,rgba(55,74,60,0.48)_46%,rgba(55,74,60,0.20)_100%)]" />
          </div>

          <div className="relative z-10 grid grid-cols-[1fr_auto] items-start gap-4">
            <div className="min-w-0 pt-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/80">
                {dashboardGreeting}
              </div>
              <h1 className="mt-1 text-[31px] font-black leading-[0.98] tracking-[-0.04em] text-white">
                <span className="text-[#ffd66b]">{displayName}</span>
              </h1>
              <div className="mt-3 inline-flex w-fit max-w-full flex-col items-stretch">
                <p className="whitespace-nowrap text-[13px] font-semibold text-white/72">
                  Keep collecting rewards!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsFeedbackOpen(true);
                    setFeedbackStatus(null);
                  }}
                  className="christmas-frost-button christmas-feedback-button mt-5 inline-flex w-full items-center justify-center px-2 py-1.5"
                >
                  YOUR FEEDBACK
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center pt-1">
              <div className="rounded-[15px] bg-white p-2 shadow-[0_10px_28px_rgba(0,0,0,0.14)]">
                <QRCode
                  value={profile.client_code || profile.id}
                  size={78}
                  bgColor="#ffffff"
                  fgColor="#1f2d2a"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="preview-card-animate mt-4 grid grid-cols-3 gap-3">
          {[
            { icon: "star", value: allTimeStampCount, label: "Stamps Earned" },
            { icon: "gift", value: giftsEarnedCount, label: "Gifts Earned" },
            { icon: "fire", value: displayStreakCount, label: "Weekly Visits" },
          ].map((item) => (
            <div
              key={String(item.label)}
              className="flex min-h-[82px] items-center justify-start border border-white/10 px-3 py-3 shadow-[0_14px_34px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
              style={{ borderRadius: 18, background: GLASS_CARD }}
            >
              <div className="flex w-full flex-col items-center text-center">
                <div className="flex items-center justify-center gap-2.5">
                  <div className="flex h-[21px] w-[21px] shrink-0 items-center justify-center leading-none">
                    <Image
                      src={item.icon === "star" ? "/favorite.png" : item.icon === "gift" ? "/gift-outline.png" : "/trending-topic.png"}
                      alt=""
                      width={21}
                      height={21}
                      className="h-[21px] w-[21px] object-contain"
                    />
                  </div>
                  <div className="text-[19px] font-black leading-none text-white">{item.value}</div>
                </div>
                <div className="mt-2 whitespace-nowrap text-center text-[11px] font-medium leading-[1.1] text-white/82">
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Santa's Helper challenge card: all wording, rank and countdown stay live. */}
        <section
          aria-label="Santa's Helper Christmas challenge"
          className="relative mt-4 overflow-hidden rounded-[24px] border-[2px] border-[#f5cb50]/45 bg-[#00483d] shadow-[0_18px_48px_rgba(0,0,0,.25)]"
          style={{ aspectRatio: "400 / 430", containerType: "inline-size", position: "relative", display: "block", flexShrink: 0 }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_68%_60%,rgba(28,120,139,.44),transparent_60%),linear-gradient(145deg,#003d31,#03545b_72%,#073b49)]" />

          {/* Santa/chimney scene: spans the full card width, scaled up so the PNG's transparent padding bleeds off the card edges (card is overflow-hidden). */}
          <img
            src="/christmas/santa-chimney.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute bottom-[-12cqw] left-1/2 z-[5] block h-auto w-[114%] max-w-none -translate-x-1/2"
          />

          {/* Hanging sign: sized by its own image so the text always sits on the wooden board. */}
          <div
            className="pointer-events-none absolute right-[-3.5cqw] top-[-3.5cqw] z-10 w-[41cqw]"
            style={{ containerType: "inline-size" }}
          >
            <img src="/christmas/sign.png" alt="" aria-hidden="true" draggable={false} className="block h-auto w-full" />
            <div
              className="absolute inset-x-[14%] top-[43%] -translate-y-1/2 text-center font-black leading-none tracking-[-.06em] text-[#ffe28c] drop-shadow-[0_3px_1px_#6e310d]"
              style={{ fontSize: "25cqw" }}
            >
              {daysUntilChristmas}
            </div>
            <div
              className="absolute inset-x-[12%] top-[56%] text-center font-black uppercase leading-[1.05] text-white drop-shadow-[0_2px_2px_#3c1d15]"
              style={{ fontSize: "5.8cqw" }}
            >
              Days to<br />Christmas
            </div>
          </div>

          {/* All sizes below are in cqw (1% of the card width), so the card scales as one piece on every screen. */}
          <div className="absolute z-20" style={{ left: "3.5cqw", top: "4.75cqw", width: "58cqw" }}>
            <div className="flex items-baseline whitespace-nowrap" style={{ columnGap: "2cqw" }}>
              <p className="font-black uppercase leading-[1.3] tracking-[.08em] text-[#ffdf81]" style={{ fontSize: "max(9px, 2.75cqw)" }}>{santaRankLabel}</p>
              <p className="font-bold leading-[1.2] text-[#ffe8a1]" style={{ fontSize: "max(10px, 3cqw)" }}>{santaRankMessage}</p>
            </div>
            <h2
              className="whitespace-nowrap font-black leading-[1.06] tracking-[-.035em] text-white drop-shadow-[0_3px_3px_rgba(0,0,0,.4)]"
              style={{ marginTop: "4cqw", fontSize: "8cqw" }}
            >
              <span className="block leading-[1.02] text-[#ffd66b]" style={{ fontSize: "1.4em", marginBottom: "1.5cqw" }}>Help Santa</span>
              This Christmas!
            </h2>
            <p className="font-semibold leading-[1.35] text-white/95" style={{ marginTop: "4cqw", fontSize: "max(10px, 3cqw)" }}>
              Cross the chimneys, beat your best score, and climb the leaderboard!
            </p>
            <a
              href="/dashboard-preview/christmas/game"
              className="christmas-frost-button christmas-feedback-button christmas-cta-pulse inline-flex items-center justify-center font-black uppercase shadow-lg"
              style={{ marginTop: "6cqw", width: "38.4cqw", minWidth: 134, height: "10.8cqw", minHeight: 41, fontSize: "max(13px, 3.6cqw)" }}
            >
              PLAY NOW <span aria-hidden="true" className="ml-1">▶</span>
            </a>
          </div>
        </section>

        {showGameScanCard ? (
          <section
            className="mt-4 flex items-center justify-between gap-4 border border-white/10 px-5 py-4 shadow-[0_14px_34px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
            style={{ borderRadius: 22, background: "rgba(255,214,107,0.92)" }}
          >
            <div>
              <h2 className="text-[18px] font-black text-[#26382d]">Look up. Scan. Play.</h2>
              <p className="mt-1 text-[11px] font-bold text-[#26382d]/75">
                Scan the screen QR to join the game.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void openQrScanner()}
              className="rounded-full bg-white px-4 py-2 text-[11px] font-black text-[#26382d]"
            >
              Scan QR
            </button>
          </section>
        ) : null}

        {visibleBanners.length > 0 ? (
          <section className="mt-4">
            <div
              className="relative w-full overflow-hidden border border-white/10 shadow-[0_16px_42px_rgba(0,0,0,0.15)]"
              style={{ borderRadius: 24, aspectRatio: "25 / 9" }}
            >
              {visibleBanners.map((banner, index) => {
                const image = (
                  <img
                    src={banner.image_url}
                    alt={`Dashboard promotion ${index + 1}`}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                );

                return (
                  <div
                    key={banner.id}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      index === bannerIndex
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-0"
                    }`}
                  >
                    {banner.link_url ? (
                      <a
                        href={banner.link_url}
                        target={banner.link_url.startsWith("http") ? "_blank" : undefined}
                        rel={banner.link_url.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="block h-full w-full"
                      >
                        {image}
                      </a>
                    ) : (
                      image
                    )}
                  </div>
                );
              })}
            </div>

            {visibleBanners.length > 1 ? (
              <div className="mt-3 flex items-center justify-center gap-2">
                {visibleBanners.map((banner, index) => (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => setBannerIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === bannerIndex ? "w-6 bg-[#ffd66b]" : "w-2 bg-white/25"
                    }`}
                    aria-label={`Show promotion ${index + 1}`}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section
          className="preview-card-animate mt-5 overflow-hidden border border-white/10 shadow-[0_16px_42px_rgba(0,0,0,0.13)] backdrop-blur-2xl"
          style={{ borderRadius: 24, background: GLASS_CARD }}
        >
          <div className="px-5 pb-2 pt-4">
            <h2 className="text-[22px] font-black text-white">My Stamps</h2>
          </div>

          {isLoyaltyProgramEnabled ? (
            <div className="divide-y divide-white/15">
              {displayedStampRows.map((item, index) => {
                const count = Math.max(
                  0,
                  Math.min(5, Number((item as AnyRecord).stamp_count ?? 0)),
                );
                const categoryName = extractCategoryName(item, categoryMap, index);
                const normalizedName = normalizeCategoryName(categoryName);
                const isDisabled = (item as AnyRecord).is_active === false;
                const stampTheme = getStampTheme(normalizedName);
                const activeGift = activeGiftByCategory.get(normalizedName);
                const isGiftLocked = Boolean(activeGift);

                return (
                  <div
                    key={
                      (item as AnyRecord).category_id ||
                      (item as AnyRecord).category_name ||
                      index
                    }
                    data-preview-reveal
                    className={`preview-reveal grid grid-cols-[110px_1fr_auto] items-center gap-2 px-5 py-3 ${
                      isDisabled ? "opacity-40" : ""
                    }`}
                    style={{ transitionDelay: `${index * 70}ms` }}
                  >
                    <div>
                      <div className="text-[13px] font-black uppercase tracking-[0.08em] text-white">
                        {normalizedName}
                      </div>
                      <div className="mt-1 text-[12px] font-medium text-white/55">
                        {count} / 5
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center justify-center gap-1 sm:gap-1.5">
                      {isGiftLocked ? (
                        <div className="flex w-full items-center justify-center gap-1.5 text-center text-[12px] font-black uppercase tracking-[0.08em] text-[#ffd66b]">
                          <Image
                            src="/gift.png"
                            alt=""
                            width={18}
                            height={18}
                            className="h-[18px] w-[18px] object-contain"
                          />
                          <span>Redeem Gift</span>
                        </div>
                      ) : (
                        Array.from({ length: 5 }).map((_, starIndex) => (
                          <svg
                            key={starIndex}
                            viewBox="0 0 100 100"
                            className="block h-[22px] w-[22px] min-w-[22px] shrink-0"
                            aria-hidden="true"
                          >
                            <polygon
                              points="50,5 61,36 94,36 67,56 78,89 50,69 22,89 33,56 6,36 39,36"
                              fill={starIndex < count ? "#ffd66b" : "transparent"}
                              stroke="#ffd66b"
                              strokeWidth={starIndex < count ? "3" : "3.2"}
                              strokeLinejoin="round"
                              opacity={starIndex < count ? "1" : "0.3"}
                            />
                          </svg>
                        ))
                      )}
                    </div>

                    {isGiftLocked && activeGift?.status === "available" ? (
                      <button
                        type="button"
                        onClick={() => void handleClaim(activeGift.id)}
                        disabled={claimingRewardIds.has(activeGift.id)}
                        className="preview-cta-blink min-w-[62px] rounded-[14px] bg-[#ffd66b] px-3 py-2 text-[10px] font-black tracking-[0.04em] text-[#26382d] disabled:opacity-60"
                      >
                        {claimingRewardIds.has(activeGift.id) ? "..." : "Claim"}
                      </button>
                    ) : isGiftLocked ? (
                      <div className="min-w-[62px] rounded-[14px] bg-white/10 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.04em] text-white/70">
                        Pending
                      </div>
                    ) : (
                      <div className="min-w-[54px]" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4">
              <DisabledLoyaltyProgramCard />
            </div>
          )}
        </section>

        {visibleRewards.length > 0 ? (
          <section
            className="preview-card-animate mt-5 overflow-hidden border border-white/10 shadow-[0_16px_42px_rgba(0,0,0,0.13)] backdrop-blur-2xl"
            style={{ borderRadius: 24, background: GLASS_CARD }}
          >
            <div className="px-5 pb-2 pt-4">
              <h2 className="text-[22px] font-black text-white">My Gifts</h2>
            </div>

            <div className="divide-y divide-white/15">
              {visibleRewards.map((reward, index) => {
                const state = getRewardState(reward);
                const title = previewRewardTitle(reward, index);
                const canClaim = reward.status === "available";

                return (
                  <div
                    key={reward.id}
                    data-preview-reveal
                    className="preview-reveal grid grid-cols-[58px_1fr_auto] items-center gap-3 px-5 py-4"
                    style={{ transitionDelay: `${index * 70}ms` }}
                  >
                    <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[16px] bg-white/8">
                      <Image
                        src={getRewardIcon(reward)}
                        alt=""
                        width={48}
                        height={48}
                        className="h-[48px] w-[48px] object-contain"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-black text-white">
                        {title}
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-white/66">
                        {getClaimCountdownLabel(reward) || state.label}
                      </div>
                    </div>

                    {canClaim ? (
                      <button
                        type="button"
                        onClick={() => void handleClaim(reward.id)}
                        disabled={claimingRewardIds.has(reward.id)}
                        className="min-w-[100px] rounded-[16px] bg-[#ffd66b] px-5 py-3 text-[13px] font-black text-[#26382d] shadow-[0_10px_22px_rgba(255,214,107,0.18)] disabled:opacity-60"
                      >
                        {claimingRewardIds.has(reward.id) ? "Claiming..." : "Claim"}
                      </button>
                    ) : (
                      <div className="min-w-[88px] rounded-[14px] bg-white/8 px-4 py-2.5 text-center text-[11px] font-black text-white/70">
                        {state.action}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="preview-card-animate mt-5 pb-7">
          <div
            className="mx-auto w-full rounded-[34px] border border-white/10 px-5 py-5"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div className="mb-4 text-left text-[22px] font-black text-white">
              Follow Us
            </div>

            <div className="flex items-center justify-between">
              {[
                ["https://www.instagram.com/pros_cafe", "/instagram.png", "Instagram"],
                ["https://www.tiktok.com/@pros_cafe", "/tik-tok.png", "TikTok"],
                ["https://wa.me/9613720277", "/whatsapp.png", "WhatsApp"],
                ["https://fb.com/proscafe", "/facebook.png", "Facebook"],
                ["https://shark-accounting.com/menu/Pros_cafe_dekwaneh/", "/dish.png", "Menu"],
              ].map(([href, src, alt]) => (
                <a
                  key={alt}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={alt}
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/0"
                >
                  <Image
                    src={src}
                    alt={alt}
                    width={27}
                    height={27}
                    className="h-[27px] w-[27px] object-contain brightness-0 invert"
                  />
                </a>
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

        {isQrScannerOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
            <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-white/15 bg-[#1c2530] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                    Scan QR
                  </div>
                  <div className="mt-1 text-[18px] font-black text-white">
                    Join the game
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeQrScanner}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[20px] font-black text-white"
                  aria-label="Close QR scanner"
                >
                  ×
                </button>
              </div>

              <div className="relative overflow-hidden rounded-[18px] bg-black">
                <video
                  ref={qrVideoRef}
                  className="h-[320px] w-full object-cover"
                  muted
                  playsInline
                  autoPlay
                />
              </div>

              {qrScannerStatus ? (
                <p className="mt-3 text-center text-[13px] font-bold leading-5 text-white/75">
                  {qrScannerStatus}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void openQrScanner()}
                className="mt-3 w-full rounded-full bg-white/14 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
              >
                Restart Camera
              </button>
            </div>
          </div>
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
              style={{
                borderRadius: 24,
                background: "linear-gradient(155deg,#4b6350,#334a39)",
              }}
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

              <h3 className="pr-9 text-[24px] font-black leading-tight text-[#ffd66b]">
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
                className="mt-4 w-full resize-none rounded-[16px] border border-white/18 bg-white px-4 py-3 font-raleway text-[14px] font-semibold text-[#243744] outline-none"
              />

              {feedbackStatus ? (
                <div className="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-[12px] font-bold text-white">
                  {feedbackStatus}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void sendFeedback()}
                disabled={isSendingFeedback}
                className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-[#ffd66b] px-5 py-3 font-raleway text-[15px] font-bold text-[#1c2530] disabled:opacity-60"
              >
                {isSendingFeedback ? "Sending..." : "Send Feedback"}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );

}

export default ChristmasDashboard;