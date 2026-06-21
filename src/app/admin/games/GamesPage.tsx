"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Toast } from "@/components/Toast";
import { AdminMobileHeader } from "@/components/AdminMobileHeader";
import { createClient } from "@/lib/supabase/client";
import * as AdminMobileFloatingMenuModule from "@/components/AdminMobileFloatingMenu";
import type { Profile } from "@/types";



// ─── Types ────────────────────────────────────────────────────────────────────

type GameLink = {
  id: string;
  title: string;
  code: string;
  sport: string;
  matchLabel: string;
  kickoff: string | null;
  opensAt: string | null;
  closesAt: string | null;
  status: string;
  players: number;
  score: string;
  gifts: string;
  tournamentId?: string | null;
  tournamentName?: string | null;
};

type Tournament = {
  id: string;
  name: string;
  sport_type: "football" | "basketball";
  created_at?: string | null;
};

type CsvRow = {
  home_team: string;
  away_team: string;
  sport_type: "football" | "basketball";
  match_label: string;
  venue: string;
  tournament_id: string;
  kickoff_at: string;
  opens_at: string;
  closes_at: string;
};

type InitialMatchRow = Record<string, any>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPredictionDatePayloadValue(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toISOString();
}

function withPredictionDatePayload<T extends { kickoff_at?: string | null; opens_at?: string | null; closes_at?: string | null }>(payload: T) {
  return {
    ...payload,
    kickoff_at: toPredictionDatePayloadValue(payload.kickoff_at),
    opens_at: toPredictionDatePayloadValue(payload.opens_at),
    closes_at: toPredictionDatePayloadValue(payload.closes_at),
  };
}

