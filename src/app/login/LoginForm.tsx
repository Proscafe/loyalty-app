"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getSafeRedirectPath(path: string | null) {
  if (!path) return "/dashboard";
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  if (path.startsWith("/login")) return "/dashboard";
  return path;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const redirectTo = getSafeRedirectPath(searchParams.get("redirectTo"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("Wrong email or password.");
      return;
    }

    window.location.assign(redirectTo);
  }

  async function handleResetPassword() {
    setError("");
    setMessage("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Enter your email first, then press Forgot password.");
      return;
    }

    setResetLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("Password reset link sent to your email.");
  }

  return (
    <form onSubmit={handleLogin} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        autoComplete="email"
        className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-[14px] font-bold text-[#18212b] outline-none placeholder:text-[#6b7280] focus:border-[#d35d58]"
        required
      />

      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-[14px] font-bold text-[#18212b] outline-none placeholder:text-[#6b7280] focus:border-[#d35d58]"
        required
      />

      {error ? <p className="text-center text-[12px] font-bold text-[#b42318]">{error}</p> : null}
      {message ? <p className="text-center text-[12px] font-bold text-[#235d2f]">{message}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-[10px] bg-[#d45d58] px-4 py-3.5 text-[13px] font-black uppercase tracking-[0.08em] text-white shadow-lg shadow-black/10 transition hover:bg-[#c6524d] disabled:opacity-60"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <div className="pt-2 text-center text-[13px] font-medium text-[#18212b]">
        <span>New here? </span>
        <a href="/signup" className="font-black text-[#c85b58] hover:underline">
          Create an account
        </a>
      </div>

      {error ? (
        <button
          type="button"
          onClick={handleResetPassword}
          disabled={resetLoading}
          className="mx-auto block text-center text-[13px] font-black text-[#2563eb] hover:underline disabled:opacity-60"
        >
          {resetLoading ? "Sending reset link..." : "Forgot Password?"}
        </button>
      ) : null}
    </form>
  );
}
