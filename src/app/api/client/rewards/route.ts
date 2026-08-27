import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import tls from "node:tls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BIRTHDAY_REWARDS = ["20% Discount", "Free Dessert"] as const;

type BirthdayProfile = {
  id: string;
  birthday?: string | null;
  birth_date?: string | null;
  date_of_birth?: string | null;
  dob?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
};

function birthdayValue(profile: BirthdayProfile | null) {
  return (
    profile?.birthday ??
    profile?.birth_date ??
    profile?.date_of_birth ??
    profile?.dob ??
    null
  );
}

function isBirthdayToday(value?: string | null) {
  if (!value) return false;

  const today = new Date();
  const raw = String(value);
  const match = raw.match(/(?:^\d{4}-)?(\d{2})-(\d{2})/);

  if (match) {
    return (
      today.getMonth() + 1 === Number(match[1]) &&
      today.getDate() === Number(match[2])
    );
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return false;

  return (
    today.getMonth() === parsed.getMonth() &&
    today.getDate() === parsed.getDate()
  );
}

function startOfBirthdayYear() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).toISOString();
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function getCustomerName(profile: BirthdayProfile | null) {
  return (
    clean(profile?.full_name) ||
    clean(profile?.name) ||
    clean(profile?.email).split("@")[0] ||
    "Customer"
  );
}

function getCustomerEmail(profile: BirthdayProfile | null) {
  return clean(profile?.email).toLowerCase() || null;
}

async function findBirthdayCategoryId(
  admin: ReturnType<typeof createAdminClient>,
) {
  const { data: categories } = await admin
    .from("loyalty_categories")
    .select("id, name, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = categories ?? [];

  return (
    rows.find((category: any) =>
      String(category.name ?? "").toLowerCase().includes("dessert"),
    ) ??
    rows.find((category: any) =>
      String(category.name ?? "").toLowerCase().includes("hooka"),
    ) ??
    rows[0] ??
    null
  )?.id ?? null;
}

function normalizeAppPassword(value: string) {
  return value.replace(/\s+/g, "");
}

function encodedSubject(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function base64Mime(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n")
    .trim();
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

      if (expected.includes(code)) resolve(data);
      else reject(new Error(data));
    }

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

function smtpCommand(
  socket: tls.TLSSocket,
  command: string,
  expected: number[],
) {
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

      if (expected.includes(code)) resolve(data);
      else reject(new Error(data));
    }

    socket.on("data", onData);
    socket.on("error", onError);
    socket.write(`${command}\r\n`);
  });
}

async function sendBirthdayEmail({
  to,
  customerName,
}: {
  to: string;
  customerName: string;
}) {
  const smtpUser =
    clean(process.env.GMAIL_SMTP_USER) ||
    clean(process.env.GMAIL_USER) ||
    clean(process.env.SMTP_USER);

  const smtpPassword = normalizeAppPassword(
    clean(process.env.GMAIL_SMTP_APP_PASSWORD) ||
      clean(process.env.GMAIL_APP_PASSWORD) ||
      clean(process.env.SMTP_PASSWORD),
  );

  if (!smtpUser || !smtpPassword) {
    throw new Error(
      "Birthday email is not configured. Add GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD.",
    );
  }

  const text = `Happy Birthday ${customerName} 🎉

Pro's Cafe has birthday gifts waiting for you:

• 20% Discount
• Free Dessert

Login to proscafe.net to see your gifts.

You can claim them on your next visit.
Your birthday gifts are valid for 30 days.

Happy Birthday from Pro's Cafe!`;

  const message = [
    `From: Pro's Cafe <${smtpUser}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject("Happy Birthday from Pro's Cafe 🎉")}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Mime(text),
  ].join("\r\n");

  const socket = tls.connect({
    host: "smtp.gmail.com",
    port: 465,
    servername: "smtp.gmail.com",
  });

  socket.setTimeout(12000);

  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", reject);
    socket.once("timeout", () =>
      reject(new Error("Birthday SMTP connection timed out.")),
    );
  });

  try {
    await smtpRead(socket, [220]);
    await smtpCommand(socket, "EHLO proscafe.net", [250]);
    await smtpCommand(socket, "AUTH LOGIN", [334]);
    await smtpCommand(
      socket,
      Buffer.from(smtpUser).toString("base64"),
      [334],
    );
    await smtpCommand(
      socket,
      Buffer.from(smtpPassword).toString("base64"),
      [235],
    );
    await smtpCommand(socket, `MAIL FROM:<${smtpUser}>`, [250]);
    await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await smtpCommand(socket, "DATA", [354]);
    await smtpCommand(socket, `${message}\r\n.`, [250]);
    await smtpCommand(socket, "QUIT", [221]);
  } finally {
    socket.destroy();
  }
}

async function ensureBirthdayRewards(profileId: string) {
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError || !profile) return;

  const birthdayProfile = profile as BirthdayProfile;

  if (!isBirthdayToday(birthdayValue(birthdayProfile))) {
    return;
  }

  const categoryId = await findBirthdayCategoryId(admin);
  if (!categoryId) return;

  const { data: existingRows, error: existingError } = await admin
    .from("rewards")
    .select("*")
    .eq("client_id", profileId)
    .in("reward_type", [...BIRTHDAY_REWARDS])
    .gte("created_at", startOfBirthdayYear());

  if (existingError) {
    console.error(
      "Could not check existing birthday rewards",
      existingError.message || existingError,
    );
    return;
  }

  const existingTypes = new Set(
    (existingRows ?? []).map((row: any) => String(row.reward_type ?? "")),
  );

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const missingRows = BIRTHDAY_REWARDS
    .filter((rewardType) => !existingTypes.has(rewardType))
    .map((rewardType) => ({
      client_id: profileId,
      category_id: categoryId,
      reward_type: rewardType,
      description: `Birthday Gift - ${rewardType}`,
      status: "available",
      earned_at: now.toISOString(),
      expires_at: expiresAt,
      source: "birthday",
    }));

  if (missingRows.length === 0) return;

  const { error: insertError } = await admin
    .from("rewards")
    .insert(missingRows);

  if (insertError) {
    console.error(
      "Could not create birthday rewards",
      insertError.message || insertError,
    );
    return;
  }

  // Send ONE birthday email only when the system actually creates
  // one or more birthday gifts. Refreshing the dashboard after that
  // will not send another email because missingRows will be empty.
  const customerEmail = getCustomerEmail(birthdayProfile);

  if (!customerEmail) {
    console.warn(`Birthday gifts created for ${profileId}, but no email exists.`);
    return;
  }

  try {
    await sendBirthdayEmail({
      to: customerEmail,
      customerName: getCustomerName(birthdayProfile),
    });
  } catch (error) {
    // A failed email must never remove/block the birthday gifts.
    console.error(
      "Birthday gifts created but birthday email failed",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function GET() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  try {
    await ensureBirthdayRewards(profile.id);
  } catch (error) {
    console.error(
      "Birthday reward provisioning failed",
      error instanceof Error ? error.message : error,
    );
  }

  const { data: rewards, error } = await supabase
    .from("rewards")
    .select("*")
    .eq("client_id", profile.id)
    .in("status", ["available", "claimed", "redeemed", "expired"])
    .order("earned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rewards: rewards ?? [] });
}
