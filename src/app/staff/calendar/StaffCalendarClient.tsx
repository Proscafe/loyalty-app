"use client";

import { AdminMobileHeader } from "@/components/AdminMobileHeader";
import { StaffBottomNav } from "@/components/StaffBottomNav";

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";

const GOOGLE_CALENDAR_URL =
  "https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=Asia%2FBeirut&showPrint=0&showTitle=0&showNav=1&showDate=1&showTabs=0&showCalendars=0&showTz=0&mode=AGENDA&src=proscafe%40gmail.com";

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

        <section className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.08] shadow-[0_16px_40px_rgba(31,45,36,0.14)] backdrop-blur-2xl">
          <div className="relative h-[calc(100vh-150px)] min-h-[620px] w-full bg-white">
            <iframe
              key="pros-calendar-agenda-v2"
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
