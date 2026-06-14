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

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

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

async function fetchFixture(fixtureId: string) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("Missing API_FOOTBALL_KEY.");

  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("id", fixtureId);

  const response = await fetch(url.toString(), {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json?.message ?? "API-Football request failed.");
  return json?.response?.[0] ?? null;
}

function asNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
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
      .select("id, home_team, away_team, sport_type, kickoff_at, external_fixture_id")
      .eq("sport_type", "football")
      .not("external_fixture_id", "is", null)
      .is("result_synced_at", null)
      .order("kickoff_at", { ascending: true })
      .limit(40);

    if (error) throw error;

    const results = [];

    for (const match of (matches ?? []) as PredictionMatch[]) {
      const fixture = await fetchFixture(String(match.external_fixture_id));
      const status = fixture?.fixture?.status?.short ?? null;
      const homeGoals = asNumber(fixture?.goals?.home);
      const awayGoals = asNumber(fixture?.goals?.away);

      const updateBase = {
        score_last_checked_at: new Date().toISOString(),
      };

      if (FINISHED_STATUSES.has(String(status)) && homeGoals !== null && awayGoals !== null) {
        const { error: updateError } = await supabase
          .from("prediction_matches")
          .update({
            ...updateBase,
            home_score: homeGoals,
            away_score: awayGoals,
            status: "closed",
            is_active: false,
            result_synced_at: new Date().toISOString(),
          })
          .eq("id", match.id);

        if (updateError) throw updateError;

        results.push({
          matchId: match.id,
          fixtureId: match.external_fixture_id,
          match: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
          status,
          saved: true,
          score: `${homeGoals}-${awayGoals}`,
        });
      } else {
        const { error: updateError } = await supabase
          .from("prediction_matches")
          .update(updateBase)
          .eq("id", match.id);

        if (updateError) throw updateError;

        results.push({
          matchId: match.id,
          fixtureId: match.external_fixture_id,
          match: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
          status,
          saved: false,
          score: homeGoals !== null && awayGoals !== null ? `${homeGoals}-${awayGoals}` : null,
        });
      }
    }

    return NextResponse.json({
      checked: results.length,
      saved: results.filter((result) => result.saved).length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error." },
      { status: 500 },
    );
  }
}
