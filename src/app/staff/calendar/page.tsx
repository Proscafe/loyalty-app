import Link from "next/link";

import { AdminMobileHeader } from "@/components/AdminMobileHeader";
import { StaffBottomNav } from "@/components/StaffBottomNav";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";

const CALENDAR_SRC =
  "https://calendar.google.com/calendar/embed?src=proscafe%40gmail.com&ctz=Asia%2FBeirut";

export default async function StaffCalendarPage() {
  const profile = await requireRole([
    "master_admin",
    "staff",
    "supervisor",
  ]);

  return (
    <main
      className="min-h-screen px-4 pb-[112px] pt-2 text-white sm:pt-5"
      style={{ background: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-md">
        <AdminMobileHeader
          title="Calendar"
          homeHref="/staff"
          profileHref="/profile"
          logoSrc="/pros-logo-basic.png"
          className="mt-1"
        />

        <div className="hidden items-center justify-between pb-5 lg:flex">
          <Link
            href="/staff"
            className="text-[12px] font-black text-white/75 transition hover:text-white"
          >
            ← Staff Console
          </Link>

          <div className="rounded-full bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] backdrop-blur-xl">
            {profile.role === "staff"
              ? "Manager"
              : profile.role === "supervisor"
                ? "Supervisor"
                : "Admin"}
          </div>
        </div>

        <section className="mb-4 rounded-[26px] bg-white/10 p-5 shadow-[0_22px_60px_rgba(35,54,47,0.14)] backdrop-blur-2xl">
          <h1 className="text-[34px] font-black tracking-[-0.05em]">
            Calendar
          </h1>
        </section>

        <section className="overflow-hidden rounded-[26px] border border-white/15 bg-white/10 p-2 shadow-[0_22px_60px_rgba(35,54,47,0.16)] backdrop-blur-2xl">
          <div className="relative h-[calc(100vh-260px)] min-h-[520px] w-full overflow-hidden rounded-[20px] bg-white">
            <iframe
              src={CALENDAR_SRC}
              title="PRO's Cafe Staff Calendar"
              className="h-full w-full border-0"
              frameBorder="0"
              scrolling="no"
            />
          </div>
        </section>
      </div>

      <StaffBottomNav active="calendar" />
    </main>
  );
}
