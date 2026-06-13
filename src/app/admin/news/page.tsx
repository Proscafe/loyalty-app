"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type StaffAnnouncement = {
  id: string;
  audience?: string | null;
  title: string | null;
  body: string | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};
function LocalToast({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;
  return (
    <div className={`fixed right-5 top-5 z-[90] rounded-2xl px-5 py-3 text-[13px] font-black shadow-[0_18px_40px_rgba(20,30,26,0.28)] ${tone === "error" ? "bg-red-100 text-red-700" : "bg-[#ffd66b] text-[#365665]"}`}>
      {message}
    </div>
  );
}

function LocalAdminSidebar({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const items = [
    { label: "Dashboard", icon: "⌂", href: "/admin" },
    { label: "Activity", icon: "↯", href: "/admin/activity" },
    { label: "News", icon: "📣", href: "/admin/news", active: true },
    { label: "Customer behavior", icon: "👤", href: "/admin/users" },
    { label: "Comment Cards", icon: "✎", href: "/admin/comment-cards" },
    { label: "Birthdays", icon: "🎂", href: "/admin/birthdays" },
    { label: "Gifts", icon: "🎁", href: "/admin/gifts" },
    { label: "Loyalty Program", icon: "★", href: "/admin/loyalty" },
    { label: "Games", icon: "🎮", href: "/admin/predictions" },
  ];

  return (
    <aside className="hidden min-h-[calc(100vh-48px)] w-[238px] shrink-0 flex-col overflow-hidden rounded-[30px] bg-white/10 shadow-[0_26px_70px_rgba(35,54,47,0.24)] backdrop-blur-2xl lg:flex">
      <div className="flex h-20 items-center bg-white/5 px-5">
        <div className="min-w-0">
          <div className="text-[19px] font-black leading-none text-white">Dashboard</div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#ffd66b]">PRO&apos;s Admin</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mb-2 flex h-12 w-full items-center rounded-[18px] px-4 text-left text-[13px] font-black transition ${item.active ? "bg-white/18 text-white shadow-[0_16px_34px_rgba(35,54,47,0.18)]" : "text-white/70 hover:bg-white/12 hover:text-white"}`}
          >
            <span className={`mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] ${item.active ? "bg-[#ffd66b] text-[#365665]" : "bg-white/12 text-white/72"}`}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/8 px-3 py-5">
        <button type="button" onClick={() => void onLogout()} className="flex w-full items-center px-4 py-2 text-left text-[12px] font-black text-white/86 transition hover:text-white">Logout</button>
      </div>
    </aside>
  );
}

function LocalAdminMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const items = [
    { label: "Overview", icon: "⌂", href: "/admin" },
    { label: "Activity", icon: "↯", href: "/admin/activity" },
    { label: "News", icon: "📣", href: "/admin/news", active: true },
    { label: "Users", icon: "👤", href: "/admin/users" },
    { label: "Comment Card", icon: "✎", href: "/admin/comment-cards" },
    { label: "Games", icon: "🎮", href: "/admin/predictions" },
  ];

  return (
    <div className="fixed bottom-5 right-4 z-50 flex flex-col items-end lg:hidden">
      {isOpen ? (
        <div className="mb-3 flex flex-col items-end gap-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`flex h-11 min-w-[154px] items-center justify-start gap-2 rounded-full px-4 text-[11px] font-black shadow-[0_14px_34px_rgba(20,30,26,0.24)] ${item.active ? "bg-white text-[#61716b]" : "bg-[#ffd66b] text-[#61716b]"}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#61716b]/12 text-[13px] text-[#61716b]">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
      <button type="button" onClick={() => setIsOpen((open) => !open)} className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ffd66b] text-[28px] font-black text-[#61716b] shadow-[0_18px_42px_rgba(20,30,26,0.28)]">
        {isOpen ? "×" : "☰"}
      </button>
    </div>
  );
}


export default function AdminNewsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [announcementId, setAnnouncementId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [title, setTitle] = useState("Staff announcement");
  const [body, setBody] = useState("");
  const [pushTitle, setPushTitle] = useState("📣 Staff announcement");
  const [pushBody, setPushBody] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");

  function showToast(message: string, nextTone: "success" | "error" = "success") {
    setTone(nextTone);
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }

  useEffect(() => {
    let alive = true;

    async function loadAnnouncement() {
      setLoading(true);
      const { data, error } = await supabase
        .from("staff_announcements")
        .select("id, audience, title, body, is_active, created_at, updated_at")
        .eq("audience", "staff")
        .maybeSingle();

      if (!alive) return;

      if (error) {
        console.error("Could not load staff announcement", error);
        showToast("Could not load announcements.", "error");
        setLoading(false);
        return;
      }

      const row = data as StaffAnnouncement | null;
      if (row) {
        const cleanTitle = row.title?.trim() || "Staff announcement";
        const cleanBody = row.body?.trim() || "";
        setAnnouncementId(row.id);
        setIsActive(Boolean(row.is_active));
        setTitle(cleanTitle);
        setBody(cleanBody);
        setPushTitle(cleanTitle || "📣 Staff announcement");
        setPushBody(cleanBody);
      }

      setLoading(false);
    }

    void loadAnnouncement();

    return () => {
      alive = false;
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function saveAnnouncement() {
    const cleanTitle = title.trim() || "Staff announcement";
    const cleanBody = body.trim();

    setSaving(true);
    const { data, error } = await supabase
      .from("staff_announcements")
      .upsert(
        {
          id: announcementId ?? undefined,
          audience: "staff",
          title: cleanTitle,
          body: cleanBody,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "audience" },
      )
      .select("id, title, body, is_active")
      .single();

    setSaving(false);

    if (error) {
      console.error("Could not save staff announcement", error);
      showToast("Could not save announcement.", "error");
      return;
    }

    const row = data as StaffAnnouncement | null;
    if (row?.id) setAnnouncementId(row.id);

    setTitle(cleanTitle);
    setBody(cleanBody);
    setPushTitle((current) => current.trim() || cleanTitle);
    setPushBody((current) => current.trim() || cleanBody);
    showToast("Announcement saved.");
  }

  async function sendAnnouncementPush() {
    const cleanTitle = pushTitle.trim() || title.trim() || "Staff announcement";
    const cleanBody = pushBody.trim() || body.trim();

    if (!cleanBody) {
      showToast("Add a notification message first.", "error");
      return;
    }

    setSending(true);
    const response = await fetch("/api/admin/announcements/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: cleanTitle, body: cleanBody }),
    });
    const json = (await response.json().catch(() => ({}))) as {
      error?: string;
      sent?: number;
    };
    setSending(false);

    if (!response.ok) {
      showToast(json.error || "Could not send notification.", "error");
      return;
    }

    const sent = json.sent ?? 0;
    showToast(`Notification sent to ${sent} staff device${sent === 1 ? "" : "s"}.`);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#435f68_0%,#62746e_50%,#7f8b7e_100%)] px-4 py-5 font-raleway text-white sm:px-6 lg:px-8">
      <LocalToast message={toast} tone={tone} />
      <div className="mx-auto flex w-full max-w-[1500px] gap-5">
        <LocalAdminSidebar onLogout={handleLogout} />

        <section className="min-w-0 flex-1 pb-24 lg:pb-8">
          <header className="flex flex-col gap-5 rounded-[30px] bg-white/8 p-5 shadow-[0_26px_70px_rgba(35,54,47,0.18)] backdrop-blur-2xl md:flex-row md:items-center md:justify-between lg:p-7">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ffd66b]">
                Staff updates
              </p>
              <h1 className="mt-2 text-[34px] font-black tracking-[-0.06em] text-white md:text-[44px]">
                Announcements
              </h1>
              <p className="mt-2 max-w-2xl text-[13px] font-bold leading-6 text-white/70">
                Create staff news, meeting notes, and reminders. Turn the message on or off for the staff page, then send a custom push reminder when needed.
              </p>
            </div>

            <div className={`rounded-full px-5 py-3 text-[12px] font-black ${isActive ? "bg-[#ffd66b] text-[#365665]" : "bg-white/12 text-white/72"}`}>
              {isActive ? "Visible to staff" : "Hidden from staff"}
            </div>
          </header>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.75fr)]">
            <section className="rounded-[30px] border border-white/14 bg-white/10 p-5 shadow-[0_24px_70px_rgba(35,54,47,0.18)] backdrop-blur-2xl lg:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ffd66b]">
                    Staff page card
                  </p>
                  <h2 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-white">
                    Announcement content
                  </h2>
                  <p className="mt-2 text-[13px] font-bold leading-6 text-white/62">
                    This appears under the staff hero in a collapsible card. Staff sees it only when it is turned on.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsActive((current) => !current)}
                  className={`rounded-full px-6 py-3 text-[12px] font-black transition ${
                    isActive
                      ? "bg-[#ffd66b] text-[#365665] shadow-[0_16px_34px_rgba(255,214,107,0.2)]"
                      : "bg-white/12 text-white/72 hover:bg-white/18"
                  }`}
                >
                  {isActive ? "On" : "Off"}
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/58">
                    Title
                  </span>
                  <input
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setPushTitle(event.target.value || "📣 Staff announcement");
                    }}
                    placeholder="Example: Team meeting tonight"
                    className="h-12 w-full rounded-[18px] border border-white/12 bg-white/90 px-4 text-[13px] font-black text-[#365665] outline-none placeholder:text-[#365665]/45"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/58">
                    Announcement text
                  </span>
                  <textarea
                    value={body}
                    onChange={(event) => {
                      setBody(event.target.value);
                      setPushBody(event.target.value);
                    }}
                    placeholder="Write the news, meeting note, or staff reminder here..."
                    rows={8}
                    className="w-full resize-none rounded-[20px] border border-white/12 bg-white/90 px-4 py-4 text-[13px] font-bold leading-6 text-[#365665] outline-none placeholder:text-[#365665]/45"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-white/8 p-3">
                  <div className="text-[12px] font-bold text-white/68">
                    {loading ? "Loading..." : isActive ? "Visible on staff page" : "Hidden from staff page"}
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveAnnouncement()}
                    disabled={saving || loading}
                    className="rounded-full bg-[#ffd66b] px-6 py-3 text-[12px] font-black text-[#365665] transition hover:bg-[#f0cf61] disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-white/14 bg-white/10 p-5 shadow-[0_24px_70px_rgba(35,54,47,0.18)] backdrop-blur-2xl lg:p-6">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ffd66b]">
                Optional reminder
              </p>
              <h2 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-white">
                Push notification
              </h2>
              <p className="mt-2 text-[13px] font-bold leading-6 text-white/62">
                Customize the push before sending. This does not change the saved announcement unless you press Save on the left.
              </p>

              <div className="mt-6 grid gap-3">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/58">
                    Notification title
                  </span>
                  <input
                    value={pushTitle}
                    onChange={(event) => setPushTitle(event.target.value)}
                    placeholder="Notification title"
                    className="h-12 w-full rounded-[18px] border border-white/12 bg-white/90 px-4 text-[13px] font-black text-[#365665] outline-none placeholder:text-[#365665]/45"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/58">
                    Notification message
                  </span>
                  <textarea
                    value={pushBody}
                    onChange={(event) => setPushBody(event.target.value)}
                    placeholder="Notification message"
                    rows={6}
                    className="w-full resize-none rounded-[20px] border border-white/12 bg-white/90 px-4 py-4 text-[13px] font-bold leading-6 text-[#365665] outline-none placeholder:text-[#365665]/45"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void sendAnnouncementPush()}
                  disabled={sending}
                  className="rounded-full bg-white px-6 py-3 text-[12px] font-black text-[#365665] transition hover:bg-[#ffd66b] disabled:opacity-60"
                >
                  {sending ? "Sending..." : "Send push reminder"}
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>

      <LocalAdminMobileMenu />
    </main>
  );
}
