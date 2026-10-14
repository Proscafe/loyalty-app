import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientDashboard } from "./ClientDashboardPreview";
import type { LoyaltyCategory, ClientStamp, Reward } from "@/types";

export const dynamic = "force-dynamic";

function beirutDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function previousDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function currentStreak(rows: Array<{ created_at?: string | null }>) {
  const daySet = new Set(
    rows.map((row) => beirutDateKey(row.created_at || "")).filter(Boolean),
  );

  const today = beirutDateKey(new Date());
  const yesterday = previousDateKey(today);

  let cursor = daySet.has(today) ? today : daySet.has(yesterday) ? yesterday : "";
  if (!cursor) return 0;

  let streak = 0;
  while (cursor && daySet.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }

  return streak;
}

export default async function DashboardPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const profile = await requireRole([
    "client",
    "staff",
    "supervisor",
    "master_admin",
  ]);

  const supabase = await createClient();

  try {
    await supabase.rpc("reset_stale_claimed_rewards");
    await supabase.rpc("expire_old_rewards");
  } catch {
    // Best-effort cleanup only.
  }

  const [
    { data: categories },
    { data: stamps },
    { data: rewards },
    { data: stampActivity },
    loyaltySettingsResult,
    bannersResult,
  ] = await Promise.all([
    supabase.from("loyalty_categories").select("*").order("sort_order"),
    supabase.from("client_stamps").select("*").eq("client_id", profile.id),
    supabase
      .from("rewards")
      .select("*")
      .eq("client_id", profile.id)
      .in("status", ["available", "claimed", "redeemed", "expired"])
      .order("earned_at", { ascending: false }),
    supabase
      .from("stamp_transactions")
      .select("created_at,action_type")
      .eq("client_id", profile.id)
      .eq("action_type", "add_stamp")
      .order("created_at", { ascending: false }),
    supabase
      .from("loyalty_program_settings")
      .select("is_enabled")
      .eq("id", "default")
      .maybeSingle(),
    supabase
      .from("client_dashboard_banners")
      .select("id,image_url,link_url,sort_order,is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(3),
  ]);

  const loyaltySettings = loyaltySettingsResult.data as {
    is_enabled?: boolean | null;
  } | null;

  const allTimeStamps = (stampActivity ?? []).length;
  const giftsEarned = (rewards ?? []).length;
  const streak = currentStreak(
    ((stampActivity ?? []) as Array<{ created_at?: string | null }>),
  );

  return (
    <ClientDashboard
      profile={profile}
      banners={(bannersResult.data ?? []) as Array<{
        id: string;
        image_url: string;
        link_url?: string | null;
        sort_order: number;
      }>}
      categories={(categories ?? []) as LoyaltyCategory[]}
      initialStamps={(stamps ?? []) as ClientStamp[]}
      initialRewards={(rewards ?? []) as Reward[]}
      isLoyaltyProgramEnabled={loyaltySettings?.is_enabled !== false}
      previewStreak={streak}
      previewAllTimeStamps={allTimeStamps}
      previewGiftsEarned={giftsEarned}
    />
  );
}
