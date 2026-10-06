import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_ROLES = new Set([
  "master_admin",
  "staff",
  "supervisor",
]);

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Please sign in first." },
      { status: 401 },
    );
  }

  const admin = createAdminClient();

  const { data: requester, error: requesterError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (requesterError) {
    return NextResponse.json(
      { error: requesterError.message },
      { status: 500 },
    );
  }

  if (!ALLOWED_ROLES.has(String(requester?.role ?? ""))) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 },
    );
  }

  const pageSize = 1000;
  const profiles: any[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("profiles")
      .select(
        "id, full_name, email, phone, client_code, role, is_active, gender, birthday, created_at",
      )
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    const rows = data ?? [];
    profiles.push(...rows);

    if (rows.length < pageSize) break;
  }

  return NextResponse.json(
    { profiles },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
