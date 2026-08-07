"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Turnstile,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";

import { createClient } from "@/lib/supabase/client";

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

export function RegisterForm() {
  const router = useRouter();

  const turnstileRef = useRef<TurnstileInstance | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  function resetCaptcha() {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);
    setInfo(null);

    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizeLebanonPhone(phone);

    if (!trimmedFullName) {
      setError("Please enter your full name.");
      return;
    }

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!isValidLebanonPhone(phone)) {
      setError(
        "Please enter a valid Lebanese phone number, like 03 123 456 or +961 71 123 456.",
      );
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (!captchaToken) {
      setError("Please complete the security check.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            captchaToken,
            data: {
              full_name: trimmedFullName,
              phone: normalizedPhone,
            },
          },
        });

      if (signUpError) {
        setError(signUpError.message);
        resetCaptcha();
        return;
      }

      if (!data.session) {
        setInfo(
          "Account created. Check your email to confirm, then sign in.",
        );

        setFullName("");
        setEmail("");
        setPhone("");
        setPassword("");

        resetCaptcha();
        return;
      }

      resetCaptcha();

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Could not create your account. Please try again.");
      resetCaptcha();
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/20 bg-white px-4 py-3.5 text-sm font-semibold text-[#182f38] outline-none transition placeholder:text-[#182f38]/35 focus:border-[#ffd66b]/80 focus:ring-4 focus:ring-[#ffd66b]/20";

  const labelClass =
    "mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-white";

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 font-raleway"
    >
      <div>
        <label
          className={labelClass}
          htmlFor="full_name"
        >
          Full name
        </label>

        <input
          id="full_name"
          className={inputClass}
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Enter your full name"
          autoComplete="name"
        />
      </div>

      <div>
        <label
          className={labelClass}
          htmlFor="email"
        >
          Email address
        </label>

        <input
          id="email"
          type="email"
          className={inputClass}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      <div>
        <label
          className={labelClass}
          htmlFor="phone"
        >
          Phone number
        </label>

        <input
          id="phone"
          type="tel"
          className={inputClass}
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="03 123 456 or +961 71 123 456"
          autoComplete="tel"
          inputMode="tel"
          pattern="[0-9+\s\-().]{7,20}"
          title="Enter a valid Lebanese phone number, like 03 123 456 or +961 71 123 456."
        />
      </div>

      <div>
        <label
          className={labelClass}
          htmlFor="password"
        >
          Password
        </label>

        <input
          id="password"
          type="password"
          className={inputClass}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          autoComplete="new-password"
        />
      </div>

      <div className="overflow-hidden rounded-xl">
        {turnstileSiteKey ? (
          <Turnstile
            ref={turnstileRef}
            siteKey={turnstileSiteKey}
            onSuccess={(token) => {
              setCaptchaToken(token);
              setError(null);
            }}
            onExpire={() => {
              setCaptchaToken(null);
            }}
            onError={() => {
              setCaptchaToken(null);
              setError(
                "Security verification failed. Please try again.",
              );
            }}
            options={{
              theme: "light",
              size: "flexible",
            }}
          />
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            Turnstile is not configured.
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {info && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-sm font-bold text-emerald-800">
          {info}
        </div>
      )}

      <button
        type="submit"
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#ffd66b] px-4 py-3.5 text-sm font-black uppercase tracking-[0.02em] text-[#182f38] transition hover:bg-[#f3c95e] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
        disabled={
          loading ||
          !captchaToken ||
          !turnstileSiteKey
        }
      >
        {loading
          ? "Creating account…"
          : "Create account"}
      </button>

      <div className="pt-2 text-center text-sm font-semibold text-black">
        Already a member?{" "}
        <Link
          href="/login"
          className="font-black text-[#ffd66b] underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </div>
    </form>
  );
}