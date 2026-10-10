"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "proscafe_bday_name";
const DEFAULT_NAME = "name";

export default function BdayClient() {
  const [name, setName] = useState(DEFAULT_NAME);
  const [draft, setDraft] = useState(DEFAULT_NAME);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)?.trim();
      if (saved) {
        setName(saved);
        setDraft(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function startEditing() {
    setDraft(name);
    setEditing(true);
  }

  function saveName() {
    const next = draft.trim() || DEFAULT_NAME;
    setName(next);
    setDraft(next);
    setEditing(false);

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  function cancelEditing() {
    setDraft(name);
    setEditing(false);
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-black text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source
          src="/bday-client/fireworksbg-bday.mp4"
          type="video/mp4"
        />
      </video>

      <div className="absolute inset-0 bg-black/28" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.24) 46%, rgba(0,0,0,0.48) 100%)",
        }}
      />

      <section className="relative z-10 flex min-h-[100svh] items-center justify-center px-5 py-12">
        <div className="w-full max-w-[1220px] text-center">
          <h1
            className="select-none text-[clamp(42px,7.4vw,120px)] font-normal uppercase leading-[0.94] tracking-[0.015em] text-[#fff4e6]"
            style={{
              fontFamily:
                '"Bodoni MT", Didot, "Times New Roman", Georgia, serif',
              textShadow:
                "0 0 10px rgba(255,219,176,.72), 0 0 30px rgba(255,130,50,.45)",
            }}
          >
            Happy Birthday
          </h1>

          <div className="mt-5 flex min-h-[112px] items-center justify-center sm:mt-6 sm:min-h-[150px]">
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={saveName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveName();
                  if (event.key === "Escape") cancelEditing();
                }}
                maxLength={34}
                aria-label="Birthday name"
                className="w-full max-w-[900px] border-0 border-b border-white/35 bg-transparent px-3 text-center text-[clamp(58px,10vw,150px)] font-normal leading-[0.9] text-[#fff5ea] outline-none"
                style={{
                  fontFamily:
                    '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive',
                  textShadow:
                    "0 0 10px rgba(255,225,190,.85), 0 0 34px rgba(255,140,70,.48)",
                }}
              />
            ) : (
              <button
                type="button"
                onDoubleClick={startEditing}
                title="Double-click to edit the name"
                className="cursor-default border-0 bg-transparent px-3 text-[clamp(58px,10vw,150px)] font-normal leading-[0.9] text-[#fff5ea] outline-none"
                style={{
                  fontFamily:
                    '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive',
                  textShadow:
                    "0 0 10px rgba(255,225,190,.85), 0 0 34px rgba(255,140,70,.48)",
                }}
              >
                {name}
              </button>
            )}
          </div>

          <p
            className="mt-3 text-[clamp(18px,2vw,34px)] tracking-[0.28em] text-[#fff5ea]"
            style={{
              fontFamily:
                '"Bodoni MT", Didot, "Times New Roman", Georgia, serif',
              textShadow: "0 0 10px rgba(255,208,160,.4)",
            }}
          >
            from Pro&apos;s Cafe
          </p>

          <img
            src="/bday-client/logo-white.png"
            alt="Pro's Cafe"
            className="mx-auto mt-6 h-auto w-[clamp(105px,11vw,180px)] object-contain drop-shadow-[0_0_14px_rgba(255,255,255,0.32)]"
            draggable={false}
          />
        </div>
      </section>
    </main>
  );
}
