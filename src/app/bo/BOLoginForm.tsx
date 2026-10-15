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

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setError("WRONG EMAIL OR PASSWORD.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("UNABLE TO LOAD ACCOUNT.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "master_admin") {
      await supabase.auth.signOut();
      setError("BO ACCESS IS RESTRICTED TO ADMIN.");
      setLoading(false);
      return;
    }

    router.replace("/bo/home");
    router.refresh();
  }

  return (
    <form onSubmit={login} className="space-y-3">
      <input type="email" required placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-[14px] bg-white px-4 py-3.5 text-[14px] font-bold text-[#24332a] outline-none" />
      <input type="password" required placeholder="PASSWORD" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-[14px] bg-white px-4 py-3.5 text-[14px] font-bold text-[#24332a] outline-none" />
      {error ? <div className="rounded-[12px] bg-red-950/40 px-3 py-2.5 text-center text-[11px] font-black uppercase">{error}</div> : null}
      <button disabled={loading} className="w-full rounded-[14px] bg-[#ffd66b] px-4 py-3.5 text-[13px] font-black uppercase text-[#26382d] disabled:opacity-60">{loading ? "SIGNING IN..." : "LOGIN"}</button>
    </form>
  );
}
