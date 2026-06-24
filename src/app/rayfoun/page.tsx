import type { Metadata } from "next";
import AdminMobileHeader from "@/components/AdminMobileHeader";

export const metadata: Metadata = {
  title: "PRO's Rayfoun",
  description: "Reserve, view the menu, or get directions to PRO's Cafe Rayfoun.",
};

const reservePhone = "76720277";
const whatsappHref = "https://wa.me/96176720277";
const locationHref = "https://maps.app.goo.gl/31F1gQvxPaxkg3XSA";
const menuHref =
  "https://shark-accounting.com/menu/Pros_cafe_rayfoun/index.php?p=home&category_id=527";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5 shrink-0 fill-current">
      <path d="M16.04 3.2A12.73 12.73 0 0 0 5.12 22.45L3.6 28.8l6.5-1.52A12.73 12.73 0 1 0 16.04 3.2Zm0 22.92a10.17 10.17 0 0 1-5.2-1.43l-.37-.22-3.86.9.92-3.76-.24-.39a10.18 10.18 0 1 1 8.75 4.9Zm5.58-7.62c-.31-.15-1.82-.9-2.1-1-.28-.1-.48-.15-.68.15-.2.3-.78 1-.96 1.16-.18.2-.35.22-.66.08-.31-.16-1.3-.48-2.47-1.53-.91-.81-1.53-1.82-1.7-2.13-.18-.3-.02-.47.13-.62.14-.13.31-.35.46-.53.15-.18.2-.3.31-.51.1-.2.05-.38-.03-.53-.08-.15-.68-1.64-.93-2.25-.25-.59-.5-.5-.68-.51h-.58c-.2 0-.53.08-.81.38-.28.3-1.06 1.04-1.06 2.53 0 1.49 1.09 2.93 1.24 3.13.15.2 2.14 3.27 5.18 4.58.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.82-.74 2.08-1.46.26-.71.26-1.33.18-1.46-.08-.13-.28-.2-.59-.35Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-current">
      <path d="M5.75 3.25A2.75 2.75 0 0 0 3 6v12a2.75 2.75 0 0 0 2.75 2.75h12.5A2.75 2.75 0 0 0 21 18V6a2.75 2.75 0 0 0-2.75-2.75H5.75Zm0 2h12.5c.41 0 .75.34.75.75v12c0 .41-.34.75-.75.75H5.75A.75.75 0 0 1 5 18V6c0-.41.34-.75.75-.75Zm2.1 4.15a1 1 0 0 0 0 2h8.3a1 1 0 1 0 0-2h-8.3Zm0 4a1 1 0 1 0 0 2h8.3a1 1 0 1 0 0-2h-8.3Z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-current">
      <path d="M12 2.25c-3.72 0-6.75 2.96-6.75 6.6 0 4.96 5.58 11.36 5.82 11.63a1.25 1.25 0 0 0 1.86 0c.24-.27 5.82-6.67 5.82-11.63 0-3.64-3.03-6.6-6.75-6.6Zm0 9.35a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-current">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.28-.28.68-.36 1.04-.25 1.15.38 2.38.57 3.55.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.17.19 2.4.57 3.55.11.36.03.76-.25 1.04l-2.2 2.2Z" />
    </svg>
  );
}

export default function RayfounPage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0b0f0d] text-white"
      style={{ fontFamily: "Raleway, var(--font-raleway), Arial, sans-serif" }}
    >
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/Rayfounweb.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />

      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/50 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-transparent to-black/26" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-4 pb-7 pt-4 sm:px-6 lg:px-8">
        <AdminMobileHeader
          title="PRO's Rayfoun"
          homeHref="/rayfoun"
          profileHref="/rayfoun"
          className="bg-black/20 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl"
        />

        <div className="flex flex-1 items-end pb-5 pt-8 sm:items-center sm:pb-10">
          <div className="w-full max-w-[520px]">
            <h1 className="max-w-[540px] font-black text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)]">
              <span className="block whitespace-nowrap text-[28px] leading-[1.02] tracking-[-0.065em] sm:text-[46px] lg:text-[54px]">
                Reserve your spot at
              </span>
              <span className="mt-1 block text-[47px] leading-[0.98] tracking-[-0.075em] text-[#ffd35b] sm:text-[72px] lg:text-[84px]">
                Pro&apos;s Rayfoun
              </span>
            </h1>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[64px] items-center justify-center gap-2 rounded-[18px] bg-[#20bf63] px-4 text-[13px] font-black uppercase tracking-[0.08em] text-white shadow-[0_18px_35px_rgba(32,191,99,0.32)] transition hover:-translate-y-0.5 hover:bg-[#25cf6d] sm:text-sm"
                aria-label={`Reserve on WhatsApp ${reservePhone}`}
              >
                <WhatsAppIcon />
                Reserve
              </a>

              <a
                href={menuHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[64px] items-center justify-center gap-2 rounded-[18px] bg-[#ffd35b] px-4 text-[13px] font-black uppercase tracking-[0.08em] text-[#151714] shadow-[0_18px_35px_rgba(255,211,91,0.28)] transition hover:-translate-y-0.5 hover:bg-[#ffe082] sm:text-sm"
              >
                <MenuIcon />
                View menu
              </a>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-[13px] font-black uppercase tracking-[0.08em] text-white sm:text-sm">
              <a
                href={locationHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-white/92 transition hover:text-[#ffd35b]"
              >
                <span className="text-[#ffd35b]">
                  <LocationIcon />
                </span>
                Get directions
              </a>

              <a
                href={`tel:${reservePhone}`}
                className="flex items-center gap-2 text-white/92 transition hover:text-[#ffd35b]"
              >
                <span className="text-[#ffd35b]">
                  <PhoneIcon />
                </span>
                Call {reservePhone}
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
