import { requireRole } from "@/lib/auth";
import { StaffActivityClient } from "./StaffActivityClient";

export const dynamic = "force-dynamic";

export default async function StaffActivityPage() {
  await requireRole(["staff", "supervisor", "master_admin"]);

  return <StaffActivityClient />;
}
