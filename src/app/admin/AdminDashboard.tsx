"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Toast } from "@/components/Toast";
import type { Profile, Reward, StampTransaction, UserRole } from "@/types";

interface Metrics {
  totalClients: number;
  stampsIssued: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  mostActiveCategoryName: string;
}

interface Props {
  profile: Profile;
  users: Profile[];
  recentTxns: StampTransaction[];
  recentRewards: Reward[];
  metrics: Metrics;
}

const TABS = ["Overview", "Users", "Activity", "Rewards"] as const;
type Tab = (typeof TABS)[number];

export function AdminDashboard({ profile, users: initialUsers, recentTxns, recentRewards, metrics }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("Overview");
  const [users, setUsers] = useState<Profile[]>(initialUsers);
  const [filter, setFilter] = useState<"all" | UserRole>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");

  function flash(message: string, t: "success" | "error" = "success") {
    setTone(t); setToast(message); setTimeout(() => setToast(null), 2200);
  }

  async function setRole(userId: string, role: UserRole) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
    if (error) { flash(error.message, "error"); return; }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    flash("Role updated.");
  }

  const filteredUsers = useMemo(
    () => (filter === "all" ? users : users.filter((u) => u.role === filter)),
    [users, filter],
  );

  return (
    <AppShell title="Admin" role={profile.role}>
      <Toast message={toast} tone={tone} />

      <section className="mb-5">
        <h1 className="font-display text-3xl font-bold leading-tight">
          Hello, <span className="italic text-brand-600">{profile.full_name.split(" ")[0]}</span>
        </h1>
        <p className="text-sm text-black/60 mt-1">
          Manage users, monitor activity, and review rewards.
        </p>
      </section>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-black/[0.06] p-1 rounded-full">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs font-semibold py-2 rounded-full transition ${
              tab === t ? "bg-white shadow-sm text-ink-900" : "text-black/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <section className="space-y-3 mb-12">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Total clients" value={metrics.totalClients} />
            <MetricCard label="Stamps issued" value={metrics.stampsIssued} />
            <MetricCard label="Rewards earned" value={metrics.rewardsEarned} />
            <MetricCard label="Rewards redeemed" value={metrics.rewardsRedeemed} />
          </div>
          <div className="card p-5">
            <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold">
              Most active category
            </div>
            <div className="font-display text-2xl font-bold mt-1">{metrics.mostActiveCategoryName}</div>
          </div>
          <div className="card p-5 bg-gradient-to-br from-ink-900 to-ink-700 text-white">
            <div className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">
              Coming soon
            </div>
            <div className="font-display text-xl font-bold mt-1">Full metrics dashboard</div>
            <p className="text-sm text-white/70 mt-2">
              Charts for trends, retention, and per-category performance will live here.
            </p>
          </div>
        </section>
      )}

      {tab === "Users" && (
        <section className="mb-12">
          <div className="flex gap-1 mb-3 bg-black/[0.06] p-1 rounded-full text-xs">
            {(["all", "client", "staff", "master_admin"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1.5 rounded-full font-semibold transition ${
                  filter === f ? "bg-white text-ink-900 shadow-sm" : "text-black/60"
                }`}
              >
                {f === "all" ? "All" : f === "master_admin" ? "Admin" : f === "staff" ? "Staff" : "Clients"}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <div key={u.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-semibold truncate">{u.full_name}</div>
                    <div className="text-xs text-black/50 truncate">
                      {u.email} {u.phone ? `· ${u.phone}` : ""}
                    </div>
                    {u.client_code && (
                      <div className="text-[10px] text-black/40 mt-0.5">{u.client_code}</div>
                    )}
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) => setRole(u.id, e.target.value as UserRole)}
                    disabled={u.id === profile.id}
                    className="text-xs font-semibold rounded-lg border border-black/15 px-2 py-1.5 bg-white"
                    title={u.id === profile.id ? "You can't change your own role" : ""}
                  >
                    <option value="client">Client</option>
                    <option value="staff">Staff</option>
                    <option value="master_admin">Admin</option>
                  </select>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="card p-4 text-sm text-black/50 text-center">No users in this view.</div>
            )}
          </div>
          <p className="text-[11px] text-black/50 mt-4 px-1 leading-relaxed">
            To create a brand-new staff account, ask the person to register as a client, then promote them here.
            (Direct staff creation requires the service-role key and can be added later.)
          </p>
        </section>
      )}

      {tab === "Activity" && (
        <section className="mb-12 space-y-2">
          {recentTxns.length === 0 && (
            <div className="card p-4 text-sm text-black/50 text-center">No activity yet.</div>
          )}
          {recentTxns.map((t) => (
            <div key={t.id} className="card p-4 flex items-center gap-3">
              <ActionBadge action={t.action_type} />
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm font-semibold truncate">
                  {labelForAction(t.action_type)}
                </div>
                <div className="text-[11px] text-black/50">
                  {new Date(t.created_at).toLocaleString()}
                  {t.stamp_count_before !== null && t.stamp_count_after !== null && (
                    <> · {t.stamp_count_before} → {t.stamp_count_after}</>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "Rewards" && (
        <section className="mb-12 space-y-2">
          {recentRewards.length === 0 && (
            <div className="card p-4 text-sm text-black/50 text-center">No rewards yet.</div>
          )}
          {recentRewards.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display font-semibold">{r.reward_type}</div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                  r.status === "available" ? "bg-emerald-100 text-emerald-800"
                  : r.status === "redeemed" ? "bg-black/[0.08] text-black/60"
                  : "bg-red-100 text-red-700"
                }`}>{r.status}</span>
              </div>
              <div className="text-[11px] text-black/50 mt-1">
                Earned {new Date(r.earned_at).toLocaleString()}
                {r.redeemed_at && <> · Redeemed {new Date(r.redeemed_at).toLocaleString()}</>}
              </div>
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold">{label}</div>
      <div className="font-display text-3xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function ActionBadge({ action }: { action: StampTransaction["action_type"] }) {
  const map: Record<StampTransaction["action_type"], { bg: string; emoji: string }> = {
    add_stamp:         { bg: "bg-brand-100 text-brand-800", emoji: "➕" },
    reward_earned:     { bg: "bg-emerald-100 text-emerald-800", emoji: "🎁" },
    reward_redeemed:   { bg: "bg-black/[0.08] text-black/70", emoji: "✓" },
    manual_adjustment: { bg: "bg-yellow-100 text-yellow-800", emoji: "✎" },
  };
  const { bg, emoji } = map[action];
  return (
    <div className={`size-9 rounded-full flex items-center justify-center text-sm ${bg}`}>
      {emoji}
    </div>
  );
}

function labelForAction(a: StampTransaction["action_type"]): string {
  return {
    add_stamp: "Stamp added",
    reward_earned: "Reward earned",
    reward_redeemed: "Reward redeemed",
    manual_adjustment: "Manual adjustment",
  }[a];
}
