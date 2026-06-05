import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ExistingMatch = {
  id: string;
  sport_type?: string | null;
  match_label?: string | null;
  venue?: string | null;
};

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

function toIso(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function inferSportType(input: {
  sport_type?: string | null;
  match_label?: string | null;
  venue?: string | null;
}) {
  const text = `${input.sport_type ?? ""} ${input.match_label ?? ""} ${input.venue ?? ""}`.toLowerCase();

  return text.includes("basket") ? "basketball" : "football";
}

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;

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

    if (profileError) {
      return jsonError(profileError.message, 400);
    }

    if (!profile || profile.role !== "master_admin") {
      return jsonError("Admin access required.", 403);
    }

    const { data: existingMatch, error: existingError } = await admin
      .from("prediction_matches")
      .select("id, sport_type, match_label, venue")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return jsonError(existingError.message, 400);
    }

    if (!existingMatch) {
      return jsonError("Game link not found.", 404);
    }

    const body = (await req.json().catch(() => ({}))) as {
      sport_type?: string;
      home_team?: string;
      away_team?: string;
      match_label?: string;
      venue?: string;
      kickoff_at?: string;
      opens_at?: string;
      closes_at?: string;
    };

    const homeTeam = String(body.home_team ?? "").trim();
    const awayTeam = String(body.away_team ?? "").trim();

    const existing = existingMatch as ExistingMatch;
    const requestedMatchLabel = String(body.match_label ?? "").trim();
    const requestedVenue = String(body.venue ?? "").trim();

    const sportType = inferSportType({
      sport_type: body.sport_type || existing.sport_type,
      match_label: requestedMatchLabel || existing.match_label,
      venue: requestedVenue || existing.venue,
    });

    const matchLabel =
      requestedMatchLabel ||
      String(existing.match_label ?? "").trim() ||
      (sportType === "basketball" ? "Basket" : "World Cup");
    const venue = requestedVenue || null;
    const kickoffAt = toIso(body.kickoff_at);
    const opensAt = toIso(body.opens_at);
    const closesAt = toIso(body.closes_at);

    if (!homeTeam || !awayTeam) {
      return jsonError("Both teams are required.", 400);
    }

    if (!kickoffAt || !opensAt || !closesAt) {
      return jsonError("Match timing, open time, and close time are required.", 400);
    }

    if (new Date(opensAt).getTime() >= new Date(closesAt).getTime()) {
      return jsonError("Open time must be before close time.", 400);
    }

    const { data, error } = await admin
      .from("prediction_matches")
      .update({
        sport_type: sportType,
        home_team: homeTeam,
        away_team: awayTeam,
        match_label: matchLabel,
        venue,
        kickoff_at: kickoffAt,
        opens_at: opensAt,
        closes_at: closesAt,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return jsonError(error.message, 400);
    }

    if (!data) {
      return jsonError("Game link not found.", 404);
    }

    return NextResponse.json({ match: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not save game details.", 500);
  }
}
