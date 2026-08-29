import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StaffConsole } from "./StaffConsole";
import type { LoyaltyCategory } from "@/types";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const profile = await requireRole(["staff", "supervisor", "master_admin"]);
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("loyalty_categories").select("*").eq("is_active", true).order("sort_order");

  return <StaffConsole profile={profile} categories={(categories ?? []) as LoyaltyCategory[]} />;
}
