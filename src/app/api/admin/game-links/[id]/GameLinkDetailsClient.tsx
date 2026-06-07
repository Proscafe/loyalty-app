"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MatchRow = {
  id: string;
  sport_type?: string | null;
  home_team: string;
  away_team: string;
  match_label?: string | null;
  venue?: string | null;
  kickoff_at?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  secret_code: string;
};

type EntryRow = {
  id: string;
  client_id: string;
  home_score?: number | null;
  away_score?: number | null;
  predicted_winner?: string | null;
  predicted_margin?: number | null;
  points?: number | null;
  created_at?: string | null;
};

type GiftOption = {
  id: "dessert" | "discount" | "custom1" | "custom2";
  label: string;
  description: string;
  checked: boolean;
};

type SendGiftEmailDebugRow = {
  type?: "admin" | "winner";
  client_id?: string;
  name?: string;
  to?: string;
  email_source?: string;
  status?: "sent" | "skipped" | "failed";
  detail?: string;
};

type SendGiftResponse = {
  ok?: boolean;
  error?: string;
  rewards_created?: number;
  admin_email_sent?: boolean;
  winner_emails_sent?: number;
  winner_emails_skipped?: number;
  email_errors?: string[];
  email_debug?: SendGiftEmailDebugRow[];
  smtp_from?: string;
  smtp_configured?: boolean;
};

type EditForm = {
  sport_type: "football" | "basketball";
  home_team: string;
  away_team: string;
  match_label: string;
  venue: string;
  kickoff_at: string;
  opens_at: string;
  closes_at: string;
  home_score: string;
  away_score: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const pad = (number: number) => String(number).padStart(2, "0");
  const hours = date.getHours();
  const hour12 = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(hour12)}:${pad(date.getMinutes())} ${period}`;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toPredictionDatePayloadValue(value?: string | null) {
  const raw = String(value ?? "").trim();

  if (!raw) return "";

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return raw;

  return date.toISOString();
}

function winnerForScores(home: number, away: number) {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

function inferSportType(match: MatchRow | EditForm) {
  const text =
    `${match.sport_type ?? ""} ${match.match_label ?? ""} ${match.venue ?? ""}`.toLowerCase();

  return text.includes("basket") ? "basketball" : "football";
}

function predictionText(match: MatchRow, entry: EntryRow) {
  if (inferSportType(match) === "basketball") {
    const winner =
      entry.predicted_winner === "away"
        ? match.away_team
        : entry.predicted_winner === "home"
          ? match.home_team
          : Number(entry.home_score ?? 0) >= Number(entry.away_score ?? 0)
            ? match.home_team
            : match.away_team;

    const margin =
      entry.predicted_margin ??
      Math.max(Number(entry.home_score ?? 0), Number(entry.away_score ?? 0));

    return `${winner} by ${margin}`;
  }

  return `${entry.home_score ?? 0} - ${entry.away_score ?? 0}`;
}

function isResultSaved(match: MatchRow) {
  return (
    typeof match.home_score === "number" && typeof match.away_score === "number"
  );
}

function entryPredictedWinner(match: MatchRow, entry: EntryRow) {
  if (inferSportType(match) === "basketball") {
    if (
      entry.predicted_winner === "home" ||
      entry.predicted_winner === "away"
    ) {
      return entry.predicted_winner;
    }

    return Number(entry.home_score ?? 0) >= Number(entry.away_score ?? 0)
      ? "home"
      : "away";
  }

  return winnerForScores(
    Number(entry.home_score ?? 0),
    Number(entry.away_score ?? 0),
  );
}

function entryPredictedMargin(entry: EntryRow) {
  return Number(
    entry.predicted_margin ??
      Math.max(Number(entry.home_score ?? 0), Number(entry.away_score ?? 0)),
  );
}

function winnerCategoryForEntry(match: MatchRow, entry: EntryRow) {
  if (!isResultSaved(match)) return null;

  const actualHome = Number(match.home_score ?? 0);
  const actualAway = Number(match.away_score ?? 0);
  const actualWinner = winnerForScores(actualHome, actualAway);
  const predictedWinner = entryPredictedWinner(match, entry);

  if (actualWinner === "draw" || predictedWinner !== actualWinner) return null;

  if (inferSportType(match) === "basketball") {
    const actualMargin = Math.abs(actualHome - actualAway);
    const predictedMargin = entryPredictedMargin(entry);

    return predictedMargin === actualMargin ? "exact" : "team";
  }

  const exactScore =
    Number(entry.home_score ?? 0) === actualHome &&
    Number(entry.away_score ?? 0) === actualAway;

  return exactScore ? "exact" : "team";
}

function initialGiftOptions(sportLabel: string): GiftOption[] {
  return [
    {
      id: "dessert",
      label: "Free Dessert",
      description: `Winner in ${sportLabel} Prediction`,
      checked: true,
    },
    {
      id: "discount",
      label: "10% Discount",
      description: `Winner in ${sportLabel} Prediction`,
      checked: false,
    },
    {
      id: "custom1",
      label: "",
      description: "",
      checked: false,
    },
    {
      id: "custom2",
      label: "",
      description: "",
      checked: false,
    },
  ];
}

function predictionLinkFor(code: string) {
  const publicUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.proscafe.net";

  return `${publicUrl.replace(/\/$/, "")}/predict/${code}`;
}

function savedWinnerStorageKey(matchId: string) {
  return `proscafe:selected-gift-winners:${matchId}`;
}

function readSavedWinnerIds(matchId: string) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(savedWinnerStorageKey(matchId));
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeSavedWinnerIds(matchId: string, winnerIds: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      savedWinnerStorageKey(matchId),
      JSON.stringify(winnerIds),
    );
  } catch {
    // Ignore local storage errors. The selected winners still stay active in this session.
  }
}

function downloadQr(code: string, title: string) {
  const link = predictionLinkFor(code);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(link)}`;
  const anchor = document.createElement("a");

  anchor.href = qrUrl;
  anchor.download = `${title}-qr.png`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.click();
}

