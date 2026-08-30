"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminMobileFloatingMenu } from "@/components/AdminMobileFloatingMenu";

type AdminPageShellProps = {
  active?:
    | "overview"
    | "activity"
    | "users"
    | "gifts"
    | "birthdays"
    | "loyalty-program"
    | "comment-cards"
    | "reports"
    | "dashboard-banner"
    | "news"
    | "games";
  children: ReactNode;
};

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";

export function AdminPageShell({ active = "overview", children }: AdminPageShellProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main
      className="min-h-screen overflow-hidden p-0 text-white lg:p-6"
      style={{ background: PAGE_BG, fontFamily: "Inter, Arial, Helvetica, sans-serif" }}
    >
      <div className="flex min-h-screen gap-6 lg:min-h-[calc(100vh-48px)]">
        <AdminSidebar active={active} onLogout={handleLogout} />
        <section className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</section>
      </div>
      <AdminMobileFloatingMenu active={active} />
    </main>
  );
}

export default AdminPageShell;
