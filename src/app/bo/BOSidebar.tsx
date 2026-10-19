"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BOLogoutButton } from "./BOLogoutButton";

type IconName = "dashboard" | "pricing" | "recipe" | "ingredients" | "reports" | "utility" | "settings" | "logout" | "menu" | "close";
type NavItem = { href: string; label: string; icon: IconName };
const sections: NavItem[][] = [
  [{ href: "/bo/home", label: "Dashboard", icon: "dashboard" }],
  [
    { href: "/bo/cover", label: "Menu Pricing", icon: "pricing" },
    { href: "/bo/menu", label: "Recipes", icon: "recipe" },
    { href: "/bo/fnb", label: "Ingredients", icon: "ingredients" },
    { href: "/bo/prep", label: "Production", icon: "recipe" },
  ],
  [
    { href: "/bo/reports", label: "Reports", icon: "reports" },
    { href: "/bo/pos-mapping", label: "POS Mapping", icon: "reports" },
    { href: "/bo/utilities", label: "Utility Cost", icon: "utility" },
  ],
  [{ href: "/bo/settings", label: "Settings", icon: "settings" }],
];

function SidebarIcon({ name, size = 21 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    pricing: <><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/></>,
    recipe: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v4h6V3M9 12h6M9 16h5"/></>,
    ingredients: <><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z"/><path d="m3 7 9 4 9-4M12 11v10"/></>,
    reports: <><path d="M4 20V4M4 20h17"/><rect x="7" y="12" width="3" height="6" rx=".5"/><rect x="12" y="8" width="3" height="10" rx=".5"/><rect x="17" y="5" width="3" height="13" rx=".5"/></>,
    utility: <><path d="M12 2 6 13h5l-1 9 8-12h-5l2-8Z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M10 2h4l.5 2.1 1.8.8 1.9-1.1 2.8 2.8-1.1 1.9.8 1.8L22 10v4l-2.1.5-.8 1.8 1.1 1.9-2.8 2.8-1.9-1.1-1.8.8L14 22h-4l-.5-2.1-1.8-.8-1.9 1.1L3 17.4l1.1-1.9-.8-1.8L2 14v-4l2.1-.5.8-1.8L3.8 5.8 6.6 3l1.9 1.1 1.8-.8L10 2Z"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    close: <path d="M5 5l14 14M19 5 5 19"/>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export function BOSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [username, setUsername] = useState("User");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const value = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.username || user?.email?.split("@")[0] || "User";
      if (alive) setUsername(String(value));
    });
    return () => { alive = false; };
  }, [supabase]);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  function contents(isExpanded: boolean) {
    return <div className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden px-3 py-5">
      <Link href="/bo/home" className={`flex min-h-[64px] items-center gap-3 rounded-xl px-2 py-2 ${isExpanded ? "" : "justify-center"}`} title="PRO'S Back Office">
        <Image src="/icon.png" width={60} height={60} alt="PRO'S Logo" className={`shrink-0 rounded-lg object-contain transition-[width,height] duration-200 ${isExpanded ? "h-[56px] w-[56px]" : "h-10 w-10"}`} />
        {isExpanded && <span className="whitespace-nowrap text-[15px] font-extrabold tracking-tight text-[#25206f]">Back Office</span>}
      </Link>
      <div className={`my-5 flex min-h-[57px] items-center gap-3 rounded-xl bg-[#eaeafa] px-3 py-3 ${isExpanded ? "" : "justify-center"}`} title={`Hello, ${username}`}>
        <span className="shrink-0 text-[20px]">👋</span>
        {isExpanded && <div className="min-w-0"><p className="text-[11px] font-medium text-[#5c5d77]">Hello,</p><p className="truncate text-[13px] font-bold text-[#25206f]">{username}</p></div>}
      </div>
      <nav aria-label="Back Office navigation" className="flex flex-col gap-3">
        {sections.map((section, index) => <div key={index} className="space-y-1 border-b border-[#dedfee] pb-3 last:border-b-0">
          {section.map(item => {
            const selected = pathname === item.href || pathname.startsWith(item.href + "/");
            return <Link key={item.href} href={item.href} title={item.label} aria-current={selected ? "page" : undefined} className={`group flex min-h-[43px] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${isExpanded ? "" : "justify-center"} ${selected ? "bg-white font-bold text-[#25206f] shadow-sm" : "text-[#4d526d] hover:bg-white/80 hover:text-[#25206f]"}`}>
              <span className="shrink-0"><SidebarIcon name={item.icon}/></span>
              {isExpanded && <span className="whitespace-nowrap text-[12px] font-semibold">{item.label}</span>}
            </Link>;
          })}
        </div>)}
      </nav>
      <div className="mt-auto pt-4">
        <div className={`group relative flex min-h-[43px] items-center gap-3 rounded-xl px-3 py-2.5 text-[#4d526d] transition-colors hover:bg-white/80 hover:text-[#25206f] ${isExpanded ? "" : "justify-center"}`} title="Log Out">
          <span className="shrink-0"><SidebarIcon name="logout" /></span>
          <div className={`min-w-0 flex-1 [&_button]:!block [&_button]:!w-full [&_button]:!border-0 [&_button]:!bg-transparent [&_button]:!p-0 [&_button]:!text-left [&_button]:!text-[12px] [&_button]:!font-semibold [&_button]:!normal-case [&_button]:!text-inherit [&_button]:!shadow-none [&_button:hover]:!bg-transparent [&_button:hover]:!text-inherit ${isExpanded ? "" : "absolute left-0 top-0 h-full w-full opacity-0"}`}>
            <BOLogoutButton />
          </div>
        </div>
        <div className="mt-4 border-t border-[#dedfee] pt-4">
          <a href="https://wissamdesigns.com" target="_blank" rel="noopener noreferrer" title="© 2026 wissamdesigns.com" className={`flex items-center gap-2 text-[#747890] hover:text-[#25206f] ${isExpanded ? "" : "justify-center"}`}>
            <Image src="/WM.png" alt="WM Designs" width={34} height={34} className="h-8 w-8 shrink-0 object-contain" unoptimized />
            {isExpanded && <span className="text-[10px] leading-4">© 2026<br/>wissamdesigns.com</span>}
          </a>
        </div>
      </div>
    </div>;
  }

  return <>
    <aside onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)} onFocus={() => setExpanded(true)} className={`fixed inset-y-0 left-0 z-[80] hidden border-r border-[#ddddeb] bg-[#f3f3ff] shadow-[2px_0_18px_rgba(35,32,89,0.06)] transition-[width] duration-200 ease-out lg:block ${expanded ? "w-[252px]" : "w-[76px]"}`}>
      {contents(expanded)}
    </aside>
    <button type="button" aria-label="Open navigation" onClick={() => setOpen(true)} className="fixed right-3 top-3 z-[85] flex h-11 w-11 items-center justify-center rounded-xl bg-[#25206f] text-white shadow-lg lg:hidden"><SidebarIcon name="menu" /></button>
    {open && <div className="fixed inset-0 z-[9999] lg:hidden">
      <button aria-label="Close navigation overlay" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <aside role="dialog" aria-modal="true" aria-label="Back Office menu" className="absolute inset-y-0 right-0 w-[min(310px,88vw)] bg-[#f3f3ff] shadow-2xl">
        <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#25206f]"><SidebarIcon name="close" size={18}/></button>
        {contents(true)}
      </aside>
    </div>}
  </>;
}