function inferSportType(match: { sport_type?: string | null; match_label?: string | null; venue?: string | null }) {
  const text = `${match.sport_type ?? ""} ${match.match_label ?? ""} ${match.venue ?? ""}`.toLowerCase();
  return text.includes("basket") ? "basketball" : "football";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatSavedScore(match: any) {
  const rawHome = match.home_score ?? match.homeScore ?? match.home_goals ?? match.homeGoals ?? null;
  const rawAway = match.away_score ?? match.awayScore ?? match.away_goals ?? match.awayGoals ?? null;
  const home = rawHome === null || rawHome === undefined || rawHome === "" ? null : Number(rawHome);
  const away = rawAway === null || rawAway === undefined || rawAway === "" ? null : Number(rawAway);

  if (Number.isFinite(home) && Number.isFinite(away)) {
    return `${home}-${away}`;
  }

  const result = String(match.result ?? match.score ?? match.final_score ?? "").trim();
  if (result && result !== "null" && result !== "undefined") return result;

  return "—";
}

function formatGiftSummary(match: any) {
  const rawCount =
    match.gifts_count ??
    match.gift_count ??
    match.giftsSentCount ??
    match.gifts_sent_count ??
    match.sent_gifts_count ??
    match.rewards_count ??
    match.rewards_created ??
    match.gift_winners_count ??
    null;

  const count = Number(rawCount);
  if (Number.isFinite(count) && count > 0) {
    return "Sent";
  }

  const rawStatus =
    match.gifts_status ??
    match.gift_status ??
    match.gifts ??
    match.gifts_sent ??
    match.gift_sent ??
    null;

  if (rawStatus === true) return "Sent";
  if (typeof rawStatus === "string") {
    const text = rawStatus.trim();
    if (text && text !== "0" && text.toLowerCase() !== "false") return text;
  }

  return "—";
}

function predictionLinkFor(code: string) {
  const publicUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.proscafe.net";
  return `${publicUrl.replace(/\/$/, "")}/predict/${code}`;
}

const AdminMobileFloatingMenu =
  (AdminMobileFloatingMenuModule as any).default ??
  (AdminMobileFloatingMenuModule as any).AdminMobileFloatingMenu;

function normalizeGameLinks(matches: any[]): GameLink[] {
  const nowMs = Date.now();
  return matches.map((match: any) => {
    const openMs = new Date(match.opens_at ?? match.open_at ?? "").getTime();
    const closeMs = new Date(match.closes_at ?? match.close_at ?? "").getTime();
    const rawStatus = String(match.status ?? "").toLowerCase();
    const isClosedByStatus = ["closed", "ended", "inactive", "completed"].includes(rawStatus);
    const status = isClosedByStatus || match.is_active === false ? "Closed"
      : Number.isFinite(openMs) && nowMs < openMs ? "Scheduled"
      : Number.isFinite(closeMs) && nowMs > closeMs ? "Closed" : "Open";
    return {
      id: String(match.id),
      title: `${match.home_team ?? match.team_1 ?? "Home"} vs ${match.away_team ?? match.team_2 ?? "Away"}`,
      code: String(match.secret_code ?? match.code ?? ""),
      sport: inferSportType(match) === "basketball" ? "Basketball" : "Football",
      matchLabel: match.match_label || match.label || (match.sport_type === "basketball" ? "Basket" : "World Cup"),
      kickoff: match.kickoff_at ?? match.match_time ?? match.date ?? null,
      opensAt: match.opens_at ?? match.open_at ?? null,
      closesAt: match.closes_at ?? match.close_at ?? null,
      status,
      players: Number(match.entries_count ?? match.players_count ?? match.players ?? 0),
      score: formatSavedScore(match),
      gifts: formatGiftSummary(match),
      tournamentId: match.tournament_id ?? match.prediction_tournaments?.id ?? null,
      tournamentName: match.tournament_name ?? match.prediction_tournaments?.name ?? null,
    };
  }).filter((game) => game.id && game.code);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GameInput({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-white/86">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#24352f] outline-none focus:border-[#ffd66b]"
      />
    </label>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] bg-white/10 p-5 text-white shadow-[0_24px_70px_rgba(35,54,47,0.20)] backdrop-blur-2xl ${className}`}>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GamesPage({ initialMatches = [], profile }: { initialMatches?: InitialMatchRow[]; profile?: Profile }) {
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");
  const [isMobileDateFilterOpen, setIsMobileDateFilterOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const mobileHeaderProfile = profile ?? ({ id: "admin", full_name: "Admin", email: "", role: "master_admin" } as Profile);

  // Game form
  const [gameKind, setGameKind] = useState<"football" | "basketball">("basketball");
  const [gameForm, setGameForm] = useState({
    home_team: "", away_team: "", venue: "", match_label: "", tournament_id: "",
    kickoff_at: "", opens_at: "", closes_at: "", home_score: "", away_score: "",
    basketball_winner: "home", basketball_win_by: "",
  });
  const [gameSaving, setGameSaving] = useState(false);
  const [gameCreateOpen, setGameCreateOpen] = useState(false);
  const [scoreUpdating, setScoreUpdating] = useState(false);

  // Tournaments
  const [predictionTournaments, setPredictionTournaments] = useState<Tournament[]>([]);
  const [tournamentPopupOpen, setTournamentPopupOpen] = useState(false);
  const [tournamentForm, setTournamentForm] = useState({ name: "", sport_type: "basketball" as "football" | "basketball" });
  const [tournamentSaving, setTournamentSaving] = useState(false);
  const [tournamentDeleteId, setTournamentDeleteId] = useState<string | null>(null);

  // Games list
  const [createdGameLinks, setCreatedGameLinks] = useState<GameLink[]>(() => normalizeGameLinks(initialMatches));
  const [gameDateFilter, setGameDateFilter] = useState<"all" | "today" | "week" | "month" | "ended">("today");
  const [gameSportFilter, setGameSportFilter] = useState<"all" | "football" | "basketball">("all");
  const [gameTournamentFilter, setGameTournamentFilter] = useState("all");
  const [gameSort, setGameSort] = useState<{ key: "sport" | "match" | "date" | "status" | "players"; direction: "asc" | "desc" }>({ key: "date", direction: "desc" });

  // CSV
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  function flash(message: string, t: "success" | "error" = "success") {
    setTone(t);
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  async function updateFootballScores() {
    if (scoreUpdating) return;

    setScoreUpdating(true);

    try {
      const res = await fetch(
        "/api/cron/update-football-scores?secret=proscafe-score-cron-2026",
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        throw new Error(json?.error || json?.message || "Could not update scores.");
      }

      const saved = Number(json?.saved ?? 0);
      const errors = Number(json?.errors ?? 0);
      const checked = Number(json?.checked ?? 0);

      await refreshGameLinks();

      if (errors > 0) {
        flash(`Updated ${saved} scores. ${errors} errors.`, "error");
        return;
      }

      flash(saved > 0 ? `Updated ${saved} score${saved === 1 ? "" : "s"}.` : `Checked ${checked} games. No new finished scores yet.`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not update scores.", "error");
    } finally {
      setScoreUpdating(false);
    }
  }

  // ── Data fetching ────────────────────────────────────────────────────────────

  async function refreshGameLinks() {
    try {
      const loaded: any[] = [];
      const apiUrls = ["/api/admin/prediction-matches", "/api/prediction-matches", "/api/admin/game-links"];

      for (const url of apiUrls) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          const text = await res.text();
          const json = text ? JSON.parse(text) as Record<string, any> : {};
          if (!res.ok) continue;
          const rows = Array.isArray(json.matches) ? json.matches
            : Array.isArray(json.games) ? json.games
            : Array.isArray(json.links) ? json.links
            : Array.isArray(json.data) ? json.data
            : [];
          loaded.push(...rows);
        } catch {
          // Try the next source.
        }
      }

      const { data: directPredictionMatches } = await supabase
        .from("prediction_matches")
        .select("*, prediction_tournaments(id, name, sport_type)")
        .order("kickoff_at", { ascending: false })
        .limit(250);

      if (directPredictionMatches) loaded.push(...directPredictionMatches);

      const { data: directPredictionGames } = await supabase
        .from("prediction_games")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250);

      if (directPredictionGames) loaded.push(...directPredictionGames);

      const unique = new Map<string, any>();
      for (const row of loaded) {
        const id = String(row?.id ?? "");
        if (!id || unique.has(id)) continue;
        unique.set(id, row);
      }

      const rows = Array.from(unique.values());
      const ids = rows.map((row) => String(row.id ?? "")).filter(Boolean);
      const playerCounts = new Map<string, Set<string>>();

      async function collectPlayerCounts(column: "match_id" | "prediction_match_id") {
        if (ids.length === 0) return;
        const { data } = await supabase.from("prediction_entries").select(`${column}, client_id`).in(column, ids);
        for (const entry of data ?? []) {
          const matchId = String((entry as any)[column] ?? "");
          if (!matchId) continue;
          const clientId = String((entry as any).client_id ?? Math.random());
          if (!playerCounts.has(matchId)) playerCounts.set(matchId, new Set());
          playerCounts.get(matchId)?.add(clientId);
        }
      }

      await collectPlayerCounts("match_id");
      await collectPlayerCounts("prediction_match_id");

      const giftCounts = new Map<string, number>();

      async function collectGiftCountsFromMatchColumn(column: string) {
        if (ids.length === 0) return;
        const { data, error } = await supabase
          .from("rewards")
          .select(`id, ${column}`)
          .in(column, ids);

        if (error || !data) return;

        for (const reward of data as any[]) {
          const matchId = String(reward[column] ?? "");
          if (!matchId) continue;
          giftCounts.set(matchId, (giftCounts.get(matchId) ?? 0) + 1);
        }
      }

      async function collectGiftCountsFromDescriptionMarker() {
        if (ids.length === 0) return;

        const { data, error } = await supabase
          .from("rewards")
          .select("id, description, reward_type")
          .eq("reward_type", "Free Dessert")
          .ilike("description", "%prediction_match:%");

        if (error || !data) return;

        const idSet = new Set(ids);

        for (const reward of data as any[]) {
          const description = String(reward.description ?? "");
          const marker = description.match(/prediction_match:([0-9a-fA-F-]+)/);
          const matchId = marker?.[1] ?? "";
          if (!matchId || !idSet.has(matchId)) continue;
          giftCounts.set(matchId, (giftCounts.get(matchId) ?? 0) + 1);
        }
      }

      await collectGiftCountsFromMatchColumn("match_id");
      await collectGiftCountsFromMatchColumn("prediction_match_id");
      await collectGiftCountsFromMatchColumn("prediction_game_id");
      await collectGiftCountsFromMatchColumn("game_id");
      await collectGiftCountsFromDescriptionMarker();

      const withCounts = rows.map((row) => ({
        ...row,
        entries_count: playerCounts.get(String(row.id))?.size ?? row.entries_count ?? row.players_count ?? row.players ?? 0,
        players_count: playerCounts.get(String(row.id))?.size ?? row.entries_count ?? row.players_count ?? row.players ?? 0,
        gifts_count: giftCounts.get(String(row.id)) ?? row.gifts_count ?? row.gift_count ?? row.gifts_sent_count ?? row.rewards_count ?? row.rewards_created ?? 0,
      }));

      setCreatedGameLinks(normalizeGameLinks(withCounts));
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not load games.", "error");
    }
  }

  async function refreshTournaments() {
    try {
      const res = await fetch("/api/admin/prediction-tournaments");
      const text = await res.text();
      const json = text ? JSON.parse(text) as { tournaments?: Tournament[]; error?: string } : {};
      if (!res.ok) { flash(json.error ?? "Could not load tournaments.", "error"); return; }
      setPredictionTournaments(json.tournaments ?? []);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not load tournaments.", "error");
    }
  }

  useEffect(() => {
    void refreshGameLinks();
    void refreshTournaments();
  }, [supabase]);

  // ── Tournament CRUD ──────────────────────────────────────────────────────────

  async function createTournament() {
    const name = tournamentForm.name.trim();
    if (!name) { flash("Tournament name is required.", "error"); return; }
    setTournamentSaving(true);
    try {
      const res = await fetch("/api/admin/prediction-tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sport_type: tournamentForm.sport_type }),
      });
      const json = await res.json() as { tournament?: Tournament; error?: string };
      if (!res.ok || !json.tournament) { flash(json.error ?? "Could not create tournament.", "error"); return; }
      setPredictionTournaments((cur) => [json.tournament!, ...cur]);
      setTournamentForm((cur) => ({ ...cur, name: "" }));
      flash("Tournament created.");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed.", "error");
    } finally {
      setTournamentSaving(false);
    }
  }

  async function deleteTournament(id: string) {
    try {
      const res = await fetch(`/api/admin/prediction-tournaments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) { flash(json.error ?? "Could not delete.", "error"); return; }
      setPredictionTournaments((cur) => cur.filter((t) => t.id !== id));
      setTournamentDeleteId(null);
      setGameForm((cur) => cur.tournament_id === id ? { ...cur, tournament_id: "" } : cur);
      setGameTournamentFilter((cur) => cur === id ? "all" : cur);
      await refreshGameLinks();
      flash("Tournament deleted.");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed.", "error");
    }
  }

  // ── Game creation ────────────────────────────────────────────────────────────

  const gameTournamentOptions = useMemo(
    () => predictionTournaments.filter((t) => t.sport_type === gameKind),
    [gameKind, predictionTournaments],
  );

  useEffect(() => {
    if (!gameForm.tournament_id) return;
    const selected = predictionTournaments.find((t) => t.id === gameForm.tournament_id);
    if (selected && selected.sport_type === gameKind) return;
    setGameForm((cur) => ({ ...cur, tournament_id: "" }));
  }, [gameForm.tournament_id, gameKind, predictionTournaments]);

  function setKickoffWithDefaultWindow(value: string) {
    setGameForm((cur) => {
      if (!value) return { ...cur, kickoff_at: "", opens_at: "", closes_at: "" };
      const kickoff = new Date(value);
      if (Number.isNaN(kickoff.getTime())) return { ...cur, kickoff_at: value };
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return { ...cur, kickoff_at: value, opens_at: fmt(new Date(kickoff.getTime() - 20 * 60 * 1000)), closes_at: fmt(new Date(kickoff.getTime() + 10 * 60 * 1000)) };
    });
  }

  async function createGame() {
    if (!gameForm.home_team.trim() || !gameForm.away_team.trim()) { flash("Add both teams first.", "error"); return; }
    setGameSaving(true);
    const payload = gameKind === "basketball"
      ? { ...gameForm, tournament_id: gameForm.tournament_id || null, sport_type: "basketball" as const, match_label: gameForm.match_label.trim() || "Basket", venue: gameForm.venue.trim() || null, home_score: "", away_score: "" }
      : { ...gameForm, tournament_id: gameForm.tournament_id || null, sport_type: "football" as const, match_label: gameForm.match_label.trim() || "World Cup", venue: gameForm.venue.trim() || null, home_score: "", away_score: "" };
    try {
      const res = await fetch("/api/admin/prediction-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withPredictionDatePayload(payload)),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) as { match?: any; error?: string } : {};
      if (!res.ok || !json.match) { flash(json.error ?? "Could not create game.", "error"); return; }
      await refreshGameLinks();
      setGameForm({ home_team: "", away_team: "", venue: "", match_label: "", tournament_id: "", kickoff_at: "", opens_at: "", closes_at: "", home_score: "", away_score: "", basketball_winner: "home", basketball_win_by: "" });
      setGameCreateOpen(false);
      flash("Game created.");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not create game.", "error");
    } finally {
      setGameSaving(false);
    }
  }

  // ── QR downloads ─────────────────────────────────────────────────────────────

  async function copyLink(code: string) {
    await navigator.clipboard.writeText(predictionLinkFor(code));
    flash("Link copied.");
  }

  async function downloadQr(code: string, title: string) {
    const link = predictionLinkFor(code);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(link)}`;
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${title}-qr.png`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objectUrl);
      flash("QR downloaded.");
    } catch { window.open(qrUrl, "_blank", "noopener,noreferrer"); }
  }

  async function downloadAllQrs() {
    if (sortedGameLinks.length === 0) { flash("No games to download.", "error"); return; }
    const tournamentName = gameTournamentFilter !== "all"
      ? (predictionTournaments.find((t) => t.id === gameTournamentFilter)?.name ?? "tournament")
      : "all-games";
    flash(`Downloading ${sortedGameLinks.length} QR codes…`);
    for (let i = 0; i < sortedGameLinks.length; i++) {
      const game = sortedGameLinks[i];
      const link = predictionLinkFor(game.code);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(link)}`;
      const filename = `${String(i + 1).padStart(2, "0")}-${game.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-qr.png";
      try {
        const res = await fetch(qrUrl);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(objectUrl);
        await new Promise((r) => setTimeout(r, 400));
      } catch { window.open(qrUrl, "_blank", "noopener,noreferrer"); }
    }
    flash(`${sortedGameLinks.length} QR codes downloaded for ${tournamentName}.`);
  }

  // ── CSV import ───────────────────────────────────────────────────────────────

  function parseCsvGames(text: string) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return { rows: [], errors: ["CSV has no data rows."] };

    function splitCsvLine(line: string): string[] {
      const result: string[] = [];
      let current = ""; let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
        else { current += ch; }
      }
      result.push(current.trim());
      return result;
    }

    const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s"']+/g, "_"));
    const errors: string[] = [];
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmtLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const resolveKickoff = (raw: string) => {
      if (!raw) return "";
      const normalised = raw.trim().replace(" ", "T");
      const d = new Date(normalised);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
      const withTime = new Date(normalised + "T00:00");
      return !Number.isNaN(withTime.getTime()) ? withTime.toISOString() : "";
    };
    const get = (row: string[], keys: string[]) => {
      for (const k of keys) {
        const i = headers.indexOf(k);
        if (i !== -1 && row[i]?.trim()) return row[i].trim().replace(/^["']|["']$/g, "");
      }
      return "";
    };
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const rows = lines.slice(1).map((line, index) => {
      const cols = splitCsvLine(line);
      const home = get(cols, ["home_team", "home", "team_1", "team1"]);
      const away = get(cols, ["away_team", "away", "team_2", "team2"]);
      const rawKickoff = get(cols, ["kickoff_at", "kickoff", "match_time", "datetime", "date"]);
      const kickoff = resolveKickoff(rawKickoff);
      const sportRaw = get(cols, ["sport_type", "sport"]).toLowerCase();
      const sport_type: "football" | "basketball" = sportRaw.includes("basket") ? "basketball" : "football";
      const match_label = get(cols, ["match_label", "label", "round", "stage"]) || (sport_type === "basketball" ? "Basket" : "World Cup");
      const venue = get(cols, ["venue", "description", "desc"]);
      const rawTournamentId = get(cols, ["tournament_id"]);
      const tournament_id = UUID_RE.test(rawTournamentId) ? rawTournamentId : "";
      if (rawTournamentId && !UUID_RE.test(rawTournamentId)) errors.push(`Row ${index + 2}: tournament_id "${rawTournamentId}" is not a valid UUID and will be ignored.`);

      let opens_at = get(cols, ["opens_at", "open_at"]);
      let closes_at = get(cols, ["closes_at", "close_at"]);

      if (kickoff && !opens_at) opens_at = new Date(new Date(kickoff).getTime() - 20 * 60 * 1000).toISOString();
      if (kickoff && !closes_at) closes_at = new Date(new Date(kickoff).getTime() + 10 * 60 * 1000).toISOString();

      if (!home || !away) errors.push(`Row ${index + 2}: missing home or away team.`);
      if (!kickoff) errors.push(`Row ${index + 2}: could not parse kickoff "${rawKickoff}" — use YYYY-MM-DDTHH:MM.`);

      return { home_team: home, away_team: away, sport_type, match_label, venue, tournament_id, kickoff_at: kickoff, opens_at, closes_at };
    }).filter((row) => row.home_team && row.away_team);

    return { rows, errors };
  }

  function handleCsvFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name); setCsvErrors([]); setCsvPreview([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, errors } = parseCsvGames(text);
      setCsvPreview(rows); setCsvErrors(errors);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function importCsvGames() {
    if (csvPreview.length === 0) return;
    setCsvImporting(true);
    let created = 0;
    const errors: string[] = [];
    for (const row of csvPreview) {
      try {
        const body = {
          home_team: row.home_team, away_team: row.away_team, sport_type: row.sport_type,
          match_label: row.match_label, venue: row.venue || null,
          tournament_id: row.tournament_id || null,
          kickoff_at: row.kickoff_at || null, opens_at: row.opens_at || null, closes_at: row.closes_at || null,
          home_score: "", away_score: "",
        };
        const res = await fetch("/api/admin/prediction-matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          let errMsg = "failed";
          try { errMsg = (JSON.parse(txt) as { error?: string }).error ?? txt; } catch { errMsg = txt; }
          errors.push(`${row.home_team} vs ${row.away_team}: ${errMsg}`);
        } else { created++; }
      } catch { errors.push(`${row.home_team} vs ${row.away_team}: network error`); }
    }
    setCsvImporting(false);
    if (errors.length > 0) setCsvErrors(errors);
    if (created > 0) {
      await refreshGameLinks();
      flash(`${created} game${created !== 1 ? "s" : ""} imported.`);
      if (errors.length === 0) { setCsvImportOpen(false); setCsvPreview([]); setCsvErrors([]); setCsvFileName(""); }
    } else { flash("Import failed. Check errors below.", "error"); }
  }

  // ── Sorting / filtering ──────────────────────────────────────────────────────

  const sortedGameLinks = useMemo(() => {
    const direction = gameSort.direction === "asc" ? 1 : -1;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTomorrow = startOfToday + 86400000;
    const dow = now.getDay(); const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset).getTime();
    const endOfWeek = startOfWeek + 7 * 86400000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    const filtered = createdGameLinks.filter((game) => {
      if (gameSportFilter !== "all" && game.sport.toLowerCase() !== gameSportFilter) return false;
      if (gameTournamentFilter !== "all" && game.tournamentId !== gameTournamentFilter) return false;
      const isEnded = game.status.toLowerCase() === "closed" || game.status.toLowerCase() === "ended";
      if (gameDateFilter === "ended") return isEnded;
      if (isEnded) return false;
      if (gameDateFilter === "all") return true;
      const time = new Date(game.kickoff ?? "").getTime();
      if (!Number.isFinite(time)) return false;
      if (gameDateFilter === "today") return time >= startOfToday && time < startOfTomorrow;
      if (gameDateFilter === "week") return time >= startOfWeek && time < endOfWeek;
      if (gameDateFilter === "month") return time >= startOfMonth && time < endOfMonth;
      return true;
    });

    return filtered.slice().sort((a, b) => {
      const cmp = (x: string, y: string) => x.localeCompare(y) * direction;
      if (gameSort.key === "sport") return cmp(a.sport, b.sport);
      if (gameSort.key === "match") return cmp(a.title, b.title);
      if (gameSort.key === "status") return cmp(a.status, b.status);
      if (gameSort.key === "players") return (a.players - b.players) * direction;
      return ((new Date(a.kickoff ?? 0).getTime() || 0) - (new Date(b.kickoff ?? 0).getTime() || 0)) * direction;
    });
  }, [createdGameLinks, gameDateFilter, gameSort, gameSportFilter, gameTournamentFilter]);

  function sortGames(key: typeof gameSort["key"]) {
    setGameSort((cur) => ({ key, direction: cur.key === key && cur.direction === "asc" ? "desc" : "asc" }));
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#6f7c6f] text-white lg:bg-[radial-gradient(circle_at_top_left,rgba(255,214,107,0.24),transparent_28%),linear-gradient(135deg,#365665_0%,#263f49_48%,#798673_100%)]" style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif" }}>
      <Toast message={toast} tone={tone} />

      <div className="flex min-h-screen w-full justify-center gap-0 overflow-visible bg-transparent p-0 sm:p-4 lg:justify-start lg:gap-6 lg:p-6 lg:min-h-screen">

        {/* Sidebar */}
        <aside className={`hidden min-h-[calc(100vh-48px)] shrink-0 flex-col overflow-hidden rounded-[30px] bg-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.24)] backdrop-blur-2xl transition-all duration-300 lg:flex ${isDesktopSidebarOpen ? "w-[238px]" : "w-[76px]"}`}>
          <div className={`flex h-20 items-center bg-white/5 ${isDesktopSidebarOpen ? "justify-between gap-3 px-5" : "justify-center px-3"}`}>
            {isDesktopSidebarOpen ? (
              <div className="min-w-0">
                <div className="text-[19px] font-black leading-none text-white">Dashboard</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#ffd66b]">PRO&apos;s Admin</div>
              </div>
            ) : null}
            <button type="button" onClick={() => setIsDesktopSidebarOpen(c => !c)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffd66b] text-[20px] font-black text-[#365665] shadow-[0_12px_28px_rgba(255,214,107,0.2)] transition hover:scale-105"
              title={isDesktopSidebarOpen ? "Collapse menu" : "Open menu"}
              aria-label={isDesktopSidebarOpen ? "Collapse menu" : "Open menu"}
            >
              {isDesktopSidebarOpen ? "←" : "☰"}
            </button>
          </div>
                    <nav className="flex-1 px-3 py-4">
              <Link href="/admin" title="Dashboard"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>⌂</span>
                {isDesktopSidebarOpen ? "Dashboard" : null}
              </Link>
              <Link href="/admin/activity" title="Activity"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>↯</span>
                {isDesktopSidebarOpen ? "Activity" : null}
              </Link>
              <Link href="/admin/news" title="News"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>📣</span>
                {isDesktopSidebarOpen ? "News" : null}
              </Link>
              <Link href="/admin/users" title="Customer behavior"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>👤</span>
                {isDesktopSidebarOpen ? "Customer behavior" : null}
              </Link>
              <Link href="/admin/comment-cards" title="Comment Cards"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>✎</span>
                {isDesktopSidebarOpen ? "Comment Cards" : null}
              </Link>
              <Link href="/admin/birthdays" title="Birthdays"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>🎂</span>
                {isDesktopSidebarOpen ? "Birthdays" : null}
              </Link>
              <Link href="/admin/gifts" title="Gifts"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>🎁</span>
                {isDesktopSidebarOpen ? "Gifts" : null}
              </Link>
              <Link href="/admin/loyalty" title="Loyalty Program"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black text-white/70 transition hover:bg-white/12 hover:text-white ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] text-white/72`}>★</span>
                {isDesktopSidebarOpen ? "Loyalty Program" : null}
              </Link>
              <Link href="/admin/games" title="Games"
                className={`mb-2 flex h-12 w-full items-center rounded-[18px] text-left text-[13px] font-black transition bg-white/18 text-white shadow-[0_16px_34px_rgba(35,54,47,0.18)] ${isDesktopSidebarOpen ? "justify-start px-4" : "justify-center px-0"}`}>
                <span className={`${isDesktopSidebarOpen ? "mr-3" : "mr-0"} flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ffd66b] text-[15px] text-[#365665]`}>🎮</span>
                {isDesktopSidebarOpen ? "Games" : null}
              </Link>
          </nav>
          <div className="border-t border-white/8 px-3 py-5">
            {isDesktopSidebarOpen ? (
              <div className="space-y-3 text-left">
                <a href="https://wissamdesigns.com" target="_blank" rel="noreferrer" className="block text-[11px] font-black uppercase leading-5 text-[#ffd66b] transition hover:text-white">© WISSAMDESIGNS.COM</a>
              </div>
            ) : <div className="text-center text-[14px] font-black text-[#ffd66b]">©</div>}
          </div>
        </aside>

        {/* Content */}
        <section className="min-h-screen w-full max-w-[376px] min-w-0 overflow-hidden bg-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.22)] backdrop-blur-2xl sm:max-w-none sm:rounded-[30px] lg:min-h-[calc(100vh-48px)]">
          <div className="px-5 py-5 sm:px-5 sm:py-6 lg:px-8">

        {/* Mobile app header */}
        <div className="mb-5 sm:hidden">
          <AdminMobileHeader profile={mobileHeaderProfile} />
        </div>

        {/* Header */}
        <div className="mb-5 sm:mb-6">
          <div className="flex items-center justify-between gap-3 rounded-[18px] bg-white/10 px-4 py-5 shadow-[0_22px_60px_rgba(35,54,47,0.16)] backdrop-blur-2xl sm:hidden">
            <h1 className="min-w-0 text-[27px] font-black leading-[1.2] tracking-[-0.05em] text-white">
              Create <span className="text-[#ffd66b]">Game</span>
            </h1>
            <button
              type="button"
              onClick={() => setGameCreateOpen(true)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[16px] font-black leading-none text-white transition hover:bg-white/18"
              aria-label="Create game link"
            >
              +
            </button>
          </div>

          <div className="hidden items-center justify-between gap-4 sm:flex">
            <div>
              <h1 className="text-[28px] font-black tracking-[-0.04em] text-white">Create Game</h1>
              <p className="mt-0.5 text-[12px] font-bold text-white/65">Manage links, QR codes, players, scores, and leaderboards.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setTournamentPopupOpen(true)} className="rounded-full bg-white/14 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/20">Add Tournament</button>
              <button type="button" onClick={() => { setCsvImportOpen(true); setCsvPreview([]); setCsvErrors([]); setCsvFileName(""); }} className="rounded-full bg-white/14 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/20">Upload CSV</button>
              <button type="button" onClick={() => void updateFootballScores()} disabled={scoreUpdating} className="rounded-full bg-white/14 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50">
                {scoreUpdating ? "Updating..." : "Update Scores"}
              </button>
              {sortedGameLinks.length > 0 && (
                <button type="button" onClick={() => void downloadAllQrs()} className="flex items-center gap-2 rounded-full bg-white/14 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/20">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3m0 4h4v-4m-4 0v4" /></svg>
                  Download QRs ({sortedGameLinks.length})
                </button>
              )}
              <button type="button" onClick={() => setGameCreateOpen(true)} className="rounded-full bg-[#ffd66b] px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#365665] shadow-[0_18px_40px_rgba(255,214,107,0.20)] transition hover:bg-[#f0cf61]">Create Link</button>
            </div>
          </div>
        </div>

        {/* Filters + table */}
        <Panel className="!rounded-[28px] !bg-white/10 !p-4 pb-28 sm:pb-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsMobileDateFilterOpen(true)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#ffd66b] px-5 text-[11px] font-black uppercase tracking-[0.14em] text-[#365665] shadow-[0_14px_30px_rgba(255,214,107,0.16)] sm:hidden"
                aria-label="Choose date filter"
              >
                <span className="leading-none">{gameDateFilter === "all" ? "All" : gameDateFilter === "today" ? "Today" : gameDateFilter === "week" ? "This week" : gameDateFilter === "month" ? "This month" : "Ended"}</span>
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 translate-y-[0.5px]" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" /></svg>
              </button>
              <div className="hidden flex-wrap items-center gap-2 sm:flex">
                {(["all", "today", "week", "month", "ended"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setGameDateFilter(v)}
                    className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition sm:px-4 ${gameDateFilter === v ? "bg-[#ffd66b] text-[#365665]" : "bg-white/10 text-white/70 hover:bg-white/16 hover:text-[#ffd66b]"}`}>
                    {v === "all" ? "All" : v === "today" ? "Today" : v === "week" ? "This week" : v === "month" ? "This month" : "Ended"}
                  </button>
                ))}
              </div>
            </div>
            <div className="hidden w-full flex-wrap items-center gap-2 sm:flex sm:w-auto">
              <select value={gameSportFilter} onChange={(e) => setGameSportFilter(e.target.value as any)} className="h-10 flex-1 rounded-full border border-white/20 bg-white px-4 text-[11px] font-black text-[#365665] outline-none sm:flex-none">
                <option value="all">All sports</option>
                <option value="football">Football</option>
                <option value="basketball">Basketball</option>
              </select>
              <select value={gameTournamentFilter} onChange={(e) => setGameTournamentFilter(e.target.value)} className="h-10 flex-1 rounded-full border border-white/20 bg-white px-4 text-[11px] font-black text-[#365665] outline-none sm:flex-none">
                <option value="all">All tournaments</option>
                {predictionTournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {sortedGameLinks.length === 0 ? (
            <p className="rounded-[18px] border border-white/18 bg-white/10 p-4 text-center text-[13px] font-bold text-white/70">No games for this filter.</p>
          ) : (
            <>
              <div className="space-y-4 md:hidden">
                {sortedGameLinks.map((game) => (
                  <div key={game.id} role="button" tabIndex={0}
                    onClick={() => { window.location.href = `/admin/game-links/${game.id}`; }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = `/admin/game-links/${game.id}`; } }}
                    className="w-full rounded-[22px] border border-white/80 bg-transparent p-4 pb-5 text-[12px] font-bold text-white/78 transition hover:bg-white/8">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd66b]">{game.sport}</div>
                        <div className="mt-1 break-words text-[15px] font-black leading-tight text-white">{game.title}</div>
                        <div className="mt-1 truncate text-[10px] font-bold text-white/70">{game.matchLabel}</div>
                      </div>
                      <div className="shrink-0 pt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                        {game.status}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[11px]">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white">Date</div>
                        <div className="mt-1 whitespace-pre-line text-white/88">{formatDate(game.kickoff)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white">Players</div>
                        <div className="mt-1 tabular-nums text-white/88">{game.players}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white">Tournament</div>
                        <div className="mt-1 truncate text-white/65">{game.tournamentName ?? "—"}</div>
                      </div>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => void copyLink(game.code)} className="flex h-8 items-center justify-center rounded-full text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-white/10">Copy</button>
                      <button type="button" onClick={() => void downloadQr(game.code, game.title)} className="flex h-8 items-center justify-center rounded-full text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-white/10">QR</button>
                      <a href={predictionLinkFor(game.code)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex h-8 items-center justify-center rounded-full text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-white/10">Open</a>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-hidden rounded-[22px] border border-white/18 bg-white/8 md:block">
              <div className="grid grid-cols-[0.62fr_1fr_1.25fr_0.78fr_0.58fr_0.58fr_0.68fr_0.5fr_0.42fr_0.42fr_0.42fr] gap-3 border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/58">
                {[["sport","Sport"],["match","Match Name"],["date","Date"],["status","Status"],["players","Players"]].map(([key, label]) => (
                  <button key={key} type="button" onClick={() => sortGames(key as any)} className="text-left">{label}</button>
                ))}
                <div className="text-left">Score</div>
                <div className="text-left">Gifts</div>
                <div className="text-left">Tournament</div>
                <div>Copy</div><div>QR</div><div>Open</div>
              </div>
              <div className="max-h-[600px] overflow-auto">
                {sortedGameLinks.map((game) => (
                  <div key={game.id} role="button" tabIndex={0}
                    onClick={() => { window.location.href = `/admin/game-links/${game.id}`; }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = `/admin/game-links/${game.id}`; } }}
                    className="grid cursor-pointer grid-cols-[0.62fr_1fr_1.25fr_0.78fr_0.58fr_0.58fr_0.68fr_0.5fr_0.42fr_0.42fr_0.42fr] items-center gap-3 border-b border-white/10 px-4 py-4 text-[12px] font-bold text-white/78 transition last:border-b-0 hover:bg-white/10">
                    <div className="font-black text-[#ffd66b]">{game.sport}</div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-black text-white">{game.title}</div>
                      <div className="truncate text-[10px] font-bold text-white/46">{game.matchLabel}</div>
                    </div>
                    <div>{formatDate(game.kickoff)}</div>
                    <div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${game.status === "Open" ? "bg-[#ffd66b] text-[#365665]" : game.status === "Closed" ? "bg-red-500/16 text-red-100" : "bg-white/14 text-white"}`}>
                        {game.status}
                      </span>
                    </div>
                    <div className="tabular-nums">{game.players}</div>
                    <div className="tabular-nums text-white/88">{game.score}</div>
                    <div className="truncate text-white/70">{game.gifts}</div>
                    <div className="truncate text-white/60">{game.tournamentName ?? "—"}</div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => void copyLink(game.code)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[13px] text-white transition hover:bg-white/20" title="Copy link">⧉</button>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => void downloadQr(game.code, game.title)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[15px] text-white transition hover:bg-white/20" title="Download QR">▣</button>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <a href={predictionLinkFor(game.code)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[15px] font-black text-white transition hover:bg-white/20" title="Open prediction">↗</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </>
          )}
        </Panel>
          </div>
        </section>

      {/* Mobile floating menu */}
      <div className="lg:hidden">
        {isMobileDateFilterOpen && (
          <div
            className="fixed inset-0 z-[55] flex items-end justify-center bg-black/35 px-5 pb-24 backdrop-blur-sm sm:hidden"
            onClick={() => setIsMobileDateFilterOpen(false)}
          >
            <div
              className="w-full max-w-[320px] rounded-[26px] border border-white/14 bg-[#7f8d82] p-3 shadow-[0_24px_70px_rgba(35,54,47,0.32)]"
              onClick={(e) => e.stopPropagation()}
            >
              {(["all", "today", "week", "month", "ended"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setGameDateFilter(v);
                    setIsMobileDateFilterOpen(false);
                  }}
                  className={`mb-2 flex h-12 w-full items-center justify-between rounded-full px-5 text-[11px] font-black uppercase tracking-[0.14em] transition last:mb-0 ${gameDateFilter === v ? "bg-white text-[#365665]" : "bg-[#ffd66b] text-[#365665]"}`}
                >
                  <span>{v === "all" ? "All" : v === "today" ? "Today" : v === "week" ? "This week" : v === "month" ? "This month" : "Ended"}</span>
                  {gameDateFilter === v ? <span>✓</span> : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {AdminMobileFloatingMenu ? <AdminMobileFloatingMenu active="games" /> : null}
      </div>

      {/* Hidden CSV input */}
      <input ref={csvFileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFileChange} />

      {/* CSV Import Modal */}
      {csvImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm" onClick={() => !csvImporting && setCsvImportOpen(false)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/18 bg-[#61716b] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffd66b]">Admin</div>
                <h3 className="mt-1 text-[23px] font-black tracking-[-0.04em] text-white">Import Games <span className="text-[#ffd66b]">via CSV</span></h3>
                <p className="mt-1 text-[11px] font-bold text-white/60">Columns: <span className="text-white/82">home_team, away_team, sport_type, match_label, venue, kickoff_at, opens_at, closes_at, tournament_id</span></p>
              </div>
              <button type="button" onClick={() => setCsvImportOpen(false)} disabled={csvImporting} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white disabled:opacity-40">×</button>
            </div>
            <button type="button" onClick={() => csvFileInputRef.current?.click()} disabled={csvImporting} className="mb-4 flex w-full flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-white/25 bg-white/8 py-8 text-center transition hover:border-[#ffd66b]/60 hover:bg-white/12 disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#ffd66b]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span className="text-[12px] font-black text-white">{csvFileName || "Click to choose a CSV file"}</span>
              {csvFileName && <span className="text-[10px] font-bold text-white/55">Click to change file</span>}
            </button>
            <button type="button" onClick={() => { const h = "home_team,away_team,sport_type,match_label,venue,kickoff_at,opens_at,closes_at,tournament_id"; const e = "SAGESSE,HOMENETMEN,basketball,Game 1,,2026-06-15T20:00,,,"; const blob = new Blob([h + "\n" + e], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "games-template.csv"; a.click(); URL.revokeObjectURL(url); }} className="mb-4 flex items-center gap-1.5 text-[11px] font-bold text-[#ffd66b] underline underline-offset-2 hover:text-white">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download template CSV
            </button>
            {csvErrors.length > 0 && (
              <div className="mb-4 rounded-[14px] bg-red-500/16 p-3">
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-red-300">Warnings</p>
                <ul className="space-y-1">{csvErrors.map((err, i) => <li key={i} className="text-[11px] font-bold text-red-200">{err}</li>)}</ul>
              </div>
            )}
            {csvPreview.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Preview — {csvPreview.length} game{csvPreview.length !== 1 ? "s" : ""} ready to import</p>
                <div className="max-h-[220px] overflow-auto rounded-[14px] border border-white/14 bg-white/8">
                  <table className="w-full text-left text-[11px]">
                    <thead><tr className="border-b border-white/10 text-[9px] font-black uppercase tracking-[0.14em] text-white/50"><th className="px-3 py-2">Match</th><th className="px-3 py-2">Sport</th><th className="px-3 py-2">Label</th><th className="px-3 py-2">Kickoff</th></tr></thead>
                    <tbody>{csvPreview.map((row, i) => (
                      <tr key={i} className="border-b border-white/8 last:border-0">
                        <td className="px-3 py-2 font-bold text-white">{row.home_team} vs {row.away_team}</td>
                        <td className="px-3 py-2 font-black text-[#ffd66b] capitalize">{row.sport_type}</td>
                        <td className="px-3 py-2 text-white/70">{row.match_label}</td>
                        <td className="px-3 py-2 text-white/60">{row.kickoff_at ? new Date(row.kickoff_at).toLocaleString() : "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
            <button type="button" onClick={() => void importCsvGames()} disabled={csvPreview.length === 0 || csvImporting} className="flex h-11 w-full items-center justify-center rounded-full bg-[#ffd66b] px-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#365665] transition hover:bg-[#f0cf61] disabled:cursor-not-allowed disabled:opacity-45">
              {csvImporting ? `Importing ${csvPreview.length} game${csvPreview.length !== 1 ? "s" : ""}…` : csvPreview.length > 0 ? `Import ${csvPreview.length} Game${csvPreview.length !== 1 ? "s" : ""}` : "Select a CSV file above"}
            </button>
          </div>
        </div>
      )}

      {/* Tournament popup */}
      {tournamentPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-5 backdrop-blur-sm lg:items-center lg:pb-0">
          <div className="w-full max-w-xl rounded-[30px] border border-white/18 bg-[#61716b] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffd66b]">Tournament</div><h3 className="mt-1 text-[23px] font-black tracking-[-0.04em] text-white">Add Tournament</h3></div>
              <button type="button" onClick={() => setTournamentPopupOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white">×</button>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-white/86">Tournament name</span>
              <input value={tournamentForm.name} onChange={(e) => setTournamentForm((cur) => ({ ...cur, name: e.target.value }))} className="h-11 w-full rounded-[14px] border border-white/20 bg-white px-4 text-[13px] font-black text-[#24352f] outline-none focus:border-[#ffd66b]" placeholder="World Cup 2026" />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-[16px] bg-white/10 p-1">
              {(["football", "basketball"] as const).map((sport) => (
                <button key={sport} type="button" onClick={() => setTournamentForm((cur) => ({ ...cur, sport_type: sport }))} className={`h-9 rounded-[13px] text-[10px] font-black uppercase tracking-[0.18em] transition ${tournamentForm.sport_type === sport ? "bg-[#ffd66b] text-[#365665]" : "text-white/72 hover:bg-white/10"}`}>
                  {sport === "football" ? "Football" : "Basketball"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void createTournament()} disabled={tournamentSaving} className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-[#ffd66b] px-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#365665] transition hover:bg-[#f0cf61] disabled:cursor-not-allowed disabled:opacity-55">
              {tournamentSaving ? "Creating..." : "Create Tournament"}
            </button>
            <div className="mt-5 max-h-[260px] space-y-2 overflow-auto">
              {predictionTournaments.length === 0 && <div className="rounded-[16px] bg-white/10 p-4 text-[12px] font-bold text-white/70">No tournaments yet.</div>}
              {predictionTournaments.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-white/10 px-4 py-3">
                  <div className="min-w-0"><div className="truncate text-[13px] font-black text-white">{t.name}</div><div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#ffd66b]">{t.sport_type}</div></div>
                  <button type="button" onClick={() => setTournamentDeleteId(t.id)} className="rounded-full bg-red-400/18 px-3 py-2 text-[11px] font-black text-red-100 transition hover:bg-red-400/26">Delete</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete tournament confirm */}
      {tournamentDeleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[26px] border border-white/18 bg-[#61716b] p-5 shadow-2xl">
            <h3 className="text-[20px] font-black text-white">Delete tournament?</h3>
            <p className="mt-2 text-[13px] font-bold leading-relaxed text-white/68">This will delete the tournament and remove it from linked games. This action cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setTournamentDeleteId(null)} className="rounded-full bg-white/12 px-5 py-3 text-[11px] font-black text-white">Cancel</button>
              <button type="button" onClick={() => void deleteTournament(tournamentDeleteId)} className="rounded-full bg-red-300 px-5 py-3 text-[11px] font-black text-red-950">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create game modal */}
      {gameCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-5 backdrop-blur-sm lg:items-center lg:pb-0">
          <div className="w-full max-w-2xl rounded-[30px] border border-white/18 bg-[#61716b] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffd66b]">Admin</div><h3 className="mt-1 text-[23px] font-black tracking-[-0.04em] text-white">Create <span className="text-[#ffd66b]">Game</span></h3></div>
              <button type="button" onClick={() => setGameCreateOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white">×</button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-[16px] bg-white/10 p-1">
              {(["football", "basketball"] as const).map((kind) => (
                <button key={kind} type="button" onClick={() => setGameKind(kind)} className={`h-9 rounded-[13px] text-[10px] font-black uppercase tracking-[0.18em] transition ${gameKind === kind ? "bg-[#ffd66b] text-[#365665]" : "text-white/72 hover:bg-white/10"}`}>
                  {kind === "football" ? "Football" : "Basketball"}
                </button>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="block lg:col-span-2">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-white/86">Tournament</span>
                <select value={gameForm.tournament_id} onChange={(e) => setGameForm((cur) => ({ ...cur, tournament_id: e.target.value }))} className="h-10 w-full rounded-[12px] border border-white/20 bg-white px-3 text-[12px] font-black text-[#24352f] outline-none focus:border-[#ffd66b]">
                  <option value="">No tournament</option>
                  {gameTournamentOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <GameInput label={gameKind === "basketball" ? "Team 1" : "Home Team"} value={gameForm.home_team} onChange={(v) => setGameForm((cur) => ({ ...cur, home_team: v }))} />
              <GameInput label={gameKind === "basketball" ? "Team 2" : "Away Team"} value={gameForm.away_team} onChange={(v) => setGameForm((cur) => ({ ...cur, away_team: v }))} />
              <GameInput label="Game Label" value={gameForm.match_label} onChange={(v) => setGameForm((cur) => ({ ...cur, match_label: v }))} />
              <GameInput label="Description" value={gameForm.venue} onChange={(v) => setGameForm((cur) => ({ ...cur, venue: v }))} />
              <GameInput type="datetime-local" label="Match Timing" value={gameForm.kickoff_at} onChange={setKickoffWithDefaultWindow} />
              <GameInput type="datetime-local" label="Open Time" value={gameForm.opens_at} onChange={(v) => setGameForm((cur) => ({ ...cur, opens_at: v }))} />
              <GameInput type="datetime-local" label="Close Time" value={gameForm.closes_at} onChange={(v) => setGameForm((cur) => ({ ...cur, closes_at: v }))} />
            </div>
            <button type="button" onClick={() => void createGame()} disabled={gameSaving} className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-[#ffd66b] px-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#365665] transition hover:bg-[#f0cf61] disabled:cursor-not-allowed disabled:opacity-55">
              {gameSaving ? "Creating..." : "Create Game"}
            </button>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}

export default GamesPage;
