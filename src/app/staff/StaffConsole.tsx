"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { QrScanner } from "@/components/QrScanner";
import { Toast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { AddStampResult, ClientStamp, LoyaltyCategory, Profile, Reward } from "@/types";

interface Props {
  profile: Profile;
  categories: LoyaltyCategory[];
}

type ClaimedReward = Reward & {
  client?: Profile;
};

type NativeBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type NativeBarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => NativeBarcodeDetector;

type WindowWithBarcodeDetector = Window & {
  BarcodeDetector?: NativeBarcodeDetectorConstructor;
};

function normalizeScannedClientCode(rawValue: string) {
  const trimmed = rawValue.trim();

  try {
    const url = new URL(trimmed);
    const fromQuery =
      url.searchParams.get("client_code") ??
      url.searchParams.get("code") ??
      url.searchParams.get("client") ??
      url.searchParams.get("id");

    if (fromQuery) return fromQuery.trim().replace(/^#/, "");

    const lastPathPart = url.pathname.split("/").filter(Boolean).pop();
    if (lastPathPart) return decodeURIComponent(lastPathPart).trim().replace(/^#/, "");
  } catch {
    // Most QR codes are plain client codes, not full URLs.
  }

  return trimmed.replace(/^#/, "");
}

function FastQrScanner({
  onResult,
  onClose,
}: {
  onResult: (value: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const [nativeSupported, setNativeSupported] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const BarcodeDetector = (window as WindowWithBarcodeDetector).BarcodeDetector;

    if (!BarcodeDetector) {
      setNativeSupported(false);
      return;
    }

    let cancelled = false;
    const detector = new BarcodeDetector({ formats: ["qr_code"] });

    function stopCamera() {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    async function scanFrame() {
      if (cancelled || lockedRef.current) return;

      const video = videoRef.current;

      if (video && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          const rawValue = codes[0]?.rawValue?.trim();

          if (rawValue) {
            lockedRef.current = true;
            stopCamera();
            await onResult(rawValue);
            return;
          }
        } catch {
          // Keep scanning. Camera focus can make some frames unreadable.
        }
      }

      frameRef.current = requestAnimationFrame(() => {
        void scanFrame();
      });
    }

    async function openCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          setReady(true);
          void scanFrame();
        }
      } catch (error) {
        setCameraError(error instanceof Error ? error.message : "Camera could not open.");
      }
    }

    void openCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [onResult]);

  if (!nativeSupported) {
    return <QrScanner onResult={onResult} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white">
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_34%,rgba(0,0,0,0.62)_35%,rgba(0,0,0,0.84)_100%)]" />

      <div className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-[32px] border-2 border-brand-500 shadow-[0_0_0_999px_rgba(0,0,0,0.10)]">
        <div className="absolute -left-1 -top-1 h-12 w-12 rounded-tl-[32px] border-l-4 border-t-4 border-white" />
        <div className="absolute -right-1 -top-1 h-12 w-12 rounded-tr-[32px] border-r-4 border-t-4 border-white" />
        <div className="absolute -bottom-1 -left-1 h-12 w-12 rounded-bl-[32px] border-b-4 border-l-4 border-white" />
        <div className="absolute -bottom-1 -right-1 h-12 w-12 rounded-br-[32px] border-b-4 border-r-4 border-white" />
      </div>

      <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-5">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.28em] text-brand-300">
            Fast Scanner
          </div>
          <div className="mt-1 text-[14px] font-black text-white">
            Point the phone camera at the QR
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/14 px-4 py-2 text-[12px] font-black text-white backdrop-blur-xl"
        >
          Close
        </button>
      </div>

      <div className="absolute bottom-8 left-5 right-5 rounded-[24px] border border-white/18 bg-black/38 p-4 text-center backdrop-blur-2xl">
        {cameraError ? (
          <div className="text-[13px] font-bold leading-5 text-red-200">
            {cameraError}
          </div>
        ) : (
          <div className="text-[13px] font-bold leading-5 text-white/82">
            {ready
              ? "Scanning with the phone camera. It stops automatically when the QR is found."
              : "Opening camera..."}
          </div>
        )}
      </div>
    </div>
  );
}

