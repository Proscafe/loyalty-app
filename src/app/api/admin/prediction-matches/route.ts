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

  // datetime-local gives YYYY-MM-DDTHH:mm.
  // Parse it as the admin browser's local time, then store UTC.
  // This keeps the same displayed time after reload.
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
  sport_type?: string;
  match_label?: string;
  venue?: string;
  kickoff_at?: string;
  opens_at?: string;
  closes_at?: string;
  home_score?: string;
  away_score?: string;
}) {
  const sportType = body.sport_type === "basketball" ? "basketball" : "football";
  const homeTeam = String(body.home_team ?? "").trim();
  const awayTeam = String(body.away_team ?? "").trim();
  const matchLabel =
    String(body.match_label ?? (sportType === "basketball" ? "Basket" : "World Cup")).trim() ||
    (sportType === "basketball" ? "Basket" : "World Cup");
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
      sport_type: sportType,
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

export async function GET() {
  try {
    const { error: authError, db } = await getAuthorizedDb();

    if (authError) return authError;
    if (!db) return jsonError("Admin connection failed.", 500);

    const { data, error } = await db
      .from("prediction_matches")
      .select(
        "id, sport_type, home_team, away_team, match_label, venue, kickoff_at, opens_at, closes_at, home_score, away_score, secret_code, is_active, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return jsonError(error.message, 400);
    }

    const matchIds = (data ?? []).map((match: { id: string }) => match.id);
    const entryCounts = new Map<string, number>();

    if (matchIds.length > 0) {
      const { data: entries, error: entriesError } = await db
        .from("prediction_entries")
        .select("match_id")
        .in("match_id", matchIds);

      if (entriesError) {
        return jsonError(entriesError.message, 400);
      }

      (entries ?? []).forEach((entry: { match_id: string }) => {
        entryCounts.set(entry.match_id, (entryCounts.get(entry.match_id) ?? 0) + 1);
      });
    }

    return NextResponse.json({
      matches: (data ?? []).map((match: { id: string }) => ({
        ...match,
        entries_count: entryCounts.get(match.id) ?? 0,
      })),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected server error while loading matches.",
      500,
    );
  }
}

export async function POST(req: Request) {
  try {
    const { error: authError, db, userId } = await getAuthorizedDb();

    if (authError) return authError;
    if (!db || !userId) return jsonError("Admin connection failed.", 500);

    let body: {
      sport_type?: string;
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
      return jsonError(error.message, 400);
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
      sport_type?: string;
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
      return jsonError(error.message, 400);
    }

    return NextResponse.json({ match: data });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected server error while saving match.",
      500,
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { error: authError, db } = await getAuthorizedDb();

    if (authError) return authError;
    if (!db) return jsonError("Admin connection failed.", 500);

    let body: {
      id?: string;
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

    const { error: entriesError } = await db
      .from("prediction_entries")
      .delete()
      .eq("match_id", matchId);

    if (entriesError) {
      return jsonError(entriesError.message, 400);
    }

    const { error } = await db.from("prediction_matches").delete().eq("id", matchId);

    if (error) {
      return jsonError(error.message, 400);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected server error while deleting match.",
      500,
    );
  }
}
