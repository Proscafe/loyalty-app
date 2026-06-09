import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { UsersPage } from "./UsersPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users — Admin" };

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "master_admin") redirect("/admin");

  return <UsersPage adminId={user.id} />;
}
