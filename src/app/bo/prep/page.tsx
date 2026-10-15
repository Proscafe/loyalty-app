import { requireRole } from "@/lib/auth";
import { PrepClient } from "./PrepClient";

export const dynamic = "force-dynamic";

export default async function PrepPage() {
  await requireRole(["master_admin"]);
  return <PrepClient />;
}
