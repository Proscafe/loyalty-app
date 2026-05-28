"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

// STAFF_QR_EXACT_SCAN_FIX_V1
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
      // The QR is usually a plain client code, not a URL.
    }

    return trimmed.replace(/^#/, "");
  }

  async function onScanResult(text: string) {
    setScanning(false);
    const code = normalizeScannedCode(text);

    if (!code) {
      flash("QR code is empty.", "error");
      return;
    }

    const res = await fetch(`/api/client/scan?code=${encodeURIComponent(code)}`);
    const json = await res.json();

    if (!res.ok || !json.client) {
      flash(json.error ? `${json.error}: ${code}` : `Client not found for QR: ${code}`, "error");
      return;
    }

    await pickClient(json.client as Profile);
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
          <div className="font-display font-bold text-[#071a20]">{reward.reward_type}</div>
          <div className="text-xs text-[#071a20]/60">
            {categoryNameById.get(reward.category_id) ?? "Reward"} · Earned {new Date(reward.earned_at).toLocaleDateString()}
          </div>
          {showClient && clientInfo && (
            <div className="text-xs font-semibold text-[#071a20]/75 mt-1">
              {clientInfo.full_name} · {clientInfo.client_code}
            </div>
          )}
          <div className="text-[11px] font-semibold text-[#91534c] mt-1">
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
      {scanning && <QrScanner onResult={onScanResult} onClose={() => setScanning(false)} />}

      {!client && (
        <section className="mb-4">
          <h1 className="font-display text-3xl font-bold leading-tight mb-1 text-[#071a20]">Find a client</h1>
          <p className="text-sm text-[#071a20]/70 mb-5">Scan their QR or search by name, phone, member ID, or ID number.</p>

          <div className="flex gap-2 mb-3">
            <input
              className="input bg-white !text-[#071a20] placeholder:!text-[#071a20]/45 caret-[#071a20]"
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
                <h2 className="font-display text-xl font-bold text-[#071a20]">Reward claims</h2>
                <span className="text-xs text-[#071a20]/60">{claimedRewards.length} pending</span>
              </div>
              {claimedRewards.map((reward) => renderRewardCard(reward, true))}
            </div>
          )}

          {searching && <div className="text-xs text-[#071a20]/60 px-1 mb-2">Searching…</div>}

          <div className="space-y-2">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => pickClient(result)}
                className="card w-full text-left p-4 hover:border-brand-300 transition text-[#071a20]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-lg text-[#071a20] truncate">{result.full_name}</div>
                    {(result.phone || result.id_number) && (
                      <div className="text-sm text-[#071a20]/70 mt-0.5 truncate">
                        {result.phone || "No phone"}{result.id_number ? ` - ID ${result.id_number}` : ""}
                      </div>
                    )}
                    <div className="text-xs text-[#071a20]/55 mt-1 truncate">
                      {result.client_code}
                    </div>
                  </div>
                  <div className="text-[#91534c] text-xs font-bold shrink-0">Open →</div>
                </div>
              </button>
            ))}
            {query && !searching && results.length === 0 && (
              <div className="card p-4 text-sm text-[#071a20]/60 text-center">No matches.</div>
            )}
          </div>
        </section>
      )}

      {client && (
        <>
          <section className="mb-5">
            <button onClick={() => setClient(null)} className="text-xs font-semibold text-[#071a20]/70 mb-3">
              ← Back to search
            </button>
            <div className="card p-5 text-[#071a20]">
              <div className="text-[10px] uppercase tracking-widest text-[#071a20]/55 font-semibold">Member</div>
              <div className="font-display text-2xl font-bold mt-1 text-[#071a20]">{client.full_name}</div>
              {(client.phone || client.id_number) && (
                <div className="text-sm text-[#071a20]/75 mt-1">
                  {client.phone || "No phone"}{client.id_number ? ` - ID ${client.id_number}` : ""}
                </div>
              )}
              <div className="text-xs text-[#071a20]/55 mt-1">
                {client.client_code}
              </div>
            </div>
          </section>

          {rewards.length > 0 && (
            <section className="mb-5">
              <div className="flex items-center justify-between px-1 mb-3">
                <h2 className="font-display text-xl font-bold text-[#071a20]">Reward claims</h2>
                <span className="text-xs text-[#071a20]/60">{rewards.length} pending</span>
              </div>
              <div className="space-y-2">{rewards.map((reward) => renderRewardCard(reward))}</div>
            </section>
          )}

          <section className="mb-5">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <h2 className="font-display text-xl font-bold text-[#071a20]">Select categories</h2>
                <p className="text-xs text-[#071a20]/60 mt-1">Choose one or more categories, then add stamps once.</p>
              </div>
              {selectedCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategories([])}
                  className="text-xs font-semibold text-[#071a20]/60 shrink-0"
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
                    className={`card p-4 text-left transition text-[#071a20] ${active ? "border-2 border-[#91534c] ring-2 ring-[#91534c]/20" : "border border-transparent"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display font-semibold text-[#071a20]">{category.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tabular-nums text-[#071a20]/65">{count}/5</span>
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
