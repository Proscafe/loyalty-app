import Image from "next/image";
import Link from "next/link";
import { BOLogoutButton } from "./BOLogoutButton";
import { BOMobileNav } from "./BOMobileNav";
import { BOCurrencyRoundingSync } from "./BOCurrencyRoundingSync";

const nav = [
  ["/bo/cover", "MENU PRICING"],
  ["/bo/fnb", "INGREDIENTS"],
  ["/bo/prep", "PRODUCTION"],
  ["/bo/utilities", "UTILITY COST"],
  ["/bo/menu", "RECIPES"],
  ["/bo/reports", "REPORTS"],
  ["/bo/settings", "SETTINGS"],
] as const;

export function BOFrame({ active, title, subtitle, actions, children }: { active?: string; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; }) {
  return (
    <main className="pros-bo-root min-h-screen min-w-0 bg-[#f4f4f4] text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <BOCurrencyRoundingSync />
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1540px] items-center justify-between gap-3 px-3 py-3 sm:px-5">
          <Link href="/bo/home" className="flex min-w-0 items-center gap-3" aria-label="Back Office Home">
            <Image src="/icon.png" alt="PRO'S" width={48} height={48} className="h-11 w-11 shrink-0 rounded-xl object-contain" />
            <span className="text-[15px] font-black uppercase tracking-[0.04em] sm:text-[19px]">BACK OFFICE</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden lg:block"><BOLogoutButton /></div>
            <BOMobileNav active={active} items={nav.map(([href, label]) => ({ href, label }))} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1540px] min-w-0 gap-3 px-3 py-3 sm:gap-5 sm:px-5 sm:py-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden h-fit rounded-[18px] border border-black/10 bg-white p-3 lg:sticky lg:top-[86px] lg:block">
          <nav className="space-y-1">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className={`block rounded-[10px] px-3 py-3 text-[11px] font-bold uppercase tracking-[0.03em] transition ${active === href ? "bg-black text-white" : "text-black/65 hover:bg-black/[0.05] hover:text-black"}`}>
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className={`${active === "/bo/home" ? "hidden lg:flex" : "flex"} mb-3 flex-wrap items-start justify-between gap-3 rounded-[18px] border border-black/10 bg-white px-4 py-4 sm:mb-4 sm:gap-4 sm:px-5`}>
            <div>
              <h1 className="text-[21px] font-bold uppercase tracking-[-0.02em] sm:text-[27px]">{title}</h1>
              {subtitle ? <p className="mt-1 text-[12px] font-normal text-black/55">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
