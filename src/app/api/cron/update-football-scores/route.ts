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

type ZafronixMatch = {
  id?: string;
  date?: string | null;
  kickoff?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  homeScore?: number | string | null;
  awayScore?: number | string | null;
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

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.error_description ?? record.details ?? record.hint ?? record.code;
    if (message) return String(message);
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown object error.";
    }
  }
  return "Unknown error.";
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

  if (!response.ok) {
    throw new Error(json?.message ?? `Zafronix request failed with ${response.status}.`);
  }

  return json as ZafronixMatch;
}

function asScoreNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function entryScore(value: unknown) {
  return asScoreNumber(value);
}

async function sendFreeDessertToExactScoreWinners({
  supabase,
  match,
  homeGoals,
  awayGoals,
}: {
  supabase: ReturnType<typeof getAdminSupabase>;
  match: PredictionMatch;
  homeGoals: number;
  awayGoals: number;
}) {
  const { data: entries, error: entriesError } = await supabase
    .from("prediction_entries")
    .select("id, client_id, home_score, away_score, points")
    .eq("match_id", match.id);

  if (entriesError) throw entriesError;

  const exactEntries = (entries ?? []).filter((entry: any) => {
    const predictedHome = entryScore(entry.home_score);
    const predictedAway = entryScore(entry.away_score);

    return predictedHome === homeGoals && predictedAway === awayGoals;
  });

  if (exactEntries.length === 0) {
    return {
      sent: 0,
      lockedWinnerClientIds: [],
      reason: "No exact-score winners. Right-team-only users do not receive gifts.",
    };
  }

  const candidateIds = Array.from(new Set(exactEntries.map((entry: any) => entry.client_id).filter(Boolean)));

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, client_code, role")
    .in("id", candidateIds);

  if (profilesError) throw profilesError;

  const profilesById = Object.fromEntries((profiles ?? []).map((profile: any) => [profile.id, profile]));

  const lockedEntries = exactEntries
    .filter((entry: any) => profilesById[entry.client_id]?.role === "client")
    .sort((a: any, b: any) => {
      const pointDiff = Number(b.points ?? 0) - Number(a.points ?? 0);
      if (pointDiff !== 0) return pointDiff;

      const aName = String(profilesById[a.client_id]?.full_name ?? profilesById[a.client_id]?.email ?? "Client").toLowerCase();
      const bName = String(profilesById[b.client_id]?.full_name ?? profilesById[b.client_id]?.email ?? "Client").toLowerCase();

      if (aName < bName) return -1;
      if (aName > bName) return 1;
      return String(a.client_id).localeCompare(String(b.client_id));
    })
    .slice(0, 3);

  const lockedWinnerClientIds = lockedEntries.map((entry: any) => entry.client_id);

  if (lockedWinnerClientIds.length === 0) {
    return {
      sent: 0,
      lockedWinnerClientIds: [],
      reason: "No client exact-score winners.",
    };
  }

  const { data: categories, error: categoryError } = await supabase
    .from("loyalty_categories")
    .select("id, name, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (categoryError) throw categoryError;

  const category =
    (categories ?? []).find((item: any) => /dessert/i.test(item.name)) ??
    (categories ?? [])[0];

  if (!category) throw new Error("Create at least one active loyalty category before sending gifts.");

  const matchGiftMarker = `prediction_match:${match.id}`;

  const { data: existingRewards, error: existingRewardsError } = await supabase
    .from("rewards")
    .select("client_id, reward_type, description")
    .in("client_id", lockedWinnerClientIds)
    .eq("reward_type", "Free Dessert")
    .ilike("description", `%${matchGiftMarker}%`);

  if (existingRewardsError) throw existingRewardsError;

  const alreadyRewardedClientIds = new Set(
    (existingRewards ?? []).map((reward: any) => reward.client_id).filter(Boolean),
  );

  const rewardRows = lockedWinnerClientIds
    .filter((clientId) => !alreadyRewardedClientIds.has(clientId))
    .map((clientId) => ({
      client_id: clientId,
      category_id: category.id,
      reward_type: "Free Dessert",
      description: `Free Dessert for exact score winner · ${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"} · ${matchGiftMarker}`,
      status: "available",
      earned_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));

  if (rewardRows.length > 0) {
    const { error: rewardError } = await supabase.from("rewards").insert(rewardRows);
    if (rewardError) throw rewardError;
  }

  return {
    sent: rewardRows.length,
    lockedWinnerClientIds,
    alreadySent: rewardRows.length === 0,
    gift: "Free Dessert",
  };
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
      const checkedAt = new Date().toISOString();
      const updateBase = {
        score_last_checked_at: checkedAt,
      };

      try {
        const fixture = await fetchFixture(String(match.external_fixture_id));
        const homeGoals = asScoreNumber(fixture.homeScore);
        const awayGoals = asScoreNumber(fixture.awayScore);
        const isFinished = homeGoals !== null && awayGoals !== null;

        if (!isFinished) {
          const { error: updateError } = await supabase
            .from("prediction_matches")
            .update(updateBase)
            .eq("id", match.id);

          if (updateError) throw updateError;

          results.push({
            matchId: match.id,
            fixtureId: match.external_fixture_id,
            match: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
            saved: false,
            reason: "Not finished yet",
            apiScore: {
              homeScore: fixture.homeScore ?? null,
              awayScore: fixture.awayScore ?? null,
              result: fixture.result ?? null,
            },
          });

          continue;
        }

        const { error: updateError } = await supabase
          .from("prediction_matches")
          .update({
            ...updateBase,
            home_score: homeGoals,
            away_score: awayGoals,
            is_active: false,
            score_source: "zafronix",
            result_synced_at: checkedAt,
          })
          .eq("id", match.id);

        if (updateError) throw updateError;

        let giftResult: Awaited<ReturnType<typeof sendFreeDessertToExactScoreWinners>> | null = null;

        try {
          giftResult = await sendFreeDessertToExactScoreWinners({
            supabase,
            match,
            homeGoals,
            awayGoals,
          });
        } catch (giftError) {
          giftResult = {
            sent: 0,
            lockedWinnerClientIds: [],
            reason: errorToMessage(giftError),
          };
        }

        results.push({
          matchId: match.id,
          fixtureId: match.external_fixture_id,
          match: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
          saved: true,
          score: `${homeGoals}-${awayGoals}`,
          autoGift: giftResult,
        });
      } catch (error) {
        const { error: updateError } = await supabase
          .from("prediction_matches")
          .update(updateBase)
          .eq("id", match.id);

        results.push({
          matchId: match.id,
          fixtureId: match.external_fixture_id,
          match: `${match.home_team ?? "Home"} vs ${match.away_team ?? "Away"}`,
          saved: false,
          error: errorToMessage(error),
          checkedAtSaved: !updateError,
          checkedAtError: updateError ? errorToMessage(updateError) : null,
        });
      }
    }

    return NextResponse.json({
      source: "zafronix",
      checked: results.length,
      saved: results.filter((result) => result.saved).length,
      gifts_sent: results.reduce((total, result: any) => total + Number(result.autoGift?.sent ?? 0), 0),
      errors: results.filter((result) => "error" in result).length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorToMessage(error) },
      { status: 500 },
    );
  }
}
