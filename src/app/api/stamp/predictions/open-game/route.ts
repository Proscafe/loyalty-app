import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PredictionMatchRecord = {
  id: string;
  secret_code?: string | null;
  code?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  match_label?: string | null;
  sport_type?: string | null;
  kickoff_at?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  open_at?: string | null;
  close_at?: string | null;
  is_active?: boolean | null;
  status?: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDateMs(value: unknown) {
  const text = clean(value);
  if (!text) return null;

  const direct = Date.parse(text);
  if (Number.isFinite(direct)) return direct;

  const normalized = text.replace(" ", "T");
  const normalizedMs = Date.parse(normalized);
  if (Number.isFinite(normalizedMs)) return normalizedMs;

  return null;
}

function getCode(match: PredictionMatchRecord) {
  return clean(match.secret_code) || clean(match.code);
}

function getOpenDate(match: PredictionMatchRecord) {
  return clean(match.opens_at) || clean(match.open_at) || null;
}

function getCloseDate(match: PredictionMatchRecord) {
  return clean(match.closes_at) || clean(match.close_at) || null;
}

function getGameTitle(match: PredictionMatchRecord) {
  const homeTeam = clean(match.home_team) || "Home";
  const awayTeam = clean(match.away_team) || "Away";
  return `${homeTeam} vs ${awayTeam}`;
}

function isCurrentlyOpen(match: PredictionMatchRecord, nowMs: number) {
  if (!getCode(match)) return false;

  const status = clean(match.status).toLowerCase();
  if (match.is_active === false) return false;
  if (["closed", "inactive", "disabled", "draft"].includes(status)) return false;

  const openMs = parseDateMs(getOpenDate(match));
  const closeMs = parseDateMs(getCloseDate(match));

  if (openMs !== null && nowMs < openMs) return false;
  if (closeMs !== null && nowMs > closeMs) return false;

  return true;
}

function createAdminClient() {
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

async function loadMatches() {
  const admin = createAdminClient();

  if (admin) {
    return admin
      .from("prediction_matches")
      .select("*")
      .order("closes_at", { ascending: true, nullsFirst: false })
      .limit(50);
  }

  const supabase = await createClient();
  return supabase
    .from("prediction_matches")
    .select("*")
    .order("closes_at", { ascending: true, nullsFirst: false })
    .limit(50);
}

export async function GET() {
  const nowMs = Date.now();
  const { data, error } = await loadMatches();

  if (error) {
    return NextResponse.json(
      {
        match: null,
        error: error.message,
        debug: {
          reason: "prediction_matches query failed",
          service_role_configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        },
      },
      { status: 500 },
    );
  }

  const matches = ((data ?? []) as PredictionMatchRecord[]).filter((match) => isCurrentlyOpen(match, nowMs));
  const match = matches[0] ?? null;

  if (!match) {
    return NextResponse.json({
      match: null,
      debug: {
        reason: "No open prediction game found",
        rows_checked: (data ?? []).length,
        service_role_configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    });
  }

  return NextResponse.json({
    match: {
      id: match.id,
      code: getCode(match),
      title: getGameTitle(match),
      label: clean(match.match_label) || (clean(match.sport_type).toLowerCase() === "basketball" ? "Basketball" : "Football"),
      opens_at: getOpenDate(match),
      closes_at: getCloseDate(match),
    },
  });
}
