import Image from "next/image";
import Link from "next/link";
import { BOLogoutButton } from "./BOLogoutButton";

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
    <main className="min-h-screen bg-[#f4f4f4] text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1540px] items-center justify-between gap-4 px-5 py-3">
          <Link href="/bo/home" className="flex items-center gap-3">
            <div className="flex h-[42px] w-[62px] items-center justify-center rounded-[10px] bg-black px-2">
              <Image src="/pros-logo-white.png" alt="PRO's" width={72} height={44} className="h-auto w-[52px] object-contain" />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-black/45">BACK OFFICE</div>
              <div className="text-[18px] font-bold uppercase">BO</div>
            </div>
          </Link>
          <BOLogoutButton />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1540px] gap-5 px-5 py-5 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-[18px] border border-black/10 bg-white p-3 lg:sticky lg:top-[86px]">
          <nav className="space-y-1">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className={`block rounded-[10px] px-3 py-3 text-[11px] font-bold uppercase tracking-[0.03em] transition ${active === href ? "bg-black text-white" : "text-black/65 hover:bg-black/[0.05] hover:text-black"}`}>
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-[18px] border border-black/10 bg-white px-5 py-4">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-black/40">BO MODULE</div>
              <h1 className="mt-1 text-[27px] font-bold uppercase tracking-[-0.02em]">{title}</h1>
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
