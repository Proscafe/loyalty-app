import { requireRole } from "@/lib/auth";
import { CoverClient } from "./CoverClient";

export const dynamic = "force-dynamic";

export default async function CoverPage() {
  await requireRole(["master_admin"]);
  return <CoverClient />;
}
