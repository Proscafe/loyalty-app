"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { BOLogoutButton } from "./BOLogoutButton";

type NavItem = { href: string; label: string };

export function BOMobileNav({ active, items }: { active?: string; items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onEscape);
    return () => { document.body.style.overflow = prior; window.removeEventListener("keydown", onEscape); };
  }, [open]);

  return <>
    <button type="button" aria-label="Open navigation" aria-expanded={open} aria-controls="pros-bo-mobile-menu" onClick={() => setOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/15 bg-white text-black lg:hidden">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
    {mounted && open && createPortal(
      <div className="fixed inset-0 z-[2147483000] flex justify-end bg-black/60 lg:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <nav id="pros-bo-mobile-menu" aria-label="Back office navigation" className="flex h-full w-[min(88vw,360px)] flex-col overflow-y-auto bg-white px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] text-black shadow-2xl" role="dialog" aria-modal="true">
          <div className="mb-4 flex items-center justify-between border-b border-black/10 pb-4">
            <span className="text-base font-black uppercase">BACK OFFICE</span>
            <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/15 text-2xl">×</button>
          </div>
          {[{ href: "/bo/home", label: "HOME" }, ...items].map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active === item.href ? "page" : undefined} className={`mb-1 flex min-h-12 items-center rounded-xl px-4 py-3 text-sm font-bold ${active === item.href ? "bg-black text-white" : "bg-gray-50 text-black hover:bg-gray-100"}`}>
              {item.label}
            </Link>
          ))}
          <div className="mt-auto border-t border-black/10 pt-5"><BOLogoutButton /></div>
        </nav>
      </div>, document.body)
    }
  </>;
}
