"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/AdminSidebar";
import { AdminMobileHeader } from "@/components/AdminMobileHeader";
import { AdminMobileFloatingMenu } from "@/components/AdminMobileFloatingMenu";
import { Toast } from "@/components/Toast";

type AnyRow = Record<string, any>;

type ProfileRow = AnyRow & {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  client_code?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type CategoryRow = AnyRow & {
  id: string;
  name?: string | null;
  average_price?: number | string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type StampRow = AnyRow & {
  id?: string;
  client_id: string;
  category_id: string;
  stamp_count?: number | null;
  updated_at?: string | null;
};

type RewardRow = AnyRow & {
  id: string;
  client_id?: string | null;
  category_id?: string | null;
  reward_type?: string | null;
  status?: string | null;
  earned_at?: string | null;
  redeemed_at?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
};

type TransactionRow = AnyRow & {
  id: string;
  client_id?: string | null;
  category_id?: string | null;
  action_type?: string | null;
  stamp_count?: number | null;
  staff_id?: string | null;
  created_at?: string | null;
};

type ContactHistoryRow = AnyRow & {
  id?: string;
  contact_key?: string | null;
  contacted_at?: string | null;
  source?: string | null;
  source_id?: string | null;
  created_at?: string | null;
};

const PAGE_BG =
  "bg-[#798673] lg:bg-[radial-gradient(circle_at_top_left,rgba(255,214,107,0.24),transparent_28%),linear-gradient(135deg,#365665_0%,#263f49_48%,#798673_100%)]";

function parseMoneyValue(value: string | number | null | undefined) {
  const numberValue =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `$${safeValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = formatDate(value);
  const time = formatTime(value);
  return time ? `${date} · ${time}` : date;
}

function getAgeText(profile?: AnyRow | null) {
  const directAge = Number(
    profile?.age ?? profile?.client_age ?? profile?.birth_age ?? NaN,
  );
  if (Number.isFinite(directAge) && directAge > 0)
    return `Age ${Math.floor(directAge)}`;

  const birthValue =
    profile?.date_of_birth ??
    profile?.birthdate ??
    profile?.birthday ??
    profile?.dob;
  if (!birthValue) return "";
  const birthDate = new Date(birthValue);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  )
    age -= 1;
  return age > 0 ? `Age ${age}` : "";
}

function withinCurrentMonth(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function getRewardDate(reward: RewardRow) {
  return reward.earned_at ?? reward.created_at ?? reward.redeemed_at ?? null;
}

function dayKey(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function displayCategoryName(name?: string | null) {
  if (!name) return "Reward";
  return name === "Desserts 2" ? "Hooka" : name;
}

function normalizeRewardText(value?: string | null) {
  return String(value || "Reward")
    .replace(/ Item$/i, "")
    .trim();
}

function statusPillClass(status?: string | null) {
  const value = String(status ?? "").toLowerCase();
  if (value === "available") return "bg-[#ffd66b] text-[#365665]";
  if (value === "redeemed" || value === "claimed")
    return "bg-emerald-400 text-[#1f3d34]";
  if (value === "expired") return "bg-red-400/80 text-white";
  return "bg-white/20 text-white/70";
}

function whatsappUrl(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 bg-white/10 p-5 shadow-[0_26px_70px_rgba(35,54,47,0.22)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[18px] bg-white/10 px-4 py-4">
      <div className="text-[11px] font-black text-white/72">{label}</div>
      <div className="mt-2 text-[22px] font-black tracking-[-0.05em] text-white">
        {value}
      </div>
    </div>
  );
}

function getProfileStatus(profile: ProfileRow | null): "client" | "staff" | "admin" | "deactivated" {
  if (!profile) return "client";
  if (profile.is_active === false) return "deactivated";
  const role = String(profile.role || "client").toLowerCase();
  if (role === "admin") return "admin";
  if (role === "staff") return "staff";
  return "client";
}

export default function ClientProfilePage({
  adminId,
  profile,
  categories,
  stamps,
  rewards,
  transactions,
  contactHistory,
}: {
  adminId: string;
  profile: ProfileRow | null;
  categories: CategoryRow[];
  stamps: StampRow[];
  rewards: RewardRow[];
  transactions: TransactionRow[];
  contactHistory?: ContactHistoryRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");
  const [giftOpen, setGiftOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [visitsOpen, setVisitsOpen] = useState(false);
  const [giftsSectionOpen, setGiftsSectionOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<"month" | "all">("month");
  const [profileStatus, setProfileStatus] = useState<"client" | "staff" | "admin" | "deactivated">(() => getProfileStatus(profile));
  const [giftCategoryId, setGiftCategoryId] = useState(categories[0]?.id ?? "");
  const [giftNote, setGiftNote] = useState("");
  const [phoneDraft, setPhoneDraft] = useState(profile?.phone ?? "");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [noteText, setNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState<
    Array<{ id: string; text: string; created_at: string; updated_at?: string }>
  >([]);
  const [lastContacted, setLastContacted] = useState<string | null>(null);

  function flash(message: string, nextTone: "success" | "error" = "success") {
    setTone(nextTone);
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    setProfileStatus(getProfileStatus(profile));
  }, [profile?.id, profile?.role, profile?.is_active]);

  useEffect(() => {
    if (!profile?.id) return;
    try {
      const savedNotes = window.localStorage.getItem(
        `proscafe_client_notes_${profile.id}`,
      );
      if (savedNotes) {
        const parsed = JSON.parse(savedNotes) as Array<{ id?: string; text: string; created_at: string; updated_at?: string }>;
        setNotes(
          parsed.map((note, index) => ({
            id: note.id || `note-${note.created_at}-${index}`,
            text: note.text,
            created_at: note.created_at,
            updated_at: note.updated_at,
          })),
        );
      }
      const savedContact = window.localStorage.getItem(
        `proscafe_client_last_contacted_${profile.id}`,
      );
      if (savedContact) setLastContacted(savedContact);
    } catch {}
  }, [profile?.id]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active !== false),
    [categories],
  );

  const categoryById = useMemo(() => {
    const map = new Map<string, CategoryRow>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const stampByCategory = useMemo(() => {
    const map = new Map<string, StampRow>();
    stamps.forEach((stamp) => map.set(stamp.category_id, stamp));
    return map;
  }, [stamps]);

  const visibleTransactions = useMemo(() => {
    if (timeRange === "all") return transactions;
    return transactions.filter((txn) => withinCurrentMonth(txn.created_at));
  }, [timeRange, transactions]);

  const visibleRewards = useMemo(() => {
    if (timeRange === "all") return rewards;
    return rewards.filter((reward) =>
      withinCurrentMonth(getRewardDate(reward)),
    );
  }, [rewards, timeRange]);

  const visitRows = useMemo(() => {
    const byDay = new Map<string, string>();
    visibleTransactions.forEach((txn) => {
      const key = dayKey(txn.created_at);
      if (!key || !txn.created_at) return;
      const existing = byDay.get(key);
      if (
        !existing ||
        new Date(txn.created_at).getTime() > new Date(existing).getTime()
      ) {
        byDay.set(key, txn.created_at);
      }
    });
    return Array.from(byDay.entries())
      .map(([day, date]) => ({ day, date }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [visibleTransactions]);

  const lifetimeSpend = useMemo(() => {
    return visibleTransactions.reduce((sum, txn) => {
      const action = String(txn.action_type ?? "").toLowerCase();
      if (action.includes("remove")) return sum;
      const category = txn.category_id
        ? categoryById.get(txn.category_id)
        : null;
      return sum + parseMoneyValue(category?.average_price);
    }, 0);
  }, [categoryById, visibleTransactions]);

  const giftCounts = useMemo(() => {
    const sent = visibleRewards.length;
    const redeemed = visibleRewards.filter((reward) => {
      const status = String(reward.status ?? "").toLowerCase();
      return (
        status === "redeemed" ||
        status === "claimed" ||
        Boolean(reward.redeemed_at)
      );
    }).length;
    const active = visibleRewards.filter(
      (reward) => String(reward.status ?? "").toLowerCase() === "available",
    ).length;
    const giftValue = visibleRewards.reduce((sum, reward) => {
      const category = reward.category_id
        ? categoryById.get(reward.category_id)
        : null;
      return sum + parseMoneyValue(category?.average_price);
    }, 0);
    return { sent, redeemed, active, giftValue };
  }, [categoryById, visibleRewards]);

  const lastVisit = visitRows[0]?.date ?? null;
  const currentWhatsAppUrl = whatsappUrl(profile?.phone);

  const timeline = useMemo(() => {
    const txnItems = visibleTransactions.map((txn) => {
      const category = txn.category_id
        ? categoryById.get(txn.category_id)
        : null;
      const categoryName = displayCategoryName(category?.name);
      const action = String(txn.action_type ?? "activity").replace(/_/g, " ");
      return {
        id: `txn-${txn.id}`,
        date: txn.created_at,
        label: `${profile?.full_name || "Client"} ${action} ${categoryName}`,
        badge: "Stamp",
      };
    });
    const rewardItems = visibleRewards.map((reward) => ({
      id: `reward-${reward.id}`,
      date: reward.earned_at ?? reward.created_at,
      label: `${profile?.full_name || "Client"} received ${normalizeRewardText(reward.reward_type)}`,
      badge: "Gift",
    }));
    const noteItems = notes.map((note) => ({
      id: `note-${note.id}`,
      date: note.updated_at ?? note.created_at,
      label: note.updated_at ? `${note.text} · edited` : note.text,
      badge: "Note",
    }));
    const contactItems = [
      ...((contactHistory ?? [])
        .filter((contact) => String(contact.source_id ?? "") === String(profile?.id ?? ""))
        .map((contact, index) => ({
          id: `contact-${contact.id || index}-${contact.contacted_at || contact.created_at}`,
          date: contact.contacted_at ?? contact.created_at,
          label: `${profile?.full_name || "Client"} was marked as contacted`,
          badge: "Contacted",
        }))),
      ...(lastContacted
        ? [
            {
              id: `contact-local-${lastContacted}`,
              date: lastContacted,
              label: `${profile?.full_name || "Client"} was marked as contacted`,
              badge: "Contacted",
            },
          ]
        : []),
    ];
    return [...txnItems, ...rewardItems, ...noteItems, ...contactItems]
      .filter((item) => item.date)
      .filter(
        (item, index, all) =>
          all.findIndex((other) => other.id === item.id) === index,
      )
      .sort(
        (a, b) =>
          new Date(b.date || "").getTime() - new Date(a.date || "").getTime(),
      );
  }, [
    categoryById,
    contactHistory,
    lastContacted,
    notes,
    profile?.full_name,
    profile?.id,
    visibleRewards,
    visibleTransactions,
  ]);

  async function markContacted() {
    if (!profile?.id) return;
    const date = new Date().toISOString();
    setLastContacted(date);
    try {
      window.localStorage.setItem(
        `proscafe_client_last_contacted_${profile.id}`,
        date,
      );
    } catch {}
    await fetch("/api/admin/contact-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keys: [`contact-client-${profile.id}`],
        contacted_at: date,
        source: "Client profile",
        source_id: profile.id,
      }),
    }).catch(() => {});
    flash("Contact saved.");
  }

  function persistNotes(nextNotes: Array<{ id: string; text: string; created_at: string; updated_at?: string }>) {
    if (!profile?.id) return;
    try {
      window.localStorage.setItem(
        `proscafe_client_notes_${profile.id}`,
        JSON.stringify(nextNotes),
      );
    } catch {}
  }

  function saveNote() {
    if (!profile?.id) return;
    const text = noteText.trim();
    if (!text) return;

    if (editingNoteId) {
      const next = notes.map((note) =>
        note.id === editingNoteId
          ? { ...note, text, updated_at: new Date().toISOString() }
          : note,
      );
      setNotes(next);
      persistNotes(next);
      setNoteText("");
      setEditingNoteId(null);
      flash("Note updated.");
      return;
    }

    const next = [
      {
        id: `note-${Date.now()}`,
        text,
        created_at: new Date().toISOString(),
      },
      ...notes,
    ].slice(0, 50);
    setNotes(next);
    persistNotes(next);
    setNoteText("");
    flash("Note added.");
  }

  function startEditNote(note: { id: string; text: string }) {
    setEditingNoteId(note.id);
    setNoteText(note.text);
  }

  function cancelEditNote() {
    setEditingNoteId(null);
    setNoteText("");
  }

  function deleteNote(noteId: string) {
    const next = notes.filter((note) => note.id !== noteId);
    setNotes(next);
    persistNotes(next);
    if (editingNoteId === noteId) cancelEditNote();
    flash("Note deleted.");
  }

  async function updateProfileStatus(nextStatus: "client" | "staff" | "admin" | "deactivated") {
    if (!profile?.id) return;

    const previousStatus = profileStatus;
    setProfileStatus(nextStatus);

    const nextRole = nextStatus === "deactivated"
      ? String(profile.role || "client").toLowerCase() || "client"
      : nextStatus;

    const { error } = await supabase
      .from("profiles")
      .update({
        role: nextRole,
        is_active: nextStatus === "deactivated" ? false : true,
      })
      .eq("id", profile.id);

    if (error) {
      setProfileStatus(previousStatus);
      flash(error.message, "error");
      return;
    }

    flash(nextStatus === "deactivated" ? "Profile deactivated." : "Profile role updated.");
    router.refresh();
  }

  async function savePhone() {
    if (!profile?.id) return;
    const nextPhone = phoneDraft.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ phone: nextPhone })
      .eq("id", profile.id);
    if (error) {
      flash(error.message, "error");
      return;
    }
    setPhoneOpen(false);
    flash("Phone number updated.");
    router.refresh();
  }

  async function savePassword() {
    if (!profile?.id) return;
    const nextPassword = passwordDraft.trim();
    if (nextPassword.length < 6) {
      flash("Password must be at least 6 characters.", "error");
      return;
    }
    const response = await fetch("/api/admin/users/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id, email: profile.email, password: nextPassword }),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      flash(payload?.error || "Could not change password.", "error");
      return;
    }

    setPasswordDraft("");
    setPasswordOpen(false);
    flash("Password changed.");
  }

  async function sendGift() {
    if (!profile?.id) return;
    const category =
      activeCategories.find((item) => item.id === giftCategoryId) ??
      activeCategories[0];
    if (!category?.id) {
      flash("No gift category found.", "error");
      return;
    }
    const rewardType = giftNote.trim()
      ? `Sent Gift - Free ${displayCategoryName(category.name)} - ${giftNote.trim()}`
      : `Sent Gift - Free ${displayCategoryName(category.name)}`;
    const { error } = await supabase.from("rewards").insert({
      client_id: profile.id,
      category_id: category.id,
      reward_type: rewardType,
      status: "available",
      earned_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) {
      flash(error.message, "error");
      return;
    }
    setGiftOpen(false);
    setGiftNote("");
    flash("Gift sent.");
    router.refresh();
  }

  async function updateStamp(categoryId: string, direction: 1 | -1) {
    if (!profile?.id) return;
    const current = stampByCategory.get(categoryId);
    const currentCount = Math.max(0, current?.stamp_count ?? 0);
    const nextCount = Math.max(0, Math.min(5, currentCount + direction));
    if (nextCount === currentCount) return;

    const result = current
      ? await supabase
          .from("client_stamps")
          .update({
            stamp_count: nextCount,
            updated_at: new Date().toISOString(),
          })
          .eq("client_id", profile.id)
          .eq("category_id", categoryId)
      : await supabase.from("client_stamps").insert({
          client_id: profile.id,
          category_id: categoryId,
          stamp_count: nextCount,
          updated_at: new Date().toISOString(),
        });

    if (result.error) {
      flash(result.error.message, "error");
      return;
    }

    await supabase.from("stamp_transactions").insert({
      client_id: profile.id,
      category_id: categoryId,
      action_type: direction > 0 ? "add_stamp" : "remove_stamp",
      stamp_count: 1,
      staff_id: adminId,
      created_at: new Date().toISOString(),
    });

    flash(direction > 0 ? "Stamp added." : "Stamp removed.");
    router.refresh();
  }

  if (!profile) {
    return (
      <main className={`min-h-screen ${PAGE_BG} px-4 py-6 text-white`}>
        <Link
          href="/admin/users"
          className="text-[12px] font-black text-white hover:text-[#ffd66b]"
        >
          ← Back to users
        </Link>
        <Panel className="mt-6">
          <h1 className="text-[28px] font-black">Client not found</h1>
        </Panel>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${PAGE_BG} text-white`}>
      <div className="pointer-events-none fixed left-6 top-6 bottom-6 z-40 hidden w-[76px] items-center justify-center lg:flex">
        <div className="pointer-events-auto flex h-full w-full items-center justify-center">
          <AdminSidebar active="users" />
        </div>
      </div>
      {toast ? <Toast message={toast} tone={tone} /> : null}

      <div className="px-4 pt-5 lg:hidden">
        <AdminMobileHeader profile={profile as any} />
      </div>

      <div className="mx-auto max-w-[1500px] space-y-4 px-3 py-4 pb-24 lg:ml-[112px] lg:max-w-none lg:px-6 lg:py-6 lg:pb-10">
        <Link
          href="/admin/users"
          className="inline-flex text-[12px] font-black text-white transition hover:text-[#ffd66b]"
        >
          ← Back to users
        </Link>

        <Panel>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70">
                Customer Profile
              </div>
              <h1 className="mt-2 text-[30px] font-black leading-none tracking-[-0.05em] text-white lg:text-[38px]">
                {profile.full_name || "Client"}
              </h1>
              <div className="mt-3 text-[13px] font-bold leading-6 text-white/76">
                {profile.email || "No email"}
                {getAgeText(profile) ? (
                  <span className="text-white/55">
                    {" "}
                    · {getAgeText(profile)}
                  </span>
                ) : null}
                <br />
                {profile.phone || "No phone"}
                {profile.client_code ? (
                  <span className="text-white/55">
                    {" "}
                    · {profile.client_code}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0">
              <button
                type="button"
                onClick={() => setTimeRange((current) => (current === "month" ? "all" : "month"))}
                className="hidden rounded-full bg-white/12 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/18 lg:inline-flex"
              >
                {timeRange === "month" ? "This month" : "Show all"}
              </button>
              <button
                type="button"
                onClick={() => setPhoneOpen(true)}
                className="hidden rounded-full bg-white/12 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-white lg:inline-flex"
              >
                Edit phone
              </button>
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                className="hidden rounded-full bg-white/12 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-white lg:inline-flex"
              >
                Change password
              </button>
              <select
                value={profileStatus}
                onChange={(event) =>
                  void updateProfileStatus(
                    event.target.value as "client" | "staff" | "admin" | "deactivated",
                  )
                }
                className="h-[34px] shrink-0 rounded-full border-0 bg-white px-3 text-[10px] font-black uppercase tracking-[0.10em] text-[#365665] outline-none lg:h-[38px] lg:px-4 lg:text-[11px] lg:tracking-[0.12em]"
                aria-label="Change profile role"
              >
                <option value="client">Client</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="deactivated">Deactivate</option>
              </select>
              {currentWhatsAppUrl ? (
                <a
                  href={currentWhatsAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full bg-[#25D366] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.10em] text-white lg:px-4 lg:py-2.5 lg:text-[11px] lg:tracking-[0.12em]"
                >
                  WA
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setGiftOpen(true)}
                className="shrink-0 rounded-full bg-[#ffd66b] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.10em] text-[#365665] lg:px-4 lg:py-2.5 lg:text-[11px] lg:tracking-[0.12em]"
              >
                Gift
              </button>
              <button
                type="button"
                onClick={() => void markContacted()}
                className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.10em] text-[#365665] lg:px-4 lg:py-2.5 lg:text-[11px] lg:tracking-[0.12em]"
              >
                Contacted
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-8">
            <Metric label="Total visits" value={visitRows.length} />
            <Metric label="Lifetime spend" value={formatMoney(lifetimeSpend)} />
            <Metric label="Gifts sent" value={giftCounts.sent} />
            <Metric label="Gifts redeemed" value={giftCounts.redeemed} />
            <Metric label="Active gifts" value={giftCounts.active} />
            <Metric
              label="Gift value"
              value={formatMoney(giftCounts.giftValue)}
            />
            <Metric label="Last visit" value={formatDate(lastVisit)} />
            <Metric label="Last contacted" value={formatDate(lastContacted)} />
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="space-y-4">
            <Panel>
              <h2 className="text-[20px] font-black tracking-[-0.04em] text-white">
                Stamps
              </h2>
              <div className="mt-4 space-y-3">
                {activeCategories.length === 0 ? (
                  <div className="text-[13px] font-bold text-white/65">
                    No stamp categories found.
                  </div>
                ) : null}
                {activeCategories.map((category) => {
                  const count = Math.max(
                    0,
                    Math.min(
                      5,
                      stampByCategory.get(category.id)?.stamp_count ?? 0,
                    ),
                  );
                  return (
                    <div
                      key={category.id}
                      className="rounded-[18px] bg-white/10 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-black text-white">
                            {displayCategoryName(category.name)}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-white/70">
                            {count}/5 stamps
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => void updateStamp(category.id, -1)}
                            className="rounded-full bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#365665]"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateStamp(category.id, 1)}
                            className="rounded-full bg-[#ffd66b] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#365665]"
                          >
                            Stamp
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-5 gap-2">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <div
                            key={index}
                            className={`h-2 rounded-full ${index < count ? "bg-[#ffd66b]" : "bg-white/25"}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <button
                type="button"
                onClick={() => setVisitsOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <h2 className="text-[20px] font-black tracking-[-0.04em] text-white">
                    Visits Log
                  </h2>
                  <div className="mt-1 text-[11px] font-black text-white/65">
                    {visitRows.length} visits
                  </div>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-[11px] font-black text-[#365665]">
                  {visitsOpen ? "Close" : "Open"}
                </span>
              </button>
              {visitsOpen ? (
                <div className="mt-4 space-y-2">
                  {visitRows.length === 0 ? (
                    <div className="text-[13px] font-bold text-white/65">
                      No visits found.
                    </div>
                  ) : null}
                  {visitRows.map((visit) => (
                    <div
                      key={visit.day}
                      className="flex items-center justify-between rounded-[16px] bg-white/10 px-4 py-3"
                    >
                      <div className="text-[13px] font-black text-white">
                        {formatDate(visit.date)}
                      </div>
                      <div className="text-[12px] font-bold text-white/60">
                        {formatTime(visit.date)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>

            <Panel>
              <button
                type="button"
                onClick={() => setGiftsSectionOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <h2 className="text-[20px] font-black tracking-[-0.04em] text-white">
                    Gifts
                  </h2>
                  <div className="mt-1 text-[11px] font-black text-white/65">
                    {visibleRewards.length} gifts
                  </div>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-[11px] font-black text-[#365665]">
                  {giftsSectionOpen ? "Close" : "Open"}
                </span>
              </button>
              {giftsSectionOpen ? (
                <div className="mt-4 space-y-3">
                  {visibleRewards.length === 0 ? (
                    <div className="text-[13px] font-bold text-white/65">
                      No gifts for this client yet.
                    </div>
                  ) : null}
                  {visibleRewards.map((reward) => (
                    <div
                      key={reward.id}
                      className="rounded-[18px] bg-white/10 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-black text-white">
                            {normalizeRewardText(reward.reward_type)}
                          </div>
                          <div className="mt-1 text-[11px] font-bold leading-5 text-white/64">
                            Earned{" "}
                            {formatDateTime(
                              reward.earned_at ?? reward.created_at,
                            )}
                            {reward.redeemed_at ? (
                              <>
                                {" "}
                                · Redeemed {formatDateTime(reward.redeemed_at)}
                              </>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${statusPillClass(reward.status)}`}
                        >
                          {String(reward.status || "gift")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel>
              <button
                type="button"
                onClick={() => setNotesOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 text-left lg:cursor-default"
              >
                <div>
                  <h2 className="text-[20px] font-black tracking-[-0.04em] text-white">
                    Notes
                  </h2>
                  <div className="mt-1 text-[11px] font-black text-white/65 lg:hidden">
                    {notes.length} notes
                  </div>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-[11px] font-black text-[#365665] lg:hidden">
                  {notesOpen ? "Close" : "Open"}
                </span>
              </button>
              <div className={`${notesOpen ? "mt-4" : "hidden"} space-y-3 lg:mt-4 lg:block`}>
                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Add note..."
                  className="min-h-[96px] w-full rounded-[18px] border border-white/16 bg-white px-4 py-3 text-[13px] font-bold text-[#365665] outline-none"
                />
                <div className="flex justify-end gap-2">
                  {editingNoteId ? (
                    <button
                      type="button"
                      onClick={cancelEditNote}
                      className="rounded-full bg-white/12 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-white"
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={saveNote}
                    className="rounded-full bg-[#ffd66b] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#365665]"
                  >
                    Save note
                  </button>
                </div>
                <div className="space-y-2 pt-1">
                  {notes.length === 0 ? (
                    <div className="text-[12px] font-bold text-white/60">
                      No notes yet.
                    </div>
                  ) : null}
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="relative rounded-[16px] bg-white/10 p-3 pr-16"
                    >
                      <div className="absolute right-3 top-3 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditNote(note)}
                          aria-label="Edit note"
                          title="Edit note"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/12 text-[12px] font-black text-white transition hover:bg-white/20"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          aria-label="Delete note"
                          title="Delete note"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-red-400/85 text-[12px] font-black text-white transition hover:bg-red-400"
                        >
                          ×
                        </button>
                      </div>
                      <div className="text-[13px] font-bold text-white">
                        {note.text}
                      </div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/45">
                        {formatDateTime(note.updated_at ?? note.created_at)}
                        {note.updated_at ? " · edited" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel>
              <button
                type="button"
                onClick={() => setActivityOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 text-left lg:cursor-default"
              >
                <div>
                  <h2 className="text-[20px] font-black tracking-[-0.04em] text-white">
                    Activity
                  </h2>
                  <div className="mt-1 text-[11px] font-black text-white/65 lg:hidden">
                    {timeline.length} activity items
                  </div>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-[11px] font-black text-[#365665] lg:hidden">
                  {activityOpen ? "Close" : "Open"}
                </span>
              </button>
              <div className={`${activityOpen ? "mt-4" : "hidden"} max-h-[720px] space-y-2 overflow-auto pr-1 lg:mt-4 lg:block`}>
                {timeline.length === 0 ? (
                  <div className="text-[13px] font-bold text-white/65">
                    No activity yet.
                  </div>
                ) : null}
                {timeline.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[16px] bg-white/10 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd66b]">
                        {item.badge}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-white/50">
                        {formatDateTime(item.date)}
                      </span>
                    </div>
                    <div className="mt-2 text-[12px] font-black leading-5 text-white">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {phoneOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
          onClick={() => setPhoneOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-[28px] bg-[#365665]/94 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-[24px] font-black tracking-[-0.04em] text-white">
              Edit phone number
            </h3>
            <label className="mt-5 block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/62">
                Phone
              </span>
              <input
                value={phoneDraft}
                onChange={(event) => setPhoneDraft(event.target.value)}
                className="h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none"
                placeholder="Phone number"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPhoneOpen(false)}
                className="rounded-full bg-white/12 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void savePhone()}
                className="rounded-full bg-[#ffd66b] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#365665]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
          onClick={() => setPasswordOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-[28px] bg-[#365665]/94 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-[24px] font-black tracking-[-0.04em] text-white">
              Change password
            </h3>
            <label className="mt-5 block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/62">
                New password
              </span>
              <input
                type="password"
                value={passwordDraft}
                onChange={(event) => setPasswordDraft(event.target.value)}
                className="h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none"
                placeholder="Minimum 6 characters"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasswordOpen(false)}
                className="rounded-full bg-white/12 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void savePassword()}
                className="rounded-full bg-[#ffd66b] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#365665]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {giftOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
          onClick={() => setGiftOpen(false)}
        >
          <div
            className="w-full max-w-[460px] rounded-[28px] bg-[#365665]/94 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-[24px] font-black tracking-[-0.04em] text-white">
              Send gift
            </h3>
            <p className="mt-1 text-[12px] font-bold text-white/65">
              Send a gift to {profile.full_name || "this client"}.
            </p>
            <label className="mt-5 block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/62">
                Gift
              </span>
              <select
                value={giftCategoryId}
                onChange={(event) => setGiftCategoryId(event.target.value)}
                className="h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none"
              >
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    Free {displayCategoryName(category.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/62">
                Note
              </span>
              <textarea
                value={giftNote}
                onChange={(event) => setGiftNote(event.target.value)}
                placeholder="Optional note..."
                className="min-h-[90px] w-full rounded-[16px] border-0 bg-white px-4 py-3 text-[13px] font-bold text-[#365665] outline-none"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGiftOpen(false)}
                className="rounded-full bg-white/12 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendGift()}
                className="rounded-full bg-[#ffd66b] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#365665]"
              >
                Send gift
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminMobileFloatingMenu active="users" />
    </main>
  );
}
