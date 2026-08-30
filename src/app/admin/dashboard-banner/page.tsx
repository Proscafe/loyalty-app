import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import DashboardBannerClient, {
  type DashboardBannerItem,
} from "./DashboardBannerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardBannerPage() {
  await requireRole(["master_admin"]);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("client_dashboard_banners")
    .select("id,image_url,link_url,sort_order,is_active,created_at,updated_at")
    .order("sort_order", { ascending: true })
    .limit(3);

  if (error) {
    throw new Error(`Could not load dashboard banners: ${error.message}`);
  }

  return (
    <DashboardBannerClient
      initialBanners={(data ?? []) as DashboardBannerItem[]}
    />
  );
}
