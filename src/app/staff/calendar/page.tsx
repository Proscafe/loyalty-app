import { requireRole } from "@/lib/auth";
import StaffCalendarClient from "./StaffCalendarClient";

export const dynamic = "force-dynamic";

export default async function StaffCalendarPage() {
  const profile = await requireRole([
    "master_admin",
    "staff",
    "supervisor",
  ]);

  return (
    <StaffCalendarClient
      isSupervisor={profile.role === "supervisor"}
    />
  );
}
