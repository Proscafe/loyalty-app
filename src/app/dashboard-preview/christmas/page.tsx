import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChristmasDashboard } from "./ChristmasDashboardPreview";

export const dynamic = "force-dynamic";

export default async function ChristmasPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  // Preview: fetch the same loyalty data without changing existing dashboard pages.
  const [categoriesRes, stampsRes, rewardsRes] = await Promise.all([
    supabase.from("loyalty_categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("client_stamps").select("*").eq("client_id", user.id),
    supabase.from("rewards").select("*").eq("client_id", user.id).order("created_at", { ascending: false }),
  ]);
  return (
    <ChristmasDashboard
      profile={profile}
      categories={categoriesRes.data ?? []}
      stamps={stampsRes.data ?? []}
      rewards={rewardsRes.data ?? []}
    />
  );
}
