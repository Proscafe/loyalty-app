import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PredictionMatch = {
  id: string;
  home_team: string | null;
  away_team: string | null;
  kickoff_at: string | null;
  external_fixture_id: string | null;
};

type ZafronixMatch = {
  id?: string;
  date?: string | null;
  kickoff?: string | null;
  stage?: string | null;
  stageNormalized?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  result?: string | null;
};

const ZAFRONIX_BASE_URL = "https://api.zafronix.com/fifa/worldcup/v1";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/\busa\b/g, "united states")
    .replace(/\bunited states of america\b/g, "united states")
    .replace(/\bcote d ivoire\b/g, "ivory coast")
    .replace(/\bcote divoire\b/g, "ivory coast")
    .replace(/\bcuraçao\b/g, "curacao")
    .replace(/\bczech republic\b/g, "czechia")
    .replace(/\bbosnia herzegovina\b/g, "bosnia and herzegovina")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function closeEnough(a: string | null | undefined, b: string | null | undefined) {
  const left = normalize(a);
  const right = normalize(b);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function toZafronixKickoffIso(match: ZafronixMatch) {
  if (!match.date) return null;
  if (!match.kickoff) return `${match.date}T00:00:00.000Z`;
  return `${match.date}T${match.kickoff}:00.000Z`;
}

function kickoffDiffMinutes(a?: string | null, b?: string | null) {
  const first = new Date(a ?? "").getTime();
  const second = new Date(b ?? "").getTime();
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return Math.round(Math.abs(first - second) / 60000);
}

function sameDate(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

async function fetchFixture(fixtureId: string) {
  const key = process.env.ZAFRONIX_WC_API_KEY;
  if (!key) throw new Error("Missing ZAFRONIX_WC_API_KEY.");

  const response = await fetch(`${ZAFRONIX_BASE_URL}/matches/${encodeURIComponent(fixtureId)}`, {
    headers: {
      "X-API-Key": key,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json?.message ?? `Zafronix request failed with ${response.status}.`);
  return json as ZafronixMatch;
}

export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get("secret");

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const supabase = getAdminSupabase();

    const { data: matches, error } = await supabase
      .from("prediction_matches")
      .select("id, home_team, away_team, kickoff_at, external_fixture_id")
      .eq("sport_type", "football")
      .not("external_fixture_id", "is", null)
      .order("kickoff_at", { ascending: true });

    if (error) throw error;

    const results = [];

    for (const match of (matches ?? []) as PredictionMatch[]) {
      try {
        const fixture = await fetchFixture(String(match.external_fixture_id));
        const apiHome = fixture?.homeTeam ?? null;
        const apiAway = fixture?.awayTeam ?? null;
        const apiKickoff = toZafronixKickoffIso(fixture);
        const diff = kickoffDiffMinutes(match.kickoff_at, apiKickoff);

        const teamsOk = closeEnough(match.home_team, apiHome) && closeEnough(match.away_team, apiAway);
        const timeOk = sameDate(match.kickoff_at, apiKickoff) || (diff !== null && diff <= 24 * 60);

        results.push({
          matchId: match.id,
          fixtureId: match.external_fixture_id,
          yourMatch: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
          apiMatch: `${apiHome ?? "Home"} vs ${apiAway ?? "Away"}`,
          yourKickoff: match.kickoff_at,
          apiKickoff,
          kickoffDiffMinutes: diff,
          apiStage: fixture.stageNormalized ?? fixture.stage ?? null,
          apiScore:
            typeof fixture.homeScore === "number" && typeof fixture.awayScore === "number"
              ? `${fixture.homeScore}-${fixture.awayScore}`
              : null,
          status: teamsOk && timeOk ? "OK" : "REVIEW",
        });
      } catch (error) {
        results.push({
          matchId: match.id,
          fixtureId: match.external_fixture_id,
          yourMatch: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error.",
        });
      }
    }

    return NextResponse.json({
      source: "zafronix",
      total: results.length,
      ok: results.filter((result) => result.status === "OK").length,
      review: results.filter((result) => result.status === "REVIEW").length,
      error: results.filter((result) => result.status === "ERROR").length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error." },
      { status: 500 },
    );
  }
}
