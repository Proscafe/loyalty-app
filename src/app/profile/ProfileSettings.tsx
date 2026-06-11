"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProfileSettingsProps = {
  profile: any;
  recentTransactions: any[];
  recentRewards: any[];
};

const CLIENT_PAGE_BG =
  "radial-gradient(circle at 16% 0%, rgba(207, 133, 124, 0.96) 0, rgba(207, 133, 124, 0.72) 30%, rgba(207, 133, 124, 0) 56%), radial-gradient(circle at 70% 78%, rgba(146, 83, 76, 0.98) 0, rgba(146, 83, 76, 0.78) 34%, rgba(146, 83, 76, 0) 62%), linear-gradient(155deg, #cf857c 0%, #b76d66 45%, #92534C 100%)";
const STAFF_PAGE_BG =
  "radial-gradient(circle at 16% 0%, rgba(121, 134, 115, 0.96) 0, rgba(121, 134, 115, 0.72) 30%, rgba(121, 134, 115, 0) 56%), radial-gradient(circle at 70% 78%, rgba(88, 98, 86, 0.98) 0, rgba(88, 98, 86, 0.78) 34%, rgba(88, 98, 86, 0) 62%), linear-gradient(155deg, #798673 0%, #687468 45%, #586256 100%)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))";
const GLASS_CARD_DARK =
  "linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.045))";
const BRAND_YELLOW = "#f0cf61";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function normalizeCategoryName(name: string) {
  const lower = name.trim().toLowerCase();

  if (
    lower === "desserts 2" ||
    lower === "dessert 2" ||
    lower === "hooka" ||
    lower === "hookas" ||
    lower === "hookah" ||
    lower === "hookahs"
  ) {
    return "Hooka";
  }

  if (lower === "sandwich" || lower === "sandwiches" || lower === "sandwiche") return "Sandwich";
  if (lower === "dessert" || lower === "desserts") return "Dessert";
  if (lower === "coffee" || lower === "coffees") return "Coffee";
  if (lower === "main course" || lower === "main courses") return "Main Course";

  return name;
}

function singularizeRewardName(value: string) {
  const cleaned = value
    .replace(/\s+Item$/i, "")
    .replace(/\s+Reward$/i, "")
    .replace(/^Free\s+(.+)\s+Item$/i, "Free $1")
    .trim();

  return cleaned
    .replace(/\bSandwiches\b/gi, "Sandwich")
    .replace(/\bSandwiche\b/gi, "Sandwich")
    .replace(/\bMain Courses\b/gi, "Main Course")
    .replace(/\bCoffees\b/gi, "Coffee")
    .replace(/\bDesserts\b/gi, "Dessert")
    .replace(/\bHookas\b/gi, "Hooka")
    .replace(/\bHookahs\b/gi, "Hooka");
}

function cleanRewardName(value: string) {
  return singularizeRewardName(value);
}

function getCategoryName(item: any) {
  const category =
    item?.category_name ||
    item?.loyalty_categories?.name ||
    item?.category?.name ||
    item?.categories?.name ||
    item?.reward_type ||
    item?.reward_name ||
    item?.type ||
    "";

  const cleaned = cleanRewardName(String(category || ""));

  return cleaned ? normalizeCategoryName(cleaned) : "Activity";
}

