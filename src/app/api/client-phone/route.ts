import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local / Vercel environment variables.");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verifyStaffUser() {
  const supabase = await createServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, error: "Unauthorized", status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false as const, error: "Staff profile not found.", status: 403 };
  }

  if (!["staff", "admin", "master_admin"].includes(profile.role)) {
    return { ok: false as const, error: `Forbidden for role: ${profile.role}`, status: 403 };
  }

  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const staff = await verifyStaffUser();

    if (!staff.ok) {
      return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    const body = await req.json();
    const clientId = String(body.client_id ?? "");
    const phone = String(body.phone ?? "").trim();

    if (!clientId) {
      return NextResponse.json({ error: "Missing client_id." }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data, error } = await admin
      .from("profiles")
      .update({ phone: phone || null })
      .eq("id", clientId)
      .select("id, phone")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, phone: data?.phone ?? "" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected phone update error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
