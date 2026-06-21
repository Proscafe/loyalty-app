import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoyaltyPageClient from "./LoyaltyPageClient";

export default async function LoyaltyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["master_admin", "staff"].includes(profile.role)) {
    redirect("/");
  }

  return <LoyaltyPageClient />;
}
