"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { Profile } from "@/types";

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
};

type MatchForm = {
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

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";

function parseSavedDateParts(value?: string | null) {
  if (!value) return null;

  const match = String(value)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function parseSavedLocalTime(value?: string | null) {
  const parts = parseSavedDateParts(value);

  if (!parts) {
    const fallback = new Date(String(value ?? ""));
    return Number.isNaN(fallback.getTime()) ? NaN : fallback.getTime();
  }

  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0,
  ).getTime();
}

function formatSavedDate(value?: string | null) {
  const parts = parseSavedDateParts(value);

  if (!parts) return "—";

  const hour12 = parts.hour % 12 || 12;
  const ampm = parts.hour >= 12 ? "PM" : "AM";
  const minute = String(parts.minute).padStart(2, "0");

  return `${parts.month}/${parts.day}/${parts.year}, ${hour12}:${minute} ${ampm}`;
}

function localValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toLocalInputValue(value?: string | null) {
  if (!value) return "";

  // Keep the exact date/time saved in Supabase instead of shifting by browser/server timezone.
  const cleanValue = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(cleanValue)) {
    return cleanValue.slice(0, 16);
  }

  const date = new Date(cleanValue);
  if (Number.isNaN(date.getTime())) return "";

  return localValue(date);
}

function makeDefaultForm(): MatchForm {
  const now = new Date();
  const kickoff = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const opens = new Date(kickoff.getTime() - 90 * 60 * 1000);
  const closes = new Date(kickoff.getTime() - 5 * 60 * 1000);

  return {
    home_team: "",
    away_team: "",
    match_label: "World Cup",
    venue: "",
    kickoff_at: localValue(kickoff),
    opens_at: localValue(opens),
    closes_at: localValue(closes),
    home_score: "",
    away_score: "",
  };
}

function formFromMatch(match: PredictionMatchRow): MatchForm {
  return {
    home_team: match.home_team ?? "",
    away_team: match.away_team ?? "",
    match_label: match.match_label || "World Cup",
    venue: match.venue ?? "",
    kickoff_at: toLocalInputValue(match.kickoff_at),
    opens_at: toLocalInputValue(match.opens_at),
    closes_at: toLocalInputValue(match.closes_at),
    home_score: match.home_score === null || match.home_score === undefined ? "" : String(match.home_score),
    away_score: match.away_score === null || match.away_score === undefined ? "" : String(match.away_score),
  };
}

function formatDate(value: string) {
  return formatSavedDate(value);
}

