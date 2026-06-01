import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { PredictionPageClient } from "./PredictionPageClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ code: string }>;
};

export type PublicPredictionMatch = {
  id: string;
  home_team: string;
  away_team: string;
  match_label: string | null;
  kickoff_at: string;
  opens_at: string;
  closes_at: string;
  secret_code: string;
  is_active: boolean;
};

function parseSavedLocalTime(value?: string | null) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (!match) {
    const fallback = new Date(String(value ?? ""));
    return Number.isNaN(fallback.getTime()) ? NaN : fallback.getTime();
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0,
  ).getTime();
}

export type ExistingPredictionEntry = {
  id: string;
  match_id: string;
  client_id: string;
  home_score: number;
  away_score: number;
  created_at: string;
};

function getMatchState(match: PublicPredictionMatch) {
  const now = Date.now();
  const open = parseSavedLocalTime(match.opens_at);
  const close = parseSavedLocalTime(match.closes_at);

  if (!match.is_active) return "inactive";
  if (now < open) return "not_open";
  if (now > close) return "closed";

  return "open";
}

export default async function PredictMatchPage({ params }: PageProps) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/predict/${code}`)}`);
  }

  const admin = createAdminClient();

  const { data: match } = await admin
    .from("prediction_matches")
    .select("*")
    .eq("secret_code", code)
    .maybeSingle();

  if (!match) {
    return (
      <PredictionPageClient
        match={null}
        existingEntry={null}
        state="missing"
      />
    );
  }

  const { data: existingEntry } = await admin
    .from("prediction_entries")
    .select("*")
    .eq("match_id", match.id)
    .eq("client_id", user.id)
    .maybeSingle();

  return (
    <PredictionPageClient
      match={match as PublicPredictionMatch}
      existingEntry={(existingEntry ?? null) as ExistingPredictionEntry | null}
      state={getMatchState(match as PublicPredictionMatch)}
    />
  );
}
