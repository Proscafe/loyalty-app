"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminPageShell } from "@/components/AdminPageShell";

const GLASS_CARD = "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";

type StaffAnnouncement = {
  id: string;
  audience?: string | null;
  title: string | null;
  body: string | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function NewsPageClient() {
  const supabase = useMemo(() => createClient(), []);
  const [announcementId, setAnnouncementId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [title, setTitle] = useState("Staff announcement");
  const [body, setBody] = useState("");
  const [pushTitle, setPushTitle] = useState("Staff reminder");
  const [pushBody, setPushBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(null), 2600);
  }

  async function loadAnnouncement() {
    setLoading(true);
    const { data, error } = await supabase
      .from("staff_announcements")
      .select("*")
      .eq("audience", "staff")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      showMessage(error.message);
    }

    const row = data as StaffAnnouncement | null;
    if (row) {
      setAnnouncementId(row.id);
      setIsActive(row.is_active === true);
      setTitle(row.title || "Staff announcement");
      setBody(row.body || "");
      setPushTitle(row.title || "Staff reminder");
      setPushBody(row.body || "");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadAnnouncement();
  }, []);

  async function saveAnnouncement(nextActive = isActive) {
    setSaving(true);
    const payload = {
      audience: "staff",
      title: title.trim() || "Staff announcement",
      body: body.trim(),
      is_active: nextActive,
      updated_at: new Date().toISOString(),
    };

    const query = announcementId
      ? supabase.from("staff_announcements").update(payload).eq("id", announcementId).select("*").single()
      : supabase.from("staff_announcements").insert(payload).select("*").single();

    const { data, error } = await query;
    setSaving(false);
    if (error) {
      showMessage(error.message);
      return;
    }
    const row = data as StaffAnnouncement;
    setAnnouncementId(row.id);
    setIsActive(row.is_active === true);
    showMessage("Announcement saved.");
  }

  async function toggleActive() {
    const next = !isActive;
    setIsActive(next);
    await saveAnnouncement(next);
  }

  async function sendPush() {
    setSending(true);
    try {
      const response = await fetch("/api/admin/announcements/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pushTitle.trim() || title.trim() || "Staff reminder",
          body: pushBody.trim() || body.trim(),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not send push notification.");
      showMessage(`Push sent${typeof json.sent === "number" ? ` to ${json.sent}` : ""}.`);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not send push notification.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AdminPageShell active="news">
      <div className="px-4 py-5 lg:px-0 lg:py-0">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[34px] font-black tracking-[-0.04em] text-white">News</h1>
            <p className="mt-1 text-sm font-bold text-white/68">Create staff announcements and send optional push reminders.</p>
          </div>
          <button
            type="button"
            onClick={() => void toggleActive()}
            disabled={saving || loading}
            className={`h-12 rounded-full px-6 text-[12px] font-black uppercase tracking-[0.14em] ${isActive ? "bg-[#ffd66b] text-[#365665]" : "bg-white/14 text-white"}`}
          >
            {isActive ? "Announcement On" : "Announcement Off"}
          </button>
        </header>

        {message ? <div className="mb-4 rounded-2xl bg-white/14 px-4 py-3 text-sm font-black text-white">{message}</div> : null}

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[30px] border border-white/14 p-5 shadow-[0_24px_70px_rgba(35,54,47,0.18)] backdrop-blur-2xl lg:p-6" style={{ background: GLASS_CARD }}>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ffd66b]">Staff card</p>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-white">Announcement</h2>
            <div className="mt-6 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/58">Title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 w-full rounded-[18px] border border-white/12 bg-white/90 px-4 text-[13px] font-black text-[#365665] outline-none" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/58">Message</span>
                <textarea value={body} onChange={(event) => { setBody(event.target.value); setPushBody(event.target.value); }} rows={8} className="w-full resize-none rounded-[20px] border border-white/12 bg-white/90 px-4 py-4 text-[13px] font-bold leading-6 text-[#365665] outline-none" />
              </label>
              <button type="button" onClick={() => void saveAnnouncement()} disabled={saving || loading} className="h-12 rounded-full bg-[#ffd66b] px-6 text-[12px] font-black uppercase tracking-[0.14em] text-[#365665] disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/14 p-5 shadow-[0_24px_70px_rgba(35,54,47,0.18)] backdrop-blur-2xl lg:p-6" style={{ background: GLASS_CARD }}>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ffd66b]">Optional reminder</p>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-white">Push notification</h2>
            <p className="mt-2 text-[13px] font-bold leading-6 text-white/62">Customize the push before sending.</p>
            <div className="mt-6 grid gap-4">
              <input value={pushTitle} onChange={(event) => setPushTitle(event.target.value)} placeholder="Notification title" className="h-12 w-full rounded-[18px] border border-white/12 bg-white/90 px-4 text-[13px] font-black text-[#365665] outline-none" />
              <textarea value={pushBody} onChange={(event) => setPushBody(event.target.value)} placeholder="Notification message" rows={6} className="w-full resize-none rounded-[20px] border border-white/12 bg-white/90 px-4 py-4 text-[13px] font-bold leading-6 text-[#365665] outline-none" />
              <button type="button" onClick={() => void sendPush()} disabled={sending} className="h-12 rounded-full bg-white px-6 text-[12px] font-black uppercase tracking-[0.14em] text-[#365665] transition hover:bg-[#ffd66b] disabled:opacity-60">
                {sending ? "Sending..." : "Send push reminder"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}
