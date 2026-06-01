import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validRank(value: unknown) {
  const rank = Number(value);

  if (!Number.isInteger(rank) || rank < 1 || rank > 250) return null;

  return rank;
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
    team_name?: string;
    fifa_rank?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const teamName = String(body.team_name ?? "").trim();
  const fifaRank = validRank(body.fifa_rank);

  if (!teamName || fifaRank === null) {
    return NextResponse.json({ error: "Choose a valid team first." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existingPick } = await admin
    .from("world_cup_winner_predictions")
    .select("team_name, fifa_rank, points")
    .eq("client_id", user.id)
    .maybeSingle();

  if (existingPick) {
    return NextResponse.json(
      {
        error: "Your winner prediction is already locked.",
        pick: {
          teamName: existingPick.team_name,
          fifaRank: existingPick.fifa_rank,
          points: Number(existingPick.points ?? 0),
        },
      },
      { status: 409 },
    );
  }

  const { data, error } = await admin
    .from("world_cup_winner_predictions")
    .insert({
      client_id: user.id,
      team_name: teamName,
      fifa_rank: fifaRank,
      points: 0,
    })
    .select("team_name, fifa_rank, points")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message.includes("world_cup_winner_predictions") ||
          error.message.includes("relation") ||
          error.message.includes("schema cache")
            ? "Winner prediction table is missing. Run the Supabase SQL first."
            : error.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    pick: {
      teamName: data.team_name,
      fifaRank: data.fifa_rank,
      points: Number(data.points ?? 0),
    },
  });
}
