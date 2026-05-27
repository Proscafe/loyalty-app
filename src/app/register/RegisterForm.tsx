"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setInfo("Account created. Check your email to confirm, then sign in.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-xl border border-white/20 bg-white px-4 py-3.5 text-sm font-semibold text-[#182f38] outline-none transition placeholder:text-[#182f38]/35 focus:border-[#ffd66b]/80 focus:ring-4 focus:ring-[#ffd66b]/20";
  const labelClass =
    "mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-white";

  return (
    <form onSubmit={onSubmit} className="space-y-4 font-raleway">
      <div>
        <label className={labelClass} htmlFor="full_name">
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
        <label className={labelClass} htmlFor="email">
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
        <label className={labelClass} htmlFor="phone">
          Phone number
        </label>
        <input
          id="phone"
          className={inputClass}
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Enter your phone number"
          autoComplete="tel"
          inputMode="tel"
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="password">
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
        disabled={loading}
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <div className="pt-2 text-center text-sm font-semibold text-white">
        Already a member?{" "}
        <Link href="/login" className="font-black text-[#ffd66b] underline-offset-4 hover:underline">
          Sign in
        </Link>
      </div>
    </form>
  );
}
