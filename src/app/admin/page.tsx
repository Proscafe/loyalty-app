import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "./AdminDashboard";
import type { Profile, Reward, StampTransaction } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await requireRole(["master_admin"]);
  const supabase = await createClient();

  const [
    { data: users },
    { data: txns },
    { data: rewards },
    { count: clientCount },
    { count: stampsIssued },
    { count: rewardsEarned },
    { count: rewardsRedeemed },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("stamp_transactions").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("rewards").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "client"),
    supabase.from("stamp_transactions").select("*", { count: "exact", head: true }).eq("action_type", "add_stamp"),
    supabase.from("rewards").select("*", { count: "exact", head: true }),
    supabase.from("rewards").select("*", { count: "exact", head: true }).eq("status", "redeemed"),
  ]);

  // Most-active category: highest count of add_stamp actions, joined to category name
  const { data: actionRows } = await supabase
    .from("stamp_transactions").select("category_id").eq("action_type", "add_stamp");

  const countMap = new Map<string, number>();
  (actionRows ?? []).forEach((r: { category_id: string | null }) => {
    if (!r.category_id) return;
    countMap.set(r.category_id, (countMap.get(r.category_id) ?? 0) + 1);
  });
  let mostActiveCategoryName = "—";
  if (countMap.size > 0) {
    const [topId] = [...countMap.entries()].sort((a, b) => b[1] - a[1])[0];
    const { data: cat } = await supabase.from("loyalty_categories").select("name").eq("id", topId).maybeSingle();
    if (cat) mostActiveCategoryName = cat.name;
  }

  return (
    <AdminDashboard
      profile={profile}
      users={(users ?? []) as Profile[]}
      recentTxns={(txns ?? []) as StampTransaction[]}
      recentRewards={(rewards ?? []) as Reward[]}
      metrics={{
        totalClients: clientCount ?? 0,
        stampsIssued: stampsIssued ?? 0,
        rewardsEarned: rewardsEarned ?? 0,
        rewardsRedeemed: rewardsRedeemed ?? 0,
        mostActiveCategoryName,
      }}
    />
  );
}
