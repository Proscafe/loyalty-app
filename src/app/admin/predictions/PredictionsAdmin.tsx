"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { Profile } from "@/types";

type PredictionMatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  match_label: string | null;
  kickoff_at: string;
  opens_at: string;
  closes_at: string;
  secret_code: string;
  is_active: boolean;
  created_at: string;
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

function makeDefaultForm() {
  const now = new Date();
  const kickoff = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const opens = new Date(kickoff.getTime() - 90 * 60 * 1000);
  const closes = new Date(kickoff.getTime() - 5 * 60 * 1000);

  return {
    home_team: "",
    away_team: "",
    match_label: "World Cup",
    kickoff_at: localValue(kickoff),
    opens_at: localValue(opens),
    closes_at: localValue(closes),
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
  const [matches, setMatches] = useState(initialMatches);
  const [form, setForm] = useState(makeDefaultForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";

    return window.location.origin;
  }, []);

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

      setMatches((current) => [json.match!, ...current]);
      setForm(makeDefaultForm());
      setToast("Prediction match created.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not create match.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink(secretCode: string) {
    const link = `${origin}/predict/${secretCode}`;

    await navigator.clipboard.writeText(link);
    setToast("Private prediction link copied.");
  }

  function qrUrl(secretCode: string) {
    const link = `${origin}/predict/${secretCode}`;

    return `https://api.qrserver.com/v1/create-qr-code/?size=900x900&margin=16&data=${encodeURIComponent(
      link,
    )}`;
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
            Create private game links and QR codes for customers inside the restaurant.
          </p>
        </section>

        {toast ? (
          <div className="mb-4 rounded-2xl border border-[#ffd66b]/35 bg-[#ffd66b]/15 px-4 py-3 text-[12px] font-black text-[#ffd66b]">
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
            label="Label"
            value={form.match_label}
            onChange={(value) => setForm((current) => ({ ...current, match_label: value }))}
          />

          <PredictionDateInput
            label="Kickoff"
            value={form.kickoff_at}
            onChange={(value) => setForm((current) => ({ ...current, kickoff_at: value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <PredictionDateInput
              label="Opens"
              value={form.opens_at}
              onChange={(value) => setForm((current) => ({ ...current, opens_at: value }))}
            />
            <PredictionDateInput
              label="Closes"
              value={form.closes_at}
              onChange={(value) => setForm((current) => ({ ...current, closes_at: value }))}
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
            const link = `${origin}/predict/${match.secret_code}`;

            return (
              <article
                key={match.id}
                className="border border-white/20 p-4 shadow-[0_18px_54px_rgba(35,48,39,0.16)] backdrop-blur-2xl"
                style={{ borderRadius: 24, background: GLASS_CARD }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                      {match.match_label || "World Cup"}
                    </div>
                    <div className="mt-1 truncate text-[20px] font-black text-white">
                      {match.home_team} <span className="text-[#ffd66b]">vs</span> {match.away_team}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold leading-5 text-white/62">
                      Kickoff {formatDate(match.kickoff_at)}
                      <br />
                      Open {formatDate(match.opens_at)}
                      <br />
                      Close {formatDate(match.closes_at)}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                      status === "Open"
                        ? "bg-[#ffd66b] text-[#365665]"
                        : "bg-white/14 text-white/68"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <div className="mb-3 rounded-2xl bg-white p-3">
                  <img
                    src={qrUrl(match.secret_code)}
                    alt={`QR code for ${match.home_team} vs ${match.away_team}`}
                    className="mx-auto aspect-square w-full max-w-[210px]"
                  />
                </div>

                <div className="mb-3 break-all rounded-2xl bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/68">
                  {link}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink(match.secret_code)}
                    className="h-11 rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.12em] text-[#365665]"
                  >
                    Copy link
                  </button>

                  <a
                    href={qrUrl(match.secret_code)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center justify-center rounded-full bg-white/14 text-[11px] font-black uppercase tracking-[0.12em] text-white"
                  >
                    Open QR
                  </a>
                </div>
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
        value={value}
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-white/20 bg-white px-3 text-[12px] font-bold text-black outline-none"
      />
    </label>
  );
}
