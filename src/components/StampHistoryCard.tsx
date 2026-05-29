"use client";

import { useState } from "react";

type HistoryItem = {
  id: string;
  type: "stamp_added" | "gift_claimed" | "gift_approved" | string;
  category?: string | null;
  rewardName?: string | null;
  title?: string | null;
  date?: string | null;
  created_at?: string | null;
};

type StampHistoryCardProps = {
  memberId: string;
};

const CARD_RADIUS = 10;
const TITLE_COLOR = "#92534C";

export default function StampHistoryCard({ memberId }: StampHistoryCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    if (hasLoaded || isLoading) return;

    try {
      setIsLoading(true);
      setError("");

      const response = await fetch(`/api/client/history?memberId=${encodeURIComponent(memberId)}`);

      if (!response.ok) {
        throw new Error("Failed to load history");
      }

      const data = await response.json();
      setHistory(data.history ?? []);
      setHasLoaded(true);
    } catch {
      setError("We couldn’t load your history. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggle() {
    const nextOpenState = !isOpen;
    setIsOpen(nextOpenState);

    if (nextOpenState) {
      await loadHistory();
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-5">
        <h2 className="text-[28px] font-black uppercase leading-none" style={{ color: TITLE_COLOR }}>
          HISTORY
        </h2>
      </div>

      <div className="bg-white px-5 py-5" style={{ borderRadius: CARD_RADIUS }}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[18px] font-semibold uppercase text-[#0f2b3a]">Stamp history</h3>
            <p className="mt-1 text-[13px] text-[#5f6b6f]">View your previous stamps and claimed gifts.</p>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            className="shrink-0 rounded-[10px] bg-[#f0cf61] px-4 py-3 text-[13px] font-bold uppercase text-[#1c2530]"
          >
            {isOpen ? "Hide" : "View"}
          </button>
        </div>

        {isOpen && (
          <div className="mt-5 border-t border-[#e6e1d8] pt-5">
            {isLoading && <p className="text-[14px] font-medium text-[#5f6b6f]">Loading history…</p>}

            {error && (
              <div className="rounded-[10px] bg-[#fff6e6] p-4">
                <p className="text-[14px] font-medium text-[#92534C]">{error}</p>

                <button
                  type="button"
                  onClick={loadHistory}
                  className="mt-3 rounded-[10px] bg-[#f0cf61] px-4 py-3 text-[13px] font-bold uppercase text-[#1c2530]"
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoading && !error && hasLoaded && history.length === 0 && (
              <div className="rounded-[10px] bg-[#f7f2ea] p-4">
                <p className="font-semibold uppercase text-[#0f2b3a]">No history yet</p>
                <p className="mt-1 text-[14px] text-[#5f6b6f]">
                  Your stamps and gifts will appear here after your first visit.
                </p>
              </div>
            )}

            {!isLoading && !error && history.length > 0 && (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="rounded-[10px] bg-[#f7f2ea] p-4">
                    <p className="font-semibold uppercase text-[#0f2b3a]">{getHistoryTitle(item)}</p>
                    <p className="mt-1 text-[13px] text-[#5f6b6f]">{formatDate(item.date || item.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function getHistoryTitle(item: HistoryItem) {
  if (item.type === "stamp_added") {
    return `Stamp added · ${item.category || "Reward"}`;
  }

  if (item.type === "gift_claimed") {
    return `Gift claimed · ${item.rewardName || "Gift"}`;
  }

  if (item.type === "gift_approved") {
    return `Gift approved · ${item.rewardName || "Gift"}`;
  }

  return item.title || "History update";
}

function formatDate(date?: string | null) {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}
