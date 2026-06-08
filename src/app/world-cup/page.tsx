import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { WorldCupClient } from "./WorldCupClient";

export const dynamic = "force-dynamic";

const WORLD_CUP_2026_TOURNAMENT_ID = "54ef3cd5-7a08-41ed-8c60-9a090a5039ab";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type PredictionEntryRow = {
  id: string;
  client_id: string;
  points: number | null;
  created_at: string;
};

type WinnerPredictionRow = {
  id: string;
  client_id: string;
  team_name: string;
  fifa_rank: number;
  points: number | null;
  created_at: string;
};

function shortName(name?: string | null) {
  return (name || "Client").trim().split(/\s+/)[0] || "Client";
}

function getRankLabel(rank: number | null) {
  if (!rank) return "—";
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

export default async function WorldCupPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/world-cup")}`);
  }

  const admin = createAdminClient();

  // First get all match IDs that belong to World Cup 2026
  const { data: wcMatches } = await admin
    .from("prediction_matches")
    .select("id")
    .eq("tournament_id", WORLD_CUP_2026_TOURNAMENT_ID);

  const wcMatchIds = (wcMatches ?? []).map((m: { id: string }) => m.id);

  const [{ data: profile }, { data: entries }, { data: winnerPicks }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").eq("id", user.id).maybeSingle(),

    // Only prediction_entries for World Cup 2026 matches
    wcMatchIds.length > 0
      ? admin
          .from("prediction_entries")
          .select("id, client_id, points, created_at")
          .in("match_id", wcMatchIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),

    admin
      .from("world_cup_winner_predictions")
      .select("id, client_id, team_name, fifa_rank, points, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const predictionRows = (entries ?? []) as PredictionEntryRow[];
  const winnerRows = (winnerPicks ?? []) as WinnerPredictionRow[];

  const statsMap = new Map<
    string,
    { client_id: string; totalPoints: number; totalPredictions: number }
  >();

  predictionRows.forEach((entry) => {
    const current = statsMap.get(entry.client_id) ?? {
      client_id: entry.client_id,
      totalPoints: 0,
      totalPredictions: 0,
    };
    current.totalPoints += Number(entry.points ?? 0);
    current.totalPredictions += 1;
    statsMap.set(entry.client_id, current);
  });

  winnerRows.forEach((entry) => {
    const current = statsMap.get(entry.client_id) ?? {
      client_id: entry.client_id,
      totalPoints: 0,
      totalPredictions: 0,
    };
    current.totalPoints += Number(entry.points ?? 0);
    current.totalPredictions += 1;
    statsMap.set(entry.client_id, current);
  });

  const leaderboard = Array.from(statsMap.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return b.totalPredictions - a.totalPredictions;
  });

  const topIds = leaderboard.slice(0, 10).map((row) => row.client_id);

  const { data: topProfiles } =
    topIds.length > 0
      ? await admin.from("profiles").select("id, full_name, email").in("id", topIds)
      : { data: [] as ProfileRow[] };

  const profileMap = new Map<string, ProfileRow>();
  ((topProfiles ?? []) as ProfileRow[]).forEach((item) => {
    profileMap.set(item.id, item);
  });

  const currentUserStats = statsMap.get(user.id) ?? {
    client_id: user.id,
    totalPoints: 0,
    totalPredictions: 0,
  };

  const placementIndex = leaderboard.findIndex((row) => row.client_id === user.id);
  const placement = placementIndex >= 0 ? placementIndex + 1 : null;
  const displayProfile = profile as ProfileRow | null;
  const currentWinnerPick = winnerRows.find((row) => row.client_id === user.id) ?? null;

  return (
    <WorldCupClient
      clientName={shortName(displayProfile?.full_name)}
      stats={{
        placement: getRankLabel(placement),
        totalPoints: currentUserStats.totalPoints,
        totalPredictions: currentUserStats.totalPredictions,
      }}
      existingWinnerPick={
        currentWinnerPick
          ? {
              teamName: currentWinnerPick.team_name,
              fifaRank: currentWinnerPick.fifa_rank,
              points: Number(currentWinnerPick.points ?? 0),
            }
          : null
      }
      leaderboard={leaderboard.slice(0, 10).map((item, index) => {
        const rowProfile = profileMap.get(item.client_id);
        return {
          id: item.client_id,
          rank: index + 1,
          name: rowProfile?.full_name || rowProfile?.email || "Client",
          totalPredictions: item.totalPredictions,
          totalPoints: item.totalPoints,
          isCurrentUser: item.client_id === user.id,
        };
      })}
    />
  );
}
