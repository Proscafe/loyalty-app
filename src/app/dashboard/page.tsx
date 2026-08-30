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

  const [
    { data: categories },
    { data: stamps },
    { data: rewards },
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
    supabase.from("loyalty_program_settings").select("is_enabled").eq("id", "default").maybeSingle(),
    supabase
      .from("client_dashboard_banners")
      .select("id,image_url,link_url,sort_order,is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(3),
  ]);

  const loyaltySettings = loyaltySettingsResult.data as { is_enabled?: boolean | null } | null;
  const isLoyaltyProgramEnabled = loyaltySettings?.is_enabled !== false;

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
      isLoyaltyProgramEnabled={isLoyaltyProgramEnabled}
    />
  );
}
