export default function Loading() {
  return (
    <main
      className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-hidden bg-black font-raleway text-white"
      style={{
        fontFamily: "Raleway, var(--font-raleway), system-ui, sans-serif",
      }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/loading5.jpg')",
        }}
        aria-hidden="true"
      />

      <div className="absolute inset-0 bg-black/58" aria-hidden="true" />

      <section className="relative z-10 flex flex-col items-center px-6 text-center">
        <div className="font-raleway text-[34px] font-black uppercase tracking-[0.22em] text-white drop-shadow-[0_12px_30px_rgba(0,0,0,0.42)]">
          Loading
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          {[0, 1, 2, 3, 4].map((star) => (
            <span
              key={star}
              className="pros-loading-star text-[28px] leading-none text-[#ffd66b]"
              style={{ animationDelay: `${star * 180}ms` }}
            >
              ★
            </span>
          ))}
        </div>
      </section>

      <style>{`
        .pros-loading-star {
          opacity: 0.2;
          transform: scale(0.68);
          animation: prosLoadingStar 1.45s ease-in-out infinite;
        }

        @keyframes prosLoadingStar {
          0%, 100% {
            opacity: 0.2;
            transform: scale(0.68);
          }

          38%, 68% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </main>
  );
}
