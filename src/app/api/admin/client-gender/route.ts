import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError("Please sign in as admin first.", 401);
    }

    const admin = getAdminClient();

    if (!admin) {
      return jsonError("SUPABASE_SERVICE_ROLE_KEY is missing.", 500);
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) return jsonError(profileError.message, 400);

    if (!profile || profile.role !== "master_admin") {
      return jsonError("Admin access required.", 403);
    }

    const body = (await req.json().catch(() => ({}))) as {
      user_id?: string;
      gender?: string;
    };

    const userId = String(body.user_id || "").trim();
    const gender = String(body.gender || "").trim().toLowerCase();
    const allowed = ["", "female", "male", "other"];

    if (!userId) return jsonError("Client id is required.", 400);
    if (!allowed.includes(gender)) return jsonError("Invalid gender.", 400);

    const { data, error } = await admin
      .from("profiles")
      .update({ gender: gender || null })
      .eq("id", userId)
      .select("id, gender")
      .maybeSingle();

    if (error) return jsonError(error.message, 400);
    if (!data) return jsonError("Client not found.", 404);

    return NextResponse.json({ profile: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not save gender.", 500);
  }
}
