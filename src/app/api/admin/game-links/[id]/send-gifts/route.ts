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

function base64Mime(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n").trim();
}

function encodedSubject(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
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

  if (predictedWinner !== actualWinner) return null;

  if (match.sport_type === "basketball") {
    const actualMargin = Math.abs(actualHome - actualAway);
    const predictedMargin = entry.predicted_margin ?? Math.max(Number(entry.home_score ?? 0), Number(entry.away_score ?? 0));

    return Number(predictedMargin) === actualMargin ? "Exact margin" : "Right team";
  }

  return Number(entry.home_score ?? 0) === actualHome && Number(entry.away_score ?? 0) === actualAway
    ? "Exact score"
    : "Right team";
}

function gameName(match: any) {
  const sport = match.sport_type === "basketball" ? "Basketball Prediction" : "Football Prediction";
  return `${match.home_team} vs ${match.away_team} ${sport}`;
}

function createWinnerEmailText({
  customerName,
  match,
  giftNames,
}: {
  customerName: string;
  match: any;
  giftNames: string[];
}) {
  return `Congratulations — You Won a Gift From Pro's Cafe

Hi ${customerName},

Congratulations!

You are a winner in our ${gameName(match)} game at Pro's Cafe.

Your prize is:

${giftNames.join("\n")}

You can claim it on your next visit.
Login to proscafe.net to claim your gift.

This gift is valid for 30 days.

Thank you for participating. We hope you enjoyed the game, and we look forward to seeing you soon.

Best regards,
Pro's Cafe`;
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createEmailMessage({
  from,
  to,
  subject,
  text,
}: {
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17262c;">
      <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; background: #f5f5f0; padding: 16px; border-radius: 12px;">${escapeHtml(
        text,
      )}</pre>
    </div>
  `;

  return [
    `From: Pro's Cafe <${from}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="pros-gift-boundary"',
    "",
    "--pros-gift-boundary",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Mime(text),
    "",
    "--pros-gift-boundary",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Mime(html),
    "",
    "--pros-gift-boundary--",
  ]
    .filter(Boolean)
    .join("\r\n");
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

async function sendWithGmailSmtp({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const smtpUser = process.env.GMAIL_SMTP_USER || process.env.SMTP_USER;
  const smtpPassword = normalizeAppPassword(
    process.env.GMAIL_SMTP_APP_PASSWORD || process.env.SMTP_PASSWORD || "",
  );

  if (!smtpUser || !smtpPassword) {
    throw new Error(
      "Gift email is not configured. Add GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD in Vercel.",
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
    };

    const winnerClientIds = Array.from(new Set((body.winner_client_ids ?? []).filter(Boolean))).slice(0, 3);

    if (winnerClientIds.length === 0) {
      return jsonError("Select winners first.", 400);
    }

    const { data: match } = await admin
      .from("prediction_matches")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!match) return jsonError("Game not found.", 404);

    const matchGiftMarker = `prediction_match:${id}`;
    const gifts = [
      {
        label: "Free Dessert",
        description: `Free Dessert for ${match.home_team} vs ${match.away_team} prediction winner. ${matchGiftMarker}`,
      },
    ];

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

    const profilesById = Object.fromEntries((profiles ?? []).map((row: any) => [row.id, { ...row }]));

    await Promise.all(
      winnerClientIds.map(async (clientId) => {
        const currentProfile = profilesById[clientId] ?? { id: clientId };

        if (clean(currentProfile.email)) {
          profilesById[clientId] = currentProfile;
          return;
        }

        try {
          const { data: authUserData } = await admin.auth.admin.getUserById(clientId);
          const authEmail = clean(authUserData?.user?.email);

          profilesById[clientId] = {
            ...currentProfile,
            email: authEmail || currentProfile.email || "",
          };
        } catch {
          profilesById[clientId] = currentProfile;
        }
      }),
    );

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

    const { data: existingRewards, error: existingRewardsError } = await admin
      .from("rewards")
      .select("client_id, reward_type, description")
      .in("client_id", winnerClientIds)
      .eq("reward_type", "Free Dessert")
      .ilike("description", `%${matchGiftMarker}%`);

    if (existingRewardsError) return jsonError(existingRewardsError.message, 400);

    const alreadyRewardedClientIds = new Set(
      (existingRewards ?? []).map((reward: any) => reward.client_id).filter(Boolean),
    );

    const winnersForInsert = (entries ?? []).filter(
      (entry: any) => !alreadyRewardedClientIds.has(entry.client_id),
    );

    const rewardRows = winnersForInsert.flatMap((entry: any) =>
      gifts.map((gift) => ({
        client_id: entry.client_id,
        category_id: category.id,
        reward_type: gift.label,
        description: gift.description,
        status: "available",
        earned_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })),
    );

    if (rewardRows.length > 0) {
      const { error: rewardError } = await admin.from("rewards").insert(rewardRows);

      if (rewardError) return jsonError(rewardError.message, 400);
    }

    if (rewardRows.length === 0) {
      return NextResponse.json({
        ok: true,
        rewards_created: 0,
        already_sent: true,
        gift_label: "Free Dessert",
        locked_winner_client_ids: winnerClientIds,
        admin_email_sent: false,
        winner_emails_sent: 0,
        winner_emails_skipped: 0,
        email_errors: [],
      });
    }

    const csv = createWinnersCsv({
      match,
      winners: entries ?? [],
      profilesById,
      gifts,
    });

    const emailErrors: string[] = [];
    let adminEmailSent = false;

    try {
      await sendWithGmailSmtp({
        to: "proscafe@gmail.com",
        subject: `Prediction winners - ${match.home_team} vs ${match.away_team}`,
        text: `Winners file for ${match.home_team} vs ${match.away_team}.

Gifts sent:
${gifts.map((gift) => `- ${gift.label}: ${gift.description}`).join("\n")}

Winners: ${winnerClientIds.length}

CSV:
${csv}`,
      });
      adminEmailSent = true;
    } catch (error) {
      emailErrors.push(error instanceof Error ? error.message : "Could not email winners file.");
    }

    let winnerEmailsSent = 0;
    let winnerEmailsSkipped = 0;

    for (const entry of entries ?? []) {
      const winnerProfile = profilesById[entry.client_id] ?? {};
      const winnerEmail = clean(winnerProfile.email);

      if (!winnerEmail) {
        winnerEmailsSkipped += 1;
        continue;
      }

      try {
        await sendWithGmailSmtp({
          to: winnerEmail,
          subject: "Congratulations — You Won a Gift From Pro's Cafe",
          text: createWinnerEmailText({
            customerName: clean(winnerProfile.full_name) || "Client",
            match,
            giftNames: gifts.map((gift) => gift.label),
          }),
        });

        winnerEmailsSent += 1;
      } catch (error) {
        winnerEmailsSkipped += 1;
        emailErrors.push(
          `${winnerEmail}: ${error instanceof Error ? error.message : "Could not send winner email."}`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      rewards_created: rewardRows.length,
      already_sent: rewardRows.length === 0,
      gift_label: "Free Dessert",
      locked_winner_client_ids: winnerClientIds,
      admin_email_sent: adminEmailSent,
      winner_emails_sent: winnerEmailsSent,
      winner_emails_skipped: winnerEmailsSkipped,
      email_errors: emailErrors.slice(0, 3),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not send gifts.", 500);
  }
}
