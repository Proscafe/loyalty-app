import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function requireBoAdminDb() {
  const session = await createClient();
  const { data: { user }, error: userError } = await session.auth.getUser();

  if (userError || !user) {
    return { admin: null, user: null, error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await session
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || String(profile.role) !== "master_admin") {
    return { admin: null, user, error: NextResponse.json({ error: "Master admin access required." }, { status: 403 }) };
  }

  return { admin: createAdminClient(), user, error: null };
}

export function boError(error: unknown, fallback = "Request failed.") {
  return NextResponse.json({ error: error instanceof Error ? error.message : String((error as any)?.message ?? fallback) }, { status: 500 });
}

export function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
