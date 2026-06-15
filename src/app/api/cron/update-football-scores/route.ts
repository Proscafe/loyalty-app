import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PredictionMatch = {
  id: string;
  home_team: string | null;
  away_team: string | null;
  sport_type: string | null;
  kickoff_at: string | null;
  external_fixture_id: string | null;
};

type PredictionEntry = {
  id: string;
  client_id: string;
  home_score: number | null;
  away_score: number | null;
  points: number | null;
};

type ProfileLite = {
  id: string;
  full_name: string | null;
};

type ZafronixMatch = Record<string, any>;

const ZAFRONIX_BASE_URL = "https://api.zafronix.com/fifa/worldcup/v1";
const GIFT_TYPE = "Free Dessert";

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

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function getFixtureId(match: ZafronixMatch) {
  return asString(match.id || match.matchId || match.fixtureId || match.code || match.slug);
}

function getHomeScore(match: ZafronixMatch) {
  return asNumber(
    match.homeScore ??
      match.home_score ??
      match.score?.home ??
      match.score?.homeScore ??
      match.goals?.home,
  );
}

function getAwayScore(match: ZafronixMatch) {
  return asNumber(
    match.awayScore ??
      match.away_score ??
      match.score?.away ??
      match.score?.awayScore ??
      match.goals?.away,
  );
}

function isFinished(match: ZafronixMatch) {
  const homeScore = getHomeScore(match);
  const awayScore = getAwayScore(match);
  if (homeScore === null || awayScore === null) return false;

  const status = asString(match.status || match.matchStatus || match.state || match.result?.status).toLowerCase();
  if (!status) return true;

  return ["finished", "complete", "completed", "final", "full_time", "full-time", "ft", "aet", "pen"].some((value) =>
    status.includes(value),
  );
}

