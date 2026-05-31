"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#f4f2ec] px-6 font-raleway text-[#365665]">
          <section className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-[0_24px_70px_rgba(34,45,38,0.14)]">
            <h1 className="text-2xl font-black">Session paused</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#365665]/70">
              The app was open in the background for too long. Refresh to continue safely.
            </p>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-full bg-[#ffd66b] px-5 py-3 text-sm font-black text-[#365665]"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-[#365665] px-5 py-3 text-sm font-black text-white"
              >
                Refresh app
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
