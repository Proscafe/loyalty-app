"use client";

import { AdminMobileHeader } from "@/components/AdminMobileHeader";
import { StaffBottomNav } from "@/components/StaffBottomNav";

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";

const GOOGLE_CALENDAR_URL =
  "https://calendar.google.com/calendar/embed?src=proscafe%40gmail.com&ctz=Asia%2FBeirut&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&showTz=0&mode=MONTH";

export function StaffCalendarClient() {
  return (
    <main
      className="min-h-screen px-4 pb-32 pt-2 font-raleway text-white"
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

        <section className="mb-4 mt-4 rounded-[22px] bg-white/[0.10] px-5 py-5 shadow-[0_18px_50px_rgba(35,54,47,0.14)] backdrop-blur-2xl">
          <h1 className="text-[30px] font-black tracking-[-0.05em] text-white">
            Calendar
          </h1>

        </section>

        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.08] shadow-[0_16px_40px_rgba(31,45,36,0.14)] backdrop-blur-2xl">
          <div className="relative h-[calc(100vh-205px)] min-h-[560px] w-full bg-white">
            <iframe
              src={GOOGLE_CALENDAR_URL}
              title="Pro's Cafe Google Calendar"
              className="absolute inset-0 h-full w-full border-0"
              frameBorder="0"
              scrolling="yes"
              loading="lazy"
            />
          </div>
        </section>
      </div>

      <StaffBottomNav active="calendar" />
    </main>
  );
}

export default StaffCalendarClient;
