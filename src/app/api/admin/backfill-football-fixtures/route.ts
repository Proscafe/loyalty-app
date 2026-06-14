import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PredictionMatch = {
  id: string;
  home_team: string | null;
  away_team: string | null;
  sport_type: string | null;
  match_label: string | null;
  kickoff_at: string | null;
  external_fixture_id?: string | null;
};

type ZafronixMatch = {
  id?: string;
  date?: string | null;
  kickoff?: string | null;
  stage?: string | null;
  stageNormalized?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  homeRef?: string | null;
  awayRef?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  result?: string | null;
  stadium?: string | null;
  city?: string | null;
};

const ZAFRONIX_BASE_URL = "https://api.zafronix.com/fifa/worldcup/v1";
const WORLD_CUP_YEAR = process.env.ZAFRONIX_WC_YEAR ?? "2026";

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

function normalizeTeamName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/\busa\b/g, "united states")
    .replace(/\bu\.s\.a\.\b/g, "united states")
    .replace(/\bunited states of america\b/g, "united states")
    .replace(/\bcote d ivoire\b/g, "ivory coast")
    .replace(/\bcote divoire\b/g, "ivory coast")
    .replace(/\bcôte d’ivoire\b/g, "ivory coast")
    .replace(/\bcuracao\b/g, "curacao")
    .replace(/\bcuraçao\b/g, "curacao")
    .replace(/\bczech republic\b/g, "czechia")
    .replace(/\bbosnia herzegovina\b/g, "bosnia and herzegovina")
    .replace(/\bdr congo\b/g, "congo dr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenScore(a: string, b: string) {
  const left = new Set(normalizeTeamName(a).split(" ").filter(Boolean));
  const right = new Set(normalizeTeamName(b).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;

  let common = 0;
  for (const token of left) {
    if (right.has(token)) common += 1;
  }

  return Math.round((common / Math.max(left.size, right.size)) * 100);
}

function directTeamScore(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeTeamName(a);
  const right = normalizeTeamName(b);
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) return 92;
  return tokenScore(left, right);
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

function scoreFixture(match: PredictionMatch, fixture: ZafronixMatch) {
  const apiHome = fixture.homeTeam ?? "";
  const apiAway = fixture.awayTeam ?? "";

  const sameDirectionHome = directTeamScore(match.home_team, apiHome);
  const sameDirectionAway = directTeamScore(match.away_team, apiAway);
  const sameDirection = Math.round((sameDirectionHome + sameDirectionAway) / 2);

  const swappedHome = directTeamScore(match.home_team, apiAway);
  const swappedAway = directTeamScore(match.away_team, apiHome);
  const swapped = Math.round((swappedHome + swappedAway) / 2);

  const isSwapped = swapped > sameDirection;
  const teamConfidence = Math.max(sameDirection, swapped);
  const apiKickoff = toZafronixKickoffIso(fixture);
  const diff = kickoffDiffMinutes(match.kickoff_at, apiKickoff);

  let confidence = teamConfidence;

  if (sameDate(match.kickoff_at, apiKickoff)) confidence += 5;
  else if (diff == null) confidence -= 10;
  else if (diff <= 24 * 60) confidence -= 0;
  else if (diff <= 72 * 60) confidence -= 10;
  else confidence -= 35;

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    fixtureId: String(fixture.id ?? ""),
    confidence,
    kickoffDiffMinutes: diff,
    isSwapped,
    apiHome,
    apiAway,
    apiKickoff,
    apiDate: fixture.date ?? null,
    apiKickoffTime: fixture.kickoff ?? null,
    apiStage: fixture.stageNormalized ?? fixture.stage ?? null,
    apiScore:
      typeof fixture.homeScore === "number" && typeof fixture.awayScore === "number"
        ? `${fixture.homeScore}-${fixture.awayScore}`
        : null,
  };
}

async function fetchZafronixMatches() {
  const key = process.env.ZAFRONIX_WC_API_KEY;
  if (!key) throw new Error("Missing ZAFRONIX_WC_API_KEY.");

  const url = new URL(`${ZAFRONIX_BASE_URL}/matches`);
  url.searchParams.set("year", WORLD_CUP_YEAR);

  const response = await fetch(url.toString(), {
    headers: {
      "X-API-Key": key,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.message ?? `Zafronix request failed with ${response.status}.`);
  }

  return Array.isArray(json?.data) ? (json.data as ZafronixMatch[]) : [];
}

export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get("secret");
    const save = request.nextUrl.searchParams.get("save") === "true";
    const minConfidence = Number(request.nextUrl.searchParams.get("minConfidence") ?? 90);

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const supabase = getAdminSupabase();

    const { data: matches, error } = await supabase
      .from("prediction_matches")
      .select("id, home_team, away_team, sport_type, match_label, kickoff_at, external_fixture_id")
      .eq("sport_type", "football")
      .not("kickoff_at", "is", null)
      .order("kickoff_at", { ascending: true });

    if (error) throw error;

    const fixtures = await fetchZafronixMatches();
    const results = [];

    for (const match of (matches ?? []) as PredictionMatch[]) {
      const candidates = fixtures
        .map((fixture) => scoreFixture(match, fixture))
        .filter((candidate) => candidate.fixtureId)
        .sort((a, b) => b.confidence - a.confidence);

      const best = candidates[0] ?? null;
      const shouldSave = Boolean(save && best && best.confidence >= minConfidence && !best.isSwapped);

      if (shouldSave && best) {
        const { error: updateError } = await supabase
          .from("prediction_matches")
          .update({
            external_fixture_id: best.fixtureId,
            score_source: "zafronix",
          })
          .eq("id", match.id);

        if (updateError) throw updateError;
      }

      results.push({
        matchId: match.id,
        yourMatch: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
        yourKickoff: match.kickoff_at,
        existingFixtureId: match.external_fixture_id ?? null,
        best,
        saved: shouldSave,
        review: !best || best.confidence < minConfidence || best.isSwapped,
      });
    }

    return NextResponse.json({
      source: "zafronix",
      mode: save ? "save" : "dry-run",
      year: WORLD_CUP_YEAR,
      zafronixFixtures: fixtures.length,
      minConfidence,
      total: results.length,
      saved: results.filter((result) => result.saved).length,
      review: results.filter((result) => result.review).length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error." },
      { status: 500 },
    );
  }
}