function isBirthdayReward(item: any) {
  const text = [
    item?.reward_type,
    item?.reward_name,
    item?.type,
    item?.category_name,
    item?.loyalty_categories?.name,
    item?.category?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes("birthday") || text.includes("20%") || text.includes("dessert");
}

function normalizeActionType(actionType?: string | null) {
  const action = String(actionType || "").toLowerCase();

  if (
    action === "add_stamp" ||
    action === "stamp_added" ||
    action === "manual_adjustment"
  ) {
    return "Stamp added";
  }

  if (action === "reward_earned") return "Reward earned";
  if (action === "reward_redeemed") return "Reward confirmed";

  return action
    ? action
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Activity";
}

function getActivityTitle(item: any) {
  if (item._type === "reward" || item.reward_type || item.status) {
    const category = getCategoryName(item);

    if (item.status === "redeemed" || item.status === "approved" || item.status === "confirmed") {
      return `Gift approved · ${category}`;
    }

    if (item.status === "claimed" || item.status === "pending") {
      return `Gift pending · ${category}`;
    }

    return `Gift earned · ${category}`;
  }

  const action = normalizeActionType(item.action_type);
  const category = getCategoryName(item);

  return `${action} · ${category}`;
}

function getActivityIcon(item: any) {
  if (item._type === "reward" || item.reward_type || item.status) {
    return isBirthdayReward(item) ? "/birthday-cake.png" : "/gift.png";
  }

  return "/approved.png";
}

function getYears() {
  const currentYear = new Date().getFullYear();
  const years = [];

  for (let year = currentYear; year >= currentYear - 100; year -= 1) {
    years.push(year);
  }

  return years;
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function splitDate(value?: string | null) {
  if (!value) {
    return {
      year: "",
      month: "",
      day: "",
    };
  }

  const [year, month, day] = value.split("-").map(Number);

  return {
    year: year ? String(year) : "",
    month: month ? String(month) : "",
    day: day ? String(day) : "",
  };
}

function buildDate(year: string, month: string, day: string) {
  const safeMonth = String(month).padStart(2, "0");
  const safeDay = String(day).padStart(2, "0");
  return `${year}-${safeMonth}-${safeDay}`;
}

export default function ProfileSettings({
  profile,
  recentTransactions,
  recentRewards,
}: ProfileSettingsProps) {
  const isStaffProfile =
    profile?.role === "staff" ||
    profile?.role === "admin" ||
    profile?.role === "master_admin";
  const pageBackground = isStaffProfile ? STAFF_PAGE_BG : CLIENT_PAGE_BG;
  const router = useRouter();
  const supabase = createClient();

  const initialDate = splitDate(profile?.birthday);
  const [birthYear, setBirthYear] = useState(initialDate.year);
  const [birthMonth, setBirthMonth] = useState(initialDate.month);
  const [birthDay, setBirthDay] = useState(initialDate.day);
  const [birthdayStatus, setBirthdayStatus] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [isSavingBirthday, setIsSavingBirthday] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const years = useMemo(() => getYears(), []);
  const days = useMemo(() => {
    const safeYear = birthYear ? Number(birthYear) : new Date().getFullYear();
    const safeMonth = birthMonth ? Number(birthMonth) : 1;

    return Array.from(
      { length: getDaysInMonth(safeYear, safeMonth - 1) },
      (_, index) => index + 1,
    );
  }, [birthYear, birthMonth]);

  const history = useMemo(() => {
    const rewardItems = recentRewards.map((item) => ({
      ...item,
      _type: "reward",
      _date: item.created_at || item.earned_at || item.redeemed_at,
    }));

    const transactionItems = recentTransactions.map((item) => ({
      ...item,
      _type: "transaction",
      _date: item.created_at,
    }));

    return [...rewardItems, ...transactionItems]
      .sort((a, b) => {
        const aDate = new Date(a._date || 0).getTime();
        const bDate = new Date(b._date || 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 5);
  }, [recentRewards, recentTransactions]);

  async function saveBirthday(year: string, month: string, day: string) {
    if (!profile?.id || !year || !month || !day) return;

    const birthday = buildDate(year, month, day);
    setBirthdayStatus("");
    setIsSavingBirthday(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ birthday })
        .eq("id", profile.id);

      if (error) throw error;

      setBirthdayStatus("Saved");
      router.refresh();
    } catch {
      setBirthdayStatus("Could not save birthday.");
    } finally {
      setIsSavingBirthday(false);
    }
  }

  async function handleDatePartChange(type: "year" | "month" | "day", value: string) {
    let nextYear = birthYear;
    let nextMonth = birthMonth;
    let nextDay = birthDay;

    if (type === "year") nextYear = value;
    if (type === "month") nextMonth = value;
    if (type === "day") nextDay = value;

    if (nextYear && nextMonth && nextDay) {
      const maxDays = getDaysInMonth(Number(nextYear), Number(nextMonth) - 1);
      if (Number(nextDay) > maxDays) nextDay = String(maxDays);
    }

    setBirthYear(nextYear);
    setBirthMonth(nextMonth);
    setBirthDay(nextDay);

    if (nextYear && nextMonth && nextDay) {
      await saveBirthday(nextYear, nextMonth, nextDay);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordStatus("");

    if (!profile?.email) {
      setPasswordStatus("Email not found for this account.");
      return;
    }

    if (!currentPassword || !newPassword) {
      setPasswordStatus("Enter your current and new password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus("New password must be at least 6 characters.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (signInError) throw new Error("Current password is incorrect.");

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message || "Could not change password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setPasswordStatus("Password changed.");
      router.refresh();
    } catch (error) {
      setPasswordStatus(
        error instanceof Error ? error.message : "Could not change password.",
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // Continue to the login page even if Supabase returns a transient sign-out error.
    }

    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("sb-") || key.includes("supabase"))
        .forEach((key) => window.localStorage.removeItem(key));

      Object.keys(window.sessionStorage)
        .filter((key) => key.startsWith("sb-") || key.includes("supabase"))
        .forEach((key) => window.sessionStorage.removeItem(key));
    } catch {
      // Storage may be unavailable in private mode; redirect anyway.
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: pageBackground }}>
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

        .pros-profile-moving-bg {
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
      `}</style>

      <div className="pros-profile-moving-bg" aria-hidden="true" />

      <div className="relative z-10 mx-auto w-full max-w-md space-y-5 px-4 py-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[13px] font-semibold tracking-[0.08em] text-white/80"
        >
          ← Back
        </button>

        <section
          className="overflow-hidden border border-white/15 backdrop-blur-xl"
          style={{
            borderRadius: 18,
            background: GLASS_CARD_DARK,
          }}
        >
          <div className="relative overflow-hidden p-5">
            <div
              className="pointer-events-none absolute inset-0 opacity-45"
              style={{
                backgroundImage: "url('/client-main-card.png'), url('/client main card.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                transform: "scale(1.12)",
              }}
            />

            <div className="relative z-10">
              <p className="text-[12px] font-bold tracking-[0.24em] text-white">
                Profile
              </p>
              <h1 className="mt-1 truncate text-[24px] font-black text-[#f0cf61]">
                {profile?.full_name || "Member"}
              </h1>
              {profile?.phone ? (
                <p className="mt-1 text-[13px] font-semibold text-white/80">
                  {profile.phone}
                </p>
              ) : null}
              <p className="mt-1 text-[13px] font-semibold text-white/70">
                {profile?.client_code || profile?.email}
              </p>
            </div>
          </div>
        </section>

        <section
          className="border border-white/15 p-5 backdrop-blur-xl"
          style={{ borderRadius: 18, background: GLASS_CARD }}
        >
          <span className="text-[15px] font-black text-white">
            Add your birthday
          </span>
          <span className="mt-1 block text-[13px] font-medium text-white/70">
            Your birthday deserves a treat from us.
          </span>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold tracking-[0.12em] text-white/70">
                Day
              </span>
              <select
                value={birthDay}
                onChange={(event) =>
                  handleDatePartChange("day", event.target.value)
                }
                disabled={isSavingBirthday}
                className="w-full rounded-[10px] border border-white/20 bg-white/15 px-3 py-3 text-[15px] text-white outline-none backdrop-blur-xl focus:border-[#f0cf61] disabled:opacity-60"
              >
                <option value="" className="text-[#1c2530]">
                  Day
                </option>
                {days.map((day) => (
                  <option key={day} value={day} className="text-[#1c2530]">
                    {day}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-bold tracking-[0.12em] text-white/70">
                Month
              </span>
              <select
                value={birthMonth}
                onChange={(event) =>
                  handleDatePartChange("month", event.target.value)
                }
                disabled={isSavingBirthday}
                className="w-full rounded-[10px] border border-white/20 bg-white/15 px-3 py-3 text-[15px] text-white outline-none backdrop-blur-xl focus:border-[#f0cf61] disabled:opacity-60"
              >
                <option value="" className="text-[#1c2530]">
                  Month
                </option>
                {[
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ].map((month, index) => (
                  <option key={month} value={index + 1} className="text-[#1c2530]">
                    {month}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-bold tracking-[0.12em] text-white/70">
                Year
              </span>
              <select
                value={birthYear}
                onChange={(event) =>
                  handleDatePartChange("year", event.target.value)
                }
                disabled={isSavingBirthday}
                className="w-full rounded-[10px] border border-white/20 bg-white/15 px-3 py-3 text-[15px] text-white outline-none backdrop-blur-xl focus:border-[#f0cf61] disabled:opacity-60"
              >
                <option value="" className="text-[#1c2530]">
                  Year
                </option>
                {years.map((year) => (
                  <option key={year} value={year} className="text-[#1c2530]">
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {birthdayStatus || isSavingBirthday ? (
            <p
              className="mt-3 text-[12px] font-bold"
              style={{
                color:
                  birthdayStatus === "Saved" || isSavingBirthday
                    ? "#f0cf61"
                    : "#ffffff",
              }}
            >
              {isSavingBirthday ? "Saving..." : birthdayStatus}
            </p>
          ) : null}
        </section>

        <section
          className="border border-white/15 p-5 backdrop-blur-xl"
          style={{ borderRadius: 18, background: GLASS_CARD }}
        >
          <h2 className="text-[22px] font-black text-white">History</h2>

          <div className="mt-4 overflow-hidden rounded-[16px] border border-white/12 bg-white/10 backdrop-blur-xl">
            {history.length > 0 ? (
              history.map((item, index) => (
                <div
                  key={`${item._type}-${item.id}`}
                  className={`flex items-start gap-3 px-4 py-4 ${
                    index !== history.length - 1 ? "border-b border-white/10" : ""
                  }`}
                >
                  <Image
                    src={getActivityIcon(item)}
                    alt=""
                    width={24}
                    height={24}
                    className="mt-0.5 h-6 w-6 shrink-0 object-contain"
                  />

                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-white">
                      {getActivityTitle(item)}
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-white/60">
                      {formatDate(item._date)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-4 text-[14px] font-medium text-white/70">
                No activity yet.
              </p>
            )}
          </div>
        </section>

        <section
          className="border border-white/15 p-5 backdrop-blur-xl"
          style={{ borderRadius: 18, background: GLASS_CARD }}
        >
          <h2 className="text-[22px] font-black text-white">Change Password</h2>

          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-[12px] font-bold tracking-[0.18em] text-white/70">
                Current password
              </span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="mt-2 w-full rounded-[10px] border border-white/20 bg-white/15 px-4 py-3 text-[15px] text-white outline-none backdrop-blur-xl placeholder:text-white/45 focus:border-[#f0cf61]"
                placeholder="••••••••"
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-bold tracking-[0.18em] text-white/70">
                New password
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-2 w-full rounded-[10px] border border-white/20 bg-white/15 px-4 py-3 text-[15px] text-white outline-none backdrop-blur-xl placeholder:text-white/45 focus:border-[#f0cf61]"
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full rounded-[10px] bg-[#f0cf61] px-4 py-3 text-[14px] font-black text-[#1c2530] disabled:opacity-60"
            >
              {isChangingPassword ? "Changing..." : "Change password"}
            </button>

            {passwordStatus ? (
              <p
                className="text-[12px] font-bold"
                style={{
                  color:
                    passwordStatus === "Password changed."
                      ? "#f0cf61"
                      : "#ffffff",
                }}
              >
                {passwordStatus}
              </p>
            ) : null}
          </form>
        </section>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-[14px] border border-white/15 px-4 py-4 text-[14px] font-black text-white backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(145deg, rgba(74, 41, 38, 0.78), rgba(42, 24, 22, 0.72))",
          }}
        >
          Logout
        </button>

        <p className="pb-4 text-center text-[12px] font-medium text-white/75">
          © Powered by{" "}
          <a
            href="https://wissamdesigns.com"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[#f0cf61]"
          >
            wissamdesigns.com
          </a>
        </p>
      </div>
    </main>
  );
}
