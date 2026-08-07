import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.",
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verifyStaffOrAdmin() {
  const supabase = await createServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      error: "Unauthorized",
      status: 401,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false as const,
      error: "Staff profile not found.",
      status: 403,
    };
  }

  if (!["staff", "master_admin"].includes(profile.role)) {
    return {
      ok: false as const,
      error: "Forbidden",
      status: 403,
    };
  }

  return {
    ok: true as const,
  };
}

export async function POST() {
  try {
    const staff = await verifyStaffOrAdmin();

    if (!staff.ok) {
      return NextResponse.json(
        { error: staff.error },
        { status: staff.status },
      );
    }

    const admin = getAdminClient();

    const [
      resetResult,
      expireResult,
    ] = await Promise.all([
      admin.rpc("reset_stale_claimed_rewards"),
      admin.rpc("expire_old_rewards"),
    ]);

    if (resetResult.error) {
      return NextResponse.json(
        { error: resetResult.error.message },
        { status: 400 },
      );
    }

    if (expireResult.error) {
      return NextResponse.json(
        { error: expireResult.error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected cleanup error.";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}