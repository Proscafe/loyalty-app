import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClientStamp, LoyaltyCategory, Reward } from "@/types";
import { ClientDashboard } from "./ClientDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  const [{ data: categories }, { data: stamps }, { data: rewards }] = await Promise.all([
    supabase.from("loyalty_categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("client_stamps").select("*").eq("client_id", profile.id),
    supabase
      .from("rewards")
      .select("*")
      .eq("client_id", profile.id)
      .in("status", ["available", "claimed", "redeemed"])
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
