"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export function LoginForm() {
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

      const { error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        10000,
        "Signing in is taking too long. Check the internet connection and try again.",
      );

      if (signInError) {
        setError(signInError.message);
        setStatusText(null);
        setLoading(false);
        return;
      }

      setStatusText("Opening your account...");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign("/dashboard");
        return;
      }

      const profileResult = await Promise.race([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        new Promise<{ data: null }>((resolve) => {
          window.setTimeout(() => resolve({ data: null }), 1800);
        }),
      ]);

      const role = profileResult.data?.role ?? "client";
      const target =
        role === "master_admin" || role === "admin"
          ? "/admin"
          : role === "staff"
            ? "/staff"
            : "/dashboard";

      window.location.assign(target);
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

      <div className="pt-2 text-center text-sm font-medium text-ink-800/65">
        New here?{" "}
        <Link href="/register" className="font-extrabold text-brand-600 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}

export default LoginForm;
