import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  // Return empty history — stored client-side in localStorage
  return NextResponse.json({ history: {} });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as {
      keys?: string[];
      contacted_at?: string;
      source?: string;
      source_id?: string;
    };

    // Just acknowledge — localStorage is the primary store
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
