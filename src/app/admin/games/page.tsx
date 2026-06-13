import { AdminGamesCombined } from "./AdminGamesCombined";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

type SportType = "football" | "basketball";

type PredictionMatchRow = {
  id: string;
  home_team: string | null;
  away_team: string | null;
  match_label: string | null;
  venue: string | null;
  kickoff_at: string | null;
  opens_at: string | null;
  closes_at: string | null;
  home_score: number | null;
  away_score: number | null;
  secret_code: string | null;
  is_active: boolean | null;
  created_at: string | null;
  sport_type?: SportType | string | null;
  tournament_id?: string | null;
  tournament_name?: string | null;
  entries_count?: number | null;
  players_count?: number | null;
  prediction_tournaments?: {
    id?: string | null;
    name?: string | null;
    sport_type?: SportType | string | null;
  } | null;
};

function getRowValue(row: Record<string, unknown>, key: string) {
  return row[key] == null ? null : row[key];
}

export default async function AdminGamesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile = {
    id: user?.id ?? "admin",
    role: "master_admin",
  } as Profile;

  if (user?.id) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileRow) profile = profileRow as Profile;
  }

  const { data: rawMatches } = await supabase
    .from("prediction_matches")
    .select("*")
    .order("kickoff_at", { ascending: false })
    .limit(250);

  const { data: tournaments } = await supabase
    .from("prediction_tournaments")
    .select("id, name, sport_type")
    .limit(250);

  const tournamentById = new Map(
    (tournaments ?? []).map((t: any) => [String(t.id), t]),
  );

  const matchIds = (rawMatches ?? [])
    .map((match: any) => String(match.id ?? ""))
    .filter(Boolean);

  const playerCounts = new Map<string, number>();

  if (matchIds.length > 0) {
    const { data: entriesByMatchId } = await supabase
      .from("prediction_entries")
      .select("match_id, client_id")
      .in("match_id", matchIds);

    for (const entry of entriesByMatchId ?? []) {
      const matchId = String((entry as any).match_id ?? "");
      if (!matchId) continue;
      playerCounts.set(matchId, (playerCounts.get(matchId) ?? 0) + 1);
    }

    if (playerCounts.size === 0) {
      const { data: entriesByPredictionMatchId } = await supabase
        .from("prediction_entries")
        .select("prediction_match_id, client_id")
        .in("prediction_match_id", matchIds);

      for (const entry of entriesByPredictionMatchId ?? []) {
        const matchId = String((entry as any).prediction_match_id ?? "");
        if (!matchId) continue;
        playerCounts.set(matchId, (playerCounts.get(matchId) ?? 0) + 1);
      }
    }
  }

  const matches = (rawMatches ?? []).map((row: any) => {
    const tournamentId = String(row.tournament_id ?? "");
    const tournament = tournamentById.get(tournamentId) as any;

    return {
      id: String(row.id),
      home_team: (getRowValue(row, "home_team") ?? getRowValue(row, "team_1") ?? "Home") as string,
      away_team: (getRowValue(row, "away_team") ?? getRowValue(row, "team_2") ?? "Away") as string,
      match_label: (getRowValue(row, "match_label") ?? getRowValue(row, "label") ?? null) as string | null,
      venue: (getRowValue(row, "venue") ?? getRowValue(row, "description") ?? null) as string | null,
      kickoff_at: (getRowValue(row, "kickoff_at") ?? getRowValue(row, "match_time") ?? getRowValue(row, "date") ?? null) as string | null,
      opens_at: (getRowValue(row, "opens_at") ?? getRowValue(row, "open_at") ?? null) as string | null,
      closes_at: (getRowValue(row, "closes_at") ?? getRowValue(row, "close_at") ?? null) as string | null,
      home_score: (getRowValue(row, "home_score") ?? null) as number | null,
      away_score: (getRowValue(row, "away_score") ?? null) as number | null,
      secret_code: (getRowValue(row, "secret_code") ?? getRowValue(row, "code") ?? "") as string,
      is_active: (getRowValue(row, "is_active") ?? true) as boolean,
      created_at: (getRowValue(row, "created_at") ?? null) as string | null,
      sport_type: (getRowValue(row, "sport_type") ?? tournament?.sport_type ?? null) as SportType | string | null,
      tournament_id: tournamentId || null,
      tournament_name: (getRowValue(row, "tournament_name") ?? tournament?.name ?? null) as string | null,
      entries_count: playerCounts.get(String(row.id)) ?? Number(row.entries_count ?? row.players_count ?? 0),
      players_count: playerCounts.get(String(row.id)) ?? Number(row.entries_count ?? row.players_count ?? 0),
      prediction_tournaments: tournament
        ? { id: tournament.id, name: tournament.name, sport_type: tournament.sport_type }
        : null,
    } satisfies PredictionMatchRow;
  });

  return <AdminGamesCombined profile={profile} initialMatches={matches} />;
}
