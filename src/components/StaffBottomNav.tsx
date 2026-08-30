"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export type StaffNavKey =
  | "activity"
  | "reserve"
  | "scan"
  | "reports"
  | "calendar";

type Props = {
  active?: StaffNavKey;
  onScan?: () => void;
  reserveHref?: string;
  calendarHref?: string;
  isSupervisor?: boolean;
};

function StaffNavIcon({ name }: { name: StaffNavKey }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "activity") return <svg {...common}><path d="M4 13h3l2-6 4 11 2-5h5" /></svg>;
  if (name === "reserve") return <svg {...common}><path d="M7 3v3M17 3v3M4 9h16" /><rect x="4" y="5" width="16" height="16" rx="3" /><path d="m9 15 2 2 4-4" /></svg>;
  if (name === "scan") return <svg {...common}><path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 12h8" /></svg>;
  if (name === "reports") return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h4M10 12h5M10 16h5" /></svg>;
  return <svg {...common}><path d="M7 3v3M17 3v3M4 9h16" /><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 13h2M14 13h2M8 17h2M14 17h2" /></svg>;
}

export function StaffBottomNav({
  active,
  onScan,
  reserveHref,
  calendarHref = "/staff/calendar",
  isSupervisor = false,
}: Props) {
  const router = useRouter();

  function openScanner() {
    if (onScan) {
      onScan();
      return;
    }
    router.push("/staff?scan=1");
  }

  const circle = (key: StaffNavKey) =>
    `flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 shadow-[0_6px_16px_rgba(30,43,35,0.16)] ${
      active === key
        ? "border-[#ffd66b] bg-[#6b7968] text-[#ffd66b]"
        : "border-white/90 bg-[#6b7968] text-white"
    }`;

  const label = (key: StaffNavKey) =>
    `absolute bottom-[4px] w-full text-center text-[9px] font-black leading-none ${
      active === key ? "text-[#ffd66b]" : "text-white"
    }`;

  return (
    <nav aria-label="Staff navigation" className="fixed bottom-0 left-0 z-[100] w-screen">
      <div
        className="relative w-full rounded-t-[10px] border-x border-t border-white/20 px-3"
        style={{
          height: "64px",
          background: "linear-gradient(180deg, rgba(116,132,113,0.82) 0%, rgba(92,109,91,0.88) 100%)",
          boxShadow: "0 14px 38px rgba(25,38,30,0.22), inset 0 1px 0 rgba(255,255,255,0.14)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
        }}
      >
        <div className="absolute inset-x-3 -top-[28px] grid grid-cols-5 items-start gap-1.5">
          {isSupervisor ? (
            <button type="button" disabled className="relative flex h-[78px] min-w-0 flex-col items-center cursor-not-allowed opacity-45">
              <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-[#4f5650] bg-[#4f5650] text-white/55 shadow-[0_6px_16px_rgba(30,43,35,0.12)]"><StaffNavIcon name="activity" /></span>
              <span className="absolute bottom-[4px] w-full text-center text-[9px] font-black leading-none text-white/45">Activity</span>
            </button>
          ) : (
            <Link href="/staff/activity" className="relative flex h-[78px] min-w-0 flex-col items-center transition active:scale-95">
              <span className={circle("activity")}><StaffNavIcon name="activity" /></span>
              <span className={label("activity")}>Activity</span>
            </Link>
          )}

          {isSupervisor ? (
            <button type="button" disabled className="relative flex h-[78px] min-w-0 flex-col items-center cursor-not-allowed opacity-45">
              <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-[#4f5650] bg-[#4f5650] text-white/55 shadow-[0_6px_16px_rgba(30,43,35,0.12)]"><StaffNavIcon name="reserve" /></span>
              <span className="absolute bottom-[4px] w-full text-center text-[9px] font-black leading-none text-white/45">Reserve</span>
            </button>
          ) : reserveHref ? (
            <Link href={reserveHref} className="relative flex h-[78px] min-w-0 flex-col items-center transition active:scale-95">
              <span className={circle("reserve")}><StaffNavIcon name="reserve" /></span>
              <span className={label("reserve")}>Reserve</span>
            </Link>
          ) : (
            <button type="button" disabled className="relative flex h-[78px] min-w-0 flex-col items-center text-white/80">
              <span className={circle("reserve")}><StaffNavIcon name="reserve" /></span>
              <span className={label("reserve")}>Reserve</span>
            </button>
          )}

          <button
            type="button"
            onClick={isSupervisor ? undefined : openScanner}
            disabled={isSupervisor}
            className={`relative -translate-y-[5px] flex h-[83px] min-w-0 flex-col items-center ${isSupervisor ? "cursor-not-allowed opacity-45" : "transition active:scale-95"}`}
          >
            <span className={`flex h-[58px] w-[58px] items-center justify-center rounded-full border-[3px] text-white shadow-[0_8px_20px_rgba(31,43,35,0.22)] [&_svg]:h-[29px] [&_svg]:w-[29px] ${isSupervisor ? "border-[#4f5650] bg-[#4f5650] text-white/55" : "border-white bg-[#ffd66b]"}`}>
              <StaffNavIcon name="scan" />
            </span>
            <span className={isSupervisor ? "absolute bottom-[4px] w-full text-center text-[9px] font-black leading-none text-white/45" : label("scan")}>Scan</span>
          </button>

          <Link href="/staff/reports" className="relative flex h-[78px] min-w-0 flex-col items-center transition active:scale-95">
            <span className={circle("reports")}><StaffNavIcon name="reports" /></span>
            <span className={label("reports")}>Reports</span>
          </Link>

          <Link href={calendarHref} className="relative flex h-[78px] min-w-0 flex-col items-center transition active:scale-95">
            <span className={circle("calendar")}><StaffNavIcon name="calendar" /></span>
            <span className={label("calendar")}>Calendar</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default StaffBottomNav;
