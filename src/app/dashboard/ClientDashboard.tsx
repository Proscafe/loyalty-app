"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/AppShell";
import { RewardCelebration } from "@/components/RewardCelebration";
import { Toast } from "@/components/Toast";
import type { ClientStamp, LoyaltyCategory, Profile, Reward } from "@/types";

interface Props {
  profile: Profile;
  categories: LoyaltyCategory[];
  initialStamps: ClientStamp[];
  initialRewards: Reward[];
}

const REDEEMED_REWARD_VISIBLE_MS = 2 * 60 * 60 * 1000;

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  Sandwiches: "Sandwiches",
  "Main Course": "Main Courses",
  Desserts: "Desserts",
  Coffee: "Coffees",
  "Desserts 2": "Hookas",
};

function isRedeemedRewardStillVisible(reward: Reward) {
  if (reward.status !== "redeemed") return true;
  if (!reward.redeemed_at) return false;

  const redeemedAt = new Date(reward.redeemed_at).getTime();
  if (!Number.isFinite(redeemedAt)) return false;

  return Date.now() - redeemedAt < REDEEMED_REWARD_VISIBLE_MS;
}

function getRewardStatusLabel(status: Reward["status"]) {
  if (status === "available") return "Ready to claim";
  if (status === "claimed") return "Waiting for staff";
  if (status === "redeemed") return "Confirmed";
  return "Expired";
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function getCategoryDisplayName(name: string) {
  return CATEGORY_DISPLAY_NAMES[name] ?? name;
}

function getRewardSingularName(name: string) {
  const displayName = getCategoryDisplayName(name);

  const singularMap: Record<string, string> = {
    Sandwiches: "Sandwich",
    "Main Courses": "Main Course",
    Desserts: "Dessert",
    Coffees: "Coffee",
    Hookas: "Hooka",
  };

  return singularMap[displayName] ?? displayName.replace(/s$/i, "");
}

function SandwichStampIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 text-[#c85b58]">
      <path
        d="M5 9.6c1.25-3.2 4-5.1 7-5.1s5.75 1.9 7 5.1H5Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path d="M4.5 11h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6.2 13.2h11.6l-1.15 5.1H7.35L6.2 13.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 15.4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function getRewardTitle(reward: Reward, categoryName?: string) {
  const fallback = reward.reward_type
    .replace(/^Free\s+/i, "")
    .replace(/\s+Item$/i, "")
    .trim();

  return `1 Free ${getRewardSingularName(categoryName ?? fallback)}`;
}

export function ClientDashboard({ profile, categories, initialStamps, initialRewards }: Props) {
  const [stamps, setStamps] = useState<ClientStamp[]>(initialStamps);
  const [rewards, setRewards] = useState<Reward[]>(initialRewards);
  const [highlightCatId, setHighlightCatId] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [claimingRewardId, setClaimingRewardId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const knownRewardIdsRef = useRef(new Set(initialRewards.map((reward) => reward.id)));
  const supabase = useMemo(() => createClient(), []);

  const stampByCat = useMemo(() => {
    const map = new Map<string, number>();
    stamps.forEach((stamp) => map.set(stamp.category_id, stamp.stamp_count));
    return map;
  }, [stamps]);

  const catNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => map.set(category.id, category.name));
    return map;
  }, [categories]);

  const visibleRewards = useMemo(
    () =>
      rewards
        .filter((reward) => ["available", "claimed", "redeemed"].includes(reward.status))
        .filter(isRedeemedRewardStillVisible)
        .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime()),
    // now intentionally refreshes redeemed reward visibility every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rewards, now],
  );

  const totalStamps = useMemo(
    () => categories.reduce((sum, category) => sum + (stampByCat.get(category.id) ?? 0), 0),
    [categories, stampByCat],
  );

  const handleNewAvailableReward = useCallback(
    (reward: Reward) => {
      if (knownRewardIdsRef.current.has(reward.id)) return;

      knownRewardIdsRef.current.add(reward.id);
      setCelebrate(getRewardTitle(reward, catNameById.get(reward.category_id)));
    },
    [catNameById],
  );

  const mergeRewards = useCallback(
    (nextRewards: Reward[], shouldCelebrateNewRewards: boolean) => {
      const sortedRewards = [...nextRewards].sort(
        (a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime(),
      );

      if (shouldCelebrateNewRewards) {
        sortedRewards
          .filter((reward) => reward.status === "available")
          .forEach((reward) => handleNewAvailableReward(reward));
      } else {
        sortedRewards.forEach((reward) => knownRewardIdsRef.current.add(reward.id));
      }

      setRewards(sortedRewards);
    },
    [handleNewAvailableReward],
  );

  const refreshClientState = useCallback(
    async (shouldCelebrateNewRewards = true) => {
      const [{ data: nextStamps }, { data: nextRewards }] = await Promise.all([
        supabase.from("client_stamps").select("*").eq("client_id", profile.id),
        supabase
          .from("rewards")
          .select("*")
          .eq("client_id", profile.id)
          .in("status", ["available", "claimed", "redeemed"])
          .order("earned_at", { ascending: false }),
      ]);

      if (nextStamps) setStamps(nextStamps as ClientStamp[]);
      if (nextRewards) mergeRewards(nextRewards as Reward[], shouldCelebrateNewRewards);
    },
    [mergeRewards, profile.id, supabase],
  );

  async function claimReward(rewardId: string) {
    setClaimingRewardId(rewardId);

    const res = await fetch("/api/reward/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reward_id: rewardId }),
    });

    const json = await res.json();
    setClaimingRewardId(null);

    if (!res.ok) {
      setToast(json.error ?? "Could not claim reward.");
      setTimeout(() => setToast(null), 2200);
      return;
    }

    setRewards((prev) =>
      prev.map((reward) => (reward.id === rewardId ? { ...reward, status: "claimed" } : reward)),
    );
    setToast("Reward sent to staff for confirmation.");
    setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => {
    const stampChan = supabase
      .channel(`stamps:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "client_stamps", filter: `client_id=eq.${profile.id}` },
        (payload) => {
          const newRow = payload.new as ClientStamp;
          const oldRow = payload.old as ClientStamp;
          setStamps((prev) => prev.map((stamp) => (stamp.id === newRow.id ? newRow : stamp)));

          if (newRow.stamp_count > (oldRow?.stamp_count ?? 0)) {
            setHighlightCatId(newRow.category_id);
            setToast("New stamp added!");
            setTimeout(() => setToast(null), 1800);
            setTimeout(() => setHighlightCatId(null), 1200);
          }
        },
      )
      .subscribe();

    const rewardChan = supabase
      .channel(`rewards:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rewards", filter: `client_id=eq.${profile.id}` },
        (payload) => {
          const reward = payload.new as Reward;
          if (reward.status !== "available") return;

          setRewards((prev) => {
            if (prev.some((item) => item.id === reward.id)) return prev;
            return [reward, ...prev];
          });
          handleNewAvailableReward(reward);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rewards", filter: `client_id=eq.${profile.id}` },
        (payload) => {
          const reward = payload.new as Reward;

          if (["available", "claimed", "redeemed"].includes(reward.status)) {
            setRewards((prev) => {
              const exists = prev.some((item) => item.id === reward.id);
              if (exists) return prev.map((item) => (item.id === reward.id ? reward : item));
              return [reward, ...prev];
            });
          } else {
            setRewards((prev) => prev.filter((item) => item.id !== reward.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(stampChan);
      supabase.removeChannel(rewardChan);
    };
  }, [handleNewAvailableReward, profile.id, supabase]);

  useEffect(() => {
    void refreshClientState(false);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshClientState(true);
      }
    }, 2500);

    const handleFocus = () => void refreshClientState(true);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [refreshClientState]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <AppShell title="Loyalty Program" role="client">
      <Toast message={toast} />
      <RewardCelebration open={!!celebrate} rewardLabel={celebrate} onClose={() => setCelebrate(null)} />

      <section className="-mx-5 -mt-5 min-h-[calc(100vh-4.25rem)] bg-[#c7867d] px-5 pb-7 pt-5 text-[#182f38]">
        <section className="mb-6 overflow-hidden rounded-[2rem] bg-white p-4 text-[#182f38] shadow-[0_14px_34px_rgba(39,24,22,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#efe8e4]">
                <div className="absolute top-3 size-7 rounded-full bg-[#91534c]" />
                <div className="absolute -bottom-4 size-14 rounded-t-full bg-[#91534c]" />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-black uppercase leading-tight tracking-[0.03em] text-[#182f38]">
                  Hello<br />
                  <span className="text-[#ffd66b]">{getFirstName(profile.full_name)},</span>
                </h1>
              </div>
            </div>

            <div className="shrink-0 bg-white p-1">
              <QRCodeSVG value={profile.client_code ?? profile.id} size={68} bgColor="#ffffff" fgColor="#182f38" level="M" />
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#91534c]">Rewards {visibleRewards.length} - Stamps {totalStamps}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#91534c]">#{profile.client_code ?? "001"}</p>
            </div>
          </div>

          <a
            href="mailto:reviews@prosclub.com?subject=PRO%27s%20Club%20Review"
            className="mt-5 inline-flex min-w-36 items-center justify-center rounded-xl bg-[#ffd66b] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#182f38] transition active:scale-[0.98]"
          >
            Message
          </a>
        </section>

        {visibleRewards.length > 0 && (
          <section className="mb-7">
            <div className="mb-3 px-1">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#ffd66b]">Rewards</p>
              <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-white">My Gifts</h2>
            </div>

            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {visibleRewards.map((reward) => {
                  const isAvailable = reward.status === "available";
                  const isClaimed = reward.status === "claimed";
                  const isRedeemed = reward.status === "redeemed";
                  const isClaiming = claimingRewardId === reward.id;
                  const categoryName = catNameById.get(reward.category_id);

                  return (
                    <motion.div
                      key={reward.id}
                      layout
                      initial={{ y: 10, opacity: 0, scale: 0.98 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ x: 42, opacity: 0, scale: 0.98 }}
                      className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/95 p-4 text-[#182f38] shadow-card"
                    >
                      <div className="absolute -right-10 -top-10 size-28 rounded-full bg-[#ffd66b]/30 blur-2xl" />
                      <div className="relative flex items-center gap-3">
                        <div className="flex size-14 shrink-0 items-center justify-center">
                          <Image
                            src="/gift.png"
                            alt="Gift reward"
                            width={48}
                            height={48}
                            className="size-12 object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-black leading-tight">{getRewardTitle(reward, categoryName)}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-black/45">
                            {getCategoryDisplayName(categoryName ?? "Reward")} · {new Date(reward.earned_at).toLocaleDateString()}
                          </p>
                          <p
                            className={`mt-1 text-[11px] font-black uppercase tracking-wider ${
                              isRedeemed ? "text-emerald-600" : isClaimed ? "text-[#4f7688]" : "text-[#c85b58]"
                            }`}
                          >
                            {getRewardStatusLabel(reward.status)}
                          </p>
                        </div>

                        {isAvailable && (
                          <button
                            onClick={() => claimReward(reward.id)}
                            disabled={isClaiming}
                            className="shrink-0 rounded-2xl bg-[#182f38] px-4 py-3 text-xs font-black uppercase tracking-wide text-white transition active:scale-[0.98] disabled:opacity-50"
                          >
                            {isClaiming ? "Claiming" : "Claim"}
                          </button>
                        )}

                        {isClaimed && (
                          <div className="shrink-0 rounded-2xl bg-[#4f7688]/12 px-3 py-2 text-center text-[11px] font-black uppercase leading-tight text-[#4f7688]">
                            Waiting
                          </div>
                        )}

                        {isRedeemed && (
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-black text-white shadow-soft">
                            ✓
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>
        )}

        <section className="mb-7">
          <div className="mb-3 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#ffd66b]">Your stamps</p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-white">Progress</h2>
          </div>

          <div className="overflow-hidden rounded-[5px] border border-white/40 bg-white/95 p-3 text-[#182f38] shadow-card">
            <div className="divide-y divide-black/[0.04]">
              {categories.map((category) => {
                const count = stampByCat.get(category.id) ?? 0;
                const isHighlighted = highlightCatId === category.id;
                const displayName = getCategoryDisplayName(category.name);
                const isSandwiches = displayName.toLowerCase().includes("sandwich");

                return (
                  <motion.div
                    key={category.id}
                    animate={isHighlighted ? { scale: [1, 1.018, 1] } : { scale: 1 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="mb-2">
                      <h3 className="text-base font-black leading-tight text-[#182f38]">{displayName}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const filled = index < count;
                        const isLatestStamp = isHighlighted && index === count - 1;

                        return (
                          <motion.div
                            key={index}
                            initial={false}
                            animate={isLatestStamp ? { scale: [1, 1.16, 1] } : { scale: 1 }}
                            className={`flex size-10 items-center justify-center rounded-full border ${
                              filled
                                ? "border-[#c85b58] bg-white"
                                : "border-dashed border-[#182f38]/12 bg-white"
                            }`}
                          >
                            {filled ? (
                              isSandwiches ? (
                                <SandwichStampIcon />
                              ) : (
                                <span className="size-3 rounded-full bg-[#c85b58]" />
                              )
                            ) : null}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