export function GameLinkDetailsClient({
  match,
  entries,
  profileNames,
}: {
  match: MatchRow;
  entries: EntryRow[];
  profileNames: Record<string, { name: string; code: string; role?: string }>;
}) {
  const sportLabel =
    inferSportType(match) === "basketball" ? "Basketball" : "Football";
  const title = `${match.home_team} vs ${match.away_team}`;
  const [homeScore, setHomeScore] = useState(String(match.home_score ?? ""));
  const [awayScore, setAwayScore] = useState(String(match.away_score ?? ""));
  const [basketWinner, setBasketWinner] = useState<"home" | "away">(
    Number(match.home_score ?? 0) >= Number(match.away_score ?? 0)
      ? "home"
      : "away",
  );
  const [basketMargin, setBasketMargin] = useState(
    match.home_score !== null || match.away_score !== null
      ? String(
          Math.max(
            Number(match.home_score ?? 0),
            Number(match.away_score ?? 0),
          ),
        )
      : "",
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    sport_type:
      inferSportType(match) === "basketball" ? "basketball" : "football",
    home_team: match.home_team,
    away_team: match.away_team,
    match_label: match.match_label ?? "",
    venue: match.venue ?? "",
    kickoff_at: toDateTimeLocal(match.kickoff_at),
    opens_at: toDateTimeLocal(match.opens_at),
    closes_at: toDateTimeLocal(match.closes_at),
    home_score: String(match.home_score ?? ""),
    away_score: String(match.away_score ?? ""),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedWinnerIds, setSelectedWinnerIds] = useState<string[]>([]);
  const [savedWinnersLoaded, setSavedWinnersLoaded] = useState(false);
  const [giftPopupOpen, setGiftPopupOpen] = useState(false);
  const [giftOptions, setGiftOptions] = useState<GiftOption[]>(() =>
    initialGiftOptions(sportLabel),
  );
  const [randomizeGifts, setRandomizeGifts] = useState(true);
  const [sendingGifts, setSendingGifts] = useState(false);
  const [sendResultPopupOpen, setSendResultPopupOpen] = useState(false);
  const [sendGiftResult, setSendGiftResult] = useState<SendGiftResponse | null>(null);

  const sortedEntries = useMemo(() => {
    return entries.slice().sort((a, b) => {
      const aProfile = profileNames[a.client_id]?.name ?? "Client";
      const bProfile = profileNames[b.client_id]?.name ?? "Client";

      return aProfile.localeCompare(bProfile);
    });
  }, [entries, profileNames]);

  const players = entries.length;

  const resultSaved = isResultSaved(match);
  const winnerGroups = useMemo(() => {
    const teamWinners: EntryRow[] = [];
    const exactWinners: EntryRow[] = [];

    entries.forEach((entry) => {
      const category = winnerCategoryForEntry(match, entry);

      if (category === "exact") {
        exactWinners.push(entry);
        return;
      }

      if (category === "team") {
        teamWinners.push(entry);
      }
    });

    return { teamWinners, exactWinners };
  }, [entries, match]);

  const correctPredictionEntries = useMemo(() => {
    const uniqueWinners = [
      ...winnerGroups.exactWinners,
      ...winnerGroups.teamWinners,
    ].filter(
      (entry, index, all) =>
        all.findIndex((item) => item.client_id === entry.client_id) === index,
    );

    return uniqueWinners.slice().sort((a, b) => {
      const aCategory = winnerCategoryForEntry(match, a) === "exact" ? 0 : 1;
      const bCategory = winnerCategoryForEntry(match, b) === "exact" ? 0 : 1;

      if (aCategory !== bCategory) return aCategory - bCategory;

      const aName = (profileNames[a.client_id]?.name ?? "Client").toLowerCase();
      const bName = (profileNames[b.client_id]?.name ?? "Client").toLowerCase();

      if (aName < bName) return -1;
      if (aName > bName) return 1;

      if (a.client_id < b.client_id) return -1;
      if (a.client_id > b.client_id) return 1;

      return 0;
    });
  }, [match, profileNames, winnerGroups]);

  const featuredWinners = useMemo(() => {
    const selectedEntries = selectedWinnerIds
      .map((clientId) =>
        correctPredictionEntries.find((entry) => entry.client_id === clientId),
      )
      .filter((entry): entry is EntryRow => Boolean(entry));

    return selectedEntries.length > 0
      ? selectedEntries
      : correctPredictionEntries.slice(0, 3);
  }, [correctPredictionEntries, selectedWinnerIds]);

  useEffect(() => {
    const validClientIds = new Set(
      correctPredictionEntries.map((entry) => entry.client_id),
    );
    const savedIds = readSavedWinnerIds(match.id)
      .filter((clientId) => validClientIds.has(clientId))
      .slice(0, 3);

    setSelectedWinnerIds(savedIds);
    setSavedWinnersLoaded(true);
  }, [correctPredictionEntries, match.id]);

  useEffect(() => {
    if (!savedWinnersLoaded) return;

    writeSavedWinnerIds(match.id, selectedWinnerIds);
  }, [match.id, savedWinnersLoaded, selectedWinnerIds]);

  function toggleWinner(clientId: string) {
    setSelectedWinnerIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : current.length >= 3
          ? [current[1], current[2], clientId].filter(Boolean)
          : [...current, clientId],
    );
  }

  function randomizeThreeGiftWinners() {
    const candidates = correctPredictionEntries.slice();

    if (candidates.length === 0) {
      setMessage("No right-team predictions available yet.");
      return;
    }

    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      const current = candidates[index];
      candidates[index] = candidates[randomIndex];
      candidates[randomIndex] = current;
    }

    setSelectedWinnerIds(
      candidates.slice(0, 3).map((entry) => entry.client_id),
    );
    setMessage(
      `Saved ${Math.min(3, candidates.length)} random winner(s) for this game.`,
    );
  }

  function updateGiftOption(
    id: GiftOption["id"],
    updates: Partial<GiftOption>,
  ) {
    setGiftOptions((current) =>
      current.map((gift) => (gift.id === id ? { ...gift, ...updates } : gift)),
    );
  }

  function setEditKickoffWithDefaultWindow(value: string) {
    setEditForm((current) => {
      if (!value) {
        return { ...current, kickoff_at: "", opens_at: "", closes_at: "" };
      }

      const kickoff = new Date(value);

      if (Number.isNaN(kickoff.getTime())) {
        return { ...current, kickoff_at: value };
      }

      const formatLocalDateTime = (date: Date) => {
        const pad = (number: number) => String(number).padStart(2, "0");

        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };

      return {
        ...current,
        kickoff_at: value,
        opens_at: formatLocalDateTime(
          new Date(kickoff.getTime() - 20 * 60 * 1000),
        ),
        closes_at: formatLocalDateTime(
          new Date(kickoff.getTime() + 10 * 60 * 1000),
        ),
      };
    });
  }

  async function deleteMatch() {
    const confirmed = window.confirm(
      `Delete ${title}? This will remove the game and its predictions.`,
    );

    if (!confirmed) return;

    const response = await fetch("/api/admin/prediction-matches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: match.id }),
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setMessage(json.error ?? "Could not delete game.");
      return;
    }

    window.location.href = "/admin?tab=Game%20Links";
  }

  async function saveEdit() {
    setEditSaving(true);
    setMessage(null);

    const response = await fetch(`/api/admin/game-links/${match.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport_type: inferSportType(editForm),
        home_team: editForm.home_team,
        away_team: editForm.away_team,
        match_label: editForm.match_label,
        venue: editForm.venue,
        kickoff_at: toPredictionDatePayloadValue(editForm.kickoff_at),
        opens_at: toPredictionDatePayloadValue(editForm.opens_at),
        closes_at: toPredictionDatePayloadValue(editForm.closes_at),
      }),
    });

    const json = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    setEditSaving(false);

    if (!response.ok) {
      setMessage(json.error ?? "Could not save game.");
      return;
    }

    window.location.reload();
  }

  async function saveResult() {
    setSaving(true);
    setMessage(null);

    const response = await fetch(`/api/admin/game-links/${match.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        inferSportType(match) === "basketball"
          ? {
              sport_type: "basketball",
              winner: basketWinner,
              margin: Number(basketMargin),
            }
          : {
              sport_type: "football",
              home_score: Number(homeScore),
              away_score: Number(awayScore),
            },
      ),
    });

    const json = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    setSaving(false);

    if (!response.ok) {
      setMessage(json.error ?? "Could not save result.");
      return;
    }

    setMessage("Result saved. Refreshing leaderboard...");
    window.location.reload();
  }

  async function sendGifts() {
    const selectedGifts = giftOptions
      .filter((gift) => gift.checked && gift.label.trim())
      .map((gift) => ({
        label: gift.label.trim(),
        description:
          gift.description.trim() || `Winner in ${sportLabel} Prediction`,
      }));

    if (selectedWinnerIds.length === 0) {
      setMessage("Select at least one winner first.");
      return;
    }

    if (selectedGifts.length === 0) {
      setMessage("Select or add at least one gift first.");
      return;
    }

    setSendingGifts(true);
    setMessage(null);

    const response = await fetch(
      `/api/admin/game-links/${match.id}/send-gifts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winner_client_ids: selectedWinnerIds,
          gifts: selectedGifts,
          randomize: randomizeGifts,
        }),
      },
    );

    const json = (await response.json().catch(() => ({}))) as SendGiftResponse;

    setSendingGifts(false);
    setGiftPopupOpen(false);

    if (!response.ok) {
      setSendGiftResult({
        ok: false,
        error: json.error ?? "Could not send gifts.",
        rewards_created: json.rewards_created ?? 0,
        admin_email_sent: json.admin_email_sent ?? false,
        winner_emails_sent: json.winner_emails_sent ?? 0,
        winner_emails_skipped: json.winner_emails_skipped ?? 0,
        email_errors: json.email_errors ?? [],
        email_debug: json.email_debug ?? [],
        smtp_from: json.smtp_from,
        smtp_configured: json.smtp_configured,
      });
      setSendResultPopupOpen(true);
      return;
    }

    setSendGiftResult(json);
    setSendResultPopupOpen(true);
    setMessage(null);
  }

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,214,107,0.24),transparent_28%),linear-gradient(135deg,#365665_0%,#263f49_48%,#798673_100%)] px-6 py-8 text-white"
      style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif" }}
    >
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin?tab=Game%20Links"
          className="mb-6 inline-flex rounded-full bg-white/12 px-4 py-2 text-[12px] font-black text-white"
        >
          ← Back
        </Link>

        <section className="rounded-[32px] border border-white/24 bg-white/10 p-6 shadow-[0_26px_70px_rgba(35,54,47,0.18)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ffd66b]">
                {sportLabel}
              </div>
              <h1 className="mt-2 text-[34px] font-black tracking-[-0.05em] text-white">
                {title}
              </h1>
              <p className="mt-2 text-[13px] font-bold text-white/64">
                {match.match_label || "Game"} · {formatDate(match.kickoff_at)}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/58">
                <span>Open: {formatDate(match.opens_at)}</span>
                <span className="text-white/28">•</span>
                <span>Close: {formatDate(match.closes_at)}</span>
                <button
                  type="button"
                  onClick={() => downloadQr(match.secret_code, title)}
                  className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-[14px] text-white"
                  title="Download QR"
                >
                  ▣
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={predictionLinkFor(match.secret_code)}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white transition hover:bg-white/20"
                title="Open prediction"
              >
                ⚡
              </a>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white"
                title="Edit game"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => void deleteMatch()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/20 text-[18px] font-black text-red-100"
                title="Delete game"
              >
                🗑
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <SmallStat label="Players" value={players} />
            <SmallStat
              label="Prediction closes"
              value={formatDate(match.closes_at)}
            />
          </div>

          {resultSaved ? (
            <div className="mt-5 rounded-[26px] border border-white/18 bg-white/8 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                    Winners
                  </div>
                  <h2 className="mt-1 text-[22px] font-black text-white">
                    Correct predictions
                  </h2>
                  <p className="mt-1 text-[12px] font-bold text-white/62">
                    Right team: {correctPredictionEntries.length} ·{" "}
                    {inferSportType(match) === "basketball"
                      ? "Right margin"
                      : "Right score"}
                    : {winnerGroups.exactWinners.length}
                  </p>
                  <p className="mt-2 text-[12px] font-bold text-[#ffd66b]">
                    Randomize 3 from the right-team users, then send gifts to
                    those selected winners.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={randomizeThreeGiftWinners}
                    disabled={correctPredictionEntries.length === 0}
                    className="rounded-full border border-[#ffd66b]/70 bg-white/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#ffd66b] disabled:opacity-45"
                    title="Randomly select 3 users from right-team predictions"
                  >
                    Randomize 3
                  </button>
                  <button
                    type="button"
                    onClick={() => setGiftPopupOpen(true)}
                    disabled={selectedWinnerIds.length === 0}
                    className="rounded-full bg-[#ffd66b] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#365665] disabled:opacity-45"
                    title="Send selected winners gifts"
                  >
                    ✦ Send Gifts
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                  Selected gift winners
                </div>
                <div className="text-[11px] font-black text-[#ffd66b]">
                  {selectedWinnerIds.length}/3 selected
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {featuredWinners.map((entry, index) => {
                  const profile = profileNames[entry.client_id];
                  const selected = selectedWinnerIds.includes(entry.client_id);
                  const colors = [
                    "border-[#ffd66b] bg-[#ffd66b]/18",
                    "border-emerald-300/70 bg-emerald-300/14",
                    "border-sky-300/70 bg-sky-300/14",
                  ];

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => toggleWinner(entry.client_id)}
                      className={`rounded-[22px] border p-4 text-left transition ${colors[index % colors.length]} ${
                        selected ? "ring-2 ring-white/80" : ""
                      }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/58">
                        Winner {index + 1}
                      </div>
                      <div className="mt-2 text-[16px] font-black text-white">
                        {profile?.name ?? "Client"}
                      </div>
                      <div className="mt-1 text-[12px] font-bold text-[#ffd66b]">
                        {predictionText(match, entry)}
                      </div>
                    </button>
                  );
                })}

                {featuredWinners.length === 0 ? (
                  <div className="rounded-[22px] border border-white/16 bg-white/10 p-4 text-[13px] font-bold text-white/60 lg:col-span-3">
                    No correct predictions yet.
                  </div>
                ) : null}
              </div>

              <div className="mt-5 rounded-[22px] border border-white/14 bg-black/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                      All right answers
                    </div>
                    <div className="mt-1 text-[12px] font-bold text-white/60">
                      These are all users who picked the right team. Right
                      margin winners are included here too.
                    </div>
                  </div>
                  <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-white">
                    {correctPredictionEntries.length}
                  </div>
                </div>

                <div className="grid gap-2 lg:grid-cols-2">
                  {correctPredictionEntries.map((entry, index) => {
                    const profile = profileNames[entry.client_id];
                    const category = winnerCategoryForEntry(match, entry);
                    const selected = selectedWinnerIds.includes(
                      entry.client_id,
                    );

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => toggleWinner(entry.client_id)}
                        className={`flex items-center justify-between gap-3 rounded-[16px] border px-3 py-3 text-left transition ${
                          selected
                            ? "border-[#ffd66b] bg-[#ffd66b]/14"
                            : "border-white/12 bg-white/7 hover:bg-white/12"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-black text-white">
                            {index + 1}. {profile?.name ?? "Client"}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-[#ffd66b]">
                            {predictionText(match, entry)}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
                          {category === "exact"
                            ? inferSportType(match) === "basketball"
                              ? "Right margin"
                              : "Right score"
                            : "Right team"}
                        </div>
                      </button>
                    );
                  })}

                  {correctPredictionEntries.length === 0 ? (
                    <div className="rounded-[16px] bg-white/7 px-4 py-5 text-center text-[12px] font-bold text-white/60 lg:col-span-2">
                      No right answers yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[28px] border border-white/24 bg-white/10 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.10)] backdrop-blur-xl">
            <h2 className="text-[22px] font-black text-white">Save Result</h2>
            <p className="mt-1 text-[12px] font-bold text-white/62">
              Save the final score to calculate winners.
            </p>

            {inferSportType(match) === "basketball" ? (
              <div className="mt-5 grid gap-3">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
                    Winner
                  </span>
                  <select
                    value={basketWinner}
                    onChange={(event) =>
                      setBasketWinner(event.target.value as "home" | "away")
                    }
                    className="h-12 w-full rounded-[14px] border border-white/20 bg-white px-3 text-[13px] font-black text-[#365665] outline-none"
                  >
                    <option value="home">{match.home_team}</option>
                    <option value="away">{match.away_team}</option>
                  </select>
                </label>

                <ResultInput
                  label="Win by"
                  value={basketMargin}
                  onChange={setBasketMargin}
                />
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <ResultInput
                  label={match.home_team}
                  value={homeScore}
                  onChange={setHomeScore}
                />
                <ResultInput
                  label={match.away_team}
                  value={awayScore}
                  onChange={setAwayScore}
                />
              </div>
            )}

            {message ? (
              <div className="mt-4 rounded-[16px] bg-white/12 px-4 py-3 text-[12px] font-black text-[#ffd66b]">
                {message}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void saveResult()}
              disabled={saving}
              className="mt-5 h-12 w-full rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.18em] text-[#365665] disabled:opacity-55"
            >
              {saving ? "Saving..." : "Save Result"}
            </button>
          </div>

          <div className="rounded-[28px] border border-white/24 bg-white/10 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.10)] backdrop-blur-xl">
            <h2 className="text-[22px] font-black text-white">Leaderboard</h2>
            <p className="mt-1 text-[12px] font-bold text-white/62">
              Names and predictions entered for this game.
            </p>

            <div className="mt-5 overflow-hidden rounded-[22px] border border-white/18 bg-white/8">
              <div
                className={`grid ${inferSportType(match) === "basketball" ? "grid-cols-[0.35fr_1fr_0.8fr]" : "grid-cols-[0.35fr_1fr_0.8fr_0.5fr]"} gap-3 border-b border-white/18 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/58`}
              >
                <div>#</div>
                <div>Name</div>
                <div>Prediction</div>
                {inferSportType(match) === "basketball" ? null : (
                  <div>Points</div>
                )}
              </div>

              {sortedEntries.map((entry, index) => {
                const profile = profileNames[entry.client_id];

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => toggleWinner(entry.client_id)}
                    className={`grid w-full ${inferSportType(match) === "basketball" ? "grid-cols-[0.35fr_1fr_0.8fr]" : "grid-cols-[0.35fr_1fr_0.8fr_0.5fr]"} gap-3 border-b border-white/10 px-4 py-3 text-left text-[12px] font-bold text-white/78 transition last:border-b-0 hover:bg-white/10 ${
                      selectedWinnerIds.includes(entry.client_id)
                        ? "bg-[#ffd66b]/12"
                        : ""
                    }`}
                  >
                    <div className="font-black text-[#ffd66b]">{index + 1}</div>
                    <div>
                      <div className="font-black text-white">
                        {profile?.name ?? "Client"}
                      </div>
                      {profile?.code ? (
                        <div className="text-[10px] text-[#ffd66b]">
                          {profile.code}
                        </div>
                      ) : null}
                    </div>
                    <div>{predictionText(match, entry)}</div>
                    {inferSportType(match) === "basketball" ? null : (
                      <div className="font-black text-white">
                        {entry.points ?? 0}
                      </div>
                    )}
                  </button>
                );
              })}

              {sortedEntries.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] font-bold text-white/60">
                  No players entered yet.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-5 backdrop-blur-sm lg:items-center lg:pb-0">
          <div className="w-full max-w-2xl rounded-[30px] border border-white/18 bg-[#61716b] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffd66b]">
                  Edit
                </div>
                <h3 className="mt-1 text-[23px] font-black tracking-[-0.04em] text-white">
                  Game details
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white"
              >
                ×
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <EditInput
                label="Home Team"
                value={editForm.home_team}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, home_team: value }))
                }
              />
              <EditInput
                label="Away Team"
                value={editForm.away_team}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, away_team: value }))
                }
              />
              <EditInput
                label="Tournament"
                value={editForm.match_label}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, match_label: value }))
                }
              />
              <EditInput
                label="Description"
                value={editForm.venue}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, venue: value }))
                }
              />
              <EditInput
                type="datetime-local"
                label="Match Timing"
                value={editForm.kickoff_at}
                onChange={setEditKickoffWithDefaultWindow}
              />
              <EditInput
                type="datetime-local"
                label="Open Time"
                value={editForm.opens_at}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, opens_at: value }))
                }
              />
              <EditInput
                type="datetime-local"
                label="Close Time"
                value={editForm.closes_at}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, closes_at: value }))
                }
              />
            </div>

            <button
              type="button"
              onClick={() => void saveEdit()}
              disabled={editSaving}
              className="mt-4 h-12 w-full rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.18em] text-[#365665] disabled:opacity-55"
            >
              {editSaving ? "Saving..." : "Save Game"}
            </button>
          </div>
        </div>
      ) : null}

      {giftPopupOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-5 backdrop-blur-sm lg:items-center lg:pb-0">
          <div className="w-full max-w-xl rounded-[30px] border border-white/18 bg-[#61716b] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffd66b]">
                  Winners gifts
                </div>
                <h3 className="mt-1 text-[23px] font-black tracking-[-0.04em] text-white">
                  Send gifts to selected winners
                </h3>
                <p className="mt-1 text-[12px] font-bold text-white/62">
                  {selectedWinnerIds.length} selected winner(s)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setGiftPopupOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {giftOptions.map((gift) => (
                <div
                  key={gift.id}
                  className="rounded-[18px] border border-white/16 bg-white/10 p-3"
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={gift.checked}
                      onChange={(event) =>
                        updateGiftOption(gift.id, {
                          checked: event.target.checked,
                        })
                      }
                      className="h-4 w-4"
                    />
                    <span className="text-[12px] font-black uppercase tracking-[0.12em] text-white">
                      {gift.id.startsWith("custom")
                        ? "Custom Gift"
                        : gift.label}
                    </span>
                  </label>

                  {gift.id.startsWith("custom") ? (
                    <div className="mt-3 grid gap-2 lg:grid-cols-2">
                      <input
                        value={gift.label}
                        onChange={(event) =>
                          updateGiftOption(gift.id, {
                            label: event.target.value,
                          })
                        }
                        placeholder="Custom gift name"
                        className="h-11 rounded-[14px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                      />
                      <input
                        value={gift.description}
                        onChange={(event) =>
                          updateGiftOption(gift.id, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Custom description"
                        className="h-11 rounded-[14px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
                      />
                    </div>
                  ) : (
                    <div className="mt-2 text-[12px] font-bold text-white/62">
                      {gift.label} — {gift.description}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <label className="mt-4 flex items-center justify-between rounded-[18px] border border-white/16 bg-white/10 px-4 py-3">
              <span className="text-[12px] font-black uppercase tracking-[0.14em] text-white">
                Randomize sending gifts
              </span>
              <input
                type="checkbox"
                checked={randomizeGifts}
                onChange={(event) => setRandomizeGifts(event.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <button
              type="button"
              onClick={() => void sendGifts()}
              disabled={sendingGifts}
              className="mt-4 h-12 w-full rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.18em] text-[#365665] disabled:opacity-55"
            >
              {sendingGifts ? "Sending..." : "Send Gifts + Email Winners File"}
            </button>
          </div>
        </div>
      ) : null}

      {sendResultPopupOpen && sendGiftResult ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={() => setSendResultPopupOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[30px] border border-white/18 bg-[#61716b] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffd66b]">
                  Send status
                </div>
                <h3 className="mt-1 text-[24px] font-black tracking-[-0.04em] text-white">
                  {sendGiftResult.ok === false ? "Action failed" : "Action completed"}
                </h3>
                <p className="mt-1 text-[12px] font-bold text-white/62">
                  Gifts can be created even when one email fails. Check the details below.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSendResultPopupOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white"
              >
                ×
              </button>
            </div>

            {sendGiftResult.error ? (
              <div className="mt-4 rounded-[18px] border border-red-200/40 bg-red-500/16 px-4 py-3 text-[12px] font-bold text-red-50">
                {sendGiftResult.error}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[18px] border border-white/14 bg-white/10 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/54">Rewards created</div>
                <div className="mt-1 text-[22px] font-black text-white">{sendGiftResult.rewards_created ?? 0}</div>
              </div>
              <div className="rounded-[18px] border border-white/14 bg-white/10 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/54">Admin email</div>
                <div className="mt-1 text-[13px] font-black text-white">{sendGiftResult.admin_email_sent ? "Sent" : "Not sent"}</div>
              </div>
              <div className="rounded-[18px] border border-white/14 bg-white/10 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/54">Winner emails sent</div>
                <div className="mt-1 text-[22px] font-black text-white">{sendGiftResult.winner_emails_sent ?? 0}</div>
              </div>
              <div className="rounded-[18px] border border-white/14 bg-white/10 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/54">Skipped / failed</div>
                <div className="mt-1 text-[22px] font-black text-white">{sendGiftResult.winner_emails_skipped ?? 0}</div>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-white/14 bg-black/10 p-4">
              <div className="grid gap-2 text-[12px] font-bold text-white/70 sm:grid-cols-2">
                <div>SMTP configured: <span className="font-black text-white">{sendGiftResult.smtp_configured === false ? "No" : "Yes"}</span></div>
                <div>Sending from: <span className="font-black text-white">{sendGiftResult.smtp_from || "—"}</span></div>
              </div>
            </div>

            {sendGiftResult.email_errors?.length ? (
              <div className="mt-4 rounded-[18px] border border-red-200/40 bg-red-500/16 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-50">Email errors</div>
                <div className="mt-2 space-y-1 text-[12px] font-bold text-red-50">
                  {sendGiftResult.email_errors.map((error, index) => (
                    <div key={`${error}-${index}`}>• {error}</div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-[18px] border border-white/14 bg-white/8">
              <div className="grid grid-cols-[0.7fr_1.2fr_0.8fr_1.6fr] gap-3 border-b border-white/12 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd66b]">
                <div>Type</div>
                <div>Name / To</div>
                <div>Status</div>
                <div>Details</div>
              </div>
              <div className="divide-y divide-white/10">
                {(sendGiftResult.email_debug ?? []).length > 0 ? (
                  (sendGiftResult.email_debug ?? []).map((row, index) => (
                    <div key={`${row.type}-${row.client_id ?? row.to}-${index}`} className="grid grid-cols-[0.7fr_1.2fr_0.8fr_1.6fr] gap-3 px-4 py-3 text-[11px] font-bold text-white/72">
                      <div className="font-black uppercase text-white">{row.type ?? "—"}</div>
                      <div className="min-w-0">
                        <div className="truncate font-black text-white">{row.name || row.to || "—"}</div>
                        <div className="truncate text-white/50">{row.to || row.client_id || "—"}</div>
                      </div>
                      <div className={row.status === "sent" ? "font-black text-emerald-200" : row.status === "failed" ? "font-black text-red-100" : "font-black text-[#ffd66b]"}>
                        {row.status ?? "—"}
                      </div>
                      <div className="break-words text-white/62">
                        {row.email_source ? `${row.email_source}: ` : ""}{row.detail || "—"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-5 text-center text-[12px] font-bold text-white/56">
                    No email debug rows returned.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSendResultPopupOpen(false)}
              className="mt-5 h-12 w-full rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.18em] text-[#365665]"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex min-h-[90px] min-w-[180px] flex-1 items-center gap-4 rounded-[999px] border border-white/22 bg-white/8 px-5 py-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffd66b] text-[18px] font-black text-[#365665]">
        {typeof value === "number" ? value : "•"}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/54">
          {label}
        </div>
        <div className="mt-1 truncate text-[16px] font-black text-white">
          {value}
        </div>
      </div>
    </div>
  );
}

function ResultInput({
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
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/[^0-9]/g, "").slice(0, 2))
        }
        inputMode="numeric"
        className="h-12 w-full rounded-[14px] border border-white/20 bg-white px-3 text-[16px] font-black text-[#365665] outline-none"
      />
    </label>
  );
}

function EditInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/58">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[14px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#365665] outline-none"
      />
    </label>
  );
}
