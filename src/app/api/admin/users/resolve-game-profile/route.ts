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

function normalizePhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("961")) {
    const withoutCountryCode = digits.slice(3);
    return withoutCountryCode.length === 7
      ? `0${withoutCountryCode}`
      : withoutCountryCode;
  }

  if (digits.length === 7) return `0${digits}`;
  if (digits.length > 8) return digits.slice(-8);

  return digits;
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function POST(request: Request) {
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

  let body: any;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const wantedPhone = normalizePhone(body?.phone);
  const wantedName = normalizeName(body?.full_name);
  const syntheticId = String(body?.synthetic_id ?? "").trim();

  // Older synthetic ids sometimes contained the real profile UUID.
  const possibleProfileId = syntheticId.startsWith("game-")
    ? syntheticId.slice(5)
    : "";

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      possibleProfileId,
    )
  ) {
    const { data: directProfile } = await admin
      .from("profiles")
      .select(
        "id, full_name, email, phone, client_code, role, is_active",
      )
      .eq("id", possibleProfileId)
      .maybeSingle();

    if (directProfile) {
      return NextResponse.json(
        { profile: directProfile },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  // Use the service-role client so RLS cannot hide the real profile.
  // The customer base is small enough to normalize phone/name safely here.
  const pageSize = 1000;
  const profiles: any[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("profiles")
      .select(
        "id, full_name, email, phone, client_code, role, is_active",
      )
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

  const exactPhoneMatches = wantedPhone
    ? profiles.filter(
        (profile) =>
          normalizePhone(profile.phone) === wantedPhone,
      )
    : [];

  const exactNameMatches = wantedName
    ? profiles.filter(
        (profile) =>
          normalizeName(profile.full_name) === wantedName,
      )
    : [];

  const matched =
    exactPhoneMatches.length === 1
      ? exactPhoneMatches[0]
      : exactPhoneMatches.find(
          (profile) =>
            wantedName &&
            normalizeName(profile.full_name) === wantedName,
        ) ??
        (exactNameMatches.length === 1
          ? exactNameMatches[0]
          : null);

  if (!matched) {
    return NextResponse.json(
      { profile: null },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { profile: matched },
    { headers: { "Cache-Control": "no-store" } },
  );
}
