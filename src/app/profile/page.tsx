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

  return (
    <ProfileSettings
      profile={profile}
      recentTransactions={[]}
      recentRewards={[]}
    />
  );
}
