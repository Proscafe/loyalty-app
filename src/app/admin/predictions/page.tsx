import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PredictionsAdmin } from "./PredictionsAdmin";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

type PredictionMatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  match_label: string | null;
  venue: string | null;
  kickoff_at: string;
  opens_at: string;
  closes_at: string;
  home_score: number | null;
  away_score: number | null;
  secret_code: string;
  is_active: boolean;
  created_at: string;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export default async function AdminPredictionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = getAdminClient();

  if (!admin) {
    return (
      <main className="min-h-screen bg-[#586256] px-5 py-10 font-raleway text-white">
        <div className="mx-auto max-w-md rounded-[24px] bg-white/10 p-5">
          <h1 className="text-[24px] font-black">Missing Supabase service key</h1>
          <p className="mt-3 text-[14px] font-semibold leading-6 text-white/70">
            Add SUPABASE_SERVICE_ROLE_KEY to your local .env.local and Vercel Environment Variables,
            then restart the server/deploy again.
          </p>
        </div>
      </main>
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "master_admin") {
    redirect("/dashboard");
  }

  const { data } = await admin
    .from("prediction_matches")
    .select(
      "id, home_team, away_team, match_label, venue, kickoff_at, opens_at, closes_at, home_score, away_score, secret_code, is_active, created_at",
    )
    .order("created_at", { ascending: false });

  const initialMatches: PredictionMatchRow[] = (data ?? []).map((match: any) => ({
    id: String(match.id),
    home_team: String(match.home_team ?? ""),
    away_team: String(match.away_team ?? ""),
    match_label: match.match_label ?? null,
    venue: match.venue ?? null,
    kickoff_at: String(match.kickoff_at ?? ""),
    opens_at: String(match.opens_at ?? ""),
    closes_at: String(match.closes_at ?? ""),
    home_score:
      match.home_score === null || match.home_score === undefined
        ? null
        : Number(match.home_score),
    away_score:
      match.away_score === null || match.away_score === undefined
        ? null
        : Number(match.away_score),
    secret_code: String(match.secret_code ?? ""),
    is_active: Boolean(match.is_active),
    created_at: String(match.created_at ?? ""),
  }));

  return (
    <PredictionsAdmin
      profile={profile as Profile}
      initialMatches={initialMatches}
    />
  );
}
