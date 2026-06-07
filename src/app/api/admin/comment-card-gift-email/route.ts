import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import tls from "node:tls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SmtpResult = {
  success: boolean;
  error?: string;
};

type EmailSource = "request.to" | "profiles.email" | "auth.email" | "missing";

function smtpConfigured() {
  const user =
    process.env.GMAIL_SMTP_USER ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER ||
    "";
  const password =
    process.env.GMAIL_SMTP_APP_PASSWORD ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.SMTP_PASSWORD ||
    "";

  return {
    user: user.trim(),
    password: password.replace(/\s/g, ""),
  };
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

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function sanitizeEmail(value: string) {
  return value.replace(/[\r\n]/g, "").trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function readResponse(socket: tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] || "";

      if (/^\d{3}\s/.test(lastLine)) {
        cleanup();
        resolve(buffer);
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error("SMTP connection closed unexpectedly."));
    };

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function command(socket: tls.TLSSocket, value: string, expected: number[]) {
  socket.write(`${value}\r\n`);
  const response = await readResponse(socket);
  const code = Number(response.slice(0, 3));

  if (!expected.includes(code)) {
    throw new Error(response.trim());
  }

  return response;
}

function buildMessage({
  from,
  to,
  customerName,
  giftName,
  expiresAt,
}: {
  from: string;
  to: string;
  customerName: string;
  giftName: string;
  expiresAt?: string | null;
}) {
  const subject = "You Received a Gift From Pro's Cafe";
  const expiryLine = expiresAt
    ? `This gift is valid until ${new Date(expiresAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}.`
    : "This gift is valid for 30 days.";

  const text = `Hi ${customerName || "Customer"},

Thank you for sharing your feedback with Pro's Cafe.

We sent you a gift:

${giftName}

You can claim it on your next visit.
Login to proscafe.net to claim your gift.

${expiryLine}

Best regards,
Pro's Cafe`;

  return [
    `From: ${encodeHeader("Pro's Cafe")} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n"),
  ].join("\r\n");
}

async function sendMail({
  to,
  customerName,
  giftName,
  expiresAt,
}: {
  to: string;
  customerName: string;
  giftName: string;
  expiresAt?: string | null;
}): Promise<SmtpResult> {
  const { user, password } = smtpConfigured();

  if (!user || !password) {
    return {
      success: false,
      error:
        "Gift email is not configured. Add GMAIL_SMTP_USER/GMAIL_SMTP_APP_PASSWORD or GMAIL_USER/GMAIL_APP_PASSWORD in Vercel/local env.",
    };
  }

  const safeTo = sanitizeEmail(to);
  const safeFrom = sanitizeEmail(user);

  if (!isValidEmail(safeTo)) {
    return { success: false, error: "Customer email is invalid." };
  }

  const socket = tls.connect({
    host: "smtp.gmail.com",
    port: 465,
    servername: "smtp.gmail.com",
  });

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", () => resolve());
      socket.once("error", reject);
      socket.setTimeout(20000, () => reject(new Error("SMTP connection timed out.")));
    });

    await readResponse(socket);
    await command(socket, "EHLO proscafe.net", [250]);
    await command(socket, "AUTH LOGIN", [334]);
    await command(socket, Buffer.from(safeFrom).toString("base64"), [334]);
    await command(socket, Buffer.from(password).toString("base64"), [235]);
    await command(socket, `MAIL FROM:<${safeFrom}>`, [250]);
    await command(socket, `RCPT TO:<${safeTo}>`, [250, 251]);
    await command(socket, "DATA", [354]);

    const message = buildMessage({
      from: safeFrom,
      to: safeTo,
      customerName,
      giftName,
      expiresAt,
    });

    socket.write(`${message}\r\n.\r\n`);
    const dataResponse = await readResponse(socket);
    const dataCode = Number(dataResponse.slice(0, 3));

    if (dataCode !== 250) {
      throw new Error(dataResponse.trim());
    }

    await command(socket, "QUIT", [221]);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not send email.",
    };
  } finally {
    socket.destroy();
  }
}

async function resolveCustomerEmail({
  to,
  clientId,
}: {
  to: string;
  clientId: string;
}): Promise<{ email: string; source: EmailSource; error?: string }> {
  const directEmail = sanitizeEmail(to);
  if (isValidEmail(directEmail)) {
    return { email: directEmail, source: "request.to" };
  }

  if (!clientId) {
    return { email: "", source: "missing", error: "Customer email is missing." };
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    return {
      email: "",
      source: "missing",
      error: "Customer email is missing and Supabase admin client is not configured.",
    };
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("email")
    .eq("id", clientId)
    .maybeSingle();

  const profileEmail = sanitizeEmail(String(profile?.email || ""));
  if (isValidEmail(profileEmail)) {
    return { email: profileEmail, source: "profiles.email" };
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(clientId);
  const authEmail = sanitizeEmail(String(authData?.user?.email || ""));

  if (isValidEmail(authEmail)) {
    return { email: authEmail, source: "auth.email" };
  }

  return {
    email: "",
    source: "missing",
    error: authError?.message || "Customer email was not found in profiles or Supabase Auth.",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      client_id?: string;
      to?: string;
      customer_name?: string;
      gift_name?: string;
      expires_at?: string | null;
    };

    const clientId = String(body.client_id || "").trim();
    const customerName = String(body.customer_name || "Customer").trim();
    const giftName = String(body.gift_name || "Gift").trim();

    const resolved = await resolveCustomerEmail({
      to: String(body.to || "").trim(),
      clientId,
    });

    if (!resolved.email) {
      return NextResponse.json(
        {
          success: false,
          error: resolved.error || "Customer email is missing.",
          email_source: resolved.source,
        },
        { status: 400 },
      );
    }

    const result = await sendMail({
      to: resolved.email,
      customerName,
      giftName,
      expiresAt: body.expires_at || null,
    });

    return NextResponse.json(
      {
        ...result,
        to: resolved.email,
        email_source: resolved.source,
      },
      { status: result.success ? 200 : 500 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not send gift email.",
      },
      { status: 500 },
    );
  }
}
