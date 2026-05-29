import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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

  if (!["staff", "admin"].includes(profile.role)) {
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
    const password = String(body.password ?? "");

    if (!clientId) {
      return NextResponse.json({ error: "Missing client_id." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const admin = getAdminClient();

    const { error } = await admin.auth.admin.updateUserById(clientId, {
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected password update error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
