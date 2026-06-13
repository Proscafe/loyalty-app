import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Reward, StampTransaction } from "@/types";

export async function loadAdminDashboardData() {
  const profile = await requireRole(["master_admin"]);
  const supabase = await createClient();

  const [usersResult, txnsResult, rewardsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("stamp_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("rewards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const users = (usersResult.data ?? []) as Profile[];
  const recentTxns = (txnsResult.data ?? []) as StampTransaction[];
  const recentRewards = (rewardsResult.data ?? []) as Reward[];

  const totalClients = users.filter((user) => user.role === "client").length;
  const rewardsRedeemed = recentRewards.filter((reward) => {
    const row = reward as Reward & Record<string, unknown>;
    const status = String(row.status ?? "").toLowerCase();
    return (
      ["redeemed", "used", "confirmed", "completed"].includes(status) ||
      Boolean(row.redeemed_at || row.used_at || row.confirmed_at || row.completed_at)
    );
  }).length;

  return {
    profile,
    users,
    recentTxns,
    recentRewards,
    metrics: {
      totalClients,
      stampsIssued: recentTxns.length,
      rewardsEarned: recentRewards.length,
      rewardsRedeemed,
      mostActiveCategoryName: "—",
    },
  };
}
