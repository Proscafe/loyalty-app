"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "proscafe_bday_name";
const DEFAULT_NAME = "name";

export default function BdayClient() {
  const [name, setName] = useState(DEFAULT_NAME);
  const editableRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)?.trim();
      if (saved) setName(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;

    const play = () => {
      video.play().catch(() => {});
    };

    play();

    const events = ["loadedmetadata", "loadeddata", "canplay", "canplaythrough"];
    events.forEach((event) => video.addEventListener(event, play));

    const onVisibility = () => {
      if (!document.hidden) play();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      events.forEach((event) => video.removeEventListener(event, play));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function saveEditableName() {
    const element = editableRef.current;
    if (!element) return;

    const next = element.innerText.trim() || DEFAULT_NAME;
    element.innerText = next;
    setName(next);

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  function replayVideo() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.muted = true;
      video.play().catch(() => {});
    }
  }

  return (
    <main
      className="relative min-h-[100svh] overflow-hidden bg-black text-white"
      onPointerDown={replayVideo}
    >
      <video
        ref={videoRef}
        className="fixed inset-0 z-0 h-[100svh] w-screen object-cover"
        style={{ opacity: 0.7 }}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        controls={false}
        poster=""
        aria-hidden="true"
      >
        <source
          src="/bday-client/fireworksbg-bday.mp4"
          type="video/mp4"
        />
      </video>

      <div className="pointer-events-none fixed inset-0 z-[1] bg-black/[0.02]" />

      <section className="relative z-10 flex min-h-[100svh] items-center justify-center px-5 py-10">
        <div className="w-full max-w-[1320px] text-center">
          <div className="relative mx-auto w-full max-w-[1180px] py-10 sm:py-12">
            <div
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.62) 42%, rgba(0,0,0,0.28) 68%, rgba(0,0,0,0) 88%)",
              }}
            />

          <div className="select-none">
            <div className="mb-1 flex items-center justify-center gap-4 sm:gap-6">
              <span className="h-px w-[clamp(34px,5vw,88px)] bg-[#f6cf92]/80" />
              <div
                className="text-[clamp(20px,2.5vw,42px)] font-normal uppercase tracking-[0.55em]"
                style={{
                  fontFamily:
                    '"Bodoni MT", Didot, "Times New Roman", Georgia, serif',
                  color: "#f8dcae",
                  WebkitTextStroke: "0.4px rgba(255,243,220,0.75)",
                  textShadow:
                    "0 1px 0 rgba(92,35,10,.9), 0 0 7px rgba(255,211,150,.65), 0 0 16px rgba(255,111,24,.28)",
                }}
              >
                Happy
              </div>
              <span className="h-px w-[clamp(34px,5vw,88px)] bg-[#f6cf92]/80" />
            </div>

            <div
              className="mx-auto mt-1 text-[clamp(68px,10vw,156px)] font-normal uppercase leading-[0.82] tracking-[-0.035em]"
              style={{
                fontFamily:
                  '"Bodoni MT", Didot, "Times New Roman", Georgia, serif',
                background:
                  "linear-gradient(180deg, #fffdf8 0%, #fff1d2 18%, #f6c97f 44%, #fff3d9 60%, #d98a32 82%, #8f3f12 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextStroke: "1px rgba(255,238,205,0.9)",
                filter:
                  "drop-shadow(0 2px 0 rgba(77,29,7,.95))",
              }}
            >
              Birthday
            </div>
          </div>

          <div className="mt-4 flex min-h-[130px] items-center justify-center sm:mt-5 sm:min-h-[165px]">
            <div
              ref={editableRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onBlur={saveEditableName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  (event.currentTarget as HTMLDivElement).blur();
                }
              }}
              aria-label="Birthday name"
              title="Click the name and type to edit"
              className="inline-block min-w-[220px] cursor-text border-0 bg-transparent px-4 text-[clamp(72px,12vw,190px)] font-normal italic leading-[0.82] text-[#fff3df] outline-none rotate-[-4deg] origin-center"
              style={{
                fontFamily:
                  '"Snell Roundhand", "Segoe Script", "Brush Script MT", "URW Chancery L", cursive',
                color: "#fff6e8",
                WebkitTextStroke: "0.7px rgba(255,223,176,0.88)",
                textShadow:
                  "0 1px 0 rgba(107,45,13,.95), 0 0 7px rgba(255,247,232,1), 0 0 18px rgba(255,190,105,.95), 0 0 36px rgba(255,111,27,.78), 0 0 58px rgba(255,72,8,.48)",
              }}
            >
              {name}
            </div>
          </div>
          </div>

          <img
            src="/bday-client/logo-white.png"
            alt="Pro's Cafe"
            className="mx-auto mt-24 h-auto w-[clamp(90px,7.8vw,135px)] object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.22)] sm:mt-28"
            draggable={false}
          />
        </div>
      </section>
    </main>
  );
}
