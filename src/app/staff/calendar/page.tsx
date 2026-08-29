import { requireRole } from "@/lib/auth";
import StaffCalendarClient from "./StaffCalendarClient";

export const dynamic = "force-dynamic";

export default async function StaffCalendarPage() {
  await requireRole(["master_admin", "staff", "supervisor"]);

  return <StaffCalendarClient />;
}
