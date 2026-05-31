"use client";

import { useMemo } from "react";

const LOADING_IMAGES = Array.from({ length: 10 }, (_, index) => `/loading${index + 1}.jpg`);

export default function Loading() {
  const imageSrc = useMemo(() => {
    const index = Math.floor(Math.random() * LOADING_IMAGES.length);
    return LOADING_IMAGES[index];
  }, []);

  return (
    <main className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-hidden bg-black font-raleway">
      <img
        src={imageSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      <div className="absolute inset-0 bg-black/42" />

      <section className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-[46px] font-black uppercase leading-none tracking-[0.12em] text-white drop-shadow-[0_10px_28px_rgba(0,0,0,0.45)] sm:text-[64px]">
          Loading
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="pros-loading-star pros-loading-star-1">★</span>
          <span className="pros-loading-star pros-loading-star-2">★</span>
          <span className="pros-loading-star pros-loading-star-3">★</span>
        </div>
      </section>

      <style>{`
        @keyframes prosLoadingStarOne {
          0% { opacity: 0; }
          18% { opacity: 1; }
          82% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes prosLoadingStarTwo {
          0% { opacity: 0; }
          22% { opacity: 0; }
          42% { opacity: 1; }
          82% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes prosLoadingStarThree {
          0% { opacity: 0; }
          46% { opacity: 0; }
          66% { opacity: 1; }
          82% { opacity: 1; }
          100% { opacity: 0; }
        }

        .pros-loading-star {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 22px;
          line-height: 1;
          opacity: 0;
          text-shadow: 0 8px 22px rgba(0, 0, 0, 0.42);
        }

        .pros-loading-star-1 {
          animation: prosLoadingStarOne 1.8s ease-in-out infinite;
        }

        .pros-loading-star-2 {
          animation: prosLoadingStarTwo 1.8s ease-in-out infinite;
        }

        .pros-loading-star-3 {
          animation: prosLoadingStarThree 1.8s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
