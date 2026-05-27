"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types";

export function AppShell({
  title,
  children,
}: {
  title: string;
  role: UserRole;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#c7867d] pb-16 font-sans text-white">
      <header className="sticky top-0 z-30 bg-[#91534c] text-white shadow-sm">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/pros-logo-basic.png"
              alt="PRO's Café & Sports Lounge"
              width={82}
              height={48}
              priority
              className="h-10 w-auto shrink-0 object-contain"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-black uppercase leading-none tracking-wide text-white">{title}</div>
            </div>
          </div>
          <button onClick={signOut} className="shrink-0 text-xs font-bold text-white/85 transition hover:text-white">
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 pt-5">{children}</main>
    </div>
  );
}
