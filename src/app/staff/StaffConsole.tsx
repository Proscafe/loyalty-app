"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
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

const pageGradient =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";



// Loads jsQR as a fallback for browsers without BarcodeDetector (Safari, Firefox)
function loadJsQrScript(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).jsQR) { resolve(); return; }
    const existing = document.getElementById("pros-jsqr-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.id = "pros-jsqr-script";
    s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

function UniversalStableQrScanner({
  onResult,
  onClose,
}: {
  onResult: (value: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const runningRef = useRef(false);
  const detectorRef = useRef<any>(null);
  const useNativeRef = useRef(false);
  const [status, setStatus] = useState("Opening camera...");

  // ── Tear-down: stop stream + cancel any pending animation frame ──
  const stopEverything = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorRef.current = null;
    runningRef.current = false;
  }, []);

  const closeScanner = useCallback(() => {
    stopEverything();
    onClose();
  }, [onClose, stopEverything]);

  const finishWithResult = useCallback(
    async (value: string) => {
      const clean = value.trim();
      if (!clean || lockedRef.current) return;
      lockedRef.current = true;
      setStatus("QR found — opening customer…");
      stopEverything();
      await onResult(clean);
    },
    [onResult, stopEverything],
  );

  // ── Core scan loop — uses requestAnimationFrame, no blinking ──
  const scanLoop = useCallback(() => {
    if (lockedRef.current || !runningRef.current) return;

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.paused) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const doNextFrame = () => {
      if (!lockedRef.current && runningRef.current) {
        rafRef.current = requestAnimationFrame(scanLoop);
      }
    };

    if (useNativeRef.current && detectorRef.current) {
      // Path A: native BarcodeDetector (Chrome / Android WebView)
      (detectorRef.current.detect(video) as Promise<any[]>)
        .then((barcodes) => {
          const val = String(barcodes?.[0]?.rawValue ?? "").trim();
          if (val) { void finishWithResult(val); } else { doNextFrame(); }
        })
        .catch(doNextFrame);
    } else {
      // Path B: jsQR canvas decode (Safari / Firefox fallback)
      const canvas = canvasRef.current;
      if (!canvas) { doNextFrame(); return; }
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) { doNextFrame(); return; }
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) { doNextFrame(); return; }
      ctx.drawImage(video, 0, 0, vw, vh);
      const imageData = ctx.getImageData(0, 0, vw, vh);
      const result = (window as any).jsQR?.(imageData.data, vw, vh, {
        inversionAttempts: "dontInvert",
      });
      if (result?.data) {
        void finishWithResult(result.data);
      } else {
        doNextFrame();
      }
    }
  }, [finishWithResult]);

  // ── Camera start — resets everything first so restart always works ──
  const startCamera = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Full reset so calling startCamera() again always works
    stopEverything();
    lockedRef.current = false;
    setStatus("Opening camera…");

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera not supported on this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { setStatus("Scanner view not ready — please try again."); return; }

      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();

      // Try native BarcodeDetector first, fall back to jsQR
      const NativeBD = (window as any).BarcodeDetector;
      if (NativeBD) {
        detectorRef.current = new NativeBD({ formats: ["qr_code"] });
        useNativeRef.current = true;
        setStatus("Point your camera at the QR code.");
        runningRef.current = true;
        rafRef.current = requestAnimationFrame(scanLoop);
      } else {
        setStatus("Loading QR engine…");
        try {
          await loadJsQrScript();
          useNativeRef.current = false;
          setStatus("Point your camera at the QR code.");
          runningRef.current = true;
          rafRef.current = requestAnimationFrame(scanLoop);
        } catch {
          setStatus("QR engine failed to load. Try refreshing the page.");
        }
      }
    } catch {
      setStatus("Camera permission blocked. Allow camera access and tap Restart.");
    }
  }, [scanLoop, stopEverything]);

  useEffect(() => {
    void startCamera();
    return () => stopEverything();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-5 text-white backdrop-blur-sm">
      {/* Hidden canvas used by jsQR path — never visible */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-white/15 bg-[#1c2530] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
              Scan QR
            </div>
            <div className="mt-1 text-[18px] font-black text-white">
              Find customer
            </div>
          </div>

          <button
            type="button"
            onClick={closeScanner}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[20px] font-black text-white"
            aria-label="Close QR scanner"
          >
            ×
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[18px] bg-black">
          <video
            ref={videoRef}
            className="h-[320px] w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          {/* Viewfinder overlay — purely decorative, no blinking */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[210px] w-[210px]">
              {/* Dimming outside the box */}
              <div className="absolute inset-0 rounded-[28px] shadow-[0_0_0_999px_rgba(0,0,0,0.32)]" />
              {/* Corner brackets */}
              <div className="absolute -left-0.5 -top-0.5 h-10 w-10 rounded-tl-[28px] border-l-[3px] border-t-[3px] border-[#ffd66b]" />
              <div className="absolute -right-0.5 -top-0.5 h-10 w-10 rounded-tr-[28px] border-r-[3px] border-t-[3px] border-[#ffd66b]" />
              <div className="absolute -bottom-0.5 -left-0.5 h-10 w-10 rounded-bl-[28px] border-b-[3px] border-l-[3px] border-[#ffd66b]" />
              <div className="absolute -bottom-0.5 -right-0.5 h-10 w-10 rounded-br-[28px] border-b-[3px] border-r-[3px] border-[#ffd66b]" />
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[13px] font-bold leading-5 text-white/75">
          {status}
        </p>

        <button
          type="button"
          onClick={() => void startCamera()}
          className="mt-3 w-full rounded-full bg-white/14 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white active:scale-95"
        >
          Restart Camera
        </button>
      </div>
    </div>
  );
}

function StaffConsole({ profile, categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [showPasswordEditor, setShowPasswordEditor] = useState(false);
  const [newPassword, setNewPassword] = useState("");
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

  async function cleanupRewardTimers() {
    try {
      await supabase.rpc("reset_stale_claimed_rewards");
      await supabase.rpc("expire_old_rewards");
    } catch {
      // Best-effort cleanup only. Never block staff screen loading.
    }
  }

  const loadClaimedRewards = useCallback(async () => {
    await cleanupRewardTimers();
    

    const { data: rewardRows, error } = await supabase
      .from("rewards")
      .select("*")
      .eq("status", "claimed")
      .order("claimed_at", { ascending: true });

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
  }, [cleanupRewardTimers, flash, supabase]);

  const refreshSelectedClient = useCallback(
    async (clientId: string) => {
      await cleanupRewardTimers();
      

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
    [cleanupRewardTimers, supabase],
  );

  const runSearch = useCallback(
    async (searchValue: string) => {
      setSearching(true);
      const res = await fetch(`/api/client/search?q=${encodeURIComponent(searchValue)}`);
      const json = await readApiResponse<{ results?: Profile[] }>(res);
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
      setShowPasswordEditor(false);
      setNewPassword("");
      await refreshSelectedClient(selectedClient.id);
    },
    [refreshSelectedClient],
  );

  function normalizeScannedCode(rawValue: string) {
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
      // QR is usually a plain client code.
    }

    return trimmed.replace(/^#/, "");
  }

  const loadClientFromScannedCode = useCallback(
    async (rawCode: string, updateUrl = true) => {
      const code = normalizeScannedCode(rawCode);

      if (!code) {
        flash("QR code is empty.", "error");
        setScanning(false);
        return;
      }

      try {
        const res = await fetch(`/api/client/scan?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        const json = await readApiResponse<{ client?: Profile }>(res);

        if (!res.ok || !json.client) {
          flash(json.error ? `${json.error}: ${code}` : `Client not found for QR: ${code}`, "error");
          setScanning(false);
          return;
        }

        const foundClient = json.client as Profile;

        setScanning(false);
        setClient(foundClient);
        setResults([]);
        setQuery("");
        setSelectedCategories([]);
        setShowPasswordEditor(false);
          setNewPassword("");
        await refreshSelectedClient(foundClient.id);
        await loadClaimedRewards();

        const nextPath = `/staff?client=${encodeURIComponent(foundClient.client_code ?? foundClient.id)}`;

        if (updateUrl) {
          window.history.replaceState(null, "", nextPath);
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
        flash(`Opened ${foundClient.full_name}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not open scanned client.";
        flash(message, "error");
        setScanning(false);
      }
    },
    [flash, loadClaimedRewards, refreshSelectedClient],
  );

  async function onScanResult(text: string) {
    await loadClientFromScannedCode(text);
  }

  function toggleCategory(categoryId: string) {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  }

  async function readApiResponse<T = any>(res: Response): Promise<T & { error?: string }> {
    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return (await res.json().catch(() => ({}))) as T & { error?: string };
    }

    const text = await res.text().catch(() => "");
    return {
      error:
        text && text.length < 140
          ? text
          : `API route failed with status ${res.status}. Make sure the route file exists and restart the server.`,
    } as T & { error?: string };
  }

  async function saveClientPassword() {
    if (!client) return;

    const trimmedPassword = newPassword.trim();

    if (trimmedPassword.length < 6) {
      flash("Password must be at least 6 characters.", "error");
      return;
    }

    setBusy(true);

    const res = await fetch("/api/staff/client-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: client.id, password: trimmedPassword }),
    });

    const json = await readApiResponse(res);

    setBusy(false);

    if (!res.ok) {
      flash(json.error ?? `Could not update password. Status ${res.status}`, "error");
      return;
    }

    setNewPassword("");
    setShowPasswordEditor(false);
    flash("Client password updated.");
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
      const json = await readApiResponse<AddStampResult>(res);

      if (!res.ok || "error" in json) {
        setBusy(false);
        const errorMessage = "error" in json ? String(json.error || "") : "";
        flash(
          errorMessage.includes("one_stamp_per_client_per_category_per_day")
            ? "This client already received today's stamp in this category."
            : errorMessage || "Could not add stamp.",
          "error",
        );
        await refreshSelectedClient(client.id);
        await loadClaimedRewards();
        return;
      }

      addedCount += 1;

      if (json.reward_earned && json.reward) {
        earnedRewards.push(json.reward.reward_type);
      }
    }

    setSelectedCategories([]);
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
    const json = await readApiResponse(res);
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
    const codeFromUrl = searchParams.get("client");
    if (!codeFromUrl || client) return;
    void loadClientFromScannedCode(codeFromUrl, false);
  }, [client, loadClientFromScannedCode, searchParams]);

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

  function maskPhoneNumber(value?: string | null) {
    const raw = String(value || "").trim();

    if (!raw) return "No phone";

    const compact = raw.replace(/\s+/g, "");
    const digits = compact.replace(/\D/g, "");

    if (digits.length < 6) return compact;

    return `${digits.slice(0, 2)}***${digits.slice(-3)}`;
  }

  function singularRewardTitle(value?: string | null) {
    const text = String(value || "Reward")
      .replace(/ Item$/i, "")
      .trim();

    if (/sandwiches/i.test(text)) return text.replace(/sandwiches/i, "Sandwich");
    if (/desserts/i.test(text)) return text.replace(/desserts/i, "Dessert");
    if (/main courses/i.test(text)) return text.replace(/main courses/i, "Main Course");
    if (/coffees/i.test(text)) return text.replace(/coffees/i, "Coffee");
    if (/hookas|hookahs/i.test(text)) return text.replace(/hookas|hookahs/i, "Hooka");

    return text;
  }

  const renderRewardCard = (reward: ClaimedReward, showClient = false) => {
    const clientInfo = showClient ? reward.client : null;

    return (
      <div
        key={reward.id}
        className="rounded-[28px] border border-white/25 bg-white/18 p-4 text-white shadow-[0_20px_55px_rgba(72,24,25,0.18)] backdrop-blur-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-white/20">
            <Image
              src={
                reward.reward_type === "20% Discount" || reward.reward_type === "Free Dessert"
                  ? "/birthday-cake.png"
                  : "/gift.png"
              }
              alt=""
              width={38}
              height={38}
              className="h-[38px] w-[38px] object-contain"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-raleway text-[17px] font-black leading-tight text-[#ffd66b]">
              {singularRewardTitle(reward.reward_type)}
            </div>
            {showClient && clientInfo && (
              <div className="mt-1 truncate text-[12px] font-black text-white">
                {clientInfo.full_name} · {maskPhoneNumber(clientInfo.phone)}
              </div>
            )}
            <div className="mt-1 text-[12px] font-bold text-white/88">
              Claimed {new Date((reward as any).claimed_at || reward.earned_at || reward.created_at).toLocaleDateString()}
            </div>
            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#ffd66b]">
              Pending approval
            </div>
          </div>

          <button
            type="button"
            onClick={() => confirmReward(reward.id)}
            disabled={busy}
            className="shrink-0 rounded-full bg-[#ffd66b] px-5 py-2 text-[12px] font-black text-[#365665] shadow-[0_12px_26px_rgba(255,214,107,0.22)] disabled:opacity-55"
          >
            Confirm
          </button>
        </div>
      </div>
    );
  };

  return (
    <AppShell title="Staff Console" role={profile.role} pageBackground={pageGradient}>
      <Toast message={toast} tone={toastTone} />
      {scanning && <UniversalStableQrScanner onResult={onScanResult} onClose={() => setScanning(false)} />}

      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-5 font-raleway text-white">
        {!client && (
          <section className="space-y-5">
            <div className="relative overflow-hidden rounded-[16px] border border-white/20 bg-white/12 px-5 py-5 shadow-[0_18px_50px_rgba(71,23,24,0.14)] backdrop-blur-2xl">
              <Image
                src="/client-main-card.png"
                alt=""
                width={360}
                height={180}
                priority
                className="pointer-events-none absolute inset-0 h-full w-[130%] translate-x-10 scale-[1.08] object-cover object-right opacity-60"
              />
              <div className="relative">
                <h1 className="text-[28px] font-black leading-[1.05] tracking-[-0.04em] text-white">
                  Hello,
                  <br />
                  <span className="text-[#ffd66b]">{profile.full_name || "Staff"}</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 rounded-full border border-white/45 bg-[#e7e9e3] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_14px_34px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
                <input
                  className="h-8 w-full bg-transparent text-[14px] font-black text-[#365665] outline-none placeholder:text-[#365665]/58"
                  placeholder="Search for client..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                />
              </div>

              <button
                type="button"
                onClick={() => setScanning(true)}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/45 bg-[#e7e9e3] text-[#365665] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_14px_34px_rgba(0,0,0,0.08)] backdrop-blur-2xl active:scale-95"
                title="Scan QR"
                aria-label="Scan QR"
              >
                <span className="relative block h-6 w-6">
                  <span className="absolute left-0 top-0 h-2.5 w-2.5 rounded-[3px] border-2 border-[#365665]" />
                  <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-[3px] border-2 border-[#365665]" />
                  <span className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-[3px] border-2 border-[#365665]" />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-[3px] border-2 border-[#365665]" />
                </span>
              </button>
            </div>

            {searching && <div className="px-1 text-[12px] font-bold text-white/70">Searching...</div>}

            <div className="space-y-3">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => pickClient(result)}
                  className="w-full rounded-[24px] border border-white/18 bg-white/18 p-4 text-left shadow-[0_14px_38px_rgba(72,24,25,0.10)] backdrop-blur-2xl transition active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[18px] font-black text-white">{result.full_name}</div>
                      {(result.phone || result.id_number) && (
                        <div className="mt-1 truncate text-[13px] font-bold text-white/70">
                          {maskPhoneNumber(result.phone) || "No phone"}
                          {result.id_number ? ` - ID ${result.id_number}` : ""}
                        </div>
                      )}
                      <div className="mt-1 truncate text-[12px] font-bold text-white/48">
                        {result.client_code}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full bg-[#ffd66b] px-5 py-2 text-[12px] font-black text-[#365665] shadow-[0_12px_26px_rgba(255,214,107,0.20)]">
                      Open
                    </div>
                  </div>
                </button>
              ))}

              {query && !searching && results.length === 0 && (
                <div className="rounded-[26px] border border-white/20 bg-white/18 p-5 text-center text-[14px] font-semibold text-white/72 backdrop-blur-2xl">
                  No matches.
                </div>
              )}
            </div>

            {claimedRewards.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[21px] font-black text-white">Reward Claims</h2>
                  <span className="rounded-full bg-white/16 px-3 py-1 text-[11px] font-black text-[#ffd66b]">
                    {claimedRewards.length} pending
                  </span>
                </div>
                {claimedRewards.map((reward) => renderRewardCard(reward, true))}
              </div>
            )}
          </section>
        )}

        {client && (
          <>
            <section className="mb-5">
              <button
                type="button"
                onClick={() => {
                  setClient(null);
                  router.replace("/staff", { scroll: false });
                }}
                className="mb-3 rounded-full bg-white/14 px-4 py-2 text-[12px] font-black text-white/82 backdrop-blur-xl"
              >
                Back to search
              </button>

              <div className="relative overflow-hidden rounded-[34px] border border-white/20 bg-white/16 p-6 shadow-[0_24px_70px_rgba(71,23,24,0.20)] backdrop-blur-2xl">
                <Image
                  src="/client-main-card.png"
                  alt=""
                  width={420}
                  height={210}
                  priority
                  className="pointer-events-none absolute inset-0 h-full w-[130%] translate-x-10 scale-[1.08] object-cover object-right opacity-60"
                />
                <div className="relative">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.34em] text-white">
                    Member
                  </p>
                  <h1 className="text-[32px] font-black uppercase leading-[0.95] tracking-[-0.04em] text-[#ffd66b]">
                    {client.full_name}
                  </h1>

                  {(client.phone || client.id_number) && (
                    <div className="mt-4 text-[14px] font-bold text-white/78">
                      {maskPhoneNumber(client.phone) || "No phone"}
                      {client.id_number ? ` - ID ${client.id_number}` : ""}
                    </div>
                  )}

                  <div className="mt-1 text-[12px] font-black uppercase tracking-[0.18em] text-white/55">
                    {client.client_code}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordEditor((value) => !value);
                                        }}
                      className="rounded-full bg-[#ffd66b] px-4 py-2 text-[12px] font-black text-[#365665] shadow-[0_12px_26px_rgba(255,214,107,0.20)]"
                    >
                      Change password
                    </button>
                  </div>

                  {showPasswordEditor && (
                    <div className="mt-4 rounded-[22px] border border-white/18 bg-white/14 p-3 backdrop-blur-xl">
                      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                        New password
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          placeholder="New password"
                          className="min-w-0 flex-1 rounded-full bg-[#e7e9e3] px-4 py-3 text-[13px] font-black text-[#365665] outline-none placeholder:text-[#365665]/55"
                        />
                        <button
                          type="button"
                          onClick={saveClientPassword}
                          disabled={busy}
                          className="rounded-full bg-[#ffd66b] px-5 py-3 text-[12px] font-black text-[#365665] disabled:opacity-60"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </section>

            {rewards.length > 0 && (
              <section className="mb-5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[21px] font-black text-white">Reward Claims</h2>
                  <span className="rounded-full bg-white/16 px-3 py-1 text-[11px] font-black text-[#ffd66b]">
                    {rewards.length} pending
                  </span>
                </div>
                {rewards.map((reward) => renderRewardCard(reward))}
              </section>
            )}

            <section className="mb-5">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-black text-white">Select Categories</h2>
                  <p className="mt-1 text-[12px] font-semibold text-white/68">
                    Choose one or more categories.
                  </p>
                </div>
                {selectedCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="shrink-0 rounded-full bg-white/14 px-3 py-1 text-[11px] font-black text-white/72"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {categories.map((category) => {
                  const count = stampByCat.get(category.id) ?? 0;
                  const active = selectedCategories.includes(category.id);

                  return (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`rounded-[28px] border p-4 text-left shadow-[0_18px_45px_rgba(72,24,25,0.13)] backdrop-blur-2xl transition active:scale-[0.99] ${
                        active
                          ? "border-[#ffd66b] bg-white/28 ring-2 ring-[#ffd66b]/35"
                          : "border-white/20 bg-white/16"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-[17px] font-black text-white">{category.name === "Desserts 2" ? "Hooka" : category.name}</span>
                        <span className="rounded-full bg-white/16 px-3 py-1 text-[12px] font-black tabular-nums text-[#ffd66b]">
                          {count}/5
                        </span>
                      </div>

                      <div className="flex gap-1.5">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <div
                            key={index}
                            className={`h-2.5 flex-1 rounded-full ${
                              index < count ? "bg-[#ffd66b]" : "bg-[#d9ded5]/45"
                            }`}
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
                className="w-full rounded-[24px] bg-[#ffd66b] px-6 py-4 text-[15px] font-black text-[#365665] shadow-[0_18px_40px_rgba(255,214,107,0.22)] disabled:opacity-70"
              >
                {busy ? "Working..." : "Stamp it!"}
              </motion.button>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

export { StaffConsole };
export default StaffConsole;