async function fetchZafronixMatches(year: string) {
  const apiKey = process.env.ZAFRONIX_WC_API_KEY;
  if (!apiKey) throw new Error("Missing ZAFRONIX_WC_API_KEY.");

  const endpoints = [
    `${ZAFRONIX_BASE_URL}/matches?year=${encodeURIComponent(year)}`,
    `${ZAFRONIX_BASE_URL}/tournaments/${encodeURIComponent(year)}/matches`,
  ];

  const failures: string[] = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
          "User-Agent": "loyalty-app-score-cron/1.0",
        },
        cache: "no-store",
      });

      const text = await response.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }

      if (!response.ok) {
        failures.push(`${endpoint} -> ${response.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
        continue;
      }

      const matches = Array.isArray(json)
        ? json
        : Array.isArray(json?.matches)
          ? json.matches
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.response)
              ? json.response
              : [];

      if (matches.length > 0) return matches as ZafronixMatch[];

      failures.push(`${endpoint} -> 200 but no matches returned`);
    } catch (error) {
      failures.push(`${endpoint} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Zafronix fetch failed. ${failures.join(" | ")}`);
}

async function sendExactScoreGifts(params: {
  supabase: ReturnType<typeof getAdminSupabase>;
  matchId: string;
  homeScore: number;
  awayScore: number;
}) {
  const { supabase, matchId, homeScore, awayScore } = params;

  const { data: existingGifts, error: existingError } = await supabase
    .from("prediction_match_gifts")
    .select("client_id")
    .eq("match_id", matchId)
    .eq("gift_type", GIFT_TYPE);

  if (existingError) throw existingError;

  const existingClientIds = new Set((existingGifts ?? []).map((gift: any) => String(gift.client_id)));
  if (existingClientIds.size >= 3) {
    return { sent: 0, reason: "Gifts already sent." };
  }

  const { data: entries, error: entriesError } = await supabase
    .from("prediction_entries")
    .select("id, client_id, home_score, away_score, points")
    .eq("match_id", matchId);

  if (entriesError) throw entriesError;

  const exactEntries = ((entries ?? []) as PredictionEntry[]).filter(
    (entry) => Number(entry.home_score) === homeScore && Number(entry.away_score) === awayScore,
  );

  if (exactEntries.length === 0) {
    return { sent: 0, reason: "No exact-score winners." };
  }

  const clientIds = Array.from(new Set(exactEntries.map((entry) => entry.client_id).filter(Boolean)));

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", clientIds);

  if (profilesError) throw profilesError;

  const profileNames = new Map((profiles ?? []).map((profile: ProfileLite) => [profile.id, profile.full_name ?? ""]));

  const winners = exactEntries
    .sort((a, b) => {
      const pointsDiff = Number(b.points ?? 0) - Number(a.points ?? 0);
      if (pointsDiff !== 0) return pointsDiff;
      return (profileNames.get(a.client_id) || "").localeCompare(profileNames.get(b.client_id) || "");
    })
    .slice(0, 3);

  let sent = 0;

  for (const winner of winners) {
    if (existingClientIds.has(winner.client_id)) continue;

    const { data: reward, error: rewardError } = await supabase
      .from("rewards")
      .insert({
        client_id: winner.client_id,
        reward_type: GIFT_TYPE,
        status: "available",
        earned_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (rewardError) throw rewardError;

    const { error: giftError } = await supabase.from("prediction_match_gifts").upsert(
      {
        match_id: matchId,
        client_id: winner.client_id,
        reward_id: reward?.id ?? null,
        gift_type: GIFT_TYPE,
      },
      { onConflict: "match_id,client_id,gift_type" },
    );

    if (giftError) throw giftError;
    sent += 1;
  }

  return { sent, reason: sent > 0 ? "Free Dessert sent." : "No new gifts to send." };
}

export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get("secret");

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const year = request.nextUrl.searchParams.get("year") || process.env.ZAFRONIX_WORLD_CUP_YEAR || "2026";
    const supabase = getAdminSupabase();

    const { data: matches, error } = await supabase
      .from("prediction_matches")
      .select("id, home_team, away_team, sport_type, kickoff_at, external_fixture_id")
      .eq("sport_type", "football")
      .not("external_fixture_id", "is", null)
      .is("result_synced_at", null)
      .order("kickoff_at", { ascending: true })
      .limit(40);

    if (error) throw error;

    const zafronixMatches = await fetchZafronixMatches(year);
    const zafronixEntries: Array<[string, ZafronixMatch]> = zafronixMatches
      .map((match): [string, ZafronixMatch] | null => {
        const id = getFixtureId(match);
        return id ? [id, match] : null;
      })
      .filter((entry): entry is [string, ZafronixMatch] => entry !== null);

    const zafronixById = new Map<string, ZafronixMatch>(zafronixEntries);

    const results = [];
    let saved = 0;
    let giftsSent = 0;
    let errors = 0;

    for (const match of (matches ?? []) as PredictionMatch[]) {
      try {
        const fixtureId = String(match.external_fixture_id ?? "");
        const fixture = zafronixById.get(fixtureId);

        if (!fixture) {
          results.push({
            matchId: match.id,
            fixtureId,
            match: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
            saved: false,
            giftsSent: 0,
            reason: "Fixture not found in Zafronix 2026 matches.",
          });
          continue;
        }

        const homeScore = getHomeScore(fixture);
        const awayScore = getAwayScore(fixture);

        const updateBase = {
          score_last_checked_at: new Date().toISOString(),
        };

        if (!isFinished(fixture) || homeScore === null || awayScore === null) {
          const { error: updateError } = await supabase.from("prediction_matches").update(updateBase).eq("id", match.id);
          if (updateError) throw updateError;

          results.push({
            matchId: match.id,
            fixtureId,
            match: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
            saved: false,
            giftsSent: 0,
            reason: "Not finished yet",
            apiScore: { homeScore, awayScore, result: fixture.result ?? null },
          });
          continue;
        }

        const { error: updateError } = await supabase
          .from("prediction_matches")
          .update({
            ...updateBase,
            home_score: homeScore,
            away_score: awayScore,
            status: "closed",
            is_active: false,
            result_synced_at: new Date().toISOString(),
          })
          .eq("id", match.id);

        if (updateError) throw updateError;

        const giftResult = await sendExactScoreGifts({ supabase, matchId: match.id, homeScore, awayScore });
        saved += 1;
        giftsSent += giftResult.sent;

        results.push({
          matchId: match.id,
          fixtureId,
          match: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
          saved: true,
          giftsSent: giftResult.sent,
          giftReason: giftResult.reason,
          score: `${homeScore}-${awayScore}`,
        });
      } catch (matchError) {
        errors += 1;
        results.push({
          matchId: match.id,
          fixtureId: match.external_fixture_id,
          match: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
          saved: false,
          giftsSent: 0,
          error: matchError instanceof Error ? matchError.message : String(matchError),
        });
      }
    }

    return NextResponse.json({
      source: "zafronix",
      checked: results.length,
      saved,
      giftsSent,
      errors,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 },
    );
  }
}
