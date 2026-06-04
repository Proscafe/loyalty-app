import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import tls from "node:tls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GiftPayload = {
  label: string;
  description: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function base64(value: string | Buffer) {
  return Buffer.from(value).toString("base64");
}

function normalizeAppPassword(value: string) {
  return value.replace(/\s+/g, "");
}

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

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function winnerForScores(home: number, away: number) {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

function predictionText(match: any, entry: any) {
  if (match.sport_type === "basketball") {
    const winner =
      entry.predicted_winner === "away"
        ? match.away_team
        : entry.predicted_winner === "home"
          ? match.home_team
          : Number(entry.home_score ?? 0) >= Number(entry.away_score ?? 0)
            ? match.home_team
            : match.away_team;

    const margin = entry.predicted_margin ?? Math.max(Number(entry.home_score ?? 0), Number(entry.away_score ?? 0));

    return `${winner} by ${margin}`;
  }

  return `${entry.home_score ?? 0} - ${entry.away_score ?? 0}`;
}

function actualResultText(match: any) {
  if (match.sport_type === "basketball") {
    const winner = Number(match.home_score ?? 0) >= Number(match.away_score ?? 0) ? match.home_team : match.away_team;
    const margin = Math.abs(Number(match.home_score ?? 0) - Number(match.away_score ?? 0));

    return `${winner} by ${margin}`;
  }

  return `${match.home_score ?? 0} - ${match.away_score ?? 0}`;
}

function winnerCategoryForEntry(match: any, entry: any) {
  const actualHome = Number(match.home_score ?? 0);
  const actualAway = Number(match.away_score ?? 0);
  const actualWinner = winnerForScores(actualHome, actualAway);
  const predictedWinner =
    match.sport_type === "basketball"
      ? entry.predicted_winner || (Number(entry.home_score ?? 0) >= Number(entry.away_score ?? 0) ? "home" : "away")
      : winnerForScores(Number(entry.home_score ?? 0), Number(entry.away_score ?? 0));

  if (actualWinner === "draw" || predictedWinner !== actualWinner) return null;

  if (match.sport_type === "basketball") {
    const actualMargin = Math.abs(actualHome - actualAway);
    const predictedMargin = entry.predicted_margin ?? Math.max(Number(entry.home_score ?? 0), Number(entry.away_score ?? 0));

    return Number(predictedMargin) === actualMargin ? "Exact margin" : "Right team";
  }

  return Number(entry.home_score ?? 0) === actualHome && Number(entry.away_score ?? 0) === actualAway
    ? "Exact score"
    : "Right team";
}

function createWinnersCsv({
  match,
  winners,
  profilesById,
  gifts,
}: {
  match: any;
  winners: any[];
  profilesById: Record<string, any>;
  gifts: GiftPayload[];
}) {
  const rows = [
    [
      "Game",
      "Sport",
      "Actual Result",
      "Client Name",
      "Client Code",
      "Email",
      "Phone",
      "Prediction",
      "Win Type",
      "Gift",
      "Gift Description",
    ],
  ];

  winners.forEach((entry) => {
    const profile = profilesById[entry.client_id] ?? {};

    gifts.forEach((gift) => {
      rows.push([
        `${match.home_team} vs ${match.away_team}`,
        match.sport_type === "basketball" ? "Basketball" : "Football",
        actualResultText(match),
        profile.full_name || "Client",
        profile.client_code || "",
        profile.email || "",
        profile.phone || "",
        predictionText(match, entry),
        winnerCategoryForEntry(match, entry) || "Winner",
        gift.label,
        gift.description,
      ]);
    });
  });

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}

function smtpCommand(socket: tls.TLSSocket, command: string, expected: number[]) {
  return new Promise<string>((resolve, reject) => {
    let data = "";

    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
    }

    function onError(error: Error) {
      cleanup();
      reject(error);
    }

    function onData(chunk: Buffer) {
      data += chunk.toString("utf8");

      const lines = data.trimEnd().split(/\r?\n/);
      const lastLine = lines[lines.length - 1];

      if (!/^\d{3}\s/.test(lastLine)) return;

      const code = Number(lastLine.slice(0, 3));

      cleanup();

      if (expected.includes(code)) {
        resolve(data);
      } else {
        reject(new Error(data));
      }
    }

    socket.on("data", onData);
    socket.on("error", onError);
    socket.write(`${command}\r\n`);
  });
}

