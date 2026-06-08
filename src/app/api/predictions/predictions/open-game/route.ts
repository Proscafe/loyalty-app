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

function hasExplicitTimezone(value: string) {
  return /(?:z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

function getTimeZoneOffsetMs(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  const localAsUtc = Date.UTC(
    values.year,
    (values.month ?? 1) - 1,
    values.day ?? 1,
    values.hour ?? 0,
    values.minute ?? 0,
    values.second ?? 0,
  );

  return localAsUtc - date.getTime();
}

function parseLocalDateTimeInZone(value: string, timeZone: string) {
  const match = value
    .trim()
    .replace(" ", "T")
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);

  if (!match) return null;

  const [, year, month, day, hour, minute, second = "0"] = match;
  let utcGuess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  for (let index = 0; index < 2; index += 1) {
    const offset = getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
    utcGuess =
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ) - offset;
  }

  return utcGuess;
}

function parseDateMs(value: unknown) {
  const text = clean(value);
  if (!text) return null;

  const normalized = text.replace(" ", "T");

  if (!hasExplicitTimezone(normalized)) {
    const beirutMs = parseLocalDateTimeInZone(normalized, "Asia/Beirut");
    if (beirutMs !== null && Number.isFinite(beirutMs)) return beirutMs;
  }

  const direct = Date.parse(normalized);
  if (Number.isFinite(direct)) return direct;

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
  // Follow the admin status first. If the admin table shows OPEN, the client
  // scan card should show even when the public code field name differs.
  const status = clean(match.status).toLowerCase();

  if (match.is_active === false) return false;
  if (["closed", "inactive", "disabled", "draft"].includes(status)) return false;
  if (status === "open") return true;

  const closeMs = parseDateMs(getCloseDate(match));
  if (closeMs !== null && nowMs > closeMs) return false;

  const openMs = parseDateMs(getOpenDate(match));
  if (openMs !== null && nowMs < openMs) return false;

  // If the row is active and does not expose dates, treat it as visible.
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
          service_role_configured: Boolean(
            process.env.NEXT_PUBLIC_SUPABASE_URL &&
            process.env.SUPABASE_SERVICE_ROLE_KEY,
          ),
        },
      },
      { status: 500 },
    );
  }

  const matches = ((data ?? []) as PredictionMatchRecord[]).filter((match) =>
    isCurrentlyOpen(match, nowMs),
  );
  const match = matches[0] ?? null;

  if (!match) {
    return NextResponse.json({
      match: null,
      debug: {
        reason: "No active prediction game link found",
        rows_checked: (data ?? []).length,
        server_time: new Date(nowMs).toISOString(),
        checked_matches: ((data ?? []) as PredictionMatchRecord[])
          .slice(0, 5)
          .map((row) => ({
            id: row.id,
            code: getCode(row),
            opens_at: getOpenDate(row),
            closes_at: getCloseDate(row),
            parsed_opens_at: parseDateMs(getOpenDate(row)),
            parsed_closes_at: parseDateMs(getCloseDate(row)),
            is_active: row.is_active,
            status: row.status ?? null,
          })),
        service_role_configured: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.SUPABASE_SERVICE_ROLE_KEY,
        ),
      },
    });
  }

  return NextResponse.json({
    match: {
      id: match.id,
      code: getCode(match) || match.id,
      title: getGameTitle(match),
      label:
        clean(match.match_label) ||
        (clean(match.sport_type).toLowerCase() === "basketball"
          ? "Basketball"
          : "Football"),
      opens_at: getOpenDate(match),
      closes_at: getCloseDate(match),
    },
  });
}
