import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { repairRecentBirthdayRewards } from "@/lib/birthday-rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = String(profile?.role ?? "").toLowerCase();

  if (!profile || !["master_admin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const result = await repairRecentBirthdayRewards();

  return NextResponse.json({
    ok: true,
    inserted: result.inserted,
    deleted_duplicates: result.deletedDuplicates,
  });
}
