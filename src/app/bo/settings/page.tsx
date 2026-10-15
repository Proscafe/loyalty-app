import { requireRole } from "@/lib/auth";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireRole(["master_admin"]);
  return <SettingsClient />;
}