export function StaffConsole({ profile, categories }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [client, setClient] = useState<Profile | null>(null);
  const [stamps, setStamps] = useState<ClientStamp[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<ClaimedReward[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "error">("success");

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => map.set(category.id, category.name));
    return map;
  }, [categories]);

  const stampByCat = useMemo(() => {
    const map = new Map<string, number>();
    stamps.forEach((stamp) => map.set(stamp.category_id, stamp.stamp_count));
    return map;
  }, [stamps]);

  const flash = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToastTone(tone);
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const loadClaimedRewards = useCallback(async () => {
    const { data: rewardRows, error } = await supabase
      .from("rewards")
      .select("*")
      .eq("status", "claimed")
      .order("earned_at", { ascending: true });

    if (error) {
      flash("Could not load claim requests.", "error");
      return;
    }

    const rewardsToApprove = (rewardRows ?? []) as Reward[];
    const clientIds = Array.from(new Set(rewardsToApprove.map((reward) => reward.client_id)));

    if (clientIds.length === 0) {
      setClaimedRewards([]);
      return;
    }

    const { data: clientRows } = await supabase.from("profiles").select("*").in("id", clientIds);
    const clientById = new Map<string, Profile>();
    ((clientRows ?? []) as Profile[]).forEach((row) => clientById.set(row.id, row));

    setClaimedRewards(
      rewardsToApprove.map((reward) => ({
        ...reward,
        client: clientById.get(reward.client_id),
      })),
    );
  }, [flash, supabase]);

  const refreshSelectedClient = useCallback(
    async (clientId: string) => {
      const [{ data: nextStamps }, { data: nextRewards }] = await Promise.all([
        supabase.from("client_stamps").select("*").eq("client_id", clientId),
        supabase
          .from("rewards")
          .select("*")
          .eq("client_id", clientId)
          .eq("status", "claimed")
          .order("earned_at", { ascending: false }),
      ]);

      setStamps((nextStamps ?? []) as ClientStamp[]);
      setRewards((nextRewards ?? []) as Reward[]);
    },
    [supabase],
  );

  const runSearch = useCallback(
    async (searchValue: string) => {
      setSearching(true);
      const res = await fetch(`/api/client/search?q=${encodeURIComponent(searchValue)}`);
      const json = await res.json();
      setSearching(false);

      if (!res.ok) {
        flash(json.error ?? "Search failed", "error");
        return;
      }

      setResults(json.results ?? []);
    },
    [flash],
  );

  const pickClient = useCallback(
    async (selectedClient: Profile) => {
      setClient(selectedClient);
      setResults([]);
      setQuery("");
      setSelectedCategories([]);
      await refreshSelectedClient(selectedClient.id);
    },
    [refreshSelectedClient],
  );

  async function onScanResult(text: string) {
    setScanning(false);
    const code = normalizeScannedClientCode(text);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`client_code.eq.${code},id.eq.${code}`)
      .eq("role", "client")
      .maybeSingle();

    if (error || !data) {
      flash("Client not found for that QR.", "error");
      return;
    }

    await pickClient(data as Profile);
  }

  function toggleCategory(categoryId: string) {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  }

  async function addStamps() {
    if (!client || selectedCategories.length === 0) return;

    setBusy(true);

    const earnedRewards: string[] = [];
    let addedCount = 0;

    for (const categoryId of selectedCategories) {
      const res = await fetch("/api/stamp/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id, category_id: categoryId }),
      });
      const json: AddStampResult | { error: string } = await res.json();

      if (!res.ok || "error" in json) {
        setBusy(false);
        flash(("error" in json && json.error) || "Could not add stamp.", "error");
        await refreshSelectedClient(client.id);
        await loadClaimedRewards();
        return;
      }

      addedCount += 1;

      if (json.reward_earned && json.reward) {
        earnedRewards.push(json.reward.reward_type);
      }
    }

    setBusy(false);
    await refreshSelectedClient(client.id);
    await loadClaimedRewards();

    if (earnedRewards.length > 0) {
      flash(`Reward earned: ${earnedRewards.join(", ")}`);
      return;
    }

    flash(`Stamp added to ${addedCount} ${addedCount === 1 ? "category" : "categories"}.`);
  }

  async function confirmReward(rewardId: string) {
    setBusy(true);
    const res = await fetch("/api/reward/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reward_id: rewardId }),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      flash(json.error ?? "Confirm failed", "error");
      return;
    }

    setRewards((prev) => prev.filter((reward) => reward.id !== rewardId));
    setClaimedRewards((prev) => prev.filter((reward) => reward.id !== rewardId));
    flash("Reward confirmed.");

    if (client) await refreshSelectedClient(client.id);
    await loadClaimedRewards();
  }

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => runSearch(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(() => {
    void loadClaimedRewards();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadClaimedRewards();
      }
    }, 2500);

    const rewardChannel = supabase
      .channel("staff-claimed-rewards")
      .on("postgres_changes", { event: "*", schema: "public", table: "rewards" }, () => {
        void loadClaimedRewards();
      })
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(rewardChannel);
    };
  }, [loadClaimedRewards, supabase]);

  const renderRewardCard = (reward: ClaimedReward, showClient = false) => {
    const clientInfo = showClient ? reward.client : null;

    return (
      <div
        key={reward.id}
        className="card p-4 flex items-center gap-3 bg-gradient-to-r from-brand-50 to-white border-brand-200"
      >
        <div className="size-10 rounded-full bg-brand-500 text-white flex items-center justify-center">🎁</div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold">{reward.reward_type}</div>
          <div className="text-xs text-black/50">
            {categoryNameById.get(reward.category_id) ?? "Reward"} · Earned {new Date(reward.earned_at).toLocaleDateString()}
          </div>
          {showClient && clientInfo && (
            <div className="text-xs font-semibold text-black/70 mt-1">
              {clientInfo.full_name} · {clientInfo.client_code}
            </div>
          )}
          <div className="text-[11px] font-semibold text-brand-700 mt-1">
            Client requested approval
          </div>
        </div>
        <button
          type="button"
          onClick={() => confirmReward(reward.id)}
          disabled={busy}
          className="btn-primary !py-2 !px-3 text-xs shrink-0"
        >
          Confirm
        </button>
      </div>
    );
  };

  return (
    <AppShell title="Staff Console" role={profile.role}>
      <Toast message={toast} tone={toastTone} />
      {scanning && <FastQrScanner onResult={onScanResult} onClose={() => setScanning(false)} />}

      {!client && (
        <section className="mb-4">
          <h1 className="font-display text-3xl font-bold leading-tight mb-1">Find a client</h1>
          <p className="text-sm text-black/60 mb-5">Scan their QR or search by name, phone, member ID, or ID number.</p>

          <div className="flex gap-2 mb-3">
            <input
              className="input"
              placeholder="Search…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
            <button onClick={() => setScanning(true)} className="btn-primary !px-4 shrink-0" title="Scan QR">
              <span aria-hidden>📷</span>
            </button>
          </div>

          {claimedRewards.length > 0 && (
            <div className="mb-5 space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-display text-xl font-bold">Reward claims</h2>
                <span className="text-xs text-black/50">{claimedRewards.length} pending</span>
              </div>
              {claimedRewards.map((reward) => renderRewardCard(reward, true))}
            </div>
          )}

          {searching && <div className="text-xs text-black/50 px-1 mb-2">Searching…</div>}

          <div className="space-y-2">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => pickClient(result)}
                className="card w-full text-left p-4 hover:border-brand-300 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display font-semibold text-lg">{result.full_name}</div>
                    <div className="text-xs text-black/50">
                      {result.client_code} {result.phone ? `· ${result.phone}` : ""}
                    </div>
                  </div>
                  <div className="text-brand-700 text-xs font-bold">Open →</div>
                </div>
              </button>
            ))}
            {query && !searching && results.length === 0 && (
              <div className="card p-4 text-sm text-black/50 text-center">No matches.</div>
            )}
          </div>
        </section>
      )}

      {client && (
        <>
          <section className="mb-5">
            <button onClick={() => setClient(null)} className="text-xs font-semibold text-black/50 mb-3">
              ← Back to search
            </button>
            <div className="card p-5">
              <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold">Member</div>
              <div className="font-display text-2xl font-bold mt-1">{client.full_name}</div>
              <div className="text-xs text-black/50 mt-1">
                {client.client_code}{client.phone ? ` · ${client.phone}` : ""}{client.id_number ? ` · ID ${client.id_number}` : ""}
              </div>
            </div>
          </section>

          {rewards.length > 0 && (
            <section className="mb-5">
              <div className="flex items-center justify-between px-1 mb-3">
                <h2 className="font-display text-xl font-bold">Reward claims</h2>
                <span className="text-xs text-black/50">{rewards.length} pending</span>
              </div>
              <div className="space-y-2">{rewards.map((reward) => renderRewardCard(reward))}</div>
            </section>
          )}

          <section className="mb-5">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <h2 className="font-display text-xl font-bold">Select categories</h2>
                <p className="text-xs text-black/50 mt-1">Choose one or more categories, then add stamps once.</p>
              </div>
              {selectedCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategories([])}
                  className="text-xs font-semibold text-black/50 shrink-0"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {categories.map((category) => {
                const count = stampByCat.get(category.id) ?? 0;
                const active = selectedCategories.includes(category.id);

                return (
                  <button
                    key={category.id}
                    onClick={() => toggleCategory(category.id)}
                    className={`card p-4 text-left transition ${active ? "ring-2 ring-brand-500 border-brand-300" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display font-semibold">{category.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tabular-nums text-black/60">{count}/5</span>
                        <span
                          className={`size-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                            active ? "bg-brand-500 border-brand-500 text-white" : "border-black/15 text-black/20"
                          }`}
                        >
                          {active ? "✓" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div
                          key={index}
                          className={`flex-1 h-2 rounded-full ${index < count ? "bg-brand-500" : "bg-black/[0.07]"}`}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mb-12">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={addStamps}
              disabled={selectedCategories.length === 0 || busy}
              className="btn-brand w-full text-base !py-4"
            >
              {busy
                ? "Working…"
                : selectedCategories.length > 0
                  ? `Add stamp to ${selectedCategories.length} ${selectedCategories.length === 1 ? "category" : "categories"}`
                  : "Pick at least one category"}
            </motion.button>
          </section>
        </>
      )}
    </AppShell>
  );
}
