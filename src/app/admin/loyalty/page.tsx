import { AdminDashboardClient } from "../AdminDashboardClient";
import { loadAdminDashboardData } from "../_dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminLoyaltyPage() {
  const props = await loadAdminDashboardData();
  return <AdminDashboardClient {...props} initialTab="Loyalty Program" />;
}
