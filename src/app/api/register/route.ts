import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status },
  );
}

function normalizeLebanonPhone(value: string) {
  const cleaned = value.replace(/[\s\-().]/g, "").trim();

  if (cleaned.startsWith("00")) {
    return `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith("+9610")) {
    return `+961${cleaned.slice(5)}`;
  }

  if (cleaned.startsWith("+961")) {
    return cleaned;
  }

  if (cleaned.startsWith("9610")) {
    return `+961${cleaned.slice(4)}`;
  }

  if (cleaned.startsWith("961")) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("0")) {
    return `+961${cleaned.slice(1)}`;
  }

  return `+961${cleaned}`;
}

function isValidLebanonPhone(value: string) {
  const normalizedPhone = normalizeLebanonPhone(value);

  if (!/^\+\d+$/.test(normalizedPhone)) {
    return false;
  }

  if (/^(\+961)?0+$/.test(normalizedPhone)) {
    return false;
  }

  return /^\+961(3\d{6}|(70|71|76|78|79|81)\d{6})$/.test(
    normalizedPhone,
  );
}

function isAllowedTurnstileHostname(hostname: string | undefined) {
  if (!hostname) return false;

  const allowedHosts = new Set([
    "proscafe.net",
    "www.proscafe.net",
    "localhost",
  ]);

  return allowedHosts.has(hostname.toLowerCase());
}

type TurnstileVerificationResponse = {
  success: boolean;
  hostname?: string;
  "error-codes"?: string[];
};

async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    throw new Error(
      "TURNSTILE_SECRET_KEY is not configured.",
    );
  }

  const body = new URLSearchParams();

  body.set("secret", secret);
  body.set("response", token);

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Turnstile verification failed with HTTP ${response.status}.`,
    );
  }

  return (await response.json()) as TurnstileVerificationResponse;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          full_name?: string;
          email?: string;
          phone?: string;
          password?: string;
          captcha_token?: string;
        }
      | null;

    if (!body) {
      return jsonError("Invalid request.");
    }

    const fullName = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");
    const captchaToken = String(
      body.captcha_token ?? "",
    ).trim();

    if (!fullName) {
      return jsonError("Please enter your full name.");
    }

    if (!email) {
      return jsonError("Please enter your email address.");
    }

    if (!isValidLebanonPhone(phone)) {
      return jsonError(
        "Please enter a valid Lebanese phone number.",
      );
    }

    if (password.length < 6) {
      return jsonError(
        "Password must be at least 6 characters.",
      );
    }

    if (!captchaToken) {
      return jsonError(
        "Please complete the security verification.",
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for");

    const remoteIp =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const turnstile = await verifyTurnstile(
      captchaToken,
      remoteIp,
    );

    if (!turnstile.success) {
      console.warn(
        "[register] Turnstile rejected registration:",
        turnstile["error-codes"] ?? [],
      );

      return jsonError(
        "Security verification failed. Please try again.",
        403,
      );
    }

    if (!isAllowedTurnstileHostname(turnstile.hostname)) {
      console.warn(
        "[register] Unexpected Turnstile hostname:",
        turnstile.hostname,
      );

      return jsonError(
        "Security verification failed.",
        403,
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonError(
        "Registration service is not configured.",
        500,
      );
    }

    /*
     * Important:
     * Use the ANON key here, not the Service Role key.
     *
     * We want Supabase Auth to perform a normal signup,
     * including your existing email-confirmation behavior
     * and auth hooks/triggers.
     *
     * Turnstile was already securely verified above.
     */
    const supabase = createSupabaseClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const normalizedPhone =
      normalizeLebanonPhone(phone);

    const { data, error } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: normalizedPhone,
          },
        },
      });

    if (error) {
      return jsonError(error.message, 400);
    }

    /*
     * If email confirmation is enabled, Supabase normally
     * returns no session.
     *
     * If confirmation is disabled, return the user's own
     * session tokens so the frontend can establish the session.
     */
    return NextResponse.json({
      ok: true,
      requiresEmailConfirmation: !data.session,
      session: data.session
        ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          }
        : null,
    });
  } catch (error) {
    console.error("[register] Unexpected error:", error);

    return jsonError(
      "Could not create your account. Please try again.",
      500,
    );
  }
}