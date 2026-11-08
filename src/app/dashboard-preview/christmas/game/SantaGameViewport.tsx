"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The AppShell has its own mobile width and padding constraints.
 * Render the playable area into document.body so position:fixed is truly
 * viewport-relative, not relative to AppShell or a transformed ancestor.
 */
export function SantaGameViewport() {
  const [mounted, setMounted] = useState(false);
  const [headerBottom, setHeaderBottom] = useState(76);

  useEffect(() => {
    setMounted(true);

    function measureHeader() {
      const headers = Array.from(document.querySelectorAll<HTMLElement>("header"));
      const header = headers.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.height > 38 && rect.height < 180 && rect.top < 90;
      });
      if (header) {
        const bottom = header.getBoundingClientRect().bottom;
        if (bottom > 45 && bottom < 180) setHeaderBottom(bottom);
      }
    }

    measureHeader();
    const raf = window.requestAnimationFrame(measureHeader);
    window.addEventListener("resize", measureHeader);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measureHeader);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      data-santa-viewport
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: `calc(100dvh - ${headerBottom}px)`,
        top: `${headerBottom}px`,
        width: "100vw",
        overflow: "hidden",
        background: "#327f8d",
        zIndex: 10,
        margin: 0,
        padding: 0,
      }}
    >
      <iframe
        title="Santa's Helper Christmas game"
        src="/christmas/santa-game/index.html"
        style={{ display: "block", width: "100%", height: "100%", border: 0, margin: 0, padding: 0 }}
        allow="fullscreen"
      />
      <Link
        href="/dashboard-preview/christmas"
        title="Back to Christmas"
        aria-label="Back to Christmas"
        className="absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-[#123a35]/90 text-white shadow-lg backdrop-blur"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </Link>
    </div>,
    document.body,
  );
}
