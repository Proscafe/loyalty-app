"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BOLogoutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await supabase.auth.signOut();
    router.replace("/bo");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={loading}
      className="rounded-[10px] border border-black/15 bg-white px-4 py-2.5 text-[10px] font-black uppercase text-black hover:bg-black hover:text-white disabled:opacity-50"
    >
      {loading ? "LOGGING OUT..." : "LOG OUT"}
    </button>
  );
}
