import Image from "next/image";

/** Loading fallback for Back Office routes only. */
export default function Loading() {
  return (
    <main
      role="status"
      aria-label="Loading Back Office"
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#f3f3ff] text-[#25206f]"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <Image
          src="/icon.png"
          alt="PRO'S Cafe"
          width={104}
          height={104}
          priority
          className="mb-5 h-[104px] w-[104px] object-contain"
        />
        <h1 className="text-[26px] font-black uppercase tracking-[0.10em] sm:text-[32px]">
          Back Office
        </h1>
        <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.26em] text-[#696b87]">
          Loading
        </p>
        <div className="mt-4 flex items-center justify-center gap-3" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((star) => (
            <span
              key={star}
              className="pros-bo-loading-star text-[28px] leading-none text-[#d4a52d]"
              style={{ animationDelay: `${star * 180}ms` }}
            >
              ★
            </span>
          ))}
        </div>
      </section>
      <a
        href="https://wissamdesigns.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mb-7 flex items-center justify-center gap-2 text-[#747890] hover:text-[#25206f]"
        aria-label="© 2026 wissamdesigns.com"
      >
        <Image src="/WM.png" alt="WM" width={34} height={34} className="h-[34px] w-[34px] object-contain" unoptimized />
        <span className="text-[10px]">© 2026 wissamdesigns.com</span>
      </a>
      <style>{`
        .pros-bo-loading-star {
          opacity: 0.2;
          transform: scale(0.68);
          animation: prosBoLoadingStar 1.45s ease-in-out infinite;
        }
        @keyframes prosBoLoadingStar {
          0%, 100% { opacity: 0.2; transform: scale(0.68); }
          38%, 68% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pros-bo-loading-star { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </main>
  );
}
