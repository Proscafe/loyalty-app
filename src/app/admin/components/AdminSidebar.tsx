"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type AdminSidebarTab =
  | "Overview"
  | "Gifts"
  | "Birthdays"
  | "Loyalty Program";

type AdminSidebarItem = {
  label: string;
  icon: string;
  href: string;
  tab?: AdminSidebarTab;
  activeKey: string;
};

type AdminSidebarProps = {
  active?: string;
  currentTab?: AdminSidebarTab;
  onTabChange?: (tab: AdminSidebarTab) => void;
  onBeforeNavigate?: () => void;
  onLogout?: () => void | Promise<void>;
};

const ADMIN_SIDEBAR_ITEMS: AdminSidebarItem[] = [
  {
    label: "Dashboard",
    icon: "⌂",
    href: "/admin",
    tab: "Overview",
    activeKey: "dashboard",
  },
  {
    label: "Activity",
    icon: "↯",
    href: "/admin/activity",
    activeKey: "activity",
  },
  {
    label: "Customer behavior",
    icon: "👤",
    href: "/admin/users",
    activeKey: "users",
  },
  {
    label: "Comment Cards",
    icon: "✎",
    href: "/admin/comment-cards",
    activeKey: "comment-cards",
  },
  {
    label: "Birthdays",
    icon: "🎂",
    href: "/admin?tab=Birthdays",
    tab: "Birthdays",
    activeKey: "birthdays",
  },
  {
    label: "Gifts",
    icon: "🎁",
    href: "/admin?tab=Gifts",
    tab: "Gifts",
    activeKey: "gifts",
  },
  {
    label: "Loyalty Program",
    icon: "★",
    href: "/admin?tab=Loyalty+Program",
    tab: "Loyalty Program",
    activeKey: "loyalty-program",
  },
  {
    label: "Games",
    icon: "🎮",
    href: "/admin/games",
    activeKey: "games",
  },
];

function inferActiveKey(pathname: string, currentTab?: AdminSidebarTab) {
  if (pathname === "/admin/activity") return "activity";
  if (pathname === "/admin/users") return "users";
  if (pathname === "/admin/comment-cards") return "comment-cards";
  if (pathname === "/admin/games") return "games";

  if (currentTab === "Birthdays") return "birthdays";
  if (currentTab === "Gifts") return "gifts";
  if (currentTab === "Loyalty Program") return "loyalty-program";

  return "dashboard";
}

export function AdminSidebar({
  active,
  currentTab,
  onTabChange,
  onBeforeNavigate,
  onLogout,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const activeKey = active ?? inferActiveKey(pathname, currentTab);

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

  function handleTabClick(tab: AdminSidebarTab) {
    onBeforeNavigate?.();
    onTabChange?.(tab);
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
            <div className="text-[19px] font-black leading-none text-white">
              Dashboard
            </div>
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

      <nav className="flex-1 px-3 py-4">
        {ADMIN_SIDEBAR_ITEMS.map((item) => {
          const isActive = activeKey === item.activeKey;
          const label = isOpen ? item.label : null;

          if (item.tab && onTabChange && pathname === "/admin") {
            return (
              <button
                key={item.activeKey}
                type="button"
                title={item.label}
                onClick={() => handleTabClick(item.tab!)}
                className={itemClass(isActive)}
              >
                <span className={iconClass(isActive)}>{item.icon}</span>
                {label}
              </button>
            );
          }

          return (
            <Link
              key={item.activeKey}
              href={item.href}
              title={item.label}
              onClick={onBeforeNavigate}
              className={itemClass(isActive)}
            >
              <span className={iconClass(isActive)}>{item.icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/8 px-3 py-5">
        {onLogout ? (
          <button
            type="button"
            onClick={() => void onLogout()}
            className={`mb-4 flex w-full items-center rounded-none bg-transparent py-2 text-left text-[12px] font-black text-white/86 transition hover:text-white ${
              isOpen ? "justify-start px-4" : "justify-center px-0"
            }`}
            title="Logout"
          >
            {isOpen ? "Logout" : "⎋"}
          </button>
        ) : null}

        {isOpen ? (
          <a
            href="https://wissamdesigns.com"
            target="_blank"
            rel="noreferrer"
            className="block text-left text-[11px] font-black uppercase leading-5 text-[#ffd66b] transition hover:text-white"
          >
            © WISSAMDESIGNS.COM
          </a>
        ) : (
          <div className="text-center text-[14px] font-black text-[#ffd66b]">©</div>
        )}
      </div>
    </aside>
  );
}

export default AdminSidebar;
