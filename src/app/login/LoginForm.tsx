"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        window.clearTimeout(timer);
        resolve(null);
      });
  });
}

function safeNextPath(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;

  return value;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError(null);
    setStatusText("Signing in...");
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setStatusText(null);
        setLoading(false);
        return;
      }

      const userId = data.user?.id;

      if (!userId) {
        window.location.replace("/dashboard");
        return;
      }

      setStatusText("Opening...");

      const profileResult = await withTimeout(
        (async () =>
          await supabase
            .from("profiles")
            .select("role, is_active")
            .eq("id", userId)
            .maybeSingle())(),
        900,
      );

      const profile = profileResult?.data as
        | { role?: string | null; is_active?: boolean | null }
        | null
        | undefined;

      if (profile?.is_active === false) {
        await supabase.auth.signOut({ scope: "local" });
        setError("This account has been deactivated. Please contact Pro's Café staff.");
        setStatusText(null);
        setLoading(false);
        return;
      }

      const role = profile?.role ?? "client";
      const nextPath = safeNextPath(searchParams.get("next"));
      const roleTarget =
        role === "master_admin" || role === "admin"
          ? "/admin"
          : role === "staff"
            ? "/staff"
            : "/dashboard";

      window.location.replace(nextPath ?? roleTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setStatusText(null);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="input h-12 bg-white/95"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="input h-12 bg-white/95"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
          {error}
        </div>
      ) : null}

      {statusText ? (
        <div className="rounded-xl border border-[#ffd66b]/50 bg-[#ffd66b]/20 px-4 py-3 text-center text-sm font-extrabold text-[#365665]">
          {statusText}
        </div>
      ) : null}

      <button
        type="submit"
        className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-brand transition hover:bg-brand-600 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Please wait..." : "Sign in"}
      </button>

      <div className="pt-2 text-center text-sm font-medium text-black">
        New here?{" "}
        <Link href="/register" className="font-extrabold text-brand-600 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}

export default LoginForm;
