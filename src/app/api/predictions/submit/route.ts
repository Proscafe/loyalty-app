import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validScore(value: unknown) {
  const score = Number(value);

  if (!Number.isInteger(score) || score < 0 || score > 99) return null;

  return score;
}

function isBasketballMatch(match: { match_label?: string | null; venue?: string | null }) {
  return /basket|basketball|__sport:basketball__/i.test(
    `${match.match_label ?? ""} ${match.venue ?? ""}`,
  );
}

function winnerForScores(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

function calculatePredictionPoints({
  match,
  homeScore,
  awayScore,
}: {
  match: {
    match_label?: string | null;
    home_score?: number | null;
    away_score?: number | null;
  };
  homeScore: number;
  awayScore: number;
}) {
  const actualHome = Number(match.home_score ?? 0);
  const actualAway = Number(match.away_score ?? 0);

  if (isBasketballMatch(match)) {
    const actualWinner = winnerForScores(actualHome, actualAway);
    const predictedWinner = winnerForScores(homeScore, awayScore);

    if (actualWinner === "draw" || predictedWinner === "draw") return 0;

    const actualMargin = Math.abs(actualHome - actualAway);
    const predictedMargin = Math.max(homeScore, awayScore);

    let points = predictedWinner === actualWinner ? 1 : 0;

    if (points > 0 && predictedMargin === actualMargin) {
      points += 1;
    }

    return points;
  }

  if (homeScore === actualHome && awayScore === actualAway) return 3;

  return winnerForScores(homeScore, awayScore) === winnerForScores(actualHome, actualAway) ? 1 : 0;
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  let body: {
    match_id?: string;
    home_score?: number;
    away_score?: number;
    predicted_winner?: "home" | "away" | "draw";
    predicted_margin?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const matchId = String(body.match_id ?? "");

  if (!matchId) {
    return NextResponse.json({ error: "Prediction game is missing." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: match } = await admin
    .from("prediction_matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) {
    return NextResponse.json({ error: "Prediction game not found." }, { status: 404 });
  }

  const now = Date.now();
  const opensAt = new Date(match.opens_at).getTime();
  const closesAt = new Date(match.closes_at).getTime();

  if (!match.is_active || now < opensAt || now > closesAt) {
    return NextResponse.json({ error: "Predictions are not open for this game." }, { status: 403 });
  }

  const basketball = isBasketballMatch(match);
  const predictedWinner = body.predicted_winner;
  const predictedMargin = validScore(body.predicted_margin);

  const rawHomeScore = basketball
    ? predictedWinner === "home"
      ? predictedMargin
      : 0
    : validScore(body.home_score);
  const rawAwayScore = basketball
    ? predictedWinner === "away"
      ? predictedMargin
      : 0
    : validScore(body.away_score);

  if (basketball) {
    if (
      (predictedWinner !== "home" && predictedWinner !== "away") ||
      predictedMargin === null ||
      predictedMargin < 1
    ) {
      return NextResponse.json(
        { error: "Choose a winner and add a valid win-by number." },
        { status: 400 },
      );
    }
  } else if (rawHomeScore === null || rawAwayScore === null) {
    return NextResponse.json({ error: "Add a valid score first." }, { status: 400 });
  }

  const homeScore = rawHomeScore ?? 0;
  const awayScore = rawAwayScore ?? 0;

  const { data: existingEntry } = await admin
    .from("prediction_entries")
    .select("id")
    .eq("match_id", matchId)
    .eq("client_id", user.id)
    .maybeSingle();

  if (existingEntry) {
    return NextResponse.json({ error: "You already submitted this prediction." }, { status: 409 });
  }

  const points = calculatePredictionPoints({ match, homeScore, awayScore });

  const { data, error } = await admin
    .from("prediction_entries")
    .insert({
      match_id: matchId,
      client_id: user.id,
      home_score: homeScore,
      away_score: awayScore,
      predicted_winner: basketball ? predictedWinner : winnerForScores(homeScore, awayScore),
      predicted_margin: basketball ? predictedMargin : null,
      points,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ entry: data });
}
