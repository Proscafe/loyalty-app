import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Reads auth cookies and calls Supabase RPCs — must run on Node, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let body: { client_id?: string; category_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  if (!body.client_id || !body.category_id) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Role enforcement also happens inside the SQL function.
  const { data, error } = await supabase.rpc("add_stamp", {
    p_client_id: body.client_id,
    p_category_id: body.category_id,
  });

  if (error) {
    const status = error.message?.includes("not_authorized") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
