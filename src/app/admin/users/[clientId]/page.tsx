import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import ClientProfilePage from "./ClientProfilePage";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ clientId: string }>;

export default async function AdminClientProfileRoute({
  params,
}: {
  params: RouteParams;
}) {
  const { clientId } = await params;
  const adminProfile = await requireRole(["master_admin"]);
  const supabase = createAdminClient();

  const [profileResult, categoriesResult, stampsResult, rewardsResult, transactionsResult, contactHistoryResult] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", clientId).maybeSingle(),
      supabase
        .from("loyalty_categories")
        .select("id, name, sort_order, average_price, is_active")
        .order("sort_order", { ascending: true }),
      supabase
        .from("client_stamps")
        .select("id, client_id, category_id, stamp_count, updated_at")
        .eq("client_id", clientId),
      supabase
        .from("rewards")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("stamp_transactions")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("contact_history")
        .select("id, contact_key, contacted_at, source, source_id, created_at")
        .eq("source_id", clientId)
        .order("contacted_at", { ascending: false })
        .limit(100),
    ]);

  return (
    <ClientProfilePage
      adminId={adminProfile.id}
      profile={profileResult.data ?? null}
      categories={categoriesResult.data ?? []}
      stamps={stampsResult.data ?? []}
      rewards={rewardsResult.data ?? []}
      transactions={transactionsResult.data ?? []}
      contactHistory={contactHistoryResult.data ?? []}
    />
  );
}
