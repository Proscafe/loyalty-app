"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminMobileHeader } from "@/components/AdminMobileHeader";
import { StaffBottomNav } from "@/components/StaffBottomNav";

type StaffActivityRow = {
  id: string;
  activity_source: "stamp" | "reward" | "profile";
  action_type: string;
  client_id: string;
  client_name: string;
  category_name?: string | null;
  reward_label?: string | null;
  staff_name: string;
  created_at: string;
  stamp_delta?: number | null;
  birthday?: boolean;
};

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";

function dayLabel(value: string) {
  const date = new Date(value);
  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const activityDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const diffDays = Math.round(
    (today.getTime() - activityDay.getTime()) / 86400000,
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function activityText(row: StaffActivityRow) {
  if (row.activity_source === "stamp") {
    const count = Math.max(1, Number(row.stamp_delta ?? 1));
    return (
      <>
        {row.client_name} earned{" "}
        <span className="text-[#ffd66b]">
          {count} {row.category_name || "Loyalty"}{" "}
          {count === 1 ? "stamp" : "stamps"}
        </span>
      </>
    );
  }

  if (row.activity_source === "profile") {
    return <>{row.client_name} joined Pro&apos;s Club</>;
  }

  if (row.action_type === "redeemed") {
    return (
      <>
        {row.client_name} redeemed{" "}
        <span className="text-[#ffd66b]">
          {row.reward_label || "Gift"}
        </span>
      </>
    );
  }

  if (row.action_type === "expired") {
    return <>{row.client_name} gift expired</>;
  }

  if (row.birthday) {
    return (
      <>
        {row.client_name} received{" "}
        <span className="text-[#ffd66b]">
          Birthday Gift
        </span>
        {row.reward_label ? ` - ${row.reward_label}` : ""}
      </>
    );
  }

  return (
    <>
      {row.client_name} received{" "}
      <span className="text-[#ffd66b]">
        {row.reward_label || "Gift"}
      </span>
    </>
  );
}

export function StaffActivityClient() {
  const [rows, setRows] = useState<StaffActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/staff/activity", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json.error || "Could not load activity.",
        );
      }

      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load activity.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main
      className="min-h-screen px-4 pb-32 pt-2 font-raleway text-white"
      style={{ background: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-md">
        <AdminMobileHeader
          title="Activity"
          homeHref="/staff"
          profileHref="/profile"
          logoSrc="/pros-logo-basic.png"
          className="mt-1"
        />

        <section className="mb-4 mt-4 rounded-[22px] bg-white/[0.10] px-5 py-5 shadow-[0_18px_50px_rgba(35,54,47,0.14)] backdrop-blur-2xl">
          <h1 className="text-[30px] font-black tracking-[-0.05em] text-white">
            Activity
          </h1>

          <div className="mt-2 text-[11px] font-bold text-white/62">  </div>
        </section>

        {loading ? (
          <div className="rounded-[20px] bg-white/[0.08] px-4 py-7 text-center text-[12px] font-bold text-white/65 backdrop-blur-xl">
            Loading activity...
          </div>
        ) : error ? (
          <div className="rounded-[20px] bg-white/[0.08] px-4 py-6 text-center text-[12px] font-bold text-white/70 backdrop-blur-xl">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[20px] bg-white/[0.08] px-4 py-7 text-center text-[12px] font-bold text-white/60 backdrop-blur-xl">
            No activity in the last 3 days.
          </div>
        ) : (
          <section className="overflow-hidden rounded-[22px] bg-white/[0.08] shadow-[0_12px_30px_rgba(31,45,36,0.10),inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl">
            {rows.map((row) => (
              <div
                key={row.id}
                className="border-b border-white/10 px-4 py-3 last:border-b-0"
              >
                <div className="text-[12px] font-black leading-[1.4] text-white">
                  {activityText(row)}
                </div>

                <div className="mt-1 flex items-center justify-between gap-3 text-[10px] font-black text-white/58">
                  <span className="min-w-0 truncate">
                    {row.staff_name}
                  </span>

                  <span className="shrink-0">
                    {dayLabel(row.created_at)} · {timeLabel(row.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      <StaffBottomNav active="activity" />
    </main>
  );
}

export default StaffActivityClient;
