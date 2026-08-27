"use client";

import { useState } from "react";

export default function BirthdayRewardRepairPage() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function runRepair() {
    setRunning(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/birthday-rewards/repair", {
        method: "POST",
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.error || "Repair failed.");
      }

      setMessage(
        `Done. Added ${json.inserted ?? 0} missing birthday gifts and removed ${
          json.deleted_duplicates ?? 0
        } duplicate birthday gifts.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Repair failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#365665] px-6 py-10 text-white">
      <div className="mx-auto max-w-xl rounded-[28px] bg-white/10 p-6 backdrop-blur-xl">
        <h1 className="text-[28px] font-black">Birthday Gift Repair</h1>
        <p className="mt-2 text-[13px] font-bold text-white/70">
          Cleans duplicate birthday rewards and restores only missing gifts from
          the last 30 days. It does not send emails and does not create game
          gifts.
        </p>

        <button
          type="button"
          onClick={() => void runRepair()}
          disabled={running}
          className="mt-6 h-12 w-full rounded-full bg-[#ffd66b] text-[12px] font-black uppercase text-[#365665] disabled:opacity-50"
        >
          {running ? "Repairing..." : "Run Birthday Gift Repair"}
        </button>

        {message ? (
          <div className="mt-4 rounded-[16px] bg-white/10 px-4 py-3 text-[13px] font-black">
            {message}
          </div>
        ) : null}
      </div>
    </main>
  );
}
