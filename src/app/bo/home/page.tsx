import Image from "next/image";
import Link from "next/link";

import { requireRole } from "@/lib/auth";
import { BOLogoutButton } from "../BOLogoutButton";

export const dynamic = "force-dynamic";

const modules = [
  { href: "/bo/cover", label: "COVER", note: "Cover charge costing" },
  { href: "/bo/fnb", label: "F&B", note: "Food & beverage costing" },
  { href: "/bo/prep", label: "PREP & SAUCES", note: "Prep recipes and sauces" },
  { href: "/bo/utilities", label: "UTL COST", note: "Utilities and operating costs" },
  { href: "/bo/menu", label: "MENU COSTING", note: "Menu item costing" },
  { href: "/bo/reports", label: "REPORTS", note: "Costing and margin reports" },
  { href: "/bo/settings", label: "SETTINGS", note: "BO configuration" },
] as const;

export default async function BOHomePage() {
  const profile = await requireRole(["master_admin"]);

  return (
    <main
      className="min-h-screen bg-[#24372b] text-white"
      style={{ fontFamily: "Raleway, RalewayLocal, Arial, sans-serif" }}
    >
      <header className="border-b border-white/10 bg-[#1e3025]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-4">
            <Image
              src="/pros-logo-white.png"
              alt="PRO's"
              width={90}
              height={54}
              priority
              className="h-auto w-[70px] object-contain"
            />

            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ffd66b]">
                Back Office
              </div>
              <div className="text-[20px] font-black uppercase text-white">BO</div>
            </div>
          </div>

          <BOLogoutButton />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-5 px-5 py-7 lg:grid-cols-[230px_1fr]">
        <aside className="rounded-[22px] border border-white/10 bg-white/7 p-4">
          <div className="mb-4 px-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
            Navigation
          </div>

          <nav className="space-y-2">
            {modules.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-[14px] px-3 py-3 text-[12px] font-black uppercase tracking-[0.04em] text-white transition hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section>
          <div className="rounded-[24px] border border-white/10 bg-white/7 p-6">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
              Welcome
            </div>

            <h1 className="mt-2 text-[30px] font-black tracking-[-0.03em] text-white">
              BO Costing System
            </h1>

            <p className="mt-2 max-w-xl text-[14px] font-medium leading-6 text-white/60">
              The secure BO foundation is ready. We will migrate the costing modules from
              the existing costing source into this area one by one.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[20px] border border-white/10 bg-white/7 p-5 transition hover:border-[#ffd66b]/45 hover:bg-white/10"
              >
                <div className="text-[13px] font-black uppercase tracking-[0.05em] text-white">
                  {item.label}
                </div>
                <div className="mt-2 text-[12px] font-semibold leading-5 text-white/50">
                  {item.note}
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-5 text-[11px] font-semibold text-white/35">
            Signed in as {profile.full_name || profile.email || "Admin"}
          </div>
        </section>
      </div>
    </main>
  );
}
