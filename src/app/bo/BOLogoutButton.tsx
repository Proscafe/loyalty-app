"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function BOLogoutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;

    setLoading(true);
    await supabase.auth.signOut();
    router.replace("/bo");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={loading}
      className="rounded-[12px] border border-white/15 bg-white/8 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.06em] text-white transition hover:bg-white/12 disabled:opacity-60"
    >
      {loading ? "LOGGING OUT..." : "LOG OUT"}
    </button>
  );
}
