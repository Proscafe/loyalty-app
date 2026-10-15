import { requireRole } from "@/lib/auth";
import { MenuClient } from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  await requireRole(["master_admin"]);
  return <MenuClient />;
}
