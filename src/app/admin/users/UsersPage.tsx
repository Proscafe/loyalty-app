"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toast } from "@/components/Toast";
import { AdminMobileFloatingMenu } from "@/components/AdminMobileFloatingMenu";
import { AdminMobileHeader } from "@/components/AdminMobileHeader";
import { AdminSidebar } from "@/components/AdminSidebar";
import type { Profile, Reward, StampTransaction, UserRole } from "@/types";

type AdminUser = Profile & {
  is_active?: boolean | null;
  gender?: string | null;
  totalVisits?: number;
  lastVisit?: string | null;
  daysSinceLastVisit?: number | null;
  giftsCount?: number;
  lifetimeValue?: number;
  stamps?: { category_id: string; stamp_count: number }[];
  playedFromGames?: boolean;
  gamePlayerId?: string | null;
  isGameOnly?: boolean;
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

const PAGE_BG = "bg-[radial-gradient(circle_at_top_left,rgba(255,214,107,0.24),transparent_28%),linear-gradient(135deg,#365665_0%,#263f49_48%,#798673_100%)]";
const CUSTOMER_TABLE_GRID =
  "minmax(130px,1fr) minmax(90px,0.6fr) minmax(78px,0.5fr) minmax(62px,0.38fr) minmax(52px,0.32fr) minmax(76px,0.48fr) minmax(52px,0.32fr) minmax(76px,0.48fr) minmax(178px,0.95fr) minmax(118px,0.7fr)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMoneyValue(value: string | number | null | undefined) {
  const numberValue =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(numberValue) ? numberValue : 0;
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

type DesktopTimeRange = "today" | "week" | "month" | "all";
type DesktopProfileTab = "all" | UserRole | "deactivated";
type DesktopSmartSegment =
  | "all"
  | "active"
  | "new"
  | "returning"
  | "one_time"
  | "high_spenders"
  | "inactive_30"
  | "at_risk"
  | "lost"
  | "from_games";
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


function normalizePhoneForMatch(value?: string | null) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("961")) {
    const without = digits.slice(3);
    return without.length === 7 ? `0${without}` : without;
  }
  if (digits.length === 7) return `0${digits}`;
  if (digits.length > 8) return digits.slice(-8);
  return digits;
}

function getGameRowClientId(row: any) {
  return String(row?.client_id ?? row?.profile_id ?? row?.user_id ?? row?.customer_id ?? "").trim();
}

function getGameRowPlayerId(row: any) {
  return String(row?.player_id ?? row?.id ?? row?.entry_id ?? row?.prediction_id ?? "").trim();
}

function getGameRowName(row: any) {
  return String(
    row?.full_name ??
      row?.client_name ??
      row?.player_name ??
      row?.name ??
      row?.user_name ??
      row?.display_name ??
      "",
  ).trim();
}

function getGameRowPhone(row: any) {
  return String(
    row?.phone ??
      row?.client_phone ??
      row?.player_phone ??
      row?.user_phone ??
      row?.mobile ??
      row?.contact ??
      "",
  ).trim();
}

