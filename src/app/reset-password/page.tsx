"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Password updated. Redirecting to login...");
    await supabase.auth.signOut();
    setTimeout(() => {
      router.replace("/login?redirectTo=/reservation");
    }, 900);
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#111827] text-[#18212b]"
      style={{ fontFamily: "Raleway, RalewayLocal, Arial, sans-serif" }}
    >
      <Image
        src="/pros-login-bg.jpg"
        alt="PRO's Café & Sports Lounge"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-black/25" />

      <section className="relative z-10 flex min-h-screen items-center justify-center px-7 py-8 sm:px-8">
        <div className="w-full max-w-[315px] rounded-[24px] bg-white/50 px-5 py-7 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:max-w-[340px] sm:px-7 sm:py-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Image
              src="/pros-logo-basic.png"
              alt="PRO's Café & Sports Lounge logo"
              width={132}
              height={88}
              priority
              className="mb-6 h-auto w-[112px] object-contain sm:w-[122px]"
            />

            <h1 className="text-[26px] font-black tracking-[-0.04em] text-[#18212b]">
              Reset password
            </h1>
            <p className="mt-2 text-[13px] font-semibold text-[#4b5563]">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-[14px] font-bold text-[#18212b] outline-none placeholder:text-[#6b7280] focus:border-[#d35d58]"
              required
            />

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
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
              {loading ? "Updating..." : "Update password"}
            </button>

            <button
              type="button"
              onClick={() => router.replace("/login?redirectTo=/reservation")}
              className="mx-auto block pt-2 text-center text-[13px] font-black text-[#2563eb] hover:underline"
            >
              Back to login
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
