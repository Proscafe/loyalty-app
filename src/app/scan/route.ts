import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanScannedCode(rawValue: string) {
  const trimmed = rawValue.trim();

  try {
    const url = new URL(trimmed);
    const fromQuery =
      url.searchParams.get("client_code") ??
      url.searchParams.get("code") ??
      url.searchParams.get("client") ??
      url.searchParams.get("id");

    if (fromQuery) return fromQuery.trim().replace(/^#/, "");

    const lastPathPart = url.pathname.split("/").filter(Boolean).pop();
    if (lastPathPart) return decodeURIComponent(lastPathPart).trim().replace(/^#/, "");
  } catch {
    // Plain client code, not a URL.
  }

  return trimmed.replace(/^#/, "");
}

async function isStaffOrAdmin(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) return false;
  return data.role === "staff" || data.role === "master_admin";
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const allowed = await isStaffOrAdmin(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const code = cleanScannedCode(url.searchParams.get("code") ?? "");

  if (!code) {
    return NextResponse.json({ error: "empty_qr_code" }, { status: 400 });
  }

  const admin = createAdminClient();
  const candidates = Array.from(
    new Set([
      code,
      code.toUpperCase(),
      code.toLowerCase(),
      code.replace(/^#/, ""),
      code.replace(/^#/, "").toUpperCase(),
    ].filter(Boolean)),
  );

  for (const candidate of candidates) {
    const { data: byCode } = await admin
      .from("profiles")
      .select("*")
      .eq("role", "client")
      .eq("client_code", candidate)
      .maybeSingle();

    if (byCode) return NextResponse.json({ client: byCode, scanned_code: code });

    const { data: byId } = await admin
      .from("profiles")
      .select("*")
      .eq("role", "client")
      .eq("id", candidate)
      .maybeSingle();

    if (byId) return NextResponse.json({ client: byId, scanned_code: code });
  }

  const { data: fallback } = await admin
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .ilike("client_code", `%${code}%`)
    .limit(1);

  if (fallback?.[0]) {
    return NextResponse.json({ client: fallback[0], scanned_code: code });
  }

  return NextResponse.json(
    { error: "client_not_found", scanned_code: code },
    { status: 404 },
  );
}
