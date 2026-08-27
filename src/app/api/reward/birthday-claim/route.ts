import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import tls from "tls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BIRTHDAY_REWARDS = ["20% Discount", "Free Dessert"] as const;

type BirthdayRewardType = (typeof BIRTHDAY_REWARDS)[number];

type BirthdayCategory = {
  id: string;
  name: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type BirthdayProfile = {
  id: string;
  birthday?: string | null;
  birth_date?: string | null;
  date_of_birth?: string | null;
  dob?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
};

type BirthdayEmailResult = {
  attempted: boolean;
  sent: boolean;
  to: string | null;
  error: string | null;
};

function isBirthdayToday(birthday?: string | null) {
  if (!birthday) return false;

  const today = new Date();
  const raw = String(birthday);

  const monthDayMatch = raw.match(/(?:^\d{4}-)?(\d{2})-(\d{2})/);
  if (monthDayMatch) {
    const month = Number(monthDayMatch[1]);
    const day = Number(monthDayMatch[2]);

    return today.getMonth() + 1 === month && today.getDate() === day;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return false;

  return today.getMonth() === parsed.getMonth() && today.getDate() === parsed.getDate();
}

function getBirthdayValue(profile: BirthdayProfile | null) {
  if (!profile) return null;
  return profile.birthday ?? profile.birth_date ?? profile.date_of_birth ?? profile.dob ?? null;
}

function getProfileName(profile: BirthdayProfile | null, fallbackEmail?: string | null) {
  const name = String(profile?.name ?? profile?.full_name ?? "").trim();
  if (name) return name;

  const emailName = String(fallbackEmail ?? "").split("@")[0]?.trim();
  return emailName || "Customer";
}

function getProfileEmail(profile: BirthdayProfile | null, fallbackEmail?: string | null) {
  return String(profile?.email ?? fallbackEmail ?? "").trim().toLowerCase() || null;
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

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function encodeBody(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n")
    .trim();
}

function escapeSmtpData(value: string) {
  return value.replace(/\r?\n\./g, "\r\n..");
}

function readSmtpResponse(socket: tls.TLSSocket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] ?? "";

      if (/^\d{3}\s/.test(lastLine)) {
        cleanup();
        resolve(buffer);
      }
    };

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendSmtpCommand(socket: tls.TLSSocket, command: string, expectedCodes: number[]) {
  socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);
  const code = Number(response.slice(0, 3));

  if (!expectedCodes.includes(code)) {
    throw new Error(response.trim());
  }

  return response;
}

async function sendGmailEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const gmailUser =
    process.env.GMAIL_SMTP_USER?.trim() || process.env.GMAIL_USER?.trim() || "";
  const gmailPassword =
    process.env.GMAIL_SMTP_APP_PASSWORD?.trim() ||
    process.env.GMAIL_APP_PASSWORD?.trim() ||
    "";

  if (!gmailUser || !gmailPassword) {
    throw new Error(
      "Birthday email is not configured. Add GMAIL_SMTP_USER/GMAIL_SMTP_APP_PASSWORD or GMAIL_USER/GMAIL_APP_PASSWORD.",
    );
  }

  const socket = tls.connect({
    host: "smtp.gmail.com",
    port: 465,
    servername: "smtp.gmail.com",
  });

  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", reject);
  });

  try {
    await readSmtpResponse(socket);
    await sendSmtpCommand(socket, "EHLO proscafe.net", [250]);
    await sendSmtpCommand(socket, "AUTH LOGIN", [334]);
    await sendSmtpCommand(socket, Buffer.from(gmailUser).toString("base64"), [334]);
    await sendSmtpCommand(socket, Buffer.from(gmailPassword).toString("base64"), [235]);
    await sendSmtpCommand(socket, `MAIL FROM:<${gmailUser}>`, [250]);
    await sendSmtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await sendSmtpCommand(socket, "DATA", [354]);

    const message = [
      `From: Pro's Cafe <${gmailUser}>`,
      `To: ${to}`,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      encodeBody(text),
    ].join("\r\n");

    socket.write(`${escapeSmtpData(message)}\r\n.\r\n`);
    const dataResponse = await readSmtpResponse(socket);
    const dataCode = Number(dataResponse.slice(0, 3));

    if (dataCode !== 250) {
      throw new Error(dataResponse.trim());
    }

    await sendSmtpCommand(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
}

function getBirthdayEmailText(customerName: string, giftName: string) {
  return `Happy Birthday ${customerName} 🎉

Pro's Cafe has a special gift for you: ${giftName}.

Login to proscafe.net to claim it.

Claim it on your next visit.
Valid for 30 days.`;
}

async function sendBirthdayGiftEmail({
  to,
  customerName,
  giftName,
}: {
  to: string | null;
  customerName: string;
  giftName: string;
}): Promise<BirthdayEmailResult> {
  if (!to) {
    return {
      attempted: false,
      sent: false,
      to: null,
      error: "No email found for this customer.",
    };
  }

  try {
    await sendGmailEmail({
      to,
      subject: "Happy Birthday from Pro's Cafe",
      text: getBirthdayEmailText(customerName, giftName),
    });

    return {
      attempted: true,
      sent: true,
      to,
      error: null,
    };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      to,
      error: error instanceof Error ? error.message : "Birthday email failed.",
    };
  }
}

