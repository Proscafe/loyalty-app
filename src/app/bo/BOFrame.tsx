import { BOSidebar } from "./BOSidebar";
import { BOCurrencyRoundingSync } from "./BOCurrencyRoundingSync";

export function BOFrame({ active, title, subtitle, actions, children }: { active?: string; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; }) {
  return (
    <main className="pros-bo-root min-h-screen min-w-0 bg-[#f4f4f4] text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <BOCurrencyRoundingSync />
      <BOSidebar />
      <div className="min-w-0 px-3 pb-6 pt-16 sm:px-5 lg:ml-[76px] lg:px-6 lg:pt-6">
        <section className="mx-auto w-full max-w-[1600px] min-w-0">
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
