import { requireRole } from "@/lib/auth";
import { FnbClient } from "./FnbClient";

export const dynamic = "force-dynamic";

export default async function FnbPage() {
  await requireRole(["master_admin"]);
  return <FnbClient />;
}
