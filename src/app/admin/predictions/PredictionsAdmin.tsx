"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, HTMLAttributes } from "react";
import { AppShell } from "@/components/AppShell";
import type { Profile } from "@/types";

type SportType = "football" | "basketball";
type MatchFilter = "all" | "today" | "week" | "month" | "ended";

type Tournament = {
  id: string;
  name: string;
  sport_type: SportType;
  created_at?: string | null;
};

type PredictionMatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  match_label: string | null;
  venue: string | null;
  kickoff_at: string;
  opens_at: string;
  closes_at: string;
  home_score: number | null;
  away_score: number | null;
  secret_code: string;
  is_active: boolean;
  created_at: string;
  sport_type?: SportType | string | null;
  tournament_id?: string | null;
  tournament_name?: string | null;
  prediction_tournaments?: {
    id?: string | null;
    name?: string | null;
    sport_type?: SportType | string | null;
  } | null;
};

type MatchForm = {
  home_team: string;
  away_team: string;
  sport_type: SportType;
  tournament_id: string;
  match_label: string;
  venue: string;
  kickoff_at: string;
  opens_at: string;
  closes_at: string;
  home_score: string;
  away_score: string;
};

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";

function localValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toLocalInputValue(value?: string | null) {
  if (!value) return "";

  const cleanValue = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(cleanValue)) {
    return cleanValue.slice(0, 16);
  }

  const date = new Date(cleanValue);
  if (Number.isNaN(date.getTime())) return "";

  return localValue(date);
}

function toPredictionDatePayloadValue(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toISOString();
}

function makeDefaultForm(): MatchForm {
  const now = new Date();
  const kickoff = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const opens = new Date(kickoff.getTime() - 20 * 60 * 1000);
  const closes = new Date(kickoff.getTime() + 10 * 60 * 1000);

  return {
    home_team: "",
    away_team: "",
    sport_type: "football",
    tournament_id: "",
    match_label: "",
    venue: "",
    kickoff_at: localValue(kickoff),
    opens_at: localValue(opens),
    closes_at: localValue(closes),
    home_score: "",
    away_score: "",
  };
}

function inferSportType(match: PredictionMatchRow): SportType {
  const text = `${match.sport_type ?? ""} ${match.match_label ?? ""} ${match.venue ?? ""}`.toLowerCase();
  return text.includes("basket") ? "basketball" : "football";
}

