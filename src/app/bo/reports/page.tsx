import { requireRole } from "@/lib/auth";
import { ReportsClient } from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireRole(["master_admin"]);
  return <ReportsClient />;
}