function matchStatus(match: PredictionMatchRow) {
  const now = Date.now();
  const open = new Date(match.opens_at).getTime();
  const close = new Date(match.closes_at).getTime();

  if (!match.is_active) return "Inactive";
  if (now < open) return "Coming";
  if (now > close) return "Closed";
  return "Open";
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
  const [expandedMatchIds, setExpandedMatchIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [downloadingQrId, setDownloadingQrId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  function updateEditForm(matchId: string, patch: Partial<MatchForm>) {
    setEditForms((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] ?? makeDefaultForm()),
        ...patch,
      },
    }));
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

  async function createMatch(event: React.FormEvent<HTMLFormElement>) {
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
        body: JSON.stringify(form),
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
          ...matchForm,
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
    } catch {
      window.open(qrUrl(match.secret_code), "_blank", "noopener,noreferrer");
      setToast("QR opened in a new tab.");
    } finally {
      setDownloadingQrId(null);
    }
  }

  return (
    <AppShell title="Predictions" role={profile.role} pageBackground={PAGE_BG}>
      <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-12 pt-5 font-raleway text-white">
        <section
          className="mb-5 border border-white/20 p-5 shadow-[0_24px_70px_rgba(35,48,39,0.22)] backdrop-blur-2xl"
          style={{ borderRadius: 24, background: GLASS_CARD }}
        >
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.34em] text-white/70">
            Admin
          </p>
          <h1 className="text-[31px] font-black leading-none tracking-[-0.04em] text-white">
            World Cup
            <br />
            <span className="text-[#ffd66b]">Predictions</span>
          </h1>
          <p className="mt-4 text-[13px] font-semibold leading-5 text-white/64">
            Create and update private game links for customers inside the restaurant.
          </p>
        </section>

        {toast ? (
          <div className="mb-4 rounded-2xl border border-[#ffd66b]/45 bg-[#ffd66b]/20 px-4 py-3 text-[12px] font-black leading-5 text-[#ffd66b] shadow-[0_14px_35px_rgba(0,0,0,0.14)]">
            {toast}
          </div>
        ) : null}

        <form
          onSubmit={createMatch}
          className="mb-6 space-y-3 border border-white/20 p-4 shadow-[0_18px_54px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
          style={{ borderRadius: 24, background: GLASS_CARD }}
        >
          <div className="grid grid-cols-2 gap-3">
            <PredictionInput
              label="Home team"
              value={form.home_team}
              onChange={(value) => setForm((current) => ({ ...current, home_team: value }))}
            />
            <PredictionInput
              label="Away team"
              value={form.away_team}
              onChange={(value) => setForm((current) => ({ ...current, away_team: value }))}
            />
          </div>

          <PredictionInput
            label="Place"
            value={form.venue}
            onChange={(value) => setForm((current) => ({ ...current, venue: value }))}
          />

          <PredictionInput
            label="Label"
            value={form.match_label}
            onChange={(value) => setForm((current) => ({ ...current, match_label: value }))}
          />

          <PredictionDateInput
            label="Match timing"
            value={form.kickoff_at}
            onChange={(value) => setForm((current) => ({ ...current, kickoff_at: value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <PredictionDateInput
              label="Open time"
              value={form.opens_at}
              onChange={(value) => setForm((current) => ({ ...current, opens_at: value }))}
            />
            <PredictionDateInput
              label="Close time"
              value={form.closes_at}
              onChange={(value) => setForm((current) => ({ ...current, closes_at: value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PredictionInput
              label="Home score"
              value={form.home_score}
              inputMode="numeric"
              onChange={(value) => setForm((current) => ({ ...current, home_score: value }))}
            />
            <PredictionInput
              label="Away score"
              value={form.away_score}
              inputMode="numeric"
              onChange={(value) => setForm((current) => ({ ...current, away_score: value }))}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="h-12 w-full rounded-full bg-[#ffd66b] text-[12px] font-black uppercase tracking-[0.14em] text-[#365665] disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create game link"}
          </button>
        </form>

        <section className="space-y-4">
          {matches.map((match) => {
            const status = matchStatus(match);
            const link = linkFor(match.secret_code);
            const currentForm = editForms[match.id] ?? formFromMatch(match);

            return (
              <article
                key={match.id}
                className="border border-white/20 p-4 shadow-[0_18px_54px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
                style={{ borderRadius: 24, background: GLASS_CARD }}
              >
                <button
                  type="button"
                  onClick={() => toggleMatch(match.id)}
                  className="mb-4 flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                      {match.match_label || "World Cup"}
                    </div>
                    <div className="mt-1 truncate text-[20px] font-black text-white">
                      {match.home_team} <span className="text-[#ffd66b]">vs</span> {match.away_team}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold leading-5 text-white/62">
                      {match.venue ? (
                        <>
                          Place {match.venue}
                          <br />
                        </>
                      ) : null}
                      Kickoff {formatDate(match.kickoff_at)}
                    </div>
                  </div>

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
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-[16px] font-black text-white/72">
                      {expandedMatchIds.has(match.id) ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {expandedMatchIds.has(match.id) ? (
                  <div className="space-y-3 rounded-[20px] bg-white/10 p-3">
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
                    label="Place"
                    value={currentForm.venue}
                    onChange={(value) => updateEditForm(match.id, { venue: value })}
                  />

                  <PredictionInput
                    label="Label"
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

          {matches.length === 0 ? (
            <div
              className="border border-white/20 p-5 text-center text-[14px] font-semibold text-white/64 backdrop-blur-2xl"
              style={{ borderRadius: 24, background: GLASS_CARD }}
            >
              No prediction games yet.
            </div>
          ) : null}
        </section>
      </main>
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
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
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
