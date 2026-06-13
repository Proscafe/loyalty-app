import { AdminDashboard } from "../AdminDashboard";
import { loadAdminDashboardData } from "../_dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminCommentCardsPage() {
  const props = await loadAdminDashboardData();
  return <AdminDashboard {...props} initialTab="Comment Cards" />;
}
