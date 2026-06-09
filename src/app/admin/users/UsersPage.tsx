"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Toast } from "@/components/Toast";
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

function getTransactionStampCount(txn: unknown) {
  const record = txn as Record<string, unknown>;
  const raw =
    record.stamp_count ??
    record.stamps ??
    record.quantity ??
    record.amount ??
    1;

  const count = Number(raw);
  return Number.isFinite(count) && count > 0 ? count : 1;
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
    const actionType = String(record.action_type ?? "").toLowerCase();

    if (actionType !== "add_stamp") return 0;

    return (priceByCategoryId.get(categoryId) ?? 0) * getTransactionStampCount(txn);
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

  const currentStampsValue = useMemo(
    () =>
      stamps.reduce(
        (sum, stamp) =>
          sum +
          Math.max(0, Number(stamp.stamp_count ?? 0)) *
            (priceByCategoryId.get(stamp.category_id) ?? 0),
        0,
      ),
    [stamps, priceByCategoryId],
  );

  const value = useMemo(
    () =>
      filteredActivities.reduce((sum, txn) => sum + stampValueFor(txn), 0) +
      currentStampsValue,
    [filteredActivities, priceByCategoryId, currentStampsValue],
  );

  const lifetime = useMemo(
    () =>
      Math.max(
        activities.reduce((sum, txn) => sum + stampValueFor(txn), 0),
        currentStampsValue,
      ),
    [activities, priceByCategoryId, currentStampsValue],
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
  const supabase = useMemo(() => createClient(), []);
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");

  // Data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [activityTxns, setActivityTxns] = useState<StampTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected user profile
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<AdminCategory[]>([]);
  const [selectedStamps, setSelectedStamps] = useState<AdminClientStamp[]>([]);
  const [selectedRewards, setSelectedRewards] = useState<Reward[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleUserCount, setVisibleUserCount] = useState(50);
  const [filter, setFilter] = useState<"all" | UserRole>("client");
  const [timeRange, setTimeRange] = useState<DesktopTimeRange>("all");
  const [lastVisitFilter, setLastVisitFilter] = useState<"all" | "active" | "inactive">("all");
  const [customerStatusFilter, setCustomerStatusFilter] = useState<"all" | "active" | "inactive" | "at_risk" | "vip">("all");
  const [customerGenderFilter, setCustomerGenderFilter] = useState<"all" | "male" | "female">("all");
  const [customerAgeRangeFilter, setCustomerAgeRangeFilter] = useState<"all" | "18-24" | "25-34" | "35-44" | "45+">("all");
  const [customerVisitRangeFilter, setCustomerVisitRangeFilter] = useState<"all" | "0" | "1-3" | "4-10" | "10+">("all");
  const [reportFiltersOpen, setReportFiltersOpen] = useState(false);
  const reportFilterRef = useRef<HTMLDivElement | null>(null);
  const [customerSort, setCustomerSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "lastVisit", direction: "desc" });

  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false);
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
        const [profilesRes, txnsRes, rewardsRes, categoriesRes, stampsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, phone, client_code, role, is_active, gender, birthday, created_at")
            .order("created_at", { ascending: false }),

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

          supabase
            .from("loyalty_categories")
            .select("id, name, average_price, sort_order")
            .order("sort_order", { ascending: true }),

          supabase
            .from("client_stamps")
            .select("client_id, category_id, stamp_count"),
        ]);

        if (!isMounted) return;

        // Log any errors to help debug
        if (profilesRes.error) console.error("[UsersPage] profiles error:", profilesRes.error);
        if (txnsRes.error) console.error("[UsersPage] txns error:", txnsRes.error);
        if (rewardsRes.error) console.error("[UsersPage] rewards error:", rewardsRes.error);
        if (categoriesRes.error) console.error("[UsersPage] categories error:", categoriesRes.error);
        if (stampsRes.error) console.error("[UsersPage] client_stamps error:", stampsRes.error);
        console.log("[UsersPage] loaded:", {
          profiles: profilesRes.data?.length,
          txns: txnsRes.data?.length,
          rewards: rewardsRes.data?.length,
          categories: categoriesRes.data?.length,
          clientStamps: stampsRes.data?.length,
        });

        const txns = (txnsRes.data ?? []) as StampTransaction[];
        const rewards = rewardsRes.data ?? [];
        const cats = (categoriesRes.data ?? []) as AdminCategory[];
        const clientStamps = (stampsRes.data ?? []) as Array<{
          client_id: string | null;
          category_id: string | null;
          stamp_count: number | null;
        }>;

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
          if (String(txn.action_type ?? "").toLowerCase() === "add_stamp") {
            const price = priceByCategory.get(txn.category_id ?? "") ?? 0;
            lifetimeByUser.set(
              txn.client_id,
              (lifetimeByUser.get(txn.client_id) ?? 0) +
                price * getTransactionStampCount(txn),
            );
          }
        });

        const currentStampValueByUser = new Map<string, number>();
        clientStamps.forEach((stamp) => {
          if (!stamp.client_id || !stamp.category_id) return;
          const price = priceByCategory.get(stamp.category_id) ?? 0;
          const count = Math.max(0, Number(stamp.stamp_count ?? 0));
          currentStampValueByUser.set(
            stamp.client_id,
            (currentStampValueByUser.get(stamp.client_id) ?? 0) + price * count,
          );
        });

        const rewardsByUser = new Map<string, number>();
        (rewards as any[]).forEach((r: any) => {
          if (!r.client_id) return;
          rewardsByUser.set(r.client_id, (rewardsByUser.get(r.client_id) ?? 0) + 1);
        });

        const enriched = ((profilesRes.data ?? []) as any[]).map((p: any) => ({
          ...p,
          totalVisits:        visitDaysByUser.get(p.id)?.size ?? 0,
          lastVisit:          lastVisitByUser.get(p.id) ?? null,
          daysSinceLastVisit: lastVisitByUser.get(p.id)
            ? Math.floor((Date.now() - new Date(lastVisitByUser.get(p.id)!).getTime()) / 86400000)
            : null,
          giftsCount:   rewardsByUser.get(p.id) ?? 0,
          lifetimeValue: Math.max(
            lifetimeByUser.get(p.id) ?? 0,
            currentStampValueByUser.get(p.id) ?? 0,
          ),
        }));

        setUsers(enriched as AdminUser[]);
        setCategories(cats);
        setActivityTxns(txns);
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
    setSelectedUser(user);
    setSelectedLoading(true);
    setSelectedCategories([]); setSelectedStamps([]); setSelectedRewards([]);
    try {
      const [catResult, stampResult, rewardResult] = await Promise.all([
        supabase.from("loyalty_categories").select("id, name, sort_order, average_price").eq("is_active", true).order("sort_order", { ascending: true }),
        supabase.from("client_stamps").select("id, client_id, category_id, stamp_count, updated_at").eq("client_id", user.id),
        supabase.from("rewards").select("*").eq("client_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setSelectedCategories((catResult.data ?? []) as AdminCategory[]);
      setSelectedStamps((stampResult.data ?? []) as AdminClientStamp[]);
      setSelectedRewards((rewardResult.data ?? []) as Reward[]);
    } finally {
      setSelectedLoading(false);
    }
  }

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

    const createdAt = new Date().toISOString();
    const { data: insertedTxn, error: transactionError } = await supabase
      .from("stamp_transactions")
      .insert({
        client_id: selectedUser.id,
        category_id: categoryId,
        action_type: "add_stamp",
        stamp_count: 1,
        staff_id: adminId,
        created_at: createdAt,
      })
      .select("*")
      .single();

    if (transactionError) {
      flash(`Stamp was added, but the value history was not saved: ${transactionError.message}`, "error");
    } else if (insertedTxn) {
      setActivityTxns((current) => [insertedTxn as StampTransaction, ...current]);
      const addedValue =
        (selectedCategories.find((category) => category.id === categoryId)?.average_price
          ? parseMoneyValue(
              selectedCategories.find((category) => category.id === categoryId)
                ?.average_price,
            )
          : 0) ||
        (categories.find((category) => category.id === categoryId)?.average_price
          ? parseMoneyValue(
              categories.find((category) => category.id === categoryId)?.average_price,
            )
          : 0);

      setUsers((current) =>
        current.map((user) =>
          user.id === selectedUser.id
            ? {
                ...user,
                lifetimeValue: Math.max(
                  user.lifetimeValue ?? 0,
                  (user.lifetimeValue ?? 0) + addedValue,
                ),
              }
            : user,
        ),
      );
      setSelectedUser((current) =>
        current?.id === selectedUser.id
          ? {
              ...current,
              lifetimeValue: (current.lifetimeValue ?? 0) + addedValue,
            }
          : current,
      );
    }

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

  const filteredCustomerReportRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const normalizedSearch = normalizePhoneForMatch(searchTerm.trim());

    return customerReportRows.filter(row => {
      const user = row.user;
      if (filter !== "all" && user.role !== filter) return false;
      const created = (user as any).created_at;
      if (!isWithinDesktopTimeRange(created, timeRange)) return false;
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
      if (!search) return true;
      const phone = normalizePhoneForMatch(user.phone);
      if (phone && normalizedSearch && phone.includes(normalizedSearch)) return true;
      return [user.full_name, user.email, user.phone, user.client_code, desktopRoleLabel(user.role), user.is_active === false ? "deactivated" : "active"].filter(Boolean).join(" ").toLowerCase().includes(search);
    });
  }, [customerReportRows, filter, timeRange, searchTerm, lastVisitFilter, customerStatusFilter, customerGenderFilter, customerAgeRangeFilter]);

  const sortedCustomerReportRows = useMemo(() => {
    const dir = customerSort.direction === "asc" ? 1 : -1;
    return filteredCustomerReportRows.slice().sort((a, b) => {
      if (customerSort.key === "name") return (a.user.full_name || "").localeCompare(b.user.full_name || "") * dir;
      if (customerSort.key === "contact") return ((a.user.phone || a.user.email || "").localeCompare(b.user.phone || b.user.email || "")) * dir;
      if (customerSort.key === "lastVisit") return ((new Date(a.lastVisit || 0).getTime() || 0) - (new Date(b.lastVisit || 0).getTime() || 0)) * dir;
      if (customerSort.key === "visits") return (a.totalVisits - b.totalVisits) * dir;
      if (customerSort.key === "lifetime") return (a.lifetimeValue - b.lifetimeValue) * dir;
      if (customerSort.key === "gifts") return (a.giftsCount - b.giftsCount) * dir;
      if (customerSort.key === "status") return (Number(a.isInactive) - Number(b.isInactive)) * dir;
      return 0;
    });
  }, [customerSort, filteredCustomerReportRows]);

  function sortBy(key: string) {
    setCustomerSort(cur => ({ key, direction: cur.key === key && cur.direction === "asc" ? "desc" : "asc" }));
  }

  function headerClass(key: string) {
    return `text-left ${customerSort.key === key ? "font-black text-[#ffd66b]" : ""}`;
  }

  // Stats
  // Stats match AdminDashboard exactly — computed from ALL client rows, not filtered
  const newCustomerCount      = customerReportRows.filter(r => r.totalVisits <= 1).length;
  const returningCustomerCount = customerReportRows.filter(r => r.totalVisits > 1).length;
  const inactiveCustomerCount = customerReportRows.filter(r => r.inactive).length;
  const activeReportCustomers = customerReportRows.length - inactiveCustomerCount;
  const atRiskCustomerCount   = customerReportRows.filter(r => r.isAtRisk).length;
  const vipCustomerCount      = customerReportRows.filter(r => r.isVip).length;
  const averageVisitsPerCustomer = customerReportRows.length > 0
    ? (customerReportRows.reduce((sum, r) => sum + r.totalVisits, 0) / customerReportRows.length).toFixed(1)
    : "0";

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,214,107,0.24),transparent_28%),linear-gradient(135deg,#365665_0%,#263f49_48%,#798673_100%)] text-white" style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif" }}>
      <Toast message={toast} tone={tone} />

      <div className="flex min-h-screen w-full gap-6 overflow-visible bg-transparent p-6 lg:min-h-screen">

        {/* Sidebar — exact match to AdminDashboard */}
        <aside
          className={`hidden min-h-[calc(100vh-48px)] shrink-0 flex-col overflow-hidden rounded-[30px] bg-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.24)] backdrop-blur-2xl transition-all duration-300 lg:flex ${
            isDesktopSidebarOpen ? "w-[238px]" : "w-[76px]"
          }`}
        >
          <div className={`flex h-20 items-center bg-white/5 ${isDesktopSidebarOpen ? "justify-between gap-3 px-5" : "justify-center px-3"}`}>
            {isDesktopSidebarOpen ? (
              <div className="min-w-0">
                <div className="text-[19px] font-black leading-none text-white">Dashboard</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#ffd66b]">PRO&apos;s Admin</div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setIsDesktopSidebarOpen(c => !c)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffd66b] text-[20px] font-black text-[#365665] shadow-[0_12px_28px_rgba(255,214,107,0.2)] transition hover:scale-105"
              title={isDesktopSidebarOpen ? "Collapse menu" : "Open menu"}
              aria-label={isDesktopSidebarOpen ? "Collapse menu" : "Open menu"}
            >
              {isDesktopSidebarOpen ? "←" : "☰"}
            </button>
          </div>

                    <nav className="flex-1 px-3 py-4">
              <Link href="/admin" title="Dashboard"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>⌂</span>
                {isDesktopSidebarOpen ? "Dashboard" : null}
              </Link>
              <Link href="/admin?tab=Activity" title="Activity"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>↯</span>
                {isDesktopSidebarOpen ? "Activity" : null}
              </Link>
              <Link href="/admin/users" title="Customer behavior"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black transition bg-white/18 text-white shadow-[0_16px_34px_rgba(35,54,47,0.18)] ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ffd66b] text-[15px] text-[#365665]`}>👤</span>
                {isDesktopSidebarOpen ? "Customer behavior" : null}
              </Link>
              <Link href="/admin?tab=Comment+Cards" title="Comment Cards"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>✎</span>
                {isDesktopSidebarOpen ? "Comment Cards" : null}
              </Link>
              <Link href="/admin?tab=Birthdays" title="Birthdays"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>🎂</span>
                {isDesktopSidebarOpen ? "Birthdays" : null}
              </Link>
              <Link href="/admin?tab=Gifts" title="Gifts"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>🎁</span>
                {isDesktopSidebarOpen ? "Gifts" : null}
              </Link>
              <Link href="/admin?tab=Loyalty+Program" title="Loyalty Program"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>★</span>
                {isDesktopSidebarOpen ? "Loyalty Program" : null}
              </Link>
              <Link href="/admin/games" title="Games"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>🎮</span>
                {isDesktopSidebarOpen ? "Games" : null}
              </Link>
          </nav>

          <div className="border-t border-white/8 px-3 py-5">
            {isDesktopSidebarOpen ? (
              <div className="space-y-3 text-left">
                <a href="https://wissamdesigns.com" target="_blank" rel="noreferrer" className="block text-left text-[11px] font-black uppercase leading-5 text-[#ffd66b] transition hover:text-white">
                  © WISSAMDESIGNS.COM
                </a>
              </div>
            ) : (
              <div className="text-center text-[14px] font-black text-[#ffd66b]">©</div>
            )}
          </div>
        </aside>

        {/* Content */}
        <section className="min-h-[calc(100vh-48px)] min-w-0 flex-1 overflow-visible">

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
          <div className="min-h-[calc(100vh-120px)] w-full rounded-[30px] bg-white/10 p-5 shadow-[0_26px_70px_rgba(35,54,47,0.22)] backdrop-blur-2xl">

            {/* Search + filters */}
            <div className="mb-4 flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="mt-1 shrink-0 text-[24px] font-black tracking-[-0.04em] text-white">Customer behavior</h2>
              <div className="ml-auto flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
                <input
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setVisibleUserCount(50); setSelectedUser(null); }}
                  placeholder="Search by name, phone, member ID..."
                  onFocus={() => setReportFiltersOpen(false)}
                  className="h-9 min-w-0 rounded-[11px] border border-white/25 bg-white px-3 text-[11px] font-bold text-black outline-none focus:border-[#ffd66b] sm:w-[320px] lg:w-[380px]"
                />
                <div ref={reportFilterRef} className="relative">
                  <button type="button" onClick={() => setReportFiltersOpen(c => !c)} className="h-10 rounded-[12px] border border-white/25 bg-white/12 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/18">Filter</button>
                  {reportFiltersOpen && (
                    <div className="absolute right-0 top-12 z-30 w-[300px] rounded-[22px] bg-[#365665] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                      <div className="space-y-4">
                        {[
                          { label: "Date Range", value: timeRange, onChange: (v: string) => { setTimeRange(v as DesktopTimeRange); setReportFiltersOpen(false); }, options: [["today","Today"],["week","This week"],["month","This month"],["all","Show all"]] },
                          { label: "Last Visit", value: lastVisitFilter, onChange: (v: string) => { setLastVisitFilter(v as any); setReportFiltersOpen(false); }, options: [["all","All"],["active","Active recently"],["inactive","Inactive recently"]] },
                          { label: "Profile Tab", value: filter, onChange: (v: string) => { setFilter(v as any); setReportFiltersOpen(false); }, options: [["all","All profiles"],["client","Clients"],["staff","Staff"],["master_admin","Admin"]] },
                          { label: "Status", value: customerStatusFilter, onChange: (v: string) => setCustomerStatusFilter(v as any), options: [["all","All status"],["active","Recent 0–7"],["inactive","Overdue 31+"],["at_risk","At Risk 31+"],["vip","VIP"]] },
                          { label: "Gender", value: customerGenderFilter, onChange: (v: string) => setCustomerGenderFilter(v as any), options: [["all","All genders"],["male","Male"],["female","Female"]] },
                          { label: "Age Range", value: customerAgeRangeFilter, onChange: (v: string) => setCustomerAgeRangeFilter(v as any), options: [["all","All ages"],["18-24","18–24"],["25-34","25–34"],["35-44","35–44"],["45+","45+"]] },
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
                <button type="button" onClick={downloadVisibleCustomerTable} className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/25 bg-white/12 text-white transition hover:bg-white/18" title="Download table">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 17v2.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="mb-4 grid w-full gap-2" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
              <DesktopReportMetric label="New Customers" value={newCustomerCount} />
              <DesktopReportMetric label="Returning" value={returningCustomerCount} />
              <DesktopReportMetric label="Active" value={activeReportCustomers} />
              <DesktopReportMetric label="Inactive" value={inactiveCustomerCount} />
              <DesktopReportMetric label="At Risk" value={atRiskCustomerCount} />
              <DesktopReportMetric label="VIP" value={vipCustomerCount} />
              <DesktopReportMetric label="Avg. Visits" value={averageVisitsPerCustomer} />
            </div>

            {/* Table */}
            <div className="w-full overflow-hidden rounded-[22px] bg-white/10">
              <div className="grid gap-4 border-b border-white/14 bg-white/6 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/58" style={{ gridTemplateColumns: CUSTOMER_TABLE_GRID, width: "100%" }}>
                {[["name","Names"],["contact","Contact"],["lastVisit","Last Visit"]].map(([k,l]) => (
                  <button key={k} type="button" onClick={() => sortBy(k)} className={headerClass(k)}>{l}</button>
                ))}
                <div>Days Ago</div>
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
                        {row.user.role === "client" ? (
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
    </main>
  );
}

export default UsersPage;