function formFromMatch(match: PredictionMatchRow): MatchForm {
  return {
    home_team: match.home_team ?? "",
    away_team: match.away_team ?? "",
    sport_type: inferSportType(match),
    tournament_id: match.tournament_id ?? match.prediction_tournaments?.id ?? "",
    match_label: match.match_label || (inferSportType(match) === "basketball" ? "Basket" : "World Cup"),
    venue: match.venue ?? "",
    kickoff_at: toLocalInputValue(match.kickoff_at),
    opens_at: toLocalInputValue(match.opens_at),
    closes_at: toLocalInputValue(match.closes_at),
    home_score: match.home_score === null || match.home_score === undefined ? "" : String(match.home_score),
    away_score: match.away_score === null || match.away_score === undefined ? "" : String(match.away_score),
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function matchStatus(match: PredictionMatchRow) {
  const now = Date.now();
  const open = new Date(match.opens_at).getTime();
  const close = new Date(match.closes_at).getTime();

  if (!match.is_active) return "Inactive";
  if (Number.isFinite(open) && now < open) return "Coming";
  if (Number.isFinite(close) && now > close) return "Closed";
  return "Open";
}

function localDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isMatchInFilter(match: PredictionMatchRow, filter: MatchFilter) {
  if (filter === "all") return true;
  if (filter === "ended") return matchStatus(match).toLowerCase() === "closed";

  const kickoff = new Date(match.kickoff_at);

  if (Number.isNaN(kickoff.getTime())) return false;

  const todayStart = localDayStart(new Date());
  const matchDayStart = localDayStart(kickoff);

  if (filter === "today") {
    return matchDayStart.getTime() === todayStart.getTime();
  }

  const end = new Date(todayStart);
  end.setDate(todayStart.getDate() + (filter === "week" ? 7 : 31));

  return matchDayStart >= todayStart && matchDayStart < end;
}

function gameDetailsHref(matchId: string) {
  return `/admin/game-links/${matchId}`;
}

export function PredictionsAdmin({
  profile,
  initialMatches,
}: {
  profile: Profile;
  initialMatches: PredictionMatchRow[];
}) {
  const normalizedMatches = initialMatches.map((match) => ({
    ...match,
    venue: match.venue ?? null,
    home_score: match.home_score ?? null,
    away_score: match.away_score ?? null,
  }));

  const [matches, setMatches] = useState(normalizedMatches);
  const [form, setForm] = useState<MatchForm>(makeDefaultForm);
  const [editForms, setEditForms] = useState<Record<string, MatchForm>>(() =>
    Object.fromEntries(normalizedMatches.map((match) => [match.id, formFromMatch(match)])),
  );
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [expandedMatchIds, setExpandedMatchIds] = useState<Set<string>>(() => new Set());
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [saving, setSaving] = useState(false);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [downloadingQrId, setDownloadingQrId] = useState<string | null>(null);
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PredictionMatchRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const createTournamentOptions = useMemo(
    () => tournaments.filter((tournament) => tournament.sport_type === form.sport_type),
    [form.sport_type, tournaments],
  );

  const filteredMatches = useMemo(
    () => matches.filter((match) => isMatchInFilter(match, matchFilter)),
    [matchFilter, matches],
  );

  useEffect(() => {
    let active = true;

    async function loadTournaments() {
      try {
        const response = await fetch("/api/admin/prediction-tournaments");
        const text = await response.text();
        const json = text ? (JSON.parse(text) as { tournaments?: Tournament[]; error?: string }) : {};

        if (!response.ok) {
          setToast(json.error ?? "Could not load tournaments.");
          return;
        }

        if (active) {
          setTournaments(json.tournaments ?? []);
        }
      } catch (error) {
        if (active) {
          setToast(error instanceof Error ? error.message : "Could not load tournaments.");
        }
      }
    }

    void loadTournaments();

    return () => {
      active = false;
    };
  }, []);

  function linkFor(secretCode: string) {
    return `/predict/${secretCode}`;
  }

  function absoluteLinkFor(secretCode: string) {
    if (typeof window === "undefined") return `/predict/${secretCode}`;

    return `${window.location.origin}/predict/${secretCode}`;
  }

  function qrUrl(secretCode: string) {
    const link = absoluteLinkFor(secretCode);

    return `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&margin=16&data=${encodeURIComponent(
      link,
    )}`;
  }

  function updateCreateForm(patch: Partial<MatchForm>) {
    setForm((current) => ({
      ...current,
      ...patch,
      tournament_id:
        patch.sport_type && patch.sport_type !== current.sport_type ? "" : patch.tournament_id ?? current.tournament_id,
    }));
  }

  function updateEditForm(matchId: string, patch: Partial<MatchForm>) {
    setEditForms((current) => {
      const currentForm = current[matchId] ?? makeDefaultForm();

      return {
        ...current,
        [matchId]: {
          ...currentForm,
          ...patch,
          tournament_id:
            patch.sport_type && patch.sport_type !== currentForm.sport_type
              ? ""
              : patch.tournament_id ?? currentForm.tournament_id,
        },
      };
    });
  }

  function toggleMatch(matchId: string) {
    setExpandedMatchIds((current) => {
      const next = new Set(current);

      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }

      return next;
    });
  }

  function setKickoffWithDefaultWindow(value: string) {
    setForm((current) => {
      if (!value) return { ...current, kickoff_at: "", opens_at: "", closes_at: "" };

      const kickoff = new Date(value);
      if (Number.isNaN(kickoff.getTime())) return { ...current, kickoff_at: value };

      return {
        ...current,
        kickoff_at: value,
        opens_at: localValue(new Date(kickoff.getTime() - 20 * 60 * 1000)),
        closes_at: localValue(new Date(kickoff.getTime() + 10 * 60 * 1000)),
      };
    });
  }

  function buildPayload(matchForm: MatchForm) {
    return {
      ...matchForm,
      tournament_id: matchForm.tournament_id || null,
      sport_type: matchForm.sport_type,
      match_label:
        matchForm.match_label.trim() || (matchForm.sport_type === "basketball" ? "Basket" : "World Cup"),
      venue: matchForm.venue.trim() || null,
      kickoff_at: toPredictionDatePayloadValue(matchForm.kickoff_at),
      opens_at: toPredictionDatePayloadValue(matchForm.opens_at),
      closes_at: toPredictionDatePayloadValue(matchForm.closes_at),
      home_score: matchForm.home_score,
      away_score: matchForm.away_score,
    };
  }

  async function createMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.home_team.trim() || !form.away_team.trim()) {
      setToast("Add both teams first.");
      return;
    }

    setSaving(true);
    setToast(null);

    try {
      const response = await fetch("/api/admin/prediction-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });

      const responseText = await response.text();

      let json: {
        match?: PredictionMatchRow;
        error?: string;
      } = {};

      try {
        json = responseText
          ? (JSON.parse(responseText) as {
              match?: PredictionMatchRow;
              error?: string;
            })
          : {};
      } catch {
        json = {
          error: `Invalid server response (${response.status}). Check that src/app/api/admin/prediction-matches/route.ts exists, then restart npm run dev.`,
        };
      }

      if (!response.ok || !json.match) {
        setToast(json.error ?? `Could not create match. Status ${response.status}`);
        return;
      }

      const nextMatch = {
        ...json.match,
        venue: json.match.venue ?? null,
        home_score: json.match.home_score ?? null,
        away_score: json.match.away_score ?? null,
      };

      setMatches((current) => [nextMatch, ...current]);
      setEditForms((current) => ({
        ...current,
        [nextMatch.id]: formFromMatch(nextMatch),
      }));
      setForm(makeDefaultForm());
      setCreateFormOpen(false);
      setToast("Prediction match created.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not create match.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMatch(matchId: string) {
    const matchForm = editForms[matchId];

    if (!matchForm) return;

    if (!matchForm.home_team.trim() || !matchForm.away_team.trim()) {
      setToast("Add both teams first.");
      return;
    }

    setSavingMatchId(matchId);
    setToast(null);

    try {
      const response = await fetch("/api/admin/prediction-matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: matchId,
          ...buildPayload(matchForm),
        }),
      });

      const responseText = await response.text();

      let json: {
        match?: PredictionMatchRow;
        error?: string;
      } = {};

      try {
        json = responseText
          ? (JSON.parse(responseText) as {
              match?: PredictionMatchRow;
              error?: string;
            })
          : {};
      } catch {
        json = {
          error: `Invalid server response (${response.status}). Check the prediction-matches API route.`,
        };
      }

      if (!response.ok || !json.match) {
        setToast(json.error ?? `Could not save match. Status ${response.status}`);
        return;
      }

      const nextMatch = {
        ...json.match,
        venue: json.match.venue ?? null,
        home_score: json.match.home_score ?? null,
        away_score: json.match.away_score ?? null,
      };

      setMatches((current) =>
        current.map((match) => (match.id === matchId ? nextMatch : match)),
      );
      setEditForms((current) => ({
        ...current,
        [matchId]: formFromMatch(nextMatch),
      }));
      setToast("Game updated.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not save match.");
    } finally {
      setSavingMatchId(null);
    }
  }

  async function copyLink(secretCode: string) {
    const link = absoluteLinkFor(secretCode);

    await navigator.clipboard.writeText(link);
    setToast("Private prediction link copied.");
  }

  async function downloadQr(match: PredictionMatchRow) {
    setDownloadingQrId(match.id);
    setToast(null);

    try {
      const response = await fetch(qrUrl(match.secret_code));
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = `${match.home_team}-vs-${match.away_team}-qr.png`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setToast("QR downloaded.");
    } catch (error) {
      if (typeof window !== "undefined") {
        window.open(qrUrl(match.secret_code), "_blank", "noopener,noreferrer");
      }
      setToast(error instanceof Error ? error.message : "Opened QR in a new tab.");
    } finally {
      setDownloadingQrId(null);
    }
  }

  async function deleteMatch(matchId: string) {
    setDeletingMatchId(matchId);
    setToast(null);

    try {
      const response = await fetch("/api/admin/prediction-matches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: matchId }),
      });

      const responseText = await response.text();

      let json: {
        success?: boolean;
        error?: string;
      } = {};

      try {
        json = responseText
          ? (JSON.parse(responseText) as {
              success?: boolean;
              error?: string;
            })
          : {};
      } catch {
        json = {
          error: `Invalid server response (${response.status}). Check the prediction-matches API route.`,
        };
      }

      if (!response.ok || !json.success) {
        setToast(json.error ?? `Could not delete game. Status ${response.status}`);
        return;
      }

      setMatches((current) => current.filter((match) => match.id !== matchId));
      setEditForms((current) => {
        const next = { ...current };
        delete next[matchId];
        return next;
      });
      setExpandedMatchIds((current) => {
        const next = new Set(current);
        next.delete(matchId);
        return next;
      });
      setDeleteCandidate(null);
      setToast("Game deleted.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not delete game.");
    } finally {
      setDeletingMatchId(null);
    }
  }

  return (
    <AppShell title="Predictions" role={profile.role} pageBackground={PAGE_BG}>
      <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-12 pt-5 font-raleway text-white">
        {toast ? (
          <div className="mb-4 rounded-2xl border border-[#ffd66b]/45 bg-[#ffd66b]/20 px-4 py-3 text-[12px] font-black leading-5 text-[#ffd66b] shadow-[0_14px_35px_rgba(0,0,0,0.14)]">
            {toast}
          </div>
        ) : null}

        <form
          onSubmit={createMatch}
          className="mb-4 space-y-3 p-4 shadow-[0_18px_54px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
          style={{ borderRadius: 24, background: GLASS_CARD }}
        >
          <button
            type="button"
            onClick={() => setCreateFormOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-4 text-left"
            aria-expanded={createFormOpen}
          >
            <h1 className="text-[29px] font-black leading-none tracking-[-0.04em] text-white">
              Create <span className="text-[#ffd66b]">Game Link</span>
            </h1>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/14 text-[22px] font-black text-white">
              {createFormOpen ? "−" : "+"}
            </span>
          </button>

          {createFormOpen ? (
            <div className="space-y-3 pt-2">
              <div>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/54">
                  Sport
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(["football", "basketball"] as SportType[]).map((sport) => (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => updateCreateForm({ sport_type: sport })}
                      className={`h-11 rounded-full text-[11px] font-black uppercase tracking-[0.14em] transition ${
                        form.sport_type === sport
                          ? "bg-[#ffd66b] text-[#365665]"
                          : "bg-white/10 text-white/72"
                      }`}
                    >
                      {sport === "football" ? "Football" : "Basketball"}
                    </button>
                  ))}
                </div>
              </div>

              <PredictionSelect
                label="Tournament"
                value={form.tournament_id}
                onChange={(value) => updateCreateForm({ tournament_id: value })}
                options={createTournamentOptions.map((tournament) => ({
                  value: tournament.id,
                  label: tournament.name,
                }))}
                placeholder="No tournament"
              />

              <div className="grid grid-cols-2 gap-3">
                <PredictionInput
                  label="Home team"
                  value={form.home_team}
                  onChange={(value) => updateCreateForm({ home_team: value })}
                />
                <PredictionInput
                  label="Away team"
                  value={form.away_team}
                  onChange={(value) => updateCreateForm({ away_team: value })}
                />
              </div>

              <PredictionInput
                label="Description"
                value={form.venue}
                onChange={(value) => updateCreateForm({ venue: value })}
              />

              <PredictionInput
                label="Match label"
                value={form.match_label}
                onChange={(value) => updateCreateForm({ match_label: value })}
              />

              <PredictionDateInput
                label="Match timing"
                value={form.kickoff_at}
                onChange={setKickoffWithDefaultWindow}
              />

              <div className="grid grid-cols-2 gap-3">
                <PredictionDateInput
                  label="Open time"
                  value={form.opens_at}
                  onChange={(value) => updateCreateForm({ opens_at: value })}
                />
                <PredictionDateInput
                  label="Close time"
                  value={form.closes_at}
                  onChange={(value) => updateCreateForm({ closes_at: value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <PredictionInput
                  label="Home score"
                  value={form.home_score}
                  inputMode="numeric"
                  onChange={(value) => updateCreateForm({ home_score: value })}
                />
                <PredictionInput
                  label="Away score"
                  value={form.away_score}
                  inputMode="numeric"
                  onChange={(value) => updateCreateForm({ away_score: value })}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="h-12 w-full rounded-full bg-[#ffd66b] text-[12px] font-black uppercase tracking-[0.14em] text-[#365665] disabled:opacity-60"
              >
                {saving ? "Creating..." : "Create game link"}
              </button>
            </div>
          ) : null}
        </form>

        <div
          className="mb-4 p-2 shadow-[0_16px_42px_rgba(35,48,39,0.13)] backdrop-blur-2xl"
          style={{ borderRadius: 999, background: GLASS_CARD }}
        >
          <div className="grid grid-cols-5 gap-1.5">
            {(["all", "today", "week", "month", "ended"] as MatchFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setMatchFilter(filter)}
                className={`h-10 rounded-full text-[10px] font-black uppercase tracking-[0.12em] transition ${
                  matchFilter === filter
                    ? "bg-[#ffd66b] text-[#365665]"
                    : "bg-white/10 text-white/68"
                }`}
              >
                {filter === "all" ? "All" : filter === "today" ? "Today" : filter === "week" ? "This week" : filter === "month" ? "This month" : "Ended"}
              </button>
            ))}
          </div>
        </div>

        <section className="space-y-4">
          {filteredMatches.map((match) => {
            const status = matchStatus(match);
            const link = linkFor(match.secret_code);
            const currentForm = editForms[match.id] ?? formFromMatch(match);
            const editTournamentOptions = tournaments.filter(
              (tournament) => tournament.sport_type === currentForm.sport_type,
            );
            const tournamentName =
              match.tournament_name ?? match.prediction_tournaments?.name ?? null;

            return (
              <article
                key={match.id}
                className="border border-white/20 p-4 shadow-[0_18px_54px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
                style={{ borderRadius: 24, background: GLASS_CARD }}
              >
                <div className="mb-4 flex w-full items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = gameDetailsHref(match.id);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                      {match.match_label || (inferSportType(match) === "basketball" ? "Basket" : "World Cup")}
                    </div>
                    <div className="mt-1 truncate text-[20px] font-black text-white">
                      {match.home_team} <span className="text-[#ffd66b]">vs</span> {match.away_team}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold leading-5 text-white/62">
                      Kickoff {formatDate(match.kickoff_at)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/54">
                      <span>{inferSportType(match)}</span>
                      {tournamentName ? <span>• {tournamentName}</span> : null}
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                        status === "Open"
                          ? "bg-[#ffd66b] text-[#365665]"
                          : "bg-white/14 text-white/68"
                      }`}
                    >
                      {status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteCandidate(match)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/18 text-[15px] font-black text-red-100 ring-1 ring-red-200/20"
                      aria-label="Delete game"
                      title="Delete game"
                    >
                      ×
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMatch(match.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-[16px] font-black text-white/72"
                      aria-label={expandedMatchIds.has(match.id) ? "Collapse edit" : "Edit game"}
                      title="Edit game"
                    >
                      {expandedMatchIds.has(match.id) ? "−" : "✎"}
                    </button>
                  </div>
                </div>

                {expandedMatchIds.has(match.id) ? (
                  <div className="space-y-3 rounded-[20px] bg-white/10 p-3">
                    <div>
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/54">
                        Sport
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {(["football", "basketball"] as SportType[]).map((sport) => (
                          <button
                            key={sport}
                            type="button"
                            onClick={() => updateEditForm(match.id, { sport_type: sport })}
                            className={`h-10 rounded-full text-[10px] font-black uppercase tracking-[0.14em] transition ${
                              currentForm.sport_type === sport
                                ? "bg-[#ffd66b] text-[#365665]"
                                : "bg-white/10 text-white/72"
                            }`}
                          >
                            {sport === "football" ? "Football" : "Basketball"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <PredictionSelect
                      label="Tournament"
                      value={currentForm.tournament_id}
                      onChange={(value) => updateEditForm(match.id, { tournament_id: value })}
                      options={editTournamentOptions.map((tournament) => ({
                        value: tournament.id,
                        label: tournament.name,
                      }))}
                      placeholder="No tournament"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <PredictionInput
                        label="Home team"
                        value={currentForm.home_team}
                        onChange={(value) => updateEditForm(match.id, { home_team: value })}
                      />
                      <PredictionInput
                        label="Away team"
                        value={currentForm.away_team}
                        onChange={(value) => updateEditForm(match.id, { away_team: value })}
                      />
                    </div>

                    <PredictionInput
                      label="Description"
                      value={currentForm.venue}
                      onChange={(value) => updateEditForm(match.id, { venue: value })}
                    />

                    <PredictionInput
                      label="Match label"
                      value={currentForm.match_label}
                      onChange={(value) => updateEditForm(match.id, { match_label: value })}
                    />

                    <PredictionDateInput
                      label="Match timing"
                      value={currentForm.kickoff_at}
                      onChange={(value) => updateEditForm(match.id, { kickoff_at: value })}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <PredictionDateInput
                        label="Open time"
                        value={currentForm.opens_at}
                        onChange={(value) => updateEditForm(match.id, { opens_at: value })}
                      />
                      <PredictionDateInput
                        label="Close time"
                        value={currentForm.closes_at}
                        onChange={(value) => updateEditForm(match.id, { closes_at: value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <PredictionInput
                        label="Home score"
                        value={currentForm.home_score}
                        inputMode="numeric"
                        onChange={(value) => updateEditForm(match.id, { home_score: value })}
                      />
                      <PredictionInput
                        label="Away score"
                        value={currentForm.away_score}
                        inputMode="numeric"
                        onChange={(value) => updateEditForm(match.id, { away_score: value })}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => void saveMatch(match.id)}
                      disabled={savingMatchId === match.id}
                      className="h-11 w-full rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.12em] text-[#365665] disabled:opacity-60"
                    >
                      {savingMatchId === match.id ? "Saving..." : "Save game"}
                    </button>
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="flex h-11 items-center justify-center rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.12em] text-[#365665]"
                  >
                    Open link
                  </a>

                  <button
                    type="button"
                    onClick={() => void downloadQr(match)}
                    disabled={downloadingQrId === match.id}
                    className="h-11 rounded-full bg-white/14 text-[11px] font-black uppercase tracking-[0.12em] text-white disabled:opacity-60"
                  >
                    {downloadingQrId === match.id ? "Downloading..." : "Download QR"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void copyLink(match.secret_code)}
                  className="mt-2 h-10 w-full rounded-full bg-white/10 text-[10px] font-black uppercase tracking-[0.12em] text-white/72"
                >
                  Copy link
                </button>
              </article>
            );
          })}

          {filteredMatches.length === 0 ? (
            <div
              className="border border-white/20 p-5 text-center text-[14px] font-semibold text-white/64 backdrop-blur-2xl"
              style={{ borderRadius: 24, background: GLASS_CARD }}
            >
              No games for this filter.
            </div>
          ) : null}
        </section>
      </main>

      {deleteCandidate ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/64 px-4 font-raleway backdrop-blur-sm"
          onClick={() => {
            if (deletingMatchId !== deleteCandidate.id) {
              setDeleteCandidate(null);
            }
          }}
        >
          <div
            className="w-full max-w-sm border border-black/10 p-5 text-black shadow-[0_24px_80px_rgba(0,0,0,0.48)]"
            style={{
              borderRadius: 26,
              background: "rgba(224, 231, 219, 0.96)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#c39a18]">
              Confirm delete
            </p>
            <h2 className="mt-3 text-[24px] font-black leading-none tracking-[-0.04em] text-black">
              Delete this game?
            </h2>
            <p className="mt-3 text-[13px] font-black leading-5 text-black/78">
              This will remove {deleteCandidate.home_team} vs {deleteCandidate.away_team} and its prediction link.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={deletingMatchId === deleteCandidate.id}
                className="h-11 rounded-full border border-black/35 bg-transparent text-[11px] font-black uppercase tracking-[0.12em] text-black disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteMatch(deleteCandidate.id)}
                disabled={deletingMatchId === deleteCandidate.id}
                className="h-11 rounded-full bg-red-500 text-[11px] font-black uppercase tracking-[0.12em] text-white disabled:opacity-60"
              >
                {deletingMatchId === deleteCandidate.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function PredictionInput({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-white/54">
        {label}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-white/20 bg-white px-4 text-[13px] font-bold text-black outline-none placeholder:text-zinc-400"
      />
    </label>
  );
}

function PredictionSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-white/54">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-white/20 bg-white px-4 text-[13px] font-bold text-black outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PredictionDateInput({
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
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-white/54">
        {label}
      </span>
      <input
        type="datetime-local"
        step={60}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-white/20 bg-white px-3 text-[12px] font-bold text-black outline-none"
      />
    </label>
  );
}