function smtpRead(socket: tls.TLSSocket, expected: number[]) {
  return new Promise<string>((resolve, reject) => {
    let data = "";

    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
    }

    function onError(error: Error) {
      cleanup();
      reject(error);
    }

    function onData(chunk: Buffer) {
      data += chunk.toString("utf8");

      const lines = data.trimEnd().split(/\r?\n/);
      const lastLine = lines[lines.length - 1];

      if (!/^\d{3}\s/.test(lastLine)) return;

      const code = Number(lastLine.slice(0, 3));

      cleanup();

      if (expected.includes(code)) {
        resolve(data);
      } else {
        reject(new Error(data));
      }
    }

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

function createEmailMessage({
  from,
  to,
  subject,
  text,
  csv,
}: {
  from: string;
  to: string;
  subject: string;
  text: string;
  csv: string;
}) {
  const mixedBoundary = `pros-winners-${Date.now()}`;

  return [
    `From: Pro's Cafe <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    `--${mixedBoundary}`,
    'Content-Type: text/csv; name="prediction-winners.csv"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="prediction-winners.csv"',
    "",
    base64(Buffer.from(csv, "utf8")),
    "",
    `--${mixedBoundary}--`,
  ].join("\r\n");
}

async function sendEmailWithCsv({
  to,
  subject,
  text,
  csv,
}: {
  to: string;
  subject: string;
  text: string;
  csv: string;
}) {
  const smtpUser = process.env.GMAIL_SMTP_USER || process.env.SMTP_USER;
  const smtpPassword = normalizeAppPassword(
    process.env.GMAIL_SMTP_APP_PASSWORD || process.env.SMTP_PASSWORD || "",
  );

  if (!smtpUser || !smtpPassword) {
    throw new Error(
      "Gmail SMTP is not configured. Add GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD in Vercel.",
    );
  }

  const socket = tls.connect({
    host: "smtp.gmail.com",
    port: 465,
    servername: "smtp.gmail.com",
  });

  socket.setTimeout(12000);

  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error("SMTP connection timed out.")));
  });

  try {
    await smtpRead(socket, [220]);
    await smtpCommand(socket, "EHLO proscafe.net", [250]);
    await smtpCommand(socket, "AUTH LOGIN", [334]);
    await smtpCommand(socket, base64(smtpUser), [334]);
    await smtpCommand(socket, base64(smtpPassword), [235]);
    await smtpCommand(socket, `MAIL FROM:<${smtpUser}>`, [250]);
    await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await smtpCommand(socket, "DATA", [354]);

    const emailMessage = createEmailMessage({
      from: smtpUser,
      to,
      subject,
      text,
      csv,
    });

    await smtpCommand(socket, `${emailMessage}\r\n.`, [250]);
    await smtpCommand(socket, "QUIT", [221]);
  } finally {
    socket.destroy();
  }
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

    const body = (await req.json().catch(() => ({}))) as {
      winner_client_ids?: string[];
      gifts?: GiftPayload[];
      randomize?: boolean;
    };

    const winnerClientIds = Array.from(new Set((body.winner_client_ids ?? []).filter(Boolean)));
    const gifts = (body.gifts ?? [])
      .map((gift) => ({
        label: clean(gift.label),
        description: clean(gift.description),
      }))
      .filter((gift) => gift.label);

    if (winnerClientIds.length === 0) {
      return jsonError("Select winners first.", 400);
    }

    if (gifts.length === 0) {
      return jsonError("Select at least one gift.", 400);
    }

    const { data: match } = await admin
      .from("prediction_matches")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!match) return jsonError("Game not found.", 404);

    const { data: entries, error: entriesError } = await admin
      .from("prediction_entries")
      .select("*")
      .eq("match_id", id)
      .in("client_id", winnerClientIds);

    if (entriesError) return jsonError(entriesError.message, 400);

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, full_name, email, phone, client_code")
      .in("id", winnerClientIds);

    if (profilesError) return jsonError(profilesError.message, 400);

    const profilesById = Object.fromEntries((profiles ?? []).map((row: any) => [row.id, row]));

    const { data: categories, error: categoryError } = await admin
      .from("loyalty_categories")
      .select("id, name, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (categoryError) return jsonError(categoryError.message, 400);

    const category =
      (categories ?? []).find((item: any) => /dessert/i.test(item.name)) ??
      (categories ?? [])[0];

    if (!category) {
      return jsonError("Create at least one active loyalty category before sending gifts.", 400);
    }

    const winnersForInsert = body.randomize ? (entries ?? []).sort(() => Math.random() - 0.5) : entries ?? [];
    const rewardRows = winnersForInsert.flatMap((entry: any) =>
      gifts.map((gift) => ({
        client_id: entry.client_id,
        category_id: category.id,
        reward_type: gift.label,
        description: gift.description || `Winner in ${match.sport_type === "basketball" ? "Basketball" : "Football"} Prediction`,
        status: "available",
        earned_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })),
    );

    const { error: rewardError } = await admin.from("rewards").insert(rewardRows);

    if (rewardError) return jsonError(rewardError.message, 400);

    const csv = createWinnersCsv({
      match,
      winners: entries ?? [],
      profilesById,
      gifts,
    });

    await sendEmailWithCsv({
      to: "proscafe@gmail.com",
      subject: `Prediction winners - ${match.home_team} vs ${match.away_team}`,
      text: `Attached is the winners file for ${match.home_team} vs ${match.away_team}.

Gifts sent:
${gifts.map((gift) => `- ${gift.label}: ${gift.description}`).join("\n")}

Winners: ${winnerClientIds.length}`,
      csv,
    });

    return NextResponse.json({ ok: true, rewards_created: rewardRows.length });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not send gifts.", 500);
  }
}
