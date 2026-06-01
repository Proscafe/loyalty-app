"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExistingPredictionEntry, PublicPredictionMatch } from "./page";

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function messageForState(state: string) {
  if (state === "missing") return "This prediction link is not valid.";
  if (state === "inactive") return "This prediction game is inactive.";
  if (state === "not_open") return "Predictions are not open yet.";
  if (state === "closed") return "Predictions are closed.";

  return "";
}

export function PredictionPageClient({
  match,
  existingEntry,
  state,
}: {
  match: PublicPredictionMatch | null;
  existingEntry: ExistingPredictionEntry | null;
  state: "open" | "missing" | "inactive" | "not_open" | "closed";
}) {
  const router = useRouter();
  const [homeScore, setHomeScore] = useState(existingEntry?.home_score?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(existingEntry?.away_score?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(match && state === "open" && !existingEntry && homeScore !== "" && awayScore !== "");

  function cleanScore(value: string) {
    return value.replace(/[^0-9]/g, "").slice(0, 2);
  }

  async function submitPrediction() {
    if (!match || !canSubmit) return;

    setSaving(true);
    setError(null);

    const response = await fetch("/api/predictions/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: match.id,
        home_score: Number(homeScore),
        away_score: Number(awayScore),
      }),
    });

    const json = (await response.json()) as { error?: string };

    setSaving(false);

    if (!response.ok) {
      setError(json.error ?? "Could not save prediction.");
      return;
    }

    router.replace("/dashboard?prediction=saved");
  }

  return (
    <main
      className="min-h-screen px-4 pb-10 pt-8 font-raleway text-white"
      style={{ background: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-md">
        <section
          className="mb-5 border border-white/20 p-5 shadow-[0_24px_70px_rgba(35,48,39,0.22)] backdrop-blur-2xl"
          style={{ borderRadius: 26, background: GLASS_CARD }}
        >
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.34em] text-white/70">
            Pro&apos;s World Cup
          </p>

          <h1 className="text-[33px] font-black leading-[0.98] tracking-[-0.04em] text-white">
            Match
            <br />
            <span className="text-[#ffd66b]">Prediction</span>
          </h1>

          <p className="mt-4 text-[13px] font-semibold leading-5 text-white/64">
            Predict the final score. You can submit only once.
          </p>
        </section>

        {!match || state !== "open" ? (
          <section
            className="border border-white/20 p-5 text-center shadow-[0_18px_54px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
            style={{ borderRadius: 26, background: GLASS_CARD }}
          >
            <div className="text-[24px] font-black text-[#ffd66b]">
              {messageForState(state)}
            </div>
            {match ? (
              <p className="mt-3 text-[13px] font-semibold leading-5 text-white/64">
                {match.home_team} vs {match.away_team}
                <br />
                Opens {formatDate(match.opens_at)}
                <br />
                Closes {formatDate(match.closes_at)}
              </p>
            ) : null}
          </section>
        ) : (
          <section
            className="border border-white/20 p-4 shadow-[0_18px_54px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
            style={{ borderRadius: 26, background: GLASS_CARD }}
          >
            <div className="mb-5 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                {match.match_label || "World Cup"}
              </div>
              <div className="mt-2 text-[24px] font-black leading-tight text-white">
                {match.home_team}
                <br />
                <span className="text-[#ffd66b]">VS</span>
                <br />
                {match.away_team}
              </div>
              <div className="mt-3 text-[12px] font-semibold text-white/62">
                Kickoff {formatDate(match.kickoff_at)}
              </div>
            </div>

            {existingEntry ? (
              <div className="rounded-3xl border border-[#ffd66b]/24 bg-[#ffd66b]/12 p-5 text-center">
                <div className="text-[13px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                  Already submitted
                </div>
                <div className="mt-3 text-[34px] font-black tabular-nums text-white">
                  {existingEntry.home_score} - {existingEntry.away_score}
                </div>
                <button
                  type="button"
                  onClick={() => router.replace("/dashboard")}
                  className="mt-5 h-12 w-full rounded-full bg-[#ffd66b] text-[12px] font-black uppercase tracking-[0.14em] text-[#365665]"
                >
                  Back to loyalty
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <ScoreInput
                    label={match.home_team}
                    value={homeScore}
                    onChange={(value) => setHomeScore(cleanScore(value))}
                  />
                  <div className="pt-7 text-[13px] font-black uppercase tracking-[0.18em] text-white/52">
                    VS
                  </div>
                  <ScoreInput
                    label={match.away_team}
                    value={awayScore}
                    onChange={(value) => setAwayScore(cleanScore(value))}
                  />
                </div>

                {error ? (
                  <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-[12px] font-bold text-red-100">
                    {error}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void submitPrediction()}
                  disabled={!canSubmit || saving}
                  className={`mt-5 h-12 w-full rounded-full text-[12px] font-black uppercase tracking-[0.14em] transition ${
                    canSubmit
                      ? "bg-[#ffd66b] text-[#365665] shadow-[0_14px_30px_rgba(255,214,107,0.2)] active:scale-[0.99]"
                      : "bg-white/12 text-white/40"
                  }`}
                >
                  {saving ? "Saving..." : "Submit prediction"}
                </button>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 truncate text-center text-[15px] font-black text-white">
        {label}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        className="h-16 w-full rounded-3xl border border-white/20 bg-white/88 text-center text-[28px] font-black tabular-nums text-[#365665] outline-none placeholder:text-[#365665]/30"
      />
    </label>
  );
}