function getGameRowDate(row: any) {
  return String(
    row?.last_played_at ??
      row?.first_played_at ??
      row?.submitted_at ??
      row?.created_at ??
      row?.updated_at ??
      "",
  ).trim();
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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


function DesktopEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-white/22 bg-white/12 p-5 text-center text-[14px] font-bold text-white/70 shadow-[0_18px_46px_rgba(54,86,101,0.08)]">
      {text}
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



// ─── Main UsersPage Component ─────────────────────────────────────────────────

export function UsersPage({ adminId }: { adminId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");

  // Data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [activityTxns, setActivityTxns] = useState<StampTransaction[]>([]);
  const [rewardRows, setRewardRows] = useState<any[]>([]);
  const [gamePredictionRows, setGamePredictionRows] = useState<any[]>([]);
  const [gamePlayersRefreshError, setGamePlayersRefreshError] = useState<string | null>(null);
  const [gamePlayerRows, setGamePlayerRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const adminProfile = useMemo(
    () =>
      ((users.find((user) => user.id === adminId) ?? {
        id: adminId,
        full_name: "Admin",
        email: null,
        role: "master_admin",
      }) as Profile),
    [adminId, users],
  );

  // Selected user profile
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<AdminCategory[]>([]);
  const [selectedStamps, setSelectedStamps] = useState<AdminClientStamp[]>([]);
  const [selectedRewards, setSelectedRewards] = useState<Reward[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleUserCount, setVisibleUserCount] = useState(50);
  const [filter, setFilter] = useState<DesktopProfileTab>("client");
  const [timeRange, setTimeRange] = useState<DesktopTimeRange>("month");
  const [lastVisitFilter, setLastVisitFilter] = useState<"all" | "active" | "inactive">("all");
  const [customerStatusFilter, setCustomerStatusFilter] = useState<"all" | "active" | "inactive" | "at_risk" | "vip">("all");
  const [customerGenderFilter, setCustomerGenderFilter] = useState<"all" | "male" | "female">("all");
  const [customerAgeRangeFilter, setCustomerAgeRangeFilter] = useState<"all" | "18-24" | "25-34" | "35-44" | "45+">("all");
  const [customerVisitRangeFilter, setCustomerVisitRangeFilter] = useState<"all" | "0" | "1-3" | "4-10" | "10+">("all");
  const [reportFiltersOpen, setReportFiltersOpen] = useState(false);
  const reportFilterRef = useRef<HTMLDivElement | null>(null);
  const [customerSort, setCustomerSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "lifetime", direction: "desc" });
  const [smartSegment, setSmartSegment] = useState<DesktopSmartSegment>("all");

  const [contactHistory, setContactHistory] = useState<Record<string, string[]>>({});

  function flash(message: string, t: "success" | "error" = "success") {
    setTone(t);
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  }

  function sharedContactKeys(phone?: string | null, email?: string | null, fallback?: string | null) {
    const keys: string[] = [];
    const phoneKey = normalizePhoneForMatch(phone);
    if (phoneKey) keys.push(`contact-phone-${phoneKey}`);
    const emailKey = (email ?? "").trim().toLowerCase();
    if (emailKey) keys.push(`contact-email-${emailKey}`);
    const fallbackKey = (fallback ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (fallbackKey) keys.push(`contact-name-${fallbackKey}`);
    return Array.from(new Set(keys.length ? keys : ["contact-unknown"]));
  }

  function contactHistoryForKeys(keys: string[]) {
    const all = keys.flatMap(k => contactHistory[k] ?? []);
    return Array.from(new Set(all.filter(Boolean))).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).slice(0, 20);
  }

  function markCustomerContacted(user: AdminUser) {
    const keys = sharedContactKeys(user.phone, user.email, user.full_name || user.id);
    const date = new Date().toISOString();
    const previous = contactHistoryForKeys(keys);
    const saved = [date, ...previous].slice(0, 20);
    const next = { ...contactHistory };
    keys.forEach(k => { next[k] = saved; });
    setContactHistory(next);
    try { window.localStorage.setItem("proscafe_users_contact_history", JSON.stringify(next)); } catch {}
    void fetch("/api/admin/contact-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys, contacted_at: date, source: "Customer behavior", source_id: user.id }),
    }).catch(() => {});
    flash("Contact saved.");
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("proscafe_users_contact_history");
      if (stored) setContactHistory(JSON.parse(stored) as Record<string, string[]>);
    } catch {}
    fetch("/api/admin/contact-history", { cache: "no-store" })
      .then(r => r.json())
      .then((data: any) => {
        if (data?.history) {
          setContactHistory(prev => {
            const merged: Record<string, string[]> = { ...prev };
            Object.entries(data.history as Record<string, string[]>).forEach(([k, dates]) => {
              const existing = merged[k] ?? [];
              merged[k] = Array.from(new Set([...existing, ...dates])).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).slice(0, 20);
            });
            try { window.localStorage.setItem("proscafe_users_contact_history", JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // ── Data loading — uses Supabase client directly, same as AdminDashboard ────

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [profilesRes, txnsRes, rewardsRes, categoriesRes, gamePredictionsRes, gamePlayersRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, phone, client_code, role, is_active, gender, birthday, created_at")
            .order("created_at", { ascending: false }),

          supabase
            .from("stamp_transactions")
            .select("*")
            .neq("action_type", "manual_adjustment")
            .order("created_at", { ascending: false })
            .limit(1000),

          supabase
            .from("rewards")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1000),

          supabase
            .from("loyalty_categories")
            .select("id, name, average_price, sort_order")
            .order("sort_order", { ascending: true }),

          supabase
            .from("prediction_entries")
            .select("*, prediction_matches(match_label, home_team, away_team, kickoff_at)")
            .order("created_at", { ascending: false })
            .limit(5000),

          fetch("/api/admin/game-players", { cache: "no-store" })
            .then(async (response) => {
              const json = await response.json().catch(() => ({}));

              if (!response.ok) {
                return {
                  data: [],
                  error: { message: json?.error || "Could not load game players." },
                };
              }

              return {
                data: json?.players ?? [],
                error: null,
              };
            })
            .catch((error) => ({
              data: [],
              error: { message: error instanceof Error ? error.message : "Could not load game players." },
            })),
        ]);

        if (!isMounted) return;

        // Log any errors to help debug
        if (profilesRes.error) console.error("[UsersPage] profiles error:", profilesRes.error);
        if (txnsRes.error) console.error("[UsersPage] txns error:", txnsRes.error);
        if (rewardsRes.error) console.error("[UsersPage] rewards error:", rewardsRes.error);
        if (gamePredictionsRes.error) console.warn("[UsersPage] prediction entries unavailable:", gamePredictionsRes.error.message);
        if (gamePlayersRes.error) console.warn("[UsersPage] game players database unavailable:", gamePlayersRes.error.message);
        console.log("[UsersPage] loaded:", {
          profiles: profilesRes.data?.length,
          txns: txnsRes.data?.length,
          rewards: rewardsRes.data?.length,
          predictionEntries: gamePredictionsRes.data?.length,
          gamePlayersDatabase: gamePlayersRes.data?.length,
        });

        const txns = (txnsRes.data ?? []) as StampTransaction[];
        const rewards = rewardsRes.data ?? [];
        const cats = (categoriesRes.data ?? []) as AdminCategory[];

        // Build price map
        const priceByCategory = new Map<string, number>();
        cats.forEach((c: AdminCategory) => {
          if (c.average_price) priceByCategory.set(c.id, parseMoneyValue(c.average_price));
        });

        // Per-user enrichment
        const visitDaysByUser = new Map<string, Set<string>>();
        const lastVisitByUser = new Map<string, string>();
        const lifetimeByUser  = new Map<string, number>();

        txns.forEach((txn: any) => {
          if (!txn.client_id) return;
          // Visit day key (Beirut +3)
          const d = new Date(txn.created_at);
          if (!Number.isNaN(d.getTime())) {
            const beirut = new Date(d.getTime() + 3 * 60 * 60 * 1000);
            const key = `${beirut.getUTCFullYear()}-${String(beirut.getUTCMonth() + 1).padStart(2, "0")}-${String(beirut.getUTCDate()).padStart(2, "0")}`;
            if (!visitDaysByUser.has(txn.client_id)) visitDaysByUser.set(txn.client_id, new Set());
            visitDaysByUser.get(txn.client_id)!.add(key);
          }
          const existing = lastVisitByUser.get(txn.client_id);
          if (!existing || txn.created_at > existing) lastVisitByUser.set(txn.client_id, txn.created_at);
          if (txn.action_type === "add_stamp") {
            const price = priceByCategory.get(txn.category_id ?? "") ?? 0;
            lifetimeByUser.set(txn.client_id, (lifetimeByUser.get(txn.client_id) ?? 0) + price);
          }
        });

        const rewardsByUser = new Map<string, number>();
        (rewards as any[]).forEach((r: any) => {
          if (!r.client_id) return;
          rewardsByUser.set(r.client_id, (rewardsByUser.get(r.client_id) ?? 0) + 1);
        });

        const gameRows = [
          ...((gamePlayersRes.data ?? []) as any[]),
          ...((gamePredictionsRes.data ?? []) as any[]),
        ];

        const gameStatsByKey = new Map<
          string,
          { rows: number; lastPlayed: string | null; name: string; phone: string; clientId: string; playerId: string }
        >();

        gameRows.forEach((row: any) => {
          const clientId = getGameRowClientId(row);
          const phone = getGameRowPhone(row);
          const normalizedPhone = normalizePhoneForMatch(phone);
          const name = getGameRowName(row);
          const playerId = getGameRowPlayerId(row);
          const key =
            clientId ||
            (normalizedPhone ? `phone:${normalizedPhone}` : "") ||
            (name ? `name:${name.toLowerCase()}` : "") ||
            (playerId ? `player:${playerId}` : "");

          if (!key) return;

          const playedAt = getGameRowDate(row);
          const existing = gameStatsByKey.get(key) ?? {
            rows: 0,
            lastPlayed: null,
            name,
            phone,
            clientId,
            playerId,
          };

          existing.rows += 1;
          if (!existing.name && name) existing.name = name;
          if (!existing.phone && phone) existing.phone = phone;
          if (!existing.clientId && clientId) existing.clientId = clientId;
          if (!existing.playerId && playerId) existing.playerId = playerId;
          if (playedAt && (!existing.lastPlayed || new Date(playedAt).getTime() > new Date(existing.lastPlayed).getTime())) {
            existing.lastPlayed = playedAt;
          }

          gameStatsByKey.set(key, existing);
        });

        const usedGameKeys = new Set<string>();

        const enriched = ((profilesRes.data ?? []) as any[]).map((p: any) => {
          const profilePhone = normalizePhoneForMatch(p.phone);
          const profileName = String(p.full_name ?? "").trim().toLowerCase();
          const matchingGameKey =
            (gameStatsByKey.has(p.id) ? p.id : "") ||
            (profilePhone && gameStatsByKey.has(`phone:${profilePhone}`) ? `phone:${profilePhone}` : "") ||
            (profileName && gameStatsByKey.has(`name:${profileName}`) ? `name:${profileName}` : "");

          const gameStats = matchingGameKey ? gameStatsByKey.get(matchingGameKey) : null;
          if (matchingGameKey) usedGameKeys.add(matchingGameKey);

          return {
            ...p,
            playedFromGames: Boolean(gameStats),
            gamePlayerId: gameStats?.playerId ?? null,
            totalVisits:        visitDaysByUser.get(p.id)?.size ?? 0,
            lastVisit:          lastVisitByUser.get(p.id) ?? null,
            daysSinceLastVisit: lastVisitByUser.get(p.id)
              ? Math.floor((Date.now() - new Date(lastVisitByUser.get(p.id)!).getTime()) / 86400000)
              : null,
            giftsCount:   rewardsByUser.get(p.id) ?? 0,
            lifetimeValue: lifetimeByUser.get(p.id) ?? 0,
          };
        });

        const gameOnlyUsers = Array.from(gameStatsByKey.entries())
          .filter(([key]) => !usedGameKeys.has(key))
          .map(([key, gameStats]) => {
            const lastPlayed = gameStats.lastPlayed ?? null;
            const safeId = key.replace(/[^a-zA-Z0-9_-]+/g, "-");

            return {
              id: `game-${safeId}`,
              full_name: gameStats.name || "Game Player",
              email: null,
              phone: gameStats.phone || null,
              client_code: gameStats.playerId ? `GAME-${gameStats.playerId.slice(-6).toUpperCase()}` : "GAME PLAYER",
              role: "client" as UserRole,
              is_active: true,
              gender: null,
              birthday: null,
              created_at: lastPlayed,
              playedFromGames: true,
              gamePlayerId: gameStats.playerId || null,
              isGameOnly: true,
              totalVisits: gameStats.rows,
              lastVisit: lastPlayed,
              daysSinceLastVisit: lastPlayed
                ? Math.floor((Date.now() - new Date(lastPlayed).getTime()) / 86400000)
                : null,
              giftsCount: 0,
              lifetimeValue: 0,
            };
          });

        setUsers([...enriched, ...gameOnlyUsers] as AdminUser[]);
        setCategories(cats);
        setActivityTxns(txns);
        setRewardRows((rewards as any[]) ?? []);
        setGamePredictionRows((gamePredictionsRes.data ?? []) as any[]);
        setGamePlayerRows((gamePlayersRes.data ?? []) as any[]);
      } catch (err) {
        flash(err instanceof Error ? err.message : "Could not load data.", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadData();
    return () => { isMounted = false; };
  }, []);

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!reportFiltersOpen) return;
    function close(e: MouseEvent | TouchEvent) {
      if (!reportFilterRef.current?.contains(e.target as Node)) setReportFiltersOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, [reportFiltersOpen]);

  // ── User profile ─────────────────────────────────────────────────────────────

  async function openUserProfile(user: AdminUser) {
    router.push(`/admin/users/${user.id}`);
  }

  useEffect(() => {
    if (loading || users.length === 0) return;

    let requestedClient = "";
    try {
      const params = new URLSearchParams(window.location.search);
      requestedClient =
        params.get("client") ??
        params.get("client_id") ??
        window.sessionStorage.getItem("proscafe_open_client_id") ??
        "";
    } catch {}

    requestedClient = requestedClient.trim();
    if (!requestedClient) return;

    const user = users.find(
      (item) =>
        item.id === requestedClient ||
        String(item.client_code ?? "").toLowerCase() === requestedClient.toLowerCase(),
    );

    if (!user) return;

    try {
      window.sessionStorage.removeItem("proscafe_open_client_id");
      const url = new URL(window.location.href);
      url.searchParams.delete("client");
      url.searchParams.delete("client_id");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {}

    setFilter("client");
    void openUserProfile(user);
  }, [loading, users]);

  async function setRole(userId: string, role: UserRole) {
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, action: "set_role", role }) });
    const json = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) { flash(json.error ?? "Could not update role.", "error"); return; }
    setUsers(cur => cur.map(u => u.id === userId ? { ...u, role } : u));
    setSelectedUser(prev => prev?.id === userId ? { ...prev, role } : prev);
    flash("Role updated.");
  }

  async function deactivateUser(userId: string) {
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, action: "deactivate" }) });
    const json = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) { flash(json.error ?? "Could not deactivate.", "error"); return; }
    setUsers(cur => cur.map(u => u.id === userId ? { ...u, is_active: false } : u));
    setSelectedUser(prev => prev?.id === userId ? { ...prev, is_active: false } : prev);
    flash("User deactivated.");
  }

  async function reactivateUser(userId: string, role: UserRole) {
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, action: "reactivate", role }) });
    const json = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) { flash(json.error ?? "Could not reactivate.", "error"); return; }
    setUsers(cur => cur.map(u => u.id === userId ? { ...u, is_active: true, role } : u));
    setSelectedUser(prev => prev?.id === userId ? { ...prev, is_active: true, role } : prev);
    flash("User reactivated.");
  }

  async function addStampToSelectedClient(categoryId: string) {
    if (!selectedUser) return;
    const currentRow = selectedStamps.find(s => s.category_id === categoryId);
    const currentCount = Math.max(0, currentRow?.stamp_count ?? 0);
    const nextCount = Math.min(currentCount + 1, 5);
    setSelectedLoading(true);

    const stampError = currentRow
      ? (await supabase.from("client_stamps").update({ stamp_count: nextCount, updated_at: new Date().toISOString() }).eq("client_id", selectedUser.id).eq("category_id", categoryId)).error
      : (await supabase.from("client_stamps").insert({ client_id: selectedUser.id, category_id: categoryId, stamp_count: nextCount, updated_at: new Date().toISOString() })).error;

    if (stampError) { flash(stampError.message, "error"); setSelectedLoading(false); return; }

    await supabase.from("stamp_transactions").insert({ client_id: selectedUser.id, category_id: categoryId, action_type: "add_stamp", stamp_count: 1, staff_id: adminId, created_at: new Date().toISOString() });

    if (nextCount >= 5) {
      const categoryName = selectedCategories.find(c => c.id === categoryId)?.name?.toLowerCase() ?? "";
      const rewardType = categoryName.includes("sandwich") ? "Free Sandwich" : categoryName.includes("main") ? "Free Main Course" : categoryName.includes("dessert") ? "Free Dessert" : categoryName.includes("coffee") ? "Free Coffee" : categoryName.includes("hooka") || categoryName.includes("hookah") ? "Free Hooka" : "Free Reward";
      await supabase.from("rewards").insert({ client_id: selectedUser.id, category_id: categoryId, reward_type: rewardType, status: "available", earned_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString() });
      await supabase.from("client_stamps").update({ stamp_count: 0, updated_at: new Date().toISOString() }).eq("client_id", selectedUser.id).eq("category_id", categoryId);
      await supabase.from("stamp_transactions").insert({ client_id: selectedUser.id, category_id: categoryId, action_type: "reward_earned", stamp_count: 5, staff_id: adminId, created_at: new Date().toISOString() });
      flash("Gift earned.");
      await openUserProfile(selectedUser);
      return;
    }
    flash("Stamp added.");
    await openUserProfile(selectedUser);
  }

  async function removeStampFromSelectedClient(categoryId: string) {
    if (!selectedUser) return;
    const currentRow = selectedStamps.find(s => s.category_id === categoryId);
    const currentCount = Math.max(0, currentRow?.stamp_count ?? 0);
    if (!currentRow || currentCount <= 0) { flash("No stamp to remove.", "error"); return; }
    setSelectedLoading(true);
    const nextCount = Math.max(0, currentCount - 1);
    const { error } = await supabase.from("client_stamps").update({ stamp_count: nextCount, updated_at: new Date().toISOString() }).eq("client_id", selectedUser.id).eq("category_id", categoryId);
    if (error) { flash(error.message, "error"); setSelectedLoading(false); return; }
    flash("Stamp removed.");
    await openUserProfile(selectedUser);
  }

  async function sendGiftToSelectedClient(gift: string, description: string) {
    if (!selectedUser) return;
    const giftName = gift.trim();
    if (!giftName) { flash("Gift is required.", "error"); return; }
    const matchedCategory = selectedCategories.find(c => {
      const cn = c.name.toLowerCase(); const rn = giftName.toLowerCase();
      return rn.includes(cn) || cn.includes(rn) || (rn.includes("hooka") && cn.includes("hooka")) || (rn.includes("dessert") && cn.includes("dessert")) || (rn.includes("sandwich") && cn.includes("sandwich")) || (rn.includes("coffee") && cn.includes("coffee")) || (rn.includes("main") && cn.includes("main"));
    }) ?? selectedCategories[0];
    if (!matchedCategory?.id) { flash("No loyalty category found for this gift.", "error"); return; }
    setSelectedLoading(true);
    const rewardType = description ? `Sent Gift - ${giftName} - ${description}` : `Sent Gift - ${giftName}`;
    const { error } = await supabase.from("rewards").insert({ client_id: selectedUser.id, category_id: matchedCategory.id, reward_type: rewardType, status: "available", earned_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString() });
    if (error) { flash(error.message, "error"); setSelectedLoading(false); return; }
    flash("Gift sent.");
    await openUserProfile(selectedUser);
  }

  // ── Filtering & sorting ──────────────────────────────────────────────────────

  const customerReportRows = useMemo(() => {
    return users.filter(u => u.role === "client").map(user => {
      // Use server-enriched fields from /api/admin/users
      const totalVisits      = user.totalVisits ?? 0;
      const lastVisit        = user.lastVisit ?? null;
      const giftsCount       = user.giftsCount ?? 0;
      const lifetimeValue    = user.lifetimeValue ?? 0;
      const age              = getAgeFromBirthday(getBirthdayValue(user));

      const lastVisitMs = lastVisit ? new Date(lastVisit).getTime() : NaN;
      const daysSinceLastVisit = user.daysSinceLastVisit ??
        (Number.isFinite(lastVisitMs)
          ? Math.floor((Date.now() - lastVisitMs) / (24 * 60 * 60 * 1000))
          : null);

      // Match AdminDashboard logic exactly
      const inactive =
        user.is_active === false ||
        !Number.isFinite(lastVisitMs) ||
        Date.now() - lastVisitMs > 30 * 24 * 60 * 60 * 1000;

      const isAtRisk =
        daysSinceLastVisit !== null &&
        daysSinceLastVisit >= 30 &&
        daysSinceLastVisit <= 60;

      const isVip = lifetimeValue >= 200 || totalVisits >= 10;

      const tier =
        totalVisits >= 15 ? "Gold" :
        totalVisits >= 7  ? "Silver" :
        totalVisits >= 2  ? "Bronze" : "New";

      return {
        user, tier, lastVisit, daysSinceLastVisit, totalVisits,
        giftsCount, lifetimeValue, value: lifetimeValue,
        age, inactive, isAtRisk, isVip, isInactive: inactive,
      };
    });
  }, [users]);

  const allProfileReportRows = useMemo(() => {
    return users.map(user => {
      const totalVisits      = user.totalVisits ?? 0;
      const lastVisit        = user.lastVisit ?? null;
      const giftsCount       = user.giftsCount ?? 0;
      const lifetimeValue    = user.lifetimeValue ?? 0;
      const age              = getAgeFromBirthday(getBirthdayValue(user));

      const lastVisitMs = lastVisit ? new Date(lastVisit).getTime() : NaN;
      const daysSinceLastVisit = user.daysSinceLastVisit ??
        (Number.isFinite(lastVisitMs)
          ? Math.floor((Date.now() - lastVisitMs) / (24 * 60 * 60 * 1000))
          : null);

      const inactive =
        user.is_active === false ||
        !Number.isFinite(lastVisitMs) ||
        Date.now() - lastVisitMs > 30 * 24 * 60 * 60 * 1000;

      const isAtRisk =
        daysSinceLastVisit !== null &&
        daysSinceLastVisit >= 30 &&
        daysSinceLastVisit <= 60;

      const isVip = lifetimeValue >= 200 || totalVisits >= 10;

      const tier =
        totalVisits >= 15 ? "Gold" :
        totalVisits >= 7  ? "Silver" :
        totalVisits >= 2  ? "Bronze" : "New";

      return {
        user, tier, lastVisit, daysSinceLastVisit, totalVisits,
        giftsCount, lifetimeValue, value: lifetimeValue,
        age, inactive, isAtRisk, isVip, isInactive: inactive,
      };
    });
  }, [users]);

  const fromGamesUserIds = useMemo(() => {
    const ids = new Set<string>();

    function addMatchedGameUser(row: any, dateFields: string[]) {
      const created =
        dateFields.map((key) => row?.[key]).find(Boolean) ??
        row?.last_played_at ??
        row?.first_played_at ??
        row?.created_at ??
        row?.updated_at ??
        null;

      if (created && !isWithinDesktopTimeRange(created, timeRange)) return;
      if (!created && timeRange !== "all") return;

      const directId = getGameRowClientId(row);
      if (directId) ids.add(directId);

      const rowPhoneRaw = getGameRowPhone(row);
      const rowNameRaw = getGameRowName(row);
      const rowPlayerId = getGameRowPlayerId(row);
      const syntheticKey =
        directId ||
        (normalizePhoneForMatch(rowPhoneRaw) ? `phone:${normalizePhoneForMatch(rowPhoneRaw)}` : "") ||
        (rowNameRaw ? `name:${rowNameRaw.toLowerCase()}` : "") ||
        (rowPlayerId ? `player:${rowPlayerId}` : "");

      if (syntheticKey) ids.add(`game-${syntheticKey.replace(/[^a-zA-Z0-9_-]+/g, "-")}`);

      const phone = normalizePhoneForMatch(
        row?.phone ??
          row?.client_phone ??
          row?.player_phone ??
          row?.user_phone ??
          row?.mobile ??
          row?.contact ??
          null,
      );
      if (phone) {
        users.forEach((user) => {
          if (normalizePhoneForMatch(user.phone) === phone) ids.add(user.id);
        });
      }

      const name = String(
        row?.full_name ??
          row?.client_name ??
          row?.player_name ??
          row?.name ??
          row?.user_name ??
          "",
      )
        .trim()
        .toLowerCase();
      if (name) {
        users.forEach((user) => {
          if (String(user.full_name ?? "").trim().toLowerCase() === name) ids.add(user.id);
        });
      }
    }

    // Preferred source: the dedicated table created from Games players.
    gamePlayerRows.forEach((row) => {
      addMatchedGameUser(row, ["last_played_at", "first_played_at", "created_at", "updated_at"]);
    });

    // Fallback source: raw prediction entries, when available.
    gamePredictionRows.forEach((row) => {
      addMatchedGameUser(row, ["created_at", "updated_at", "submitted_at"]);
    });

    // Fallback source: rewards created by game winners.
    rewardRows.forEach((row) => {
      const isGameReward =
        row?.source === "game_prediction" ||
        row?.source_match_id ||
        String(row?.reward_type ?? row?.reward_name ?? row?.title ?? "")
          .toLowerCase()
          .includes("prediction");
      if (!isGameReward) return;

      addMatchedGameUser(row, ["created_at", "earned_at", "updated_at"]);
    });

    return ids;
  }, [gamePlayerRows, gamePredictionRows, rewardRows, timeRange, users]);

  const filteredCustomerReportRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const normalizedSearch = normalizePhoneForMatch(searchTerm.trim());

    return allProfileReportRows.filter(row => {
      const user = row.user;
      const isClient = user.role === "client";

      if (filter === "deactivated") {
        if (user.is_active !== false) return false;
      } else if (filter !== "all" && user.role !== filter) {
        return false;
      }

      if (smartSegment !== "all") {
        if (!isClient) return false;
        if (smartSegment === "active" && (!row.lastVisit || row.inactive)) return false;
        if (smartSegment === "from_games" && !fromGamesUserIds.has(user.id)) return false;
        if (smartSegment === "new" && row.totalVisits > 1) return false;
        if (smartSegment === "returning" && row.totalVisits <= 1) return false;
        if (smartSegment === "one_time" && row.totalVisits !== 1) return false;
        if (smartSegment === "high_spenders" && row.lifetimeValue < 100) return false;
        if (smartSegment === "inactive_30" && (row.daysSinceLastVisit === null || row.daysSinceLastVisit < 30)) return false;
        if (smartSegment === "at_risk" && !row.isAtRisk) return false;
        if (smartSegment === "lost" && (row.daysSinceLastVisit === null || row.daysSinceLastVisit < 60)) return false;
      }

      // Client activity filters should not hide Staff/Admin rows.
      // This keeps the desktop Profile Tab filter working for Staff and Admin.
      if (isClient) {
        const created = (user as any).created_at;
        if (smartSegment !== "from_games" && !isWithinDesktopTimeRange(created, timeRange)) return false;
        if (lastVisitFilter === "active" && (row.daysSinceLastVisit === null || row.daysSinceLastVisit > 14)) return false;
        if (lastVisitFilter === "inactive" && (row.daysSinceLastVisit === null || row.daysSinceLastVisit <= 14)) return false;
        if (customerStatusFilter === "active" && (row.daysSinceLastVisit === null || row.daysSinceLastVisit > 7)) return false;
        if (customerStatusFilter === "inactive" && (row.daysSinceLastVisit === null || row.daysSinceLastVisit <= 30)) return false;
        if (customerStatusFilter === "at_risk" && !row.isAtRisk) return false;
        if (customerStatusFilter === "vip" && !row.isVip) return false;
        if (customerGenderFilter !== "all" && (user.gender ?? "").toLowerCase() !== customerGenderFilter) return false;
        if (customerAgeRangeFilter !== "all") {
          const age = row.age;
          if (age === null) return false;
          if (customerAgeRangeFilter === "18-24" && (age < 18 || age > 24)) return false;
          if (customerAgeRangeFilter === "25-34" && (age < 25 || age > 34)) return false;
          if (customerAgeRangeFilter === "35-44" && (age < 35 || age > 44)) return false;
          if (customerAgeRangeFilter === "45+" && age < 45) return false;
        }
      }

      if (!search) return true;
      const phone = normalizePhoneForMatch(user.phone);
      if (phone && normalizedSearch && phone.includes(normalizedSearch)) return true;
      return [user.full_name, user.email, user.phone, user.client_code, desktopRoleLabel(user.role), user.is_active === false ? "deactivated" : "active"].filter(Boolean).join(" ").toLowerCase().includes(search);
    });
  }, [allProfileReportRows, filter, smartSegment, timeRange, searchTerm, lastVisitFilter, customerStatusFilter, customerGenderFilter, customerAgeRangeFilter, fromGamesUserIds]);

  const sortedCustomerReportRows = useMemo(() => {
    const dir = customerSort.direction === "asc" ? 1 : -1;
    return filteredCustomerReportRows.slice().sort((a, b) => {
      if (customerSort.key === "name") return (a.user.full_name || "").localeCompare(b.user.full_name || "") * dir;
      if (customerSort.key === "contact") return ((a.user.phone || a.user.email || "").localeCompare(b.user.phone || b.user.email || "")) * dir;
      if (customerSort.key === "lastVisit") return ((new Date(a.lastVisit || 0).getTime() || 0) - (new Date(b.lastVisit || 0).getTime() || 0)) * dir;
      if (customerSort.key === "daysAgo") return ((a.daysSinceLastVisit ?? 99999) - (b.daysSinceLastVisit ?? 99999)) * dir;
      if (customerSort.key === "visits") return (a.totalVisits - b.totalVisits) * dir;
      if (customerSort.key === "lifetime") return (a.lifetimeValue - b.lifetimeValue) * dir;
      if (customerSort.key === "gifts") return (a.giftsCount - b.giftsCount) * dir;
      if (customerSort.key === "status") return (Number(a.isInactive) - Number(b.isInactive)) * dir;
      return 0;
    });
  }, [customerSort, filteredCustomerReportRows]);

  const mobileFilteredCustomerRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const normalizedSearch = normalizePhoneForMatch(searchTerm.trim());

    return allProfileReportRows.filter(row => {
      const user = row.user;
      const isClient = user.role === "client";

      if (filter !== "all" && user.role !== filter) return false;

      // Date and last-visit filters are customer activity filters, so they should not hide Staff/Admin.
      if (isClient) {
        const created = (user as any).created_at;
        if (!isWithinDesktopTimeRange(created, timeRange)) return false;
        if (lastVisitFilter === "active" && (row.daysSinceLastVisit === null || row.daysSinceLastVisit > 14)) return false;
        if (lastVisitFilter === "inactive" && (row.daysSinceLastVisit === null || row.daysSinceLastVisit <= 14)) return false;
      }

      if (!search) return true;
      const phone = normalizePhoneForMatch(user.phone);
      if (phone && normalizedSearch && phone.includes(normalizedSearch)) return true;
      return [user.full_name, user.email, user.phone, user.client_code, desktopRoleLabel(user.role), user.is_active === false ? "deactivated" : "active"].filter(Boolean).join(" ").toLowerCase().includes(search);
    });
  }, [allProfileReportRows, filter, timeRange, searchTerm, lastVisitFilter]);

  const mobileSortedCustomerRows = useMemo(() => {
    const dir = customerSort.direction === "asc" ? 1 : -1;
    return mobileFilteredCustomerRows.slice().sort((a, b) => {
      if (customerSort.key === "name") return (a.user.full_name || "").localeCompare(b.user.full_name || "") * dir;
      if (customerSort.key === "contact") return ((a.user.phone || a.user.email || "").localeCompare(b.user.phone || b.user.email || "")) * dir;
      if (customerSort.key === "lastVisit") return ((new Date(a.lastVisit || 0).getTime() || 0) - (new Date(b.lastVisit || 0).getTime() || 0)) * dir;
      if (customerSort.key === "visits") return (a.totalVisits - b.totalVisits) * dir;
      if (customerSort.key === "lifetime") return (a.lifetimeValue - b.lifetimeValue) * dir;
      if (customerSort.key === "gifts") return (a.giftsCount - b.giftsCount) * dir;
      if (customerSort.key === "status") return (Number(a.isInactive) - Number(b.isInactive)) * dir;
      return 0;
    });
  }, [customerSort, mobileFilteredCustomerRows]);

  function sortBy(key: string) {
    setCustomerSort(cur => ({ key, direction: cur.key === key && cur.direction === "asc" ? "desc" : "asc" }));
  }

  function headerClass(key: string) {
    return `text-left ${customerSort.key === key ? "font-black text-[#ffd66b]" : ""}`;
  }

  // Stats — desktop cards and segment counts follow the selected date range and selected segment.
  const dateScopedCustomerRows = useMemo(() => {
    return customerReportRows.filter(row =>
      isWithinDesktopTimeRange((row.user as any).created_at ?? row.lastVisit, timeRange),
    );
  }, [customerReportRows, timeRange]);

  const activityScopedCustomerRows = useMemo(() => {
    if (timeRange === "all") return customerReportRows;
    return customerReportRows.filter(row => isWithinDesktopTimeRange(row.lastVisit, timeRange));
  }, [customerReportRows, timeRange]);

  const fromGamesCount = fromGamesUserIds.size;

  const baseSegmentRows = useMemo(() => {
    if (smartSegment === "active") {
      return activityScopedCustomerRows.filter(row => row.lastVisit && !row.inactive);
    }

    if (smartSegment === "from_games") {
      return customerReportRows.filter(row => fromGamesUserIds.has(row.user.id));
    }

    return dateScopedCustomerRows;
  }, [activityScopedCustomerRows, customerReportRows, dateScopedCustomerRows, fromGamesUserIds, smartSegment]);

  const statsScopedCustomerRows = useMemo(() => {
    return baseSegmentRows.filter(row => {
      if (smartSegment === "all" || smartSegment === "active" || smartSegment === "from_games") return true;
      if (smartSegment === "new") return row.totalVisits <= 1;
      if (smartSegment === "returning") return row.totalVisits > 1;
      if (smartSegment === "one_time") return row.totalVisits === 1;
      if (smartSegment === "high_spenders") return row.lifetimeValue >= 100;
      if (smartSegment === "inactive_30") return row.daysSinceLastVisit !== null && row.daysSinceLastVisit >= 30;
      if (smartSegment === "at_risk") return row.isAtRisk;
      if (smartSegment === "lost") return row.daysSinceLastVisit !== null && row.daysSinceLastVisit >= 60;
      return true;
    });
  }, [baseSegmentRows, smartSegment]);

  const totalCustomerCount = statsScopedCustomerRows.length;
  const returningCustomerCount = statsScopedCustomerRows.filter(r => r.totalVisits > 1).length;
  const activeReportCustomers = statsScopedCustomerRows.filter(r => r.lastVisit && !r.inactive).length;
  const inactiveCustomerCount = statsScopedCustomerRows.filter(r => r.inactive).length;
  const atRiskCustomerCount = statsScopedCustomerRows.filter(r => r.isAtRisk).length;
  const vipCustomerCount = statsScopedCustomerRows.filter(r => r.isVip).length;
  const averageVisitsPerCustomer = statsScopedCustomerRows.length > 0
    ? (statsScopedCustomerRows.reduce((sum, r) => sum + r.totalVisits, 0) / statsScopedCustomerRows.length).toFixed(1)
    : "0";

  const segmentBaseRows = dateScopedCustomerRows;
  const activeSegmentCount = activityScopedCustomerRows.filter(r => r.lastVisit && !r.inactive).length;

  const smartSegments = [
    { key: "active" as const, label: "Active users", count: activeSegmentCount },
    { key: "new" as const, label: "New customers", count: segmentBaseRows.filter(r => r.totalVisits <= 1).length },
    { key: "returning" as const, label: "Returning customers", count: segmentBaseRows.filter(r => r.totalVisits > 1).length },
    { key: "one_time" as const, label: "One-time visitors", count: segmentBaseRows.filter(r => r.totalVisits === 1).length },
    { key: "high_spenders" as const, label: "High spenders", count: segmentBaseRows.filter(r => r.lifetimeValue >= 100).length },
    { key: "inactive_30" as const, label: "Inactive 30+ days", count: segmentBaseRows.filter(r => r.daysSinceLastVisit !== null && r.daysSinceLastVisit >= 30).length },
    { key: "at_risk" as const, label: "At risk", count: segmentBaseRows.filter(r => r.isAtRisk).length },
    { key: "lost" as const, label: "Lost customers", count: segmentBaseRows.filter(r => r.daysSinceLastVisit !== null && r.daysSinceLastVisit >= 60).length },
    { key: "from_games" as const, label: "From games", count: fromGamesCount },
  ];

  function downloadVisibleCustomerTable() {
    const rows = sortedCustomerReportRows.slice(0, 80);
    const header = ["Name", "Client Code", "Phone", "Email", "Role", "Last Visit", "Days Ago", "Total Visits", "Lifetime $", "Gifts", "Status"].join(",");
    const body = rows.map(r => [
      `"${r.user.full_name || ""}"`, r.user.client_code || "", r.user.phone || "", r.user.email || "",
      desktopRoleLabel(r.user.role), r.lastVisit ? new Date(r.lastVisit).toLocaleDateString() : "",
      r.daysSinceLastVisit ?? "", r.totalVisits, desktopFormatMoney(r.lifetimeValue), r.giftsCount,
      daysAgoStatusLabel(r.daysSinceLastVisit),
    ].join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "customers.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#7b8977] text-white lg:bg-[radial-gradient(circle_at_top_left,rgba(255,214,107,0.24),transparent_28%),linear-gradient(135deg,#365665_0%,#263f49_48%,#798673_100%)]" style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif" }}>
      <Toast message={toast} tone={tone} />

      <div className="flex min-h-screen w-full gap-3 overflow-visible bg-transparent p-3 pb-24 lg:gap-6 lg:p-6 lg:pb-6 lg:min-h-screen">

        {/* Sidebar */}
        <AdminSidebar active="users" />

        {/* Content */}
        <section className="min-h-[calc(100vh-24px)] min-w-0 flex-1 overflow-visible lg:min-h-[calc(100vh-48px)]">
          <div className="mb-5 space-y-5 lg:hidden">
            <AdminMobileHeader profile={adminProfile} />
            <div className="rounded-[20px] border border-white/10 bg-white/10 px-5 py-5 shadow-[0_18px_48px_rgba(35,54,47,0.16)] backdrop-blur-2xl">
              <h1 className="text-[24px] font-black tracking-[-0.05em] text-white">Users</h1>
            </div>
          </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-[14px] font-bold text-white/60">Loading users...</div>
        ) : selectedUser ? (
          <DesktopClientProfilePanel
            user={selectedUser}
            currentUserId={adminId}
            categories={selectedCategories}
            stamps={selectedStamps}
            rewards={selectedRewards}
            activities={activityTxns.filter(t => t.client_id === selectedUser.id && t.action_type !== "manual_adjustment")}
            loading={selectedLoading}
            onBack={() => setSelectedUser(null)}
            onRoleChange={role => void setRole(selectedUser.id, role)}
            onDeactivate={() => void deactivateUser(selectedUser.id)}
            onReactivate={role => void reactivateUser(selectedUser.id, role)}
            onAddStamp={categoryId => void addStampToSelectedClient(categoryId)}
            onRemoveStamp={categoryId => void removeStampFromSelectedClient(categoryId)}
            onSendGift={(gift, desc) => void sendGiftToSelectedClient(gift, desc)}
          />
        ) : (
          <div className="min-h-[calc(100vh-88px)] w-full rounded-[28px] bg-white/10 p-4 shadow-[0_26px_70px_rgba(35,54,47,0.22)] backdrop-blur-2xl lg:min-h-[calc(100vh-120px)] lg:rounded-[30px] lg:p-5">

            {/* Search + filters */}
            <div className="mb-4 flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="mt-1 hidden shrink-0 text-[24px] font-black tracking-[-0.04em] text-white lg:block">Customer behavior</h2>
              <div className="ml-auto flex w-full min-w-0 flex-col gap-2 lg:w-auto lg:flex-row lg:items-center lg:justify-end">
                <input
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setVisibleUserCount(50); setSelectedUser(null); }}
                  placeholder="Search by name, phone, member ID..."
                  onFocus={() => setReportFiltersOpen(false)}
                  className="h-11 w-full min-w-0 rounded-[14px] border border-white/25 bg-white px-4 text-[12px] font-bold text-black outline-none focus:border-[#ffd66b] lg:h-9 lg:w-[380px] lg:rounded-[11px] lg:px-3 lg:text-[11px]"
                />
                <div ref={reportFilterRef} className="relative w-full lg:w-auto">
                  <button type="button" onClick={() => setReportFiltersOpen(c => !c)} className="h-12 w-full rounded-[16px] border border-white/25 bg-white/12 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/18 lg:h-10 lg:w-auto lg:rounded-[12px]">Filter</button>
                  {reportFiltersOpen && (
                    <div className="absolute left-0 right-0 top-14 z-30 w-full rounded-[22px] bg-[#365665] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] lg:left-auto lg:top-12 lg:w-[300px]">
                      <div className="space-y-4">
                        {[
                          { label: "Date Range", value: timeRange, onChange: (v: string) => { setTimeRange(v as DesktopTimeRange); setReportFiltersOpen(false); }, options: [["today","Today"],["week","This week"],["month","This month"],["all","Show all"]] },
                          { label: "Profile Tab", value: filter, onChange: (v: string) => { setFilter(v as DesktopProfileTab); setReportFiltersOpen(false); }, options: [["all","All profiles"],["client","Clients"],["staff","Staff"],["master_admin","Admin"],["deactivated","Deactivated profiles"]] },
                        ].map(({ label, value, onChange, options }) => (
                          <label key={label} className="block">
                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">{label}</span>
                            <select value={value} onChange={e => onChange(e.target.value)} className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none">
                              {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button type="button" onClick={downloadVisibleCustomerTable} className="hidden h-10 w-10 items-center justify-center rounded-[12px] border border-white/25 bg-white/12 text-white transition hover:bg-white/18 lg:flex" title="Download table">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 17v2.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="mb-4 hidden w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid lg:grid-cols-7">
              <DesktopReportMetric label="Total Customers" value={totalCustomerCount} />
              <DesktopReportMetric label="Returning" value={returningCustomerCount} />
              <DesktopReportMetric label="Active Users" value={activeReportCustomers} />
              <DesktopReportMetric label="Inactive" value={inactiveCustomerCount} />
              <DesktopReportMetric label="At Risk" value={atRiskCustomerCount} />
              <DesktopReportMetric label="VIP" value={vipCustomerCount} />
              <DesktopReportMetric label="Avg. Visits" value={averageVisitsPerCustomer} />
            </div>

            {/* Smart Segments — desktop only */}
            <div className="mb-4 hidden flex-wrap items-center gap-2 lg:flex">
              <button
                type="button"
                onClick={() => setSmartSegment("all")}
                className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${smartSegment === "all" ? "bg-[#ffd66b] text-[#365665] shadow-[0_10px_24px_rgba(255,214,107,0.24)]" : "bg-white/12 text-white/82 hover:bg-white/18"}`}
              >
                {desktopTimeRangeLabel(timeRange)}
              </button>
              {smartSegments.map(segment => (
                <button
                  key={segment.key}
                  type="button"
                  onClick={() => { setSmartSegment(segment.key); setVisibleUserCount(50); }}
                  className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${smartSegment === segment.key ? "bg-[#ffd66b] text-[#365665] shadow-[0_10px_24px_rgba(255,214,107,0.24)]" : "bg-white/12 text-white/82 hover:bg-white/18"}`}
                  title={`${segment.label}: ${segment.count}`}
                >
                  {segment.label}
                </button>
              ))}
            </div>

            {/* Mobile customer list */}
            <div className="lg:hidden">
              <div className="overflow-hidden rounded-[22px] bg-white/10">
                <div className="grid grid-cols-[1.25fr_0.8fr_0.55fr_0.85fr] gap-3 border-b border-white/14 bg-white/6 px-3 py-3 text-[9px] font-black uppercase tracking-[0.13em] text-white/58">
                  <button type="button" onClick={() => sortBy("name")} className={headerClass("name")}>Name</button>
                  <button type="button" onClick={() => sortBy("lastVisit")} className={headerClass("lastVisit")}>Date</button>
                  <button type="button" onClick={() => sortBy("visits")} className={headerClass("visits")}>Visits</button>
                  <button type="button" onClick={() => sortBy("status")} className={headerClass("status")}>Status</button>
                </div>
                <div className="max-h-[560px] overflow-auto pb-20">
                  {mobileSortedCustomerRows.slice(0, visibleUserCount).map((row) => (
                    <button
                      key={row.user.id}
                      type="button"
                      onClick={() => void openUserProfile(row.user)}
                      className="grid w-full grid-cols-[1.25fr_0.8fr_0.55fr_0.85fr] items-center gap-3 border-b border-white/10 px-3 py-3 text-left text-[11px] font-bold text-white/74 transition last:border-b-0 hover:bg-white/10"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-black text-white">{row.user.full_name || "Client"}</div>
                        <div className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-[#ffd66b]">{row.user.client_code || row.user.phone || "No ID"}</div>
                      </div>
                      <div className="text-[10px] leading-tight text-white/72">{desktopFormatDateOnly(row.lastVisit)}</div>
                      <div className="font-black text-white">{row.totalVisits}</div>
                      <div>
                        <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${daysAgoClass(row.daysSinceLastVisit)}`}>
                          {daysAgoStatusLabel(row.daysSinceLastVisit)}
                        </span>
                      </div>
                    </button>
                  ))}

                  {mobileSortedCustomerRows.length > visibleUserCount && (
                    <div className="px-4 py-4 text-center">
                      <button type="button" onClick={() => setVisibleUserCount(c => c + 50)} className="rounded-full bg-white/12 px-6 py-3 text-[12px] font-black text-white transition hover:bg-white/20">
                        Load more ({mobileSortedCustomerRows.length - visibleUserCount} remaining)
                      </button>
                    </div>
                  )}

                  {mobileSortedCustomerRows.length === 0 && (
                    <div className="px-4 py-6 text-center text-[13px] font-bold text-white/64">No profiles found for this view.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="hidden w-full overflow-hidden rounded-[22px] bg-white/10 lg:block">
              <div className="grid gap-4 border-b border-white/14 bg-white/6 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/58" style={{ gridTemplateColumns: CUSTOMER_TABLE_GRID, width: "100%" }}>
                {[["name","Names"],["contact","Contact"],["lastVisit","Last Visit"]].map(([k,l]) => (
                  <button key={k} type="button" onClick={() => sortBy(k)} className={headerClass(k)}>{l}</button>
                ))}
                <button type="button" onClick={() => sortBy("daysAgo")} className={headerClass("daysAgo")}>Days Ago</button>
                {[["visits","Visits"],["lifetime","Lifetime $"],["gifts","Gifts"],["status","Status"]].map(([k,l]) => (
                  <button key={k} type="button" onClick={() => sortBy(k)} className={headerClass(k)}>{l}</button>
                ))}
                <div className="text-left">Actions</div>
                <div className="text-left">Last Contacted</div>
              </div>

              <div className="max-h-[600px] overflow-auto">
                {sortedCustomerReportRows.slice(0, visibleUserCount).map(row => {
                  const digits = String(row.user.phone || "").replace(/\D/g, "");
                  const whatsappUrl = digits ? `https://wa.me/${digits}` : "";

                  return (
                    <div key={row.user.id} className="grid gap-4 px-4 py-3 text-[12px] font-bold text-white/78 transition hover:bg-white/10" style={{ gridTemplateColumns: CUSTOMER_TABLE_GRID, width: "100%" }}>
                      <button type="button" onClick={() => void openUserProfile(row.user)} className="min-w-0 text-left">
                        <div className="truncate font-black text-white">{row.user.full_name || "Client"}</div>
                        <div className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#ffd66b]">{row.user.client_code || "No ID"}</div>
                      </button>
                      <div className="min-w-0"><div className="truncate">{row.user.phone || "—"}</div></div>
                      <div>{desktopFormatDateOnly(row.lastVisit)}</div>
                      <div><span className={`inline-flex min-w-[34px] justify-center rounded-full px-2 py-1 text-[10px] font-black ${daysAgoClass(row.daysSinceLastVisit)}`}>{row.daysSinceLastVisit ?? "—"}</span></div>
                      <div className="font-black text-white">{row.totalVisits}</div>
                      <div className="font-black text-white">{desktopFormatMoney(row.lifetimeValue)}</div>
                      <div className="font-black text-white">{row.giftsCount}</div>
                      <div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${daysAgoClass(row.daysSinceLastVisit)}`}>{daysAgoStatusLabel(row.daysSinceLastVisit)}</span></div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.user.role === "client" && !row.user.isGameOnly ? (
                          <button type="button" onClick={() => void openUserProfile(row.user)} className="rounded-full bg-[#ffd66b] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#365665]">Gift</button>
                        ) : <span className="text-white/36">—</span>}
                        {whatsappUrl ? (
                          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">WA</a>
                        ) : <span className="text-white/36">—</span>}
                        <button
                          type="button"
                          onClick={e => { e.preventDefault(); e.stopPropagation(); markCustomerContacted(row.user); }}
                          className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#365665]"
                        >
                          Contacted
                        </button>
                      </div>
                      <div className="space-y-0.5 text-[11px] font-black text-white/72">
                        {(() => {
                          const keys = sharedContactKeys(row.user.phone, row.user.email, row.user.full_name || row.user.id);
                          const dates = contactHistoryForKeys(keys).slice(0, 2);
                          return dates.length > 0
                            ? dates.map(d => <div key={d}>{desktopFormatDateTime(d)}</div>)
                            : <span className="text-white/42">—</span>;
                        })()}
                      </div>
                    </div>
                  );
                })}

                {sortedCustomerReportRows.length > visibleUserCount && (
                  <div className="px-4 py-4 text-center">
                    <button type="button" onClick={() => setVisibleUserCount(c => c + 50)} className="rounded-full bg-white/12 px-6 py-2.5 text-[12px] font-black text-white transition hover:bg-white/20">
                      Load more ({sortedCustomerReportRows.length - visibleUserCount} remaining)
                    </button>
                  </div>
                )}

                {sortedCustomerReportRows.length === 0 && (
                  <div className="px-4 py-6 text-center text-[13px] font-bold text-white/60">No customers found for this view.</div>
                )}
              </div>
            </div>
          </div>
        )}
        </section>
      </div>
      <AdminMobileFloatingMenu active="users" />
    </main>
  );
}

export default UsersPage;
