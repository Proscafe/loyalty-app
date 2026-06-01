import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { PredictionsAdmin } from "./PredictionsAdmin";

export const dynamic = "force-dynamic";

export type PredictionMatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  match_label: string | null;
  kickoff_at: string;
  opens_at: string;
  closes_at: string;
  secret_code: string;
  is_active: boolean;
  created_at: string;
};

export default async function AdminPredictionsPage() {
  const profile = await requireRole(["master_admin"]);
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("prediction_matches")
    .select("*")
    .order("kickoff_at", { ascending: true })
    .limit(80);

  return (
    <PredictionsAdmin
      profile={profile}
      initialMatches={(data ?? []) as PredictionMatchRow[]}
    />
  );
}
