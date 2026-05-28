import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileSettings from "./ProfileSettings";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, client_code, birthday, created_at")
    .eq("id", user.id)
    .single();

  const { data: recentTransactions } = await supabase
    .from("stamp_transactions")
    .select(
      `
      id,
      action_type,
      notes,
      created_at,
      loyalty_categories:category_id(name)
    `,
    )
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: recentRewards } = await supabase
    .from("rewards")
    .select(
      `
      id,
      reward_type,
      status,
      created_at,
      earned_at,
      redeemed_at,
      loyalty_categories:category_id(name)
    `,
    )
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <ProfileSettings
      profile={profile}
      recentTransactions={recentTransactions ?? []}
      recentRewards={recentRewards ?? []}
    />
  );
}
