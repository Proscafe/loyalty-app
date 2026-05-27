"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { QrScanner } from "@/components/QrScanner";
import { Toast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type {
  AddStampResult,
  ClientStamp,
  LoyaltyCategory,
  Profile,
  Reward,
} from "@/types";

interface Props {
  profile: Profile;
  categories: LoyaltyCategory[];
}

type ClaimedReward = Reward & {
  client?: Profile;
};

export function StaffConsole({ profile, categories }: Props) {
  // STAFF_SCANNER_BORDER_FIX_V4: scanner button restored; no checkmarks; selected cards use border only and clear immediately after Add Stamp.
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

  const flash = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      setToastTone(tone);
      setToast(message);
      setTimeout(() => setToast(null), 2200);
    },
    [],
  );

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
    const clientIds = Array.from(
      new Set(rewardsToApprove.map((reward) => reward.client_id)),
    );

    if (clientIds.length === 0) {
      setClaimedRewards([]);
      return;
    }

    const { data: clientRows } = await supabase
      .from("profiles")
      .select("*")
      .in("id", clientIds);
    const clientById = new Map<string, Profile>();
    ((clientRows ?? []) as Profile[]).forEach((row) =>
      clientById.set(row.id, row),
    );

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
          .in("status", ["available", "claimed"])
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
      const res = await fetch(
        `/api/client/search?q=${encodeURIComponent(searchValue)}`,
      );
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

  const handleScanResult = useCallback(
    async (text: string) => {
      setScanning(false);
      const code = text.trim();

      if (!code) {
        flash("No client code found in that scan.", "error");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`client_code.eq.${code},id.eq.${code}`)
        .eq("role", "client")
        .maybeSingle();

      if (error || !data) {
        flash("Client not found for that code.", "error");
        return;
      }

      await pickClient(data as Profile);
    },
    [flash, pickClient, supabase],
  );

  function toggleCategory(categoryId: string) {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  }

  async function addStamps() {
    if (!client || selectedCategories.length === 0) return;

    const categoriesToAdd = [...selectedCategories];
    setSelectedCategories([]);
    setBusy(true);

    const earnedRewards: string[] = [];
    let addedCount = 0;

    for (const categoryId of categoriesToAdd) {
      const res = await fetch("/api/stamp/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id, category_id: categoryId }),
      });
      const json: AddStampResult | { error: string } = await res.json();

      if (!res.ok || "error" in json) {
        setBusy(false);
        flash(
          ("error" in json && json.error) || "Could not add stamp.",
          "error",
        );
        await refreshSelectedClient(client.id);
        await loadClaimedRewards();
        return;
      }

      addedCount += 1;

      if (json.reward_earned && json.reward) {
        earnedRewards.push(json.reward.reward_type);

        const earnedReward: Reward = {
          id: json.reward.id,
          client_id: client.id,
          category_id: json.reward.category_id,
          reward_type: json.reward.reward_type,
          status: json.reward.status,
          earned_at: json.reward.earned_at,
          redeemed_at: null,
          redeemed_by: null,
          created_at: json.reward.earned_at,
        };

        setRewards((prev) => {
          if (prev.some((reward) => reward.id === earnedReward.id)) return prev;
          return [earnedReward, ...prev];
        });
      }
    }

    setBusy(false);
    await refreshSelectedClient(client.id);
    await loadClaimedRewards();

    if (earnedRewards.length > 0) {
      flash(`Reward earned: ${earnedRewards.join(", ")}`);
      return;
    }

    flash(
      `Stamp added to ${addedCount} ${addedCount === 1 ? "category" : "categories"}.`,
    );
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
    setClaimedRewards((prev) =>
      prev.filter((reward) => reward.id !== rewardId),
    );
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rewards" },
        () => {
          void loadClaimedRewards();
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(rewardChannel);
    };
  }, [loadClaimedRewards, supabase]);

  useEffect(() => {
    if (!client) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshSelectedClient(client.id);
      }
    }, 2500);

    const selectedClientRewardChannel = supabase
      .channel(`staff-selected-client-rewards-${client.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rewards",
          filter: `client_id=eq.${client.id}`,
        },
        () => {
          void refreshSelectedClient(client.id);
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(selectedClientRewardChannel);
    };
  }, [client, refreshSelectedClient, supabase]);

  const renderRewardCard = (reward: ClaimedReward, showClient = false) => {
    const clientInfo = showClient ? reward.client : null;
    const isClaimed = String(reward.status) === "claimed";

    return (
      <div
        key={reward.id}
        className="card p-4 flex items-center gap-3 border border-black/[0.04] bg-white"
      >
        <div className="size-11 rounded-full bg-brand-500/15 text-xl flex items-center justify-center shrink-0">
          🎁
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-lg leading-tight">
            {reward.reward_type}
          </div>
          <div className="text-xs text-black/50 mt-1">
            {categoryNameById.get(reward.category_id) ?? "Reward"} ·{" "}
            {new Date(reward.earned_at).toLocaleDateString()}
          </div>
          {showClient && clientInfo && (
            <div className="text-xs font-semibold text-black/70 mt-1">
              {clientInfo.full_name} · {clientInfo.client_code}
            </div>
          )}
        </div>
        {isClaimed ? (
          <button
            type="button"
            onClick={() => confirmReward(reward.id)}
            disabled={busy}
            className="btn-primary !py-2 !px-3 text-xs shrink-0"
          >
            Confirm
          </button>
        ) : (
          <span className="rounded-xl bg-black text-white px-3 py-2 text-xs font-bold shrink-0">
            Not claimed
          </span>
        )}
      </div>
    );
  };

  return (
    <AppShell title="Staff Console" role={profile.role}>
      <Toast message={toast} tone={toastTone} />
      {scanning && (
        <QrScanner
          onResult={handleScanResult}
          onClose={() => setScanning(false)}
        />
      )}
      {!client && (
        <section className="mb-4">
          <h1 className="font-display text-3xl font-bold leading-tight mb-1">
            Find a client
          </h1>
          <p className="text-sm text-black/60 mb-5">
            Search by name, phone, member ID, or ID number.
          </p>

          <div className="mb-3 flex gap-2">
            <input
              className="input flex-1"
              placeholder="Search…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="h-12 w-14 shrink-0 rounded-2xl bg-black text-white flex items-center justify-center shadow-card transition active:scale-95"
              aria-label="Scan client barcode or QR code"
              title="Scan client barcode or QR code"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <path d="M8 7v10" />
                <path d="M12 7v10" />
                <path d="M16 7v10" />
              </svg>
            </button>
          </div>

          {claimedRewards.length > 0 && (
            <div className="mb-5 space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-display text-xl font-bold">
                  Reward claims
                </h2>
                <span className="text-xs text-black/50">
                  {claimedRewards.length} pending
                </span>
              </div>
              {claimedRewards.map((reward) => renderRewardCard(reward, true))}
            </div>
          )}

          {searching && (
            <div className="text-xs text-black/50 px-1 mb-2">Searching…</div>
          )}

          <div className="space-y-2">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => pickClient(result)}
                className="card w-full text-left p-4 hover:border-brand-300 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display font-semibold text-lg">
                      {result.full_name}
                    </div>
                    <div className="text-xs text-black/50">
                      {result.client_code}{" "}
                      {result.phone ? `· ${result.phone}` : ""}
                    </div>
                  </div>
                  <div className="text-brand-700 text-xs font-bold">Open →</div>
                </div>
              </button>
            ))}
            {query && !searching && results.length === 0 && (
              <div className="card p-4 text-sm text-black/50 text-center">
                No matches.
              </div>
            )}
          </div>
        </section>
      )}

      {client && (
        <>
          <section className="mb-5">
            <button
              onClick={() => setClient(null)}
              className="text-xs font-semibold text-black/50 mb-3"
            >
              ← Back to search
            </button>
            <div className="card p-5">
              <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold">
                Member
              </div>
              <div className="font-display text-2xl font-bold mt-1">
                {client.full_name}
              </div>
              <div className="text-xs text-black/50 mt-1">
                {client.client_code}
                {client.phone ? ` · ${client.phone}` : ""}
                {client.id_number ? ` · ID ${client.id_number}` : ""}
              </div>
            </div>
          </section>

          {rewards.length > 0 && (
            <section className="mb-5">
              <div className="flex items-center justify-between px-1 mb-3">
                <h2 className="font-display text-xl font-bold">New rewards</h2>
                <span className="text-xs text-black/50">
                  {rewards.length} reward{rewards.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-2">
                {rewards.map((reward) => renderRewardCard(reward))}
              </div>
            </section>
          )}

          <section className="mb-5">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <h2 className="font-display text-xl font-bold">
                  Select categories
                </h2>
                <p className="text-xs text-black/50 mt-1">
                  Choose one or more categories, then add stamps once.
                </p>
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
                    type="button"
                    aria-pressed={active}
                    data-selected={active ? "true" : "false"}
                    onClick={() => toggleCategory(category.id)}
                    className={`rounded-2xl bg-white shadow-card p-4 text-left transition border-2 ${
                      active
                        ? "border-brand-500 ring-2 ring-brand-500/20"
                        : "border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display font-semibold">
                        {category.name}
                      </span>
                      <span className="text-xs font-bold tabular-nums text-black/60">
                        {count}/5
                      </span>
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
