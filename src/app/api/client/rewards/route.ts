import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  const { data: rewards, error } = await supabase
    .from("rewards")
    .select("*")
    .eq("client_id", profile.id)
    .in("status", ["available", "claimed", "redeemed", "expired"])
    .order("earned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rewards: rewards ?? [] });
}
