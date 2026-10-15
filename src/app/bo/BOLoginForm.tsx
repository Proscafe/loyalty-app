"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function BOLoginForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Wrong email or password.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await supabase.auth.signOut();
      setError("Unable to load your account.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("Unable to verify BO access.");
      setLoading(false);
      return;
    }

    const role = String(profile.role ?? "").trim().toLowerCase();

    if (role !== "master_admin") {
      await supabase.auth.signOut();
      setError("BO access is restricted to the Admin account.");
      setLoading(false);
      return;
    }

    router.replace("/bo/home");
    router.refresh();
  }

  return (
    <form onSubmit={handleLogin} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="EMAIL"
        autoComplete="email"
        className="w-full rounded-[14px] border border-white/15 bg-white px-4 py-3.5 text-[14px] font-bold text-[#24332a] outline-none placeholder:text-[#6b746e] focus:border-[#ffd66b]"
        required
      />

      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="PASSWORD"
        autoComplete="current-password"
        className="w-full rounded-[14px] border border-white/15 bg-white px-4 py-3.5 text-[14px] font-bold text-[#24332a] outline-none placeholder:text-[#6b746e] focus:border-[#ffd66b]"
        required
      />

      {error ? (
        <div className="rounded-[12px] bg-[#7f1d1d]/45 px-3 py-2.5 text-center text-[12px] font-bold text-white">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-[14px] bg-[#ffd66b] px-4 py-3.5 text-[13px] font-black uppercase tracking-[0.08em] text-[#26382d] shadow-[0_10px_24px_rgba(255,214,107,0.16)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "SIGNING IN..." : "LOGIN"}
      </button>
    </form>
  );
}
