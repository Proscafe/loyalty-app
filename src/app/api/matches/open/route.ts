import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ matches: [] });
  }

  const admin = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date().toISOString();

  const { data: matches } = await admin
    .from("prediction_matches")
    .select("id, opens_at, closes_at, is_active")
    .eq("is_active", true)
    .lte("opens_at", now)
    .gte("closes_at", now)
    .limit(10);

  return NextResponse.json({ matches: matches ?? [] });
}
