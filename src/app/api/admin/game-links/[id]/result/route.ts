import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function winnerForScores(home: number, away: number) {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

function pointsForEntry(match: any, entry: any, actualHome: number, actualAway: number) {
  if (match.sport_type === "basketball") {
    const actualWinner = winnerForScores(actualHome, actualAway);
    const predictedWinner =
      entry.predicted_winner ||
      winnerForScores(Number(entry.home_score ?? 0), Number(entry.away_score ?? 0));
    const actualMargin = Math.abs(actualHome - actualAway);
    const predictedMargin =
      entry.predicted_margin ?? Math.max(Number(entry.home_score ?? 0), Number(entry.away_score ?? 0));

    if (actualWinner === "draw" || predictedWinner !== actualWinner) return 0;

    return predictedMargin === actualMargin ? 2 : 1;
  }

  const predictedHome = Number(entry.home_score ?? 0);
  const predictedAway = Number(entry.away_score ?? 0);

  if (predictedHome === actualHome && predictedAway === actualAway) return 3;

  return winnerForScores(predictedHome, predictedAway) === winnerForScores(actualHome, actualAway) ? 1 : 0;
}

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return jsonError("Please sign in as admin first.", 401);

    const admin = getAdminClient();
    if (!admin) return jsonError("SUPABASE_SERVICE_ROLE_KEY is missing.", 500);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "master_admin") {
      return jsonError("Admin access required.", 403);
    }

    const { data: match } = await admin
      .from("prediction_matches")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!match) return jsonError("Game not found.", 404);

    const body = await req.json().catch(() => ({}));

    let homeScore: number | null = null;
    let awayScore: number | null = null;

    if (match.sport_type === "basketball" || body.sport_type === "basketball") {
      const margin = Number(body.margin);
      const winner = body.winner === "away" ? "away" : "home";

      if (!Number.isInteger(margin) || margin < 1 || margin > 99) {
        return jsonError("Add a valid win margin.", 400);
      }

      homeScore = winner === "home" ? margin : 0;
      awayScore = winner === "away" ? margin : 0;
    } else {
      homeScore = Number(body.home_score);
      awayScore = Number(body.away_score);

      if (
        !Number.isInteger(homeScore) ||
        !Number.isInteger(awayScore) ||
        homeScore < 0 ||
        awayScore < 0 ||
        homeScore > 99 ||
        awayScore > 99
      ) {
        return jsonError("Add valid scores first.", 400);
      }
    }

    const { error: matchError } = await admin
      .from("prediction_matches")
      .update({ home_score: homeScore, away_score: awayScore })
      .eq("id", id);

    if (matchError) return jsonError(matchError.message, 400);

    const { data: entries, error: entriesError } = await admin
      .from("prediction_entries")
      .select("*")
      .eq("match_id", id);

    if (entriesError) return jsonError(entriesError.message, 400);

    await Promise.all(
      (entries ?? []).map((entry: any) => {
        const points = pointsForEntry(match, entry, homeScore!, awayScore!);

        return admin.from("prediction_entries").update({ points }).eq("id", entry.id);
      }),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected result save error.", 500);
  }
}
