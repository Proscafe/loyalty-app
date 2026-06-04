"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import type { ExistingPredictionEntry, PublicPredictionMatch } from "./page";

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";

function parseSavedLocalTime(value?: string | null) {
  if (!value) return NaN;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? NaN : date.getTime();
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function countdownTo(value?: string | null) {
  const target = parseSavedLocalTime(value);
  const now = Date.now();

  if (!Number.isFinite(target)) return "";
  if (target <= now) return "Kickoff time";

  const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m to Kickoff`;
  if (hours > 0) return `${hours}h ${minutes}m to Kickoff`;

  return `${minutes}m to Kickoff`;
}

function getClientMatchState(match: PublicPredictionMatch | null) {
  if (!match) return "missing" as const;
  if (!match.is_active) return "inactive" as const;

  const now = Date.now();
  const open = parseSavedLocalTime(match.opens_at);
  const close = parseSavedLocalTime(match.closes_at);

  if (!Number.isFinite(open) || !Number.isFinite(close)) return "not_open" as const;
  if (now < open) return "not_open" as const;
  if (now > close) return "closed" as const;

  return "open" as const;
}

function messageForState(state: string) {
  if (state === "missing") return "This prediction link is not valid.";
  if (state === "inactive") return "This prediction game is inactive.";
  if (state === "not_open") return "Predictions are not open yet.";
  if (state === "closed") return "Predictions are closed.";

  return "";
}

function isBasketballMatch(match: PublicPredictionMatch | null) {
  return (
    match?.sport_type === "basketball" ||
    /basket|basketball/i.test(`${match?.match_label ?? ""} ${match?.venue ?? ""}`)
  );
}

function basketballEntryWinner(entry: ExistingPredictionEntry | null) {
  if (!entry) return "home" as const;
  return Number(entry.home_score ?? 0) >= Number(entry.away_score ?? 0) ? "home" : "away";
}

function basketballEntryWinBy(entry: ExistingPredictionEntry | null) {
  if (!entry) return "";
  return String(Math.max(Number(entry.home_score ?? 0), Number(entry.away_score ?? 0)));
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
  const isBasketball = isBasketballMatch(match);
  const [homeScore, setHomeScore] = useState(existingEntry?.home_score?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(existingEntry?.away_score?.toString() ?? "");
  const [basketballWinner, setBasketballWinner] = useState<"home" | "away">(
    basketballEntryWinner(existingEntry),
  );
  const [basketballWinBy, setBasketballWinBy] = useState(basketballEntryWinBy(existingEntry));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kickoffCountdown, setKickoffCountdown] = useState(() =>
    countdownTo(match?.kickoff_at),
  );
  const [liveState, setLiveState] = useState(() =>
    state === "missing" || state === "inactive" ? state : getClientMatchState(match),
  );

  useEffect(() => {
    setKickoffCountdown(countdownTo(match?.kickoff_at));
    setLiveState(state === "missing" || state === "inactive" ? state : getClientMatchState(match));

    const timer = window.setInterval(() => {
      setKickoffCountdown(countdownTo(match?.kickoff_at));
      setLiveState(state === "missing" || state === "inactive" ? state : getClientMatchState(match));
    }, 15000);

    return () => window.clearInterval(timer);
  }, [match, match?.kickoff_at, state]);

  const displayState = liveState;
  const canSubmit = Boolean(
    match &&
      displayState === "open" &&
      !existingEntry &&
      (isBasketball ? basketballWinBy !== "" : homeScore !== "" && awayScore !== ""),
  );

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
      body: JSON.stringify(
        isBasketball
          ? {
              match_id: match.id,
              predicted_winner: basketballWinner,
              predicted_margin: Number(basketballWinBy),
            }
          : {
              match_id: match.id,
              home_score: Number(homeScore),
              away_score: Number(awayScore),
            },
      ),
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
    <AppShell
      title="World Cup Predictions"
      roleLabel=""
      headerBackground="rgba(54,86,101,0.72)"
      pageBackground={PAGE_BG}
      logoSrc="/pros-logo-basic.png"
      logoAlt="PRO's Logo"
    >
      <main
        className="flex min-h-screen flex-col px-4 pb-8 pt-6 font-raleway text-white"
        style={{ background: PAGE_BG }}
      >
      <div className="mx-auto w-full max-w-md flex-1">
        <section
          className="relative mb-5 overflow-hidden border border-white/20 p-5 shadow-[0_24px_70px_rgba(35,48,39,0.22)] backdrop-blur-2xl"
          style={{ borderRadius: 26, background: GLASS_CARD }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-34"
            style={{
              backgroundImage: "url('/client-main-card.png'), url('/client main card.png')",
              backgroundSize: "cover",
              backgroundPosition: "left center",
              backgroundRepeat: "no-repeat",
            }}
          />

          <div className="relative z-10">
            <h1 className="text-[33px] font-black leading-[0.98] tracking-[-0.04em] text-white">
              Match
              <br />
              <span className="text-[#ffd66b]">Prediction</span>
            </h1>
            <p className="mt-4 max-w-[280px] text-[13px] font-bold leading-5 text-white">
              Predict the match, earn points,
              <br />
              & collect gifts in your profile.
            </p>
          </div>
        </section>

        {!match || displayState !== "open" ? (
          <section
            className="border border-white/20 px-5 py-7 text-center shadow-[0_18px_54px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
            style={{ borderRadius: 26, background: GLASS_CARD }}
          >
            {match ? (
              <>
                <div className="text-[28px] font-black uppercase leading-tight tracking-[0.02em] text-[#ffd66b]">
                  {match.home_team} <span className="text-white">VS</span> {match.away_team}
                </div>

                <div className="mt-4 text-[24px] font-black leading-tight text-white">
                  {messageForState(displayState)}
                </div>

                <div className="mt-4 text-[15px] font-black leading-6 text-[#ffd66b]">
                  {isBasketball ? kickoffCountdown.replace("Kickoff", "Tip off") : kickoffCountdown}
                  <br />
                  <span className="text-white">{formatDate(match.kickoff_at)}</span>
                </div>

                <div className="mt-3 text-[13px] font-bold leading-5 text-white/76">
                  Opens {formatDate(match.opens_at)}
                  <span className="mx-2 text-white/46">|</span>
                  Closes {formatDate(match.closes_at)}
                </div>
              </>
            ) : (
              <div className="text-[24px] font-black text-white">
                {messageForState(displayState)}
              </div>
            )}
          </section>
        ) : (
          <section
            className="border border-white/20 p-4 shadow-[0_18px_54px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
            style={{ borderRadius: 26, background: GLASS_CARD }}
          >
            <div className="mb-5 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                {isBasketball ? "BASKETBALL" : match.match_label || "World Cup"}
              </div>
              <div className="mt-3 text-[28px] font-black uppercase leading-tight tracking-[0.02em] text-[#ffd66b]">
                {match.home_team} <span className="text-white">VS</span> {match.away_team}
              </div>
              <div className="mt-3 text-[13px] font-black text-[#ffd66b]">
                {isBasketball ? kickoffCountdown.replace("Kickoff", "Tip off") : kickoffCountdown}
              </div>
              <div className="mt-1 text-[12px] font-semibold text-white/62">
                {formatDate(match.kickoff_at)}
              </div>
            </div>

            {existingEntry ? (
              <div className="rounded-3xl border border-[#ffd66b]/24 bg-[#ffd66b]/12 p-5 text-center">
                <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                  Already submitted
                </div>
                {isBasketball ? (
                  <div className="mt-3 text-[21px] font-black leading-tight text-white">
                    {(basketballEntryWinner(existingEntry) === "home"
                      ? match.home_team
                      : match.away_team)}{" "}
                    to win by <span className="text-[#ffd66b]">{basketballEntryWinBy(existingEntry)}</span>
                  </div>
                ) : (
                  <div className="mt-3 text-[34px] font-black tabular-nums text-white">
                    {existingEntry.home_score} - {existingEntry.away_score}
                  </div>
                )}
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
                {isBasketball ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <WinnerButton
                        active={basketballWinner === "home"}
                        label={match.home_team}
                        onClick={() => setBasketballWinner("home")}
                      />
                      <WinnerButton
                        active={basketballWinner === "away"}
                        label={match.away_team}
                        onClick={() => setBasketballWinner("away")}
                      />
                    </div>

                    <div className="text-center">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
                        Bonus Gift: Winning margin
                      </div>
                      <div className="mt-1 text-[13px] font-black text-[#ffd66b]">
                        WIN BY HOW MANY POINTS?
                      </div>

                      <div className="mx-auto mt-4 w-[152px]">
                        <ScoreInput
                          label=""
                          value={basketballWinBy}
                          onChange={(value) => setBasketballWinBy(cleanScore(value))}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <ScoreInput
                      label={match.home_team}
                      value={homeScore}
                      onChange={(value) => setHomeScore(cleanScore(value))}
                    />
                    <div className="flex h-14 items-center justify-center text-[13px] font-black uppercase tracking-[0.18em] text-white/72">
                      VS
                    </div>
                    <ScoreInput
                      label={match.away_team}
                      value={awayScore}
                      onChange={(value) => setAwayScore(cleanScore(value))}
                    />
                  </div>
                )}

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
        <footer className="mx-auto mt-auto w-full max-w-md pt-10 text-center text-[12px] font-semibold text-white/54">
          © Powered by{" "}
          <a
            href="https://wissamdesigns.com"
            target="_blank"
            rel="noreferrer"
            className="font-black text-[#ffd66b]"
          >
            wissamdesigns.com
          </a>
        </footer>
      </main>
    </AppShell>
  );
}

function WinnerButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex min-h-[70px] items-center gap-3 rounded-[22px] border px-4 py-4 text-left transition ${
        active
          ? "border-[#ffd66b] bg-[#ffd66b] text-[#365665] shadow-[0_14px_30px_rgba(255,214,107,0.18)]"
          : "border-white/24 bg-white/8 text-white"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          active ? "border-[#365665] bg-[#365665]" : "border-white/60 bg-transparent"
        }`}
      >
        {active ? <span className="h-2.5 w-2.5 rounded-full bg-[#ffd66b]" /> : null}
      </span>
      <span className="min-w-0 text-[15px] font-black leading-tight">
        {label}
      </span>
    </button>
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
      {label ? (
        <div className="mb-2 truncate text-center text-[11px] font-black uppercase tracking-[0.12em] text-white/62">
          {label}
        </div>
      ) : null}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        className="h-14 w-full rounded-[22px] border border-white/20 bg-white/88 text-center text-[24px] font-black tabular-nums text-[#365665] outline-none placeholder:text-[#365665]/30"
      />
    </label>
  );
}
