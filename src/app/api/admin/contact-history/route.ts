import { NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

async function requireAdmin() {
  const authSupabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized.", status: 401 as const };
  }

  const adminSupabase = createAdminClient();

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.is_active === false ||
    !["master_admin", "staff", "supervisor"].includes(String(profile.role))
  ) {
    return { error: "Forbidden.", status: 403 as const };
  }

  return { adminSupabase };
}

export async function GET() {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: NO_CACHE_HEADERS },
    );
  }

  const { data, error } = await auth.adminSupabase
    .from("contact_history")
    .select("id, contact_key, contacted_at, source, source_id, created_at")
    .order("contacted_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not load contact history." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  const rows = Array.isArray(data) ? data : [];
  const history: Record<string, string[]> = {};

  for (const row of rows) {
    const key = String(row.contact_key ?? "").trim();
    const date = String(row.contacted_at ?? row.created_at ?? "").trim();

    if (key && date) {
      history[key] = Array.from(
        new Set([...(history[key] ?? []), date]),
      )
        .sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime(),
        )
        .slice(0, 20);
    }

    const sourceId = String(row.source_id ?? "").trim();
    if (sourceId && date) {
      const clientKey = `contact-client-${sourceId}`;
      history[clientKey] = Array.from(
        new Set([...(history[clientKey] ?? []), date]),
      )
        .sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime(),
        )
        .slice(0, 20);
    }
  }

  return NextResponse.json(
    { history, rows },
    { headers: NO_CACHE_HEADERS },
  );
}

export async function POST(request: Request) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: NO_CACHE_HEADERS },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const sourceId =
    typeof body.source_id === "string" ? body.source_id.trim() : "";
  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim()
      : "Customer behavior";

  const contactedAt =
    typeof body.contacted_at === "string" &&
    !Number.isNaN(new Date(body.contacted_at).getTime())
      ? new Date(body.contacted_at).toISOString()
      : new Date().toISOString();

  const rawKeys = Array.isArray(body.keys) ? body.keys : [];
  const keys = Array.from(
    new Set(
      rawKeys
        .map((key) => String(key ?? "").trim())
        .filter(Boolean),
    ),
  );

  if (sourceId) {
    keys.unshift(`contact-client-${sourceId}`);
  }

  const uniqueKeys = Array.from(new Set(keys));

  if (!sourceId || uniqueKeys.length === 0) {
    return NextResponse.json(
      { error: "source_id and at least one contact key are required." },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const rows = uniqueKeys.map((contactKey) => ({
    contact_key: contactKey,
    contacted_at: contactedAt,
    source,
    source_id: sourceId,
  }));

  const { data, error } = await auth.adminSupabase
    .from("contact_history")
    .insert(rows)
    .select("id, contact_key, contacted_at, source, source_id, created_at");

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not save contact history." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  return NextResponse.json(
    { ok: true, rows: data ?? [] },
    { headers: NO_CACHE_HEADERS },
  );
}
