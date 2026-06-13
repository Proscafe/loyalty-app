"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type AdminMobileFloatingMenuProps = {
  active?: "overview" | "activity" | "users" | "loyalty-program" | "comment-cards" | "games" | "gifts" | "birthdays" | "news";
  onBeforeNavigate?: () => void;
  className?: string;
};

const MENU_ITEMS = [
  { key: "overview", label: "Overview", icon: "⌂", href: "/admin" },
  { key: "activity", label: "Activity", icon: "↯", href: "/admin/activity" },
  { key: "users", label: "Users", icon: "♟", href: "/admin/users" },
  { key: "loyalty-program", label: "Loyalty", icon: "★", href: "/admin/loyalty" },
  { key: "comment-cards", label: "Comment Card", icon: "✎", href: "/admin/comment-cards" },
  { key: "games", label: "Games", icon: "🎮", href: "/admin/games" },
  { key: "gifts", label: "Gifts", icon: "🎁", href: "/admin/gifts" },
  { key: "birthdays", label: "Birthdays", icon: "🎂", href: "/admin/birthdays" },
  { key: "news", label: "News", icon: "📣", href: "/admin/news" },
] as const;

function inferActiveFromPath(pathname: string) {
  if (pathname === "/admin/activity") return "activity";
  if (pathname === "/admin/users") return "users";
  if (pathname === "/admin/loyalty") return "loyalty-program";
  if (pathname === "/admin/comment-cards") return "comment-cards";
  if (pathname === "/admin/games" || pathname === "/admin/predictions" || pathname.startsWith("/admin/game-links")) return "games";
  if (pathname === "/admin/gifts") return "gifts";
  if (pathname === "/admin/birthdays") return "birthdays";
  if (pathname === "/admin/news") return "news";
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

      if (!menuRef.current.contains(target)) {
        setIsOpen(false);
      }
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
                    ? "bg-white text-[#61716b]"
                    : "bg-[#ffd66b] text-[#61716b] hover:bg-[#ffe08a]"
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] text-[#61716b] ${isActive ? "bg-[#ffd66b]" : "bg-white/24"}`}>
                  {item.icon}
                </span>
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ffd66b] text-[28px] font-black text-[#61716b] shadow-[0_18px_42px_rgba(20,30,26,0.28)] transition active:scale-95"
        aria-label={isOpen ? "Close admin menu" : "Open admin menu"}
      >
        {isOpen ? "×" : "☰"}
      </button>
    </div>
  );
}

export default AdminMobileFloatingMenu;
