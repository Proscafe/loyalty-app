"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "proscafe_bday_name";
const DEFAULT_NAME = "name";

const kidsPalette = [
  ["#ff9f1c", "#ffd44d"],
  ["#ff4fa3", "#ff89c3"],
  ["#42b7ff", "#7cd9ff"],
  ["#72d84f", "#b7ef66"],
  ["#b874ff", "#d79cff"],
  ["#ffd34d", "#fff07c"],
];

function KidsLetters({
  text,
  className,
  rotateEveryOther = false,
}: {
  text: string;
  className?: string;
  rotateEveryOther?: boolean;
}) {
  const letters = text.split("");

  return (
    <span className={className}>
      {letters.map((char, index) => {
        if (char === " ") {
          return <span key={`${char}-${index}`} className="inline-block w-[0.18em]" />;
        }

        const [from, to] = kidsPalette[index % kidsPalette.length];
        const rotation = rotateEveryOther ? (index % 2 === 0 ? -5 : 5) : index % 2 === 0 ? -2.5 : 2.5;

        return (
          <span
            key={`${char}-${index}`}
            className="inline-block"
            style={{
              transform: `rotate(${rotation}deg)`,
              marginInline: "0.012em",
              background: `linear-gradient(180deg, ${to} 0%, ${from} 72%, ${from} 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              WebkitTextStroke: "1.2px rgba(255,255,255,0.32)",
              paintOrder: "stroke fill",
              filter:
                "drop-shadow(0 5px 0 rgba(126,58,0,0.95)) drop-shadow(0 9px 0 rgba(82,35,0,0.72)) drop-shadow(0 12px 18px rgba(0,0,0,0.32))",
              textShadow:
                "0 -2px 0 rgba(255,255,255,0.45), 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

export default function BdayClient() {
  const [name, setName] = useState(DEFAULT_NAME);
  const [kidsMode, setKidsMode] = useState(false);
  const [fredokaLoaded, setFredokaLoaded] = useState(false);
  const editableRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)?.trim();
      if (saved) setName(saved);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFredoka() {
      try {
        const face = new FontFace(
          "FredokaBirthday",
          'url("/bday-client/Fredoka_SemiExpanded-Bold.ttf?v=3")',
          {
            style: "normal",
            weight: "700",
          },
        );

        const loadedFace = await face.load();

        if (cancelled) return;

        document.fonts.add(loadedFace);
        await document.fonts.load(
          '700 48px "FredokaBirthday"',
          "Birthday",
        );

        if (!cancelled) setFredokaLoaded(true);
      } catch (error) {
        console.error("Fredoka font failed to load:", error);
        if (!cancelled) setFredokaLoaded(false);
      }
    }

    loadFredoka();

    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.load();
    video.muted = true;
    video.defaultMuted = true;
    video.play().catch(() => {});
  }, [kidsMode]);

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
      <style>{`
        @font-face {
          font-family: "FredokaBirthday";
          src: url("/bday-client/Fredoka_SemiExpanded-Bold.ttf?v=3");
          font-style: normal;
          font-weight: 700;
          font-display: swap;
        }

        @font-face {
          font-family: "GreatVibesBirthday";
          src: url("/bday-client/GreatVibes-Regular.ttf?v=1") format("truetype");
          font-style: normal;
          font-weight: 400;
          font-display: swap;
        }

        .fredoka-birthday {
          font-family: "FredokaBirthday" !important;
          font-style: normal !important;
          font-weight: 700 !important;
          font-synthesis: none !important;
        }
      `}</style>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setKidsMode((current) => !current);
        }}
        aria-label="Switch birthday style"
        title={kidsMode ? "Switch to elegant style" : "Switch to kids style"}
        className={`fixed right-5 top-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border text-white backdrop-blur-md transition hover:scale-105 sm:right-7 sm:top-7 sm:h-12 sm:w-12 ${
          kidsMode
            ? "border-[#ffd66b] bg-[#ffd66b]/25"
            : "border-white/30 bg-black/20 hover:bg-black/30"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 12a4.35 4.35 0 1 0 0-8.7 4.35 4.35 0 0 0 0 8.7Zm0 2.2c-4.4 0-8 2.35-8 5.25 0 .7.55 1.25 1.25 1.25h13.5c.7 0 1.25-.55 1.25-1.25 0-2.9-3.6-5.25-8-5.25Z" />
        </svg>
      </button>

      {kidsMode && !fredokaLoaded ? (
        <div className="fixed right-5 top-[74px] z-30 rounded-full bg-red-600/90 px-3 py-1 text-[10px] font-bold text-white sm:right-7 sm:top-[82px]">
          Fredoka not loaded
        </div>
      ) : null}

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
          src={
            kidsMode
              ? "/bday-client/kidsbg.mp4"
              : "/bday-client/fireworksbg-bday.mp4"
          }
          type="video/mp4"
        />
      </video>

      <div className="pointer-events-none fixed inset-0 z-[1] bg-black/[0.02]" />

      <section className="relative z-10 flex min-h-[100svh] items-center justify-center px-5 py-10">
        <div className="w-full max-w-[1320px] text-center">
          <div className={`relative mx-auto w-full max-w-[1180px] py-10 sm:py-12 ${kidsMode ? "-translate-y-6 sm:-translate-y-10" : ""}`}>
            {!kidsMode ? (
              <div
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.62) 42%, rgba(0,0,0,0.28) 68%, rgba(0,0,0,0) 88%)",
                }}
              />
            ) : null}

            <div className="select-none">
              {kidsMode ? (
                <div className="flex items-center justify-center">
                  <img
                    src="/bday-client/bday.png"
                    alt="Happy Birthday"
                    className="h-auto w-[min(62vw,680px)] object-contain"
                    draggable={false}
                  />
                </div>
              ) : (
                <>
                  <div className="mb-1 flex items-center justify-center gap-4 sm:gap-6">
                    <span className="h-px w-[clamp(34px,5vw,88px)] bg-[#f6cf92]/80" />
                    <div
                      className="text-[clamp(20px,2.5vw,42px)] font-normal uppercase tracking-[0.55em]"
                      style={{
                        fontFamily: '"Bodoni MT", Didot, "Times New Roman", Georgia, serif',
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
                      fontFamily: '"Bodoni MT", Didot, "Times New Roman", Georgia, serif',
                      background:
                        "linear-gradient(180deg, #fffdf8 0%, #fff1d2 18%, #f6c97f 44%, #fff3d9 60%, #d98a32 82%, #8f3f12 100%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                      WebkitTextStroke: "1px rgba(255,238,205,0.9)",
                      filter: "drop-shadow(0 2px 0 rgba(77,29,7,.95))",
                    }}
                  >
                    Birthday
                  </div>
                </>
              )}
            </div>

            <div
              className={`flex min-h-[130px] items-center justify-center sm:min-h-[165px] ${
                kidsMode ? "-mt-7 sm:-mt-9" : "mt-8 sm:mt-10"
              }`}
            >
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
                className={`inline-block min-w-[220px] cursor-text border-0 bg-transparent px-4 text-[clamp(72px,12vw,190px)] leading-[0.82] text-[#fff3df] outline-none origin-center ${
                  kidsMode
                    ? "fredoka-birthday not-italic rotate-0"
                    : "font-normal italic rotate-[-4deg]"
                }`}
                style={
                  kidsMode
                    ? {
                        fontFamily: '"FredokaBirthday"',
                        fontWeight: 700,
                        letterSpacing: "-0.04em",
                        background:
                          "linear-gradient(135deg, #fff6ce 0%, #ffe67f 14%, #ffbf6f 38%, #ff9f92 64%, #ffd0af 100%)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                        WebkitTextStroke: "1.5px rgba(228,138,20,0.92)",
                        paintOrder: "stroke fill",
                        textShadow:
                          "0 -2px 0 rgba(255,255,255,0.92), 0 2px 0 rgba(255,247,231,0.78), 0 5px 0 rgba(230,145,26,0.68), 0 10px 18px rgba(0,0,0,0.22)",
                        filter: "drop-shadow(0 4px 12px rgba(255,159,74,0.18))",
                      }
                    : {
                        fontFamily: '"GreatVibesBirthday", cursive',
                        fontWeight: 400,
                        color: "#fff6e8",
                        WebkitTextStroke: "0.7px rgba(255,223,176,0.88)",
                        textShadow:
                          "0 1px 0 rgba(107,45,13,.95), 0 0 7px rgba(255,247,232,1), 0 0 18px rgba(255,190,105,.95), 0 0 36px rgba(255,111,27,.78), 0 0 58px rgba(255,72,8,.48)",
                      }
                }
              >
                {name}
              </div>
            </div>
          </div>

          <img
            src="/bday-client/logo-white.png"
            alt="Pro's Cafe"
            className={`mx-auto h-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.22)] ${
              kidsMode
                ? "mt-8 w-[clamp(72px,6.2vw,108px)] sm:mt-10"
                : "mt-24 w-[clamp(90px,7.8vw,135px)] sm:mt-28"
            }`}
            draggable={false}
          />
        </div>
      </section>
    </main>
  );
}
