import { createClient } from "@/lib/supabase/server";
import { UsersPage } from "./UsersPage";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <UsersPage adminId={user?.id ?? "admin"} />;
}
