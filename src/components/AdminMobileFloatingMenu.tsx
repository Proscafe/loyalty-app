"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AdminMobileFloatingMenuProps = {
  active?: string;
  onBeforeNavigate?: () => void;
};

const MENU_ITEMS = [
  {
    label: "Overview",
    icon: "⌂",
    href: "/admin",
    activeKey: "overview",
  },
  {
    label: "Activity",
    icon: "↯",
    href: "/admin/activity",
    activeKey: "activity",
  },
  {
    label: "Users",
    icon: "♟",
    href: "/admin/users",
    activeKey: "users",
  },
  {
    label: "Loyalty Program",
    icon: "★",
    href: "/admin?tab=Loyalty+Program",
    activeKey: "loyalty-program",
  },
  {
    label: "Comment Card",
    icon: "✎",
    href: "/admin/comment-cards",
    activeKey: "comment-cards",
  },
  {
    label: "Games",
    icon: "🎮",
    href: "/admin/predictions",
    activeKey: "games",
  },
];

function getActiveKey(pathname: string) {
  if (pathname === "/admin") return "overview";
  if (pathname.startsWith("/admin/activity")) return "activity";
  if (pathname.startsWith("/admin/users")) return "users";
  if (pathname.startsWith("/admin/comment-cards")) return "comment-cards";
  if (pathname.startsWith("/admin/predictions")) return "games";
  if (pathname.startsWith("/admin/games")) return "games";

  return "overview";
}

export function AdminMobileFloatingMenu({
  active,
  onBeforeNavigate,
}: AdminMobileFloatingMenuProps) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const activeKey = active ?? getActiveKey(pathname);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (!isOpen) return;

      const target = event.target as Node;

      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={menuRef}
      className="fixed bottom-5 right-4 z-50 flex flex-col items-end lg:hidden"
    >
      {isOpen ? (
        <div className="mb-3 flex flex-col items-end gap-2">
          {MENU_ITEMS.map((item) => {
            const isActive = activeKey === item.activeKey;

            return (
              <Link
                key={item.activeKey}
                href={item.href}
                onClick={() => {
                  setIsOpen(false);
                  onBeforeNavigate?.();
                }}
                className={`group flex h-12 min-w-[164px] items-center justify-start gap-2 rounded-full border px-5 text-[11px] font-black shadow-[0_16px_34px_rgba(20,30,26,0.22)] backdrop-blur-2xl transition active:scale-[0.98] ${
                  isActive
                    ? "border-white/70 bg-white text-[#61716b]"
                    : "border-[#FFD66B]/60 bg-[#FFD66B] text-[#61716b] hover:bg-[#FFD66B]"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] ${
                    isActive
                      ? "bg-[#FFD66B] text-[#61716b]"
                      : "bg-white/35 text-[#61716b]"
                  }`}
                >
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
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFD66B] text-[28px] font-black text-[#61716b] shadow-[0_18px_42px_rgba(20,30,26,0.28)] transition active:scale-95"
        aria-label={isOpen ? "Close admin menu" : "Open admin menu"}
      >
        {isOpen ? "×" : "☰"}
      </button>
    </div>
  );
}

export default AdminMobileFloatingMenu;