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

function parseMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
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
      id?: string;
      program_name?: string;
      stamp_name?: string;
      gift_name?: string;
      is_enabled?: boolean;
      average_stamp_cost?: number;
      stamps_per_gift?: number;
      currency?: string;
    };

    const isEnabled = body.is_enabled !== false;

    const payload = {
      id: "default",
      program_name: String(body.program_name || "PRO's Club").trim() || "PRO's Club",
      stamp_name: String(body.stamp_name || "Stamp").trim() || "Stamp",
      gift_name: String(body.gift_name || "Gift").trim() || "Gift",
      is_enabled: isEnabled,
      average_stamp_cost: parseMoney(body.average_stamp_cost),
      stamps_per_gift: Math.max(1, Number(body.stamps_per_gift) || 5),
      currency: String(body.currency || "$").trim() || "$",
    };

    const { data, error } = await admin
      .from("loyalty_program_settings")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) {
      return jsonError(error.message, 400);
    }

    if (!data) {
      return jsonError("Could not update loyalty program.", 400);
    }

    return NextResponse.json({ settings: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not update loyalty program.", 500);
  }
}
