import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function makeSecretCode(homeTeam: string, awayTeam: string) {
  const home = homeTeam.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 3) || "hom";
  const away = awayTeam.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 3) || "awy";
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `wc-${home}-${away}-${random}`;
}

function toIso(value: unknown) {
  const date = new Date(String(value ?? ""));

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function getAdminClientOrNull() {
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

    const admin = getAdminClientOrNull();
    const db = admin ?? supabase;

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return jsonError(profileError.message, 400);
    }

    if (!profile || profile.role !== "master_admin") {
      return jsonError("Admin access required.", 403);
    }

    let body: {
      home_team?: string;
      away_team?: string;
      match_label?: string;
      kickoff_at?: string;
      opens_at?: string;
      closes_at?: string;
    };

    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid request.", 400);
    }

    const homeTeam = String(body.home_team ?? "").trim();
    const awayTeam = String(body.away_team ?? "").trim();
    const matchLabel = String(body.match_label ?? "World Cup").trim() || "World Cup";
    const kickoffAt = toIso(body.kickoff_at);
    const opensAt = toIso(body.opens_at);
    const closesAt = toIso(body.closes_at);

    if (!homeTeam || !awayTeam) {
      return jsonError("Home team and away team are required.", 400);
    }

    if (!kickoffAt || !opensAt || !closesAt) {
      return jsonError("Kickoff, open, and close times are required.", 400);
    }

    if (new Date(opensAt).getTime() >= new Date(closesAt).getTime()) {
      return jsonError("Open time must be before close time.", 400);
    }

    const { data, error } = await db
      .from("prediction_matches")
      .insert({
        home_team: homeTeam,
        away_team: awayTeam,
        match_label: matchLabel,
        kickoff_at: kickoffAt,
        opens_at: opensAt,
        closes_at: closesAt,
        secret_code: makeSecretCode(homeTeam, awayTeam),
        created_by: user.id,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) {
      const message =
        error.message.includes("prediction_matches") ||
        error.message.includes("relation") ||
        error.message.includes("schema cache")
          ? "Prediction tables are missing. Run the Supabase SQL first."
          : error.message;

      return jsonError(message, 400);
    }

    return NextResponse.json({ match: data });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected server error while creating match.",
      500,
    );
  }
}
