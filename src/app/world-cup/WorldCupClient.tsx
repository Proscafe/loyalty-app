"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";

type WinnerPick = {
  teamName: string;
  fifaRank: number;
  points: number;
};

type LeaderboardRow = {
  id: string;
  rank: number;
  name: string;
  totalPredictions: number;
  totalPoints: number;
  isCurrentUser: boolean;
};

function firstNameOnly(value?: string | null) {
  return (value || "Client").trim().split(/\s+/)[0] || "Client";
}

const FIFA_RANKED_TEAMS = [
  { rank: 1, name: "France" },
  { rank: 2, name: "Spain" },
  { rank: 3, name: "Argentina" },
  { rank: 4, name: "England" },
  { rank: 5, name: "Portugal" },
  { rank: 6, name: "Brazil" },
  { rank: 7, name: "Netherlands" },
  { rank: 8, name: "Morocco" },
  { rank: 9, name: "Belgium" },
  { rank: 10, name: "Germany" },
  { rank: 11, name: "Croatia" },
  { rank: 12, name: "Colombia" },
  { rank: 13, name: "Senegal" },
  { rank: 14, name: "Mexico" },
  { rank: 15, name: "USA" },
  { rank: 16, name: "Uruguay" },
  { rank: 17, name: "Japan" },
  { rank: 18, name: "Switzerland" },
  { rank: 19, name: "Iran" },
  { rank: 20, name: "Türkiye" },
  { rank: 21, name: "Ecuador" },
  { rank: 22, name: "Austria" },
  { rank: 23, name: "Korea Republic" },
  { rank: 24, name: "Australia" },
  { rank: 25, name: "Algeria" },
  { rank: 26, name: "Egypt" },
  { rank: 27, name: "Norway" },
  { rank: 28, name: "Panama" },
  { rank: 29, name: "Côte d’Ivoire" },
  { rank: 30, name: "Sweden" },
  { rank: 31, name: "Paraguay" },
  { rank: 32, name: "Czechia" },
  { rank: 33, name: "Scotland" },
  { rank: 34, name: "Tunisia" },
  { rank: 35, name: "DR Congo" },
  { rank: 36, name: "Uzbekistan" },
  { rank: 37, name: "Qatar" },
  { rank: 38, name: "Iraq" },
  { rank: 39, name: "South Africa" },
  { rank: 40, name: "Saudi Arabia" },
  { rank: 41, name: "Jordan" },
  { rank: 42, name: "Bosnia & Herzegovina" },
  { rank: 43, name: "Cabo Verde" },
  { rank: 44, name: "Ghana" },
  { rank: 45, name: "Curaçao" },
  { rank: 46, name: "Haiti" },
  { rank: 47, name: "New Zealand" },
];

