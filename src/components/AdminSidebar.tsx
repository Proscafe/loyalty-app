"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AdminActiveKey =
  | "overview"
  | "activity"
  | "users"
  | "gifts"
  | "birthdays"
  | "loyalty-program"
  | "comment-cards"
  | "reports"
  | "news"
  | "games";

type AdminSidebarItem = {
  key: AdminActiveKey;
  label: string;
  icon: string;
  href: string;
};

type AdminSidebarProps = {
  active?: AdminActiveKey | string;
  onBeforeNavigate?: () => void;
  onLogout?: () => void | Promise<void>;
};

const ADMIN_SIDEBAR_ITEMS: AdminSidebarItem[] = [
  { key: "overview", label: "Dashboard", icon: "⌂", href: "/admin" },
  { key: "activity", label: "Activity", icon: "↯", href: "/admin/activity" },
  { key: "news", label: "News", icon: "📣", href: "/admin/news" },
  { key: "users", label: "Customer behavior", icon: "👤", href: "/admin/users" },
  { key: "comment-cards", label: "Comment Cards", icon: "✎", href: "/admin/comment-cards" },
  { key: "reports", label: "Reports", icon: "▤", href: "/admin/reports" },
  { key: "gifts", label: "Gifts", icon: "🎁", href: "/admin/gifts" },
  { key: "birthdays", label: "Birthdays", icon: "🎂", href: "/admin/birthdays" },
  { key: "loyalty-program", label: "Loyalty Program", icon: "★", href: "/admin/loyalty" },
  { key: "games", label: "Games", icon: "🎮", href: "/admin/predictions" },
];

function inferActiveKey(pathname: string): AdminActiveKey {
  if (pathname.startsWith("/admin/activity")) return "activity";
  if (pathname.startsWith("/admin/news")) return "news";
  if (pathname.startsWith("/admin/users")) return "users";
  if (pathname.startsWith("/admin/comment-cards")) return "comment-cards";
  if (pathname.startsWith("/admin/reports")) return "reports";
  if (pathname.startsWith("/admin/gifts")) return "gifts";
  if (pathname.startsWith("/admin/birthdays")) return "birthdays";
  if (pathname.startsWith("/admin/loyalty")) return "loyalty-program";
  if (
    pathname.startsWith("/admin/predictions") ||
    pathname.startsWith("/admin/games") ||
    pathname.startsWith("/admin/game-links")
  ) {
    return "games";
  }
  return "overview";
}

export function AdminSidebar({ active, onBeforeNavigate, onLogout }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const activeKey = (active as AdminActiveKey | undefined) ?? inferActiveKey(pathname);

  function itemClass(isActive: boolean) {
    return `mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black transition ${
      isOpen ? "justify-start px-4" : "justify-center px-0"
    } ${
      isActive
        ? "bg-white/18 text-white shadow-[0_16px_34px_rgba(35,54,47,0.18)]"
        : "text-white/70 hover:bg-white/12 hover:text-white"
    }`;
  }

  function iconClass(isActive: boolean) {
    return `${
      isOpen ? "mr-3" : "mr-0"
    } flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] ${
      isActive ? "bg-[#ffd66b] text-[#365665]" : "bg-white/12 text-white/72"
    }`;
  }

  async function handleLogout() {
    if (onLogout) {
      await onLogout();
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <aside
      className={`hidden min-h-[calc(100vh-48px)] shrink-0 flex-col overflow-hidden rounded-[30px] bg-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.24)] backdrop-blur-2xl transition-all duration-300 lg:flex ${
        isOpen ? "w-[238px]" : "w-[76px]"
      }`}
    >
      <div
        className={`flex h-20 items-center bg-white/5 ${
          isOpen ? "justify-between gap-3 px-5" : "justify-center px-3"
        }`}
      >
        {isOpen ? (
          <div className="min-w-0">
            <div className="text-[19px] font-black leading-none text-white">Dashboard</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#ffd66b]">
              PRO&apos;s Admin
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffd66b] text-[20px] font-black text-[#365665] shadow-[0_12px_28px_rgba(255,214,107,0.2)] transition hover:scale-105"
          title={isOpen ? "Collapse menu" : "Open menu"}
          aria-label={isOpen ? "Collapse menu" : "Open menu"}
        >
          {isOpen ? "←" : "☰"}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {ADMIN_SIDEBAR_ITEMS.map((item) => {
          const isActive = activeKey === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              title={item.label}
              onClick={onBeforeNavigate}
              className={itemClass(isActive)}
            >
              <span className={iconClass(isActive)}>{item.icon}</span>
              {isOpen ? item.label : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/8 px-3 py-5">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className={`mb-4 flex w-full items-center rounded-none bg-transparent py-2 text-left text-[12px] font-black text-white/86 transition hover:text-white ${
            isOpen ? "justify-start px-4" : "justify-center px-0"
          }`}
          title="Logout"
        >
          {isOpen ? "Logout" : "⎋"}
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
