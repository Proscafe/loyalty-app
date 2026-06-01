"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AppShell } from "@/components/AppShell";

type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  group: string;
  status: "open" | "soon" | "closed";
};

type Prediction = {
  homeScore: string;
  awayScore: string;
};

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";

const MATCHES: Match[] = [
  {
    id: "arg-fra",
    homeTeam: "Argentina",
    awayTeam: "France",
    kickoff: "Today · 6:00 PM",
    group: "World Cup · Match 01",
    status: "open",
  },
  {
    id: "bra-ger",
    homeTeam: "Brazil",
    awayTeam: "Germany",
    kickoff: "Today · 8:00 PM",
    group: "World Cup · Match 02",
    status: "open",
  },
  {
    id: "esp-ita",
    homeTeam: "Spain",
    awayTeam: "Italy",
    kickoff: "Tomorrow · 7:00 PM",
    group: "World Cup · Match 03",
    status: "soon",
  },
  {
    id: "eng-por",
    homeTeam: "England",
    awayTeam: "Portugal",
    kickoff: "Tomorrow · 9:00 PM",
    group: "World Cup · Match 04",
    status: "soon",
  },
];

function statusLabel(status: Match["status"]) {
  if (status === "open") return "Open";
  if (status === "soon") return "Coming";
  return "Closed";
}

export default function WorldCupPredictionsPage() {
  const [predictions, setPredictions] = useState<Record<string, Prediction>>(() =>
    Object.fromEntries(MATCHES.map((match) => [match.id, { homeScore: "", awayScore: "" }])),
  );
  const [submittedMatch, setSubmittedMatch] = useState<string | null>(null);

  const completedCount = useMemo(
    () =>
      MATCHES.filter((match) => {
        const prediction = predictions[match.id];

        return prediction?.homeScore !== "" && prediction?.awayScore !== "";
      }).length,
    [predictions],
  );

  function updateScore(matchId: string, side: keyof Prediction, value: string) {
    const cleaned = value.replace(/[^0-9]/g, "").slice(0, 2);

    setPredictions((current) => ({
      ...current,
      [matchId]: {
        ...current[matchId],
        [side]: cleaned,
      },
    }));
  }

  function submitPrediction(matchId: string) {
    const prediction = predictions[matchId];

    if (!prediction?.homeScore || !prediction?.awayScore) return;

    setSubmittedMatch(matchId);

    window.setTimeout(() => {
      setSubmittedMatch(null);
    }, 1800);
  }

  return (
    <AppShell title="Predictions" pageBackground={PAGE_BG}>
      <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-12 pt-5 font-raleway text-white">
        <section
          className="relative mb-5 overflow-hidden border border-white/20 px-5 py-5 shadow-[0_24px_70px_rgba(35,48,39,0.22)] backdrop-blur-2xl"
          style={{ borderRadius: 22, background: GLASS_CARD, minHeight: 170 }}
        >
          <Image
            src="/client-main-card.png"
            alt=""
            width={420}
            height={210}
            priority
            className="pointer-events-none absolute inset-0 h-full w-[128%] translate-x-8 scale-[1.06] object-cover object-right opacity-50"
          />

          <div className="relative z-10">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.34em] text-white/80">
              Pro&apos;s World Cup
            </p>

            <h1 className="text-[33px] font-black leading-[0.98] tracking-[-0.04em] text-white">
              Match
              <br />
              <span className="text-[#ffd66b]">Predictions</span>
            </h1>

            <p className="mt-4 max-w-[310px] text-[13px] font-semibold leading-5 text-white/72">
              Scan the QR code in the restaurant, sign in, and predict the score before kickoff.
            </p>
          </div>
        </section>

        <section
          className="mb-5 grid grid-cols-3 gap-2 border border-white/16 p-3 shadow-[0_18px_50px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
          style={{ borderRadius: 24, background: GLASS_CARD }}
        >
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/52">
              Games
            </div>
            <div className="mt-1 text-[22px] font-black text-[#ffd66b]">4</div>
          </div>

          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/52">
              Open
            </div>
            <div className="mt-1 text-[22px] font-black text-[#ffd66b]">2</div>
          </div>

          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/52">
              Filled
            </div>
            <div className="mt-1 text-[22px] font-black text-[#ffd66b]">
              {completedCount}
            </div>
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[22px] font-black leading-none text-white">Today&apos;s Games</h2>
          <div className="rounded-full bg-[#ffd66b]/16 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd66b]">
            QR Only
          </div>
        </div>

        <section className="space-y-4">
          {MATCHES.map((match) => {
            const prediction = predictions[match.id];
            const canSubmit =
              match.status === "open" && prediction.homeScore !== "" && prediction.awayScore !== "";
            const isSubmitted = submittedMatch === match.id;

            return (
              <article
                key={match.id}
                className="border border-white/20 p-4 shadow-[0_18px_54px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
                style={{ borderRadius: 26, background: GLASS_CARD }}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                      {match.group}
                    </div>
                    <div className="mt-1 text-[12px] font-bold text-white/68">
                      {match.kickoff}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                      match.status === "open"
                        ? "bg-[#ffd66b] text-[#365665]"
                        : "bg-white/14 text-white/68"
                    }`}
                  >
                    {statusLabel(match.status)}
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <TeamScoreInput
                    team={match.homeTeam}
                    value={prediction.homeScore}
                    disabled={match.status !== "open"}
                    onChange={(value) => updateScore(match.id, "homeScore", value)}
                  />

                  <div className="pt-7 text-[13px] font-black uppercase tracking-[0.18em] text-white/52">
                    VS
                  </div>

                  <TeamScoreInput
                    team={match.awayTeam}
                    value={prediction.awayScore}
                    disabled={match.status !== "open"}
                    onChange={(value) => updateScore(match.id, "awayScore", value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => submitPrediction(match.id)}
                  disabled={!canSubmit}
                  className={`mt-4 h-12 w-full rounded-full text-[12px] font-black uppercase tracking-[0.14em] transition ${
                    canSubmit
                      ? "bg-[#ffd66b] text-[#365665] shadow-[0_14px_30px_rgba(255,214,107,0.2)] active:scale-[0.99]"
                      : "bg-white/12 text-white/40"
                  }`}
                >
                  {isSubmitted
                    ? "Prediction saved"
                    : match.status === "open"
                      ? "Submit prediction"
                      : "Not open yet"}
                </button>
              </article>
            );
          })}
        </section>

        <p className="mt-5 rounded-3xl border border-white/18 bg-white/10 px-4 py-4 text-center text-[12px] font-semibold leading-5 text-white/62 backdrop-blur-xl">
          This page is hidden from the loyalty app. Customers enter from the private QR code only.
        </p>
      </main>
    </AppShell>
  );
}

function TeamScoreInput({
  team,
  value,
  disabled,
  onChange,
}: {
  team: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 truncate text-center text-[15px] font-black text-white">
        {team}
      </div>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        className="h-16 w-full rounded-3xl border border-white/20 bg-white/88 text-center text-[28px] font-black tabular-nums text-[#365665] outline-none placeholder:text-[#365665]/30 disabled:bg-white/16 disabled:text-white/38"
      />
    </label>
  );
}