async function findBirthdayCategoryId(db: any) {
  const { data: categories } = await db
    .from("loyalty_categories")
    .select("id, name, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = (categories ?? []) as BirthdayCategory[];

  const birthdayCategory =
    rows.find((category) =>
      String(category.name ?? "").toLowerCase().includes("dessert"),
    ) ??
    rows.find((category) =>
      String(category.name ?? "").toLowerCase().includes("hooka"),
    ) ??
    rows[0];

  return birthdayCategory?.id ?? null;
}

export async function POST(req: Request) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { reward_type?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rewardType = String(body.reward_type ?? "") as BirthdayRewardType;

  if (!BIRTHDAY_REWARDS.includes(rewardType)) {
    return NextResponse.json({ error: "invalid_birthday_reward" }, { status: 400 });
  }

  const admin = getAdminClient();
  const db = admin ?? supabase;

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const birthdayProfile = profile as BirthdayProfile | null;

  if (profileError || !birthdayProfile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  if (!isBirthdayToday(getBirthdayValue(birthdayProfile))) {
    return NextResponse.json({ error: "birthday_not_today" }, { status: 403 });
  }

  const customerEmail = getProfileEmail(birthdayProfile, user.email);
  const customerName = getProfileName(birthdayProfile, customerEmail);
  const todayStart = startOfTodayIso();

  const { data: existing } = await db
    .from("rewards")
    .select("*")
    .eq("client_id", user.id)
    .eq("reward_type", rewardType)
    .gte("created_at", todayStart)
    .maybeSingle();

  if (existing) {
    if (existing.status !== "claimed") {
      const claimedAt = new Date().toISOString();
      const existingExpiry =
        existing.expires_at ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: updated, error: updateError } = await db
        .from("rewards")
        .update({
          status: "claimed",
          reward_status: "claimed",
          claimed_at: claimedAt,
          expires_at: existingExpiry,
          description: existing.description || `Birthday Gift - ${rewardType}`,
          source: "birthday",
          reward_source: "birthday",
          is_birthday: true,
          birthday_reward: true,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      const email = await sendBirthdayGiftEmail({
        to: customerEmail,
        customerName,
        giftName: rewardType,
      });

      return NextResponse.json({ reward: updated, email });
    }

    return NextResponse.json({
      reward: existing,
      email: {
        attempted: false,
        sent: false,
        to: customerEmail,
        error: "Birthday gift was already claimed today, so no duplicate email was sent.",
      },
    });
  }

  const categoryId = await findBirthdayCategoryId(db);

  if (!categoryId) {
    return NextResponse.json({ error: "birthday_category_not_found" }, { status: 400 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAtIso = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: reward, error: insertError } = await db
    .from("rewards")
    .insert({
      client_id: user.id,
      category_id: categoryId,
      reward_type: rewardType,
      reward_name: rewardType,
      title: rewardType,
      description: `Birthday Gift - ${rewardType}`,
      status: "claimed",
      reward_status: "claimed",
      earned_at: nowIso,
      claimed_at: nowIso,
      expires_at: expiresAtIso,
      source: "birthday",
      reward_source: "birthday",
      is_birthday: true,
      birthday_reward: true,
      reward_icon: "birthday-cake",
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const email = await sendBirthdayGiftEmail({
    to: customerEmail,
    customerName,
    giftName: rewardType,
  });

  return NextResponse.json({ reward, email });
}
