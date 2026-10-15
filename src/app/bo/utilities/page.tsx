import { requireRole } from "@/lib/auth";
import { UtilitiesClient } from "./UtilitiesClient";

export const dynamic = "force-dynamic";

export default async function UtilitiesPage() {
  await requireRole(["master_admin"]);
  return <UtilitiesClient />;
}
