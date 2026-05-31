"use client";

import { useEffect, useRef, useState } from "react";

type FeedbackSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    id: string;
    full_name?: string | null;
    client_code?: string | null;
    email?: string | null;
  };
};

export default function FeedbackSheet({ isOpen, onClose, profile }: FeedbackSheetProps) {
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setStatus("idle");
    setDragY(0);
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    if (isOpen) window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanMessage = message.trim();
    if (!cleanMessage || !agreed || isSending) return;

    try {
      setIsSending(true);
      setStatus("idle");

      const response = await fetch("/api/client/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: cleanMessage,
          clientId: profile.id,
          clientName: profile.full_name || "Client",
          clientCode: profile.client_code || "",
          clientEmail: profile.email || "",
        }),
      });

      if (!response.ok) throw new Error("Failed to send feedback");

      setStatus("success");
      setMessage("");
      setAgreed(false);
    } catch {
      setStatus("error");
    } finally {
      setIsSending(false);
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    startYRef.current = event.clientY;
    setDragY(0);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (startYRef.current === null) return;

    const nextDragY = Math.max(0, event.clientY - startYRef.current);
    setDragY(nextDragY);
  }

  function handlePointerUp() {
    if (dragY > 90) {
      onClose();
    }

    startYRef.current = null;
    setDragY(0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" aria-modal="true" role="dialog">
      <button
        type="button"
        aria-label="Close feedback form"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-md rounded-t-[24px] bg-[#f7f2ea] px-5 pb-6 pt-3 shadow-2xl transition-transform duration-200"
        style={{
          transform: `translateY(${dragY}px)`,
          fontFamily: "Raleway, sans-serif",
        }}
      >
        <div
          className="touch-none pb-3"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-[#c8beb2]" />
        </div>

        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-black uppercase text-[#0f2b3a]">Give feedback</h2>
            <p className="mt-1 text-[14px] font-medium text-[#5f6b6f]">
              Tell us what went well or what we can improve.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-[22px] leading-none text-[#5f6b6f]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="feedback-message" className="text-[12px] font-black uppercase tracking-[0.18em] text-[#6f6a64]">
            Message
          </label>

          <textarea
            id="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            placeholder="Write your message here..."
            className="mt-2 w-full resize-none rounded-[10px] border border-[#ded6cb] bg-white px-4 py-3 text-[14px] font-medium text-[#0f2b3a] outline-none focus:border-[#92534C]"
          />

          <label className="mt-3 flex items-start gap-2 text-[11px] font-medium text-[#5f6b6f]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#92534C]"
            />
            <span>
              I agree to our friendly <span className="underline">privacy policy</span>.
            </span>
          </label>

          {status === "success" && (
            <p className="mt-3 rounded-[10px] bg-white px-4 py-3 text-[13px] font-bold text-[#2d5f46]">
              Thanks for your feedback. Your message was sent.
            </p>
          )}

          {status === "error" && (
            <p className="mt-3 rounded-[10px] bg-white px-4 py-3 text-[13px] font-bold text-[#92534C]">
              We couldn’t send your message. Please try again.
            </p>
          )}

          <button
            type="submit"
            disabled={!message.trim() || !agreed || isSending}
            className="mt-4 w-full rounded-[10px] bg-[#92534C] px-5 py-3 text-[14px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Sending…" : "Send feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}
