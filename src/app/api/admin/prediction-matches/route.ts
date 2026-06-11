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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

async function requireAdmin() {
  const supabase = await createClient();
  const admin = getAdminClient();

  if (!admin) return { admin: null as any, error: jsonError("Supabase admin client is not configured.", 500) };

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { admin: null as any, error: jsonError("Please sign in as admin first.", 401) };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return { admin: null as any, error: jsonError(profileError.message, 400) };
  if (!profile || profile.role !== "master_admin") return { admin: null as any, error: jsonError("Admin access required.", 403) };

  return { admin, error: null as Response | null };
}

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const now = new Date().toISOString();

  const { data: matches, error: matchesError } = await admin
    .from("prediction_matches")
    .select(
      "id, sport_type, tournament_id, home_team, away_team, secret_code, match_label, venue, kickoff_at, opens_at, closes_at, is_active, home_score, away_score, created_at, prediction_tournaments(id, name)",
    )
    .eq("is_active", true)
    .lte("opens_at", now)
    .gte("closes_at", now)
    .order("created_at", { ascending: false })
    .limit(50);

  if (matchesError) return jsonError(matchesError.message, 400);

  const ids = (matches ?? []).map((match: any) => match.id).filter(Boolean);
  const entriesByMatch = new Map<string, number>();

  if (ids.length > 0) {
    const { data: entries } = await admin.from("prediction_entries").select("match_id").in("match_id", ids);

    (entries ?? []).forEach((entry: any) => {
      if (!entry.match_id) return;
      entriesByMatch.set(entry.match_id, (entriesByMatch.get(entry.match_id) ?? 0) + 1);
    });
  }

  const normalized = (matches ?? []).map((match: any) => ({
    ...match,
    tournament_name: match.prediction_tournaments?.name ?? null,
    entries_count: entriesByMatch.get(match.id) ?? 0,
  }));

  return NextResponse.json({ matches: normalized });
}

export async function POST(req: Request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as {
    sport_type?: string;
    tournament_id?: string | null;
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

  const sportType = body.sport_type === "football" ? "football" : body.sport_type === "basketball" ? "basketball" : "football";
  const homeTeam = String(body.home_team ?? "").trim();
  const awayTeam = String(body.away_team ?? "").trim();
  const matchLabel = String(body.match_label ?? "").trim() || (sportType === "basketball" ? "Basket" : "World Cup");
  const venue = String(body.venue ?? "").trim() || null;
  const rawTournamentId = String(body.tournament_id ?? "").trim();
  // Only use tournament_id if it is a valid UUID — silently drop invalid values
  const tournamentId = UUID_RE.test(rawTournamentId) ? rawTournamentId : null;
  const kickoffAt = toIso(body.kickoff_at);
  const opensAt = toIso(body.opens_at);
  const closesAt = toIso(body.closes_at);
  const homeScore = toNullableScore(body.home_score);
  const awayScore = toNullableScore(body.away_score);

  if (!homeTeam || !awayTeam) return jsonError("Both teams are required.", 400);
  if (!kickoffAt || !opensAt || !closesAt) return jsonError("Match timing, open time, and close time are required.", 400);
  if (homeScore === undefined || awayScore === undefined) return jsonError("Scores must be whole numbers from 0 to 99.", 400);
  if (new Date(opensAt).getTime() >= new Date(closesAt).getTime()) return jsonError("Open time must be before close time.", 400);

  // Validate tournament only if a UUID was provided — but do NOT block the insert if
  // the lookup fails (e.g. RLS policy differences between local and production).
  let resolvedTournamentId: string | null = tournamentId;

  if (tournamentId) {
    const { data: tournament, error: tournamentError } = await admin
      .from("prediction_tournaments")
      .select("id, sport_type, is_active")
      .eq("id", tournamentId)
      .maybeSingle();

    if (tournamentError) {
      // Log but don't block — RLS or network issue on production
      console.error("[prediction-matches] Tournament lookup error:", tournamentError.message);
    } else if (!tournament) {
      // Tournament not found — log and clear so insert doesn't fail with FK error
      console.warn("[prediction-matches] Tournament not found for id:", tournamentId);
      resolvedTournamentId = null;
    } else if (tournament.is_active === false) {
      return jsonError("Selected tournament is inactive.", 400);
    } else if (tournament.sport_type !== sportType) {
      return jsonError("Selected tournament does not match this sport.", 400);
    }
  }

  const payload: Record<string, unknown> = {
    sport_type: sportType,
    tournament_id: resolvedTournamentId,
    home_team: homeTeam,
    away_team: awayTeam,
    secret_code: makeSecretCode(homeTeam, awayTeam),
    match_label: matchLabel,
    venue,
    kickoff_at: kickoffAt,
    opens_at: opensAt,
    closes_at: closesAt,
    is_active: true,
  };

  if (homeScore !== null) payload.home_score = homeScore;
  if (awayScore !== null) payload.away_score = awayScore;

  const { data, error: insertError } = await admin.from("prediction_matches").insert(payload).select("*").maybeSingle();

  if (insertError) return jsonError(insertError.message, 400);

  return NextResponse.json({ match: data });
}
