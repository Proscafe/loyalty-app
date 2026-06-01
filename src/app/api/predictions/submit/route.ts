import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validScore(value: unknown) {
  const score = Number(value);

  if (!Number.isInteger(score) || score < 0 || score > 99) return null;

  return score;
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
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const matchId = String(body.match_id ?? "");
  const homeScore = validScore(body.home_score);
  const awayScore = validScore(body.away_score);

  if (!matchId || homeScore === null || awayScore === null) {
    return NextResponse.json({ error: "Add a valid score first." }, { status: 400 });
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

  const { data: existingEntry } = await admin
    .from("prediction_entries")
    .select("id")
    .eq("match_id", matchId)
    .eq("client_id", user.id)
    .maybeSingle();

  if (existingEntry) {
    return NextResponse.json({ error: "You already submitted this prediction." }, { status: 409 });
  }

  const { data, error } = await admin
    .from("prediction_entries")
    .insert({
      match_id: matchId,
      client_id: user.id,
      home_score: homeScore,
      away_score: awayScore,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ entry: data });
}
