import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientDashboard } from "./ClientDashboard";
import type { LoyaltyCategory, ClientStamp, Reward } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  try {
    await supabase.rpc("reset_stale_claimed_rewards");
    await supabase.rpc("expire_old_rewards");
  } catch {
    // Best-effort cleanup only.
  }

  const [{ data: categories }, { data: stamps }, { data: rewards }] = await Promise.all([
    supabase.from("loyalty_categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("client_stamps").select("*").eq("client_id", profile.id),
    supabase
      .from("rewards")
      .select("*")
      .eq("client_id", profile.id)
      .in("status", ["available", "claimed", "redeemed", "expired"])
      .order("earned_at", { ascending: false }),
  ]);

  return (
    <ClientDashboard
      profile={profile}
      categories={(categories ?? []) as LoyaltyCategory[]}
      initialStamps={(stamps ?? []) as ClientStamp[]}
      initialRewards={(rewards ?? []) as Reward[]}
    />
  );
}
