import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import AdminDashboard from "../AdminDashboard";
import type { Profile, Reward, StampTransaction } from "@/types";

export const dynamic = "force-dynamic";

type Metrics = {
  totalClients: number;
  stampsIssued: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  mostActiveCategoryName: string;
};

async function loadAdminDashboardData() {
  const supabase = createAdminClient();

  const [
    usersResult,
    txnsResult,
    rewardsResult,
    totalClientsResult,
    stampsIssuedResult,
    rewardsEarnedResult,
    rewardsRedeemedResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("stamp_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("rewards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "client"),
    supabase
      .from("stamp_transactions")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("rewards")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("rewards")
      .select("id", { count: "exact", head: true })
      .eq("status", "redeemed"),
  ]);

  const metrics: Metrics = {
    totalClients: totalClientsResult.count ?? 0,
    stampsIssued: stampsIssuedResult.count ?? 0,
    rewardsEarned: rewardsEarnedResult.count ?? 0,
    rewardsRedeemed: rewardsRedeemedResult.count ?? 0,
    mostActiveCategoryName: "—",
  };

  return {
    users: (usersResult.data ?? []) as Profile[],
    recentTxns: (txnsResult.data ?? []) as StampTransaction[],
    recentRewards: (rewardsResult.data ?? []) as Reward[],
    metrics,
  };
}

export default async function AdminActivityPage() {
  const profile = await requireRole(["master_admin"]);
  const data = await loadAdminDashboardData();

  return (
    <AdminDashboard
      profile={profile}
      users={data.users}
      recentTxns={data.recentTxns}
      recentRewards={data.recentRewards}
      metrics={data.metrics}
      initialTab="Activity"
    />
  );
}
