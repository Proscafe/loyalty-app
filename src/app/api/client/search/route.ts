import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Reads auth cookies, query params, and calls Supabase — must run on Node, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";

  const { data, error } = await supabase.rpc("search_clients", { p_query: q });
  if (error) {
    const status = error.message?.includes("not_authorized") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ results: data ?? [] });
}