export function WorldCupClient({
  clientName,
  stats,
  existingWinnerPick,
  leaderboard,
}: {
  clientName: string;
  stats: {
    placement: string;
    totalPoints: number;
    totalPredictions: number;
  };
  existingWinnerPick: WinnerPick | null;
  leaderboard: LeaderboardRow[];
}) {
  const [winnerPick, setWinnerPick] = useState<WinnerPick | null>(existingWinnerPick);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [savingTeam, setSavingTeam] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pickerStartY = useRef<number | null>(null);

  async function selectWinner(team: { rank: number; name: string }) {
    if (winnerPick || savingTeam) return;

    setSavingTeam(team.name);
    setError(null);

    const response = await fetch("/api/predictions/winner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_name: team.name, fifa_rank: team.rank }),
    });

    const json = (await response.json()) as {
      pick?: WinnerPick;
      error?: string;
    };

    setSavingTeam(null);

    if (!response.ok || !json.pick) {
      setError(json.error ?? "Could not save your answer.");
      return;
    }

    setWinnerPick(json.pick);
    setIsPickerOpen(false);
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
        className="min-h-screen px-4 pb-12 pt-6 font-raleway text-white"
        style={{ background: PAGE_BG }}
      >
      <div className="mx-auto w-full max-w-md font-raleway">
        <section
          className="relative mb-5 overflow-hidden px-5 py-6 shadow-[0_24px_70px_rgba(35,48,39,0.22)] backdrop-blur-2xl"
          style={{ borderRadius: 26, background: GLASS_CARD }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-28"
            style={{
              backgroundImage: "url('/WC-branding.png')",
              backgroundSize: "auto 88%",
              backgroundPosition: "right bottom",
              backgroundRepeat: "no-repeat",
            }}
          />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-raleway text-[28px] font-black uppercase leading-[1.12] tracking-[0.04em] text-white">
                Cheer,
                <br />
                Predict &amp; <span className="text-[#ffd66b]">Win</span>
              </h1>

              <p className="mt-4 max-w-[300px] text-[13px] font-black leading-5">
                <span className="text-white">Look up, scan the SCREEN QR code,</span>
                <br />
                <span className="text-[#ffd66b]">&amp; make your prediction.</span>
              </p>

              <p className="mt-3 max-w-[300px] text-[13px] font-semibold leading-5 text-white/68">
                Guess the right score &amp; earn <span className="font-black text-[#ffd66b]">3 points</span>
                <br />
                Pick the winning team &amp; earn <span className="font-black text-[#ffd66b]">1 point</span>
              </p>
            </div>

            <img
              src="/WC-logo.png"
              alt="World Cup"
              className="h-[104px] w-[88px] shrink-0 object-contain drop-shadow-[0_18px_34px_rgba(0,0,0,0.26)]"
            />
          </div>
        </section>

        <section
          className="mb-5 px-5 py-5 shadow-[0_20px_62px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
          style={{ borderRadius: 26, background: GLASS_CARD }}
        >
          <h2 className="mt-2 text-[23px] font-black leading-tight text-white">
            Who will win the World Cup?
          </h2>

          <p className="mt-2 text-[13px] font-normal leading-5 text-white/66">
            Choose your champion &amp; earn <span className="font-black text-[#ffd66b]">5 bonus points</span>.
          </p>

          <button
            type="button"
            onClick={() => {
              if (!winnerPick) setIsPickerOpen(true);
            }}
            disabled={Boolean(winnerPick)}
            className="mt-4 flex min-h-[64px] w-full items-center justify-between rounded-2xl bg-[#365665]/58 px-4 py-3 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl disabled:opacity-100"
          >
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-black">
                {winnerPick ? winnerPick.teamName : "Pick up your squad"}
              </span>
              {winnerPick ? (
                <span className="mt-1 block text-[11px] font-semibold text-white/58">
                  Locked answer
                </span>
              ) : null}
            </span>

            <span className="shrink-0 rounded-full bg-[#ffd66b] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#365665]">
              {winnerPick ? "Locked" : "Choose"}
            </span>
          </button>

          {winnerPick ? (
            <p className="mt-3 text-[11px] font-semibold leading-5 text-white/56">
              Your answer is locked &amp; can&apos;t be modified.
            </p>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-2xl bg-red-500/14 px-4 py-3 text-[12px] font-bold text-red-100">
              {error}
            </div>
          ) : null}
        </section>

        <section className="mb-6 grid grid-cols-3 gap-3">
          <StatCard label="Leaderboard Rank" value={stats.placement} />
          <StatCard label="Total points" value={stats.totalPoints} />
          <StatCard label="Total prediction" value={stats.totalPredictions} />
        </section>

        <section
          className="p-4 shadow-[0_20px_62px_rgba(35,48,39,0.18)] backdrop-blur-2xl"
          style={{ borderRadius: 26, background: GLASS_CARD }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[22px] font-black leading-none text-white">
              Leaderboard
            </h2>
            <span className="rounded-full bg-[#ffd66b]/16 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd66b]">
              Top 10
            </span>
          </div>

          <div className="space-y-3">
            {leaderboard.filter((item) => item.totalPoints > 0).map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${
                  item.isCurrentUser ? "bg-[#ffd66b]/14" : "bg-white/10"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black ${
                      index < 3 ? "bg-[#ffd66b] text-[#365665]" : "bg-white/16 text-white"
                    }`}
                  >
                    {item.rank}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-black text-white">
                      {firstNameOnly(item.name)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/46">
                      {item.totalPredictions} predictions
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[20px] font-black tabular-nums text-[#ffd66b]">
                    {item.totalPoints}
                  </div>
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/46">
                    Points
                  </div>
                </div>
              </div>
            ))}

            {leaderboard.filter((item) => item.totalPoints > 0).length === 0 ? (
              <div className="rounded-2xl bg-white/10 px-4 py-5 text-center text-[13px] font-semibold text-white/60">
                No users with points yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {isPickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/42 px-3 pb-3 font-raleway backdrop-blur-sm"
          onClick={() => setIsPickerOpen(false)}
        >
          <div
            className="max-h-[78vh] w-full max-w-md overflow-hidden font-raleway shadow-[0_-24px_70px_rgba(0,0,0,0.28)]"
            style={{
              borderRadius: 28,
              background:
                "linear-gradient(145deg, rgba(54,86,101,0.94), rgba(88,98,86,0.88))",
            }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => {
              pickerStartY.current = event.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(event) => {
              if (pickerStartY.current === null) return;

              const endY = event.changedTouches[0]?.clientY ?? pickerStartY.current;
              if (endY - pickerStartY.current > 80) {
                setIsPickerOpen(false);
              }

              pickerStartY.current = null;
            }}
          >
            <div className="sticky top-0 z-10 bg-[#365665]/82 px-5 pb-3 pt-5 backdrop-blur-xl">
              <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/26" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/52">
                  FIFA ranking
                </div>
              </div>
            </div>

            <div className="max-h-[58vh] overflow-y-auto px-5 pb-5">
              <div className="space-y-2">
                {FIFA_RANKED_TEAMS.map((team) => (
                  <button
                    key={team.name}
                    type="button"
                    onClick={() => void selectWinner(team)}
                    disabled={Boolean(savingTeam)}
                    className="flex w-full items-center justify-between rounded-2xl bg-white/12 px-4 py-3 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_22px_rgba(35,48,39,0.16)] backdrop-blur-xl disabled:opacity-60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ffd66b] text-[13px] font-black text-[#365665]">
                        {team.rank}
                      </div>
                      <span className="truncate text-[15px] font-black text-white">
                        {team.name}
                      </span>
                    </div>

                    {savingTeam === team.name ? (
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#365665]/42">
                        Saving
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </main>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="p-3 shadow-[0_14px_38px_rgba(35,48,39,0.14)] backdrop-blur-2xl"
      style={{ borderRadius: 20, background: GLASS_CARD }}
    >
      <div className="min-h-[34px] text-[8px] font-black uppercase leading-[1.25] tracking-[0.14em] text-white/54">
        {label}
      </div>
      <div className="mt-2 text-[24px] font-black tabular-nums leading-none text-[#ffd66b]">
        {value}
      </div>
    </div>
  );
}
