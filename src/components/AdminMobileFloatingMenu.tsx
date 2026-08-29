"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { AdminActiveKey } from "@/components/AdminSidebar";

type AdminMobileFloatingMenuProps = {
  active?: AdminActiveKey;
  onBeforeNavigate?: () => void;
  className?: string;
};

const MENU_ITEMS: ReadonlyArray<{
  key: AdminActiveKey;
  label: string;
  icon: string;
  href: string;
}> = [
  { key: "overview", label: "Overview", icon: "⌂", href: "/admin" },
  { key: "activity", label: "Activity", icon: "↯", href: "/admin/activity" },
  { key: "users", label: "Users", icon: "♟", href: "/admin/users" },
  { key: "comment-cards", label: "Comment Cards", icon: "✎", href: "/admin/comment-cards" },
  { key: "reports", label: "Reports", icon: "▤", href: "/admin/reports" },
  { key: "games", label: "Games", icon: "🎮", href: "/admin/games" },
  { key: "loyalty-program", label: "Loyalty", icon: "★", href: "/admin/loyalty" },
];

function inferActiveFromPath(pathname: string): AdminActiveKey {
  if (pathname.startsWith("/admin/activity")) return "activity";
  if (pathname.startsWith("/admin/users")) return "users";
  if (pathname.startsWith("/admin/comment-cards")) return "comment-cards";
  if (pathname.startsWith("/admin/reports")) return "reports";
  if (
    pathname.startsWith("/admin/games") ||
    pathname.startsWith("/admin/predictions") ||
    pathname.startsWith("/admin/game-links")
  ) return "games";
  if (pathname.startsWith("/admin/loyalty")) return "loyalty-program";
  if (pathname.startsWith("/admin/gifts")) return "gifts";
  if (pathname.startsWith("/admin/birthdays")) return "birthdays";
  if (pathname.startsWith("/admin/news")) return "news";
  return "overview";
}

export function AdminMobileFloatingMenu({
  active,
  onBeforeNavigate,
  className = "",
}: AdminMobileFloatingMenuProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const activeKey = useMemo(
    () => active ?? inferActiveFromPath(pathname),
    [active, pathname],
  );

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target || !menuRef.current) return;
      if (!menuRef.current.contains(target)) setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={menuRef}
      className={`fixed bottom-5 right-4 z-50 flex flex-col items-end lg:hidden ${className}`}
    >
      {isOpen ? (
        <div className="mb-3 flex flex-col items-end gap-2">
          {MENU_ITEMS.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => {
                  onBeforeNavigate?.();
                  setIsOpen(false);
                }}
                className={`group flex h-11 min-w-[154px] items-center justify-start gap-2 rounded-full px-4 text-[11px] font-black shadow-[0_14px_34px_rgba(20,30,26,0.24)] transition active:scale-[0.98] ${
                  isActive
                    ? "bg-[#ffd66b] text-[#365665]"
                    : "bg-[#365665]/95 text-white backdrop-blur-2xl"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/12 text-[14px]">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ffd66b] text-[20px] font-black text-[#365665] shadow-[0_16px_38px_rgba(20,30,26,0.28)]"
        aria-label={isOpen ? "Close admin menu" : "Open admin menu"}
      >
        {isOpen ? "×" : "☰"}
      </button>
    </div>
  );
}

export default AdminMobileFloatingMenu;
