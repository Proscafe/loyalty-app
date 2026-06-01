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
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  // datetime-local sends YYYY-MM-DDTHH:mm.
  // Save that exact calendar date/time to Supabase without timezone shifting.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return `${raw}:00.000Z`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw)) {
    return raw.endsWith("Z") ? raw : `${raw.replace(/\.\d+$/, "")}.000Z`;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function toNullableScore(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  const score = Number(raw);

  if (!Number.isInteger(score) || score < 0 || score > 99) return undefined;

  return score;
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

async function getAuthorizedDb(): Promise<
  | { error: Response; db: null; userId: null }
  | { error: null; db: any; userId: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: jsonError("Please sign in as admin first.", 401),
      db: null,
      userId: null,
    };
  }

  const admin = getAdminClient();

  if (!admin) {
    return {
      error: jsonError(
        "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local and Vercel Environment Variables.",
        500,
      ),
      db: null,
      userId: null,
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      error: jsonError(profileError.message, 400),
      db: null,
      userId: null,
    };
  }

  if (!profile || profile.role !== "master_admin") {
    return {
      error: jsonError("Admin access required.", 403),
      db: null,
      userId: null,
    };
  }

  return { error: null, db: admin, userId: user.id };
}

function buildMatchPayload(body: {
  home_team?: string;
  away_team?: string;
  match_label?: string;
  venue?: string;
  kickoff_at?: string;
  opens_at?: string;
  closes_at?: string;
  home_score?: string;
  away_score?: string;
}) {
  const homeTeam = String(body.home_team ?? "").trim();
  const awayTeam = String(body.away_team ?? "").trim();
  const matchLabel = String(body.match_label ?? "World Cup").trim() || "World Cup";
  const venue = String(body.venue ?? "").trim() || null;
  const kickoffAt = toIso(body.kickoff_at);
  const opensAt = toIso(body.opens_at);
  const closesAt = toIso(body.closes_at);
  const homeScore = toNullableScore(body.home_score);
  const awayScore = toNullableScore(body.away_score);

  if (!homeTeam || !awayTeam) {
    return { error: "Home team and away team are required.", payload: null };
  }

  if (!kickoffAt || !opensAt || !closesAt) {
    return { error: "Kickoff, open, and close times are required.", payload: null };
  }

  if (new Date(opensAt).getTime() >= new Date(closesAt).getTime()) {
    return { error: "Open time must be before close time.", payload: null };
  }

  if (homeScore === undefined || awayScore === undefined) {
    return { error: "Scores must be whole numbers between 0 and 99.", payload: null };
  }

  return {
    error: null,
    payload: {
      home_team: homeTeam,
      away_team: awayTeam,
      match_label: matchLabel,
      venue,
      kickoff_at: kickoffAt,
      opens_at: opensAt,
      closes_at: closesAt,
      home_score: homeScore,
      away_score: awayScore,
    },
  };
}

export async function POST(req: Request) {
  try {
    const { error: authError, db, userId } = await getAuthorizedDb();

    if (authError) return authError;
    if (!db || !userId) return jsonError("Admin connection failed.", 500);

    let body: {
      home_team?: string;
      away_team?: string;
      match_label?: string;
      venue?: string;
      kickoff_at?: string;
      opens_at?: string;
      closes_at?: string;
      home_score?: string;
      away_score?: string;
    };

    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid request.", 400);
    }

    const { error: validationError, payload } = buildMatchPayload(body);

    if (validationError || !payload) {
      return jsonError(validationError ?? "Invalid match details.", 400);
    }

    const { data, error } = await db
      .from("prediction_matches")
      .insert({
        ...payload,
        secret_code: makeSecretCode(payload.home_team, payload.away_team),
        created_by: userId,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) {
      const message =
        error.message.includes("prediction_matches") ||
        error.message.includes("relation") ||
        error.message.includes("schema cache") ||
        error.message.includes("venue") ||
        error.message.includes("home_score") ||
        error.message.includes("away_score")
          ? "Prediction table columns are missing. Run the Supabase SQL update first."
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

export async function PATCH(req: Request) {
  try {
    const { error: authError, db } = await getAuthorizedDb();

    if (authError) return authError;
    if (!db) return jsonError("Admin connection failed.", 500);

    let body: {
      id?: string;
      home_team?: string;
      away_team?: string;
      match_label?: string;
      venue?: string;
      kickoff_at?: string;
      opens_at?: string;
      closes_at?: string;
      home_score?: string;
      away_score?: string;
    };

    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid request.", 400);
    }

    const matchId = String(body.id ?? "").trim();

    if (!matchId) {
      return jsonError("Match ID is required.", 400);
    }

    const { error: validationError, payload } = buildMatchPayload(body);

    if (validationError || !payload) {
      return jsonError(validationError ?? "Invalid match details.", 400);
    }

    const { data, error } = await db
      .from("prediction_matches")
      .update(payload)
      .eq("id", matchId)
      .select("*")
      .single();

    if (error) {
      const message =
        error.message.includes("prediction_matches") ||
        error.message.includes("relation") ||
        error.message.includes("schema cache") ||
        error.message.includes("venue") ||
        error.message.includes("home_score") ||
        error.message.includes("away_score")
          ? "Prediction table columns are missing. Run the Supabase SQL update first."
          : error.message;

      return jsonError(message, 400);
    }

    return NextResponse.json({ match: data });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected server error while saving match.",
      500,
    );
  }
}
