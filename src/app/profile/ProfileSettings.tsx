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

const PAGE_GREEN = "#dce1d8";
const BRAND_RED = "#92534C";
const BRAND_YELLOW = "#f0cf61";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function getCategoryName(item: any) {
  return (
    item?.loyalty_categories?.name ||
    item?.category?.name ||
    item?.reward_type ||
    "Activity"
  );
}

function getActivityTitle(item: any) {
  if (item.reward_type || item.status) {
    const category = getCategoryName(item);
    const status = item.status ? ` · ${String(item.status).toUpperCase()}` : "";
    return `${item.reward_type || `Reward: ${category}`}${status}`;
  }

  const action = String(item.action_type || "activity").replaceAll("_", " ");
  const category = getCategoryName(item);

  return `${action.toUpperCase()} · ${category}`;
}

export default function ProfileSettings({
  profile,
  recentTransactions,
  recentRewards,
}: ProfileSettingsProps) {
  const router = useRouter();
  const supabase = createClient();

  const [birthday, setBirthday] = useState(profile?.birthday || "");
  const [birthdayStatus, setBirthdayStatus] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [isSavingBirthday, setIsSavingBirthday] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  async function handleBirthdayChange(value: string) {
    setBirthday(value);
    setBirthdayStatus("");

    if (!value) return;

    setIsSavingBirthday(true);

    try {
      const response = await fetch("/api/profile/birthday", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ birthday: value }),
      });

      if (!response.ok) {
        throw new Error("Could not save birthday.");
      }

      setBirthdayStatus("Saved");
    } catch {
      setBirthdayStatus("Could not save birthday.");
    } finally {
      setIsSavingBirthday(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordStatus("");

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
      const response = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Could not change password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setPasswordStatus("Password changed.");
    } catch (error) {
      setPasswordStatus(
        error instanceof Error ? error.message : "Could not change password."
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen px-4 py-5" style={{ background: PAGE_GREEN }}>
      <div className="mx-auto w-full max-w-md space-y-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[13px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: BRAND_RED }}
        >
          ← Back
        </button>

        <section
          className="overflow-hidden bg-white"
          style={{ borderRadius: 10 }}
        >
          <div className="p-5" style={{ background: BRAND_RED }}>
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-white">
                <Image
                  src="/profile-icon.png"
                  alt="Profile"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#f0cf61]">
                  Profile
                </p>
                <h1 className="truncate text-[24px] font-black uppercase text-white">
                  {profile?.full_name || "Member"}
                </h1>
                <p className="text-[13px] font-semibold text-white/80">
                  {profile?.client_code || profile?.email}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-5">
            <label className="block">
              <span className="text-[15px] font-black uppercase text-[#123048]">
                Add your birthday
              </span>
              <span className="mt-1 block text-[13px] font-medium text-[#59656d]">
                Add your birthday to collect a special gift.
              </span>
              <input
                type="date"
                value={birthday}
                onChange={(event) => handleBirthdayChange(event.target.value)}
                className="mt-3 w-full rounded-[10px] border border-[#d8d8d8] bg-white px-4 py-3 text-[15px] text-[#123048] outline-none focus:border-[#92534C]"
              />
            </label>

            {birthdayStatus ? (
              <p
                className="text-[12px] font-bold uppercase"
                style={{ color: birthdayStatus === "Saved" ? "#0a9b62" : BRAND_RED }}
              >
                {isSavingBirthday ? "Saving..." : birthdayStatus}
              </p>
            ) : null}
          </div>
        </section>

        <section className="bg-white p-5" style={{ borderRadius: 10 }}>
          <h2 className="text-[22px] font-black uppercase" style={{ color: BRAND_RED }}>
            History
          </h2>
          <p className="mt-1 text-[13px] font-medium text-[#59656d]">
            Last 5 activities
          </p>

          <div className="mt-4 space-y-3">
            {history.length > 0 ? (
              history.map((item) => (
                <div
                  key={`${item._type}-${item.id}`}
                  className="rounded-[10px] border border-[#eeeeee] bg-[#fafafa] px-4 py-3"
                >
                  <p className="text-[14px] font-bold uppercase text-[#123048]">
                    {getActivityTitle(item)}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-[#7b7b7b]">
                    {formatDate(item._date)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-[10px] bg-[#fafafa] px-4 py-3 text-[14px] font-medium text-[#59656d]">
                No activity yet.
              </p>
            )}
          </div>
        </section>

        <section className="bg-white p-5" style={{ borderRadius: 10 }}>
          <h2 className="text-[22px] font-black uppercase" style={{ color: BRAND_RED }}>
            Change Password
          </h2>

          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#123048]">
                Current password
              </span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="mt-2 w-full rounded-[10px] border border-[#d8d8d8] bg-white px-4 py-3 text-[15px] text-[#123048] outline-none focus:border-[#92534C]"
                placeholder="Current password"
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#123048]">
                New password
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-2 w-full rounded-[10px] border border-[#d8d8d8] bg-white px-4 py-3 text-[15px] text-[#123048] outline-none focus:border-[#92534C]"
                placeholder="New password"
              />
            </label>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full rounded-[10px] px-4 py-3 text-[14px] font-black uppercase disabled:opacity-60"
              style={{ background: BRAND_YELLOW, color: "#1c2530" }}
            >
              {isChangingPassword ? "Changing..." : "Change password"}
            </button>

            {passwordStatus ? (
              <p
                className="text-[12px] font-bold uppercase"
                style={{
                  color:
                    passwordStatus === "Password changed."
                      ? "#0a9b62"
                      : BRAND_RED,
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
          className="w-full rounded-[10px] px-4 py-4 text-[14px] font-black uppercase text-white"
          style={{ background: BRAND_RED }}
        >
          Logout
        </button>
      </div>
    </main>
  );
}
