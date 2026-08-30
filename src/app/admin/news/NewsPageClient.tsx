"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/AdminPageShell";
import { AdminMobileHeader } from "@/components/AdminMobileHeader";

const PAGE_BG =
  "radial-gradient(circle at top left, rgba(255,214,107,0.24), transparent 28%), linear-gradient(135deg, #365665 0%, #263f49 48%, #798673 100%)";
const GLASS_PANEL = "rgba(255,255,255,0.10)";
const GLASS_CARD =
  "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))";
type Audience = "" | "Client" | "Staff" | "Supervisor" | "Admin";
type SendMode = "now" | "scheduled";
type NotificationStatus = "Draft" | "Scheduled" | "Sent" | "Failed";

type NotificationHistoryRow = {
  id: string;
  title: string;
  audience: Exclude<Audience, "">;
  status: NotificationStatus;
  sentDate: string;
  sentBy: string;
  message: string;
};

const AUDIENCES: Exclude<Audience, "">[] = ["Client", "Staff", "Supervisor", "Admin"];

const NOTIFICATION_TYPES = [
  "Announcements",
  "Promotion",
  "New Reward",
  "Points Reminder",
  "Order / Visit Update",
];

const TITLE_LIMIT = 40;
const MESSAGE_LIMIT = 120;
const TITLE_IDEAL_MIN = 25;
const TITLE_IDEAL_MAX = 35;
const MESSAGE_IDEAL_MIN = 60;
const MESSAGE_IDEAL_MAX = 100;

function counterColor(count: number, max: number, _idealMin: number, idealMax: number) {
  if (count >= max) return "#ff4d4d";
  if (count > idealMax) return "#b87900";
  return "#17995a";
}


function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function notificationRowFromApi(row: any): NotificationHistoryRow {
  return {
    id: String(row.id),
    title: String(row.title || "Notification"),
    message: String(row.message || ""),
    audience: (row.audience || "Client") as Exclude<Audience, "">,
    status: (row.status || "Sent") as NotificationStatus,
    sentDate: String(row.sent_at || row.scheduled_at || row.created_at || new Date().toISOString()),
    sentBy: "Admin",
  };
}

export default function NewsPageClient() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("Announcements");
  const [audience, setAudience] = useState<Audience>("");
  const [sendMode, setSendMode] = useState<SendMode>("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [history, setHistory] = useState<NotificationHistoryRow[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function registerCurrentDeviceForPush() {
    if (typeof window === "undefined") return false;

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      flash("This browser does not support push notifications.");
      return false;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      flash("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local.");
      return false;
    }

    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      flash("Allow notifications in Chrome first.");
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription,
          audience: "Admin",
          role: "master_admin",
        }),
      });

      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        flash(json.error || "Could not save this device for notifications.");
        return false;
      }

      return true;
    } catch {
      flash("Could not register this device for notifications.");
      return false;
    }
  }

  useEffect(() => {
    async function loadNotifications() {
      try {
        const response = await fetch("/api/notifications/send", {
          method: "GET",
          cache: "no-store",
        });
        const json = (await response.json().catch(() => ({}))) as {
          notifications?: any[];
          error?: string;
        };

        if (!response.ok) {
          flash(json.error || "Could not load notifications.");
          return;
        }

        setHistory((json.notifications || []).map(notificationRowFromApi));
      } catch {
        flash("Could not load notifications.");
      }
    }

    void loadNotifications();

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      void registerCurrentDeviceForPush();
    }
  }, []);


  function saveHistory(nextHistory: NotificationHistoryRow[]) {
    setHistory(nextHistory);
  }

  function flash(text: string) {
    setStatusMessage(text);
    window.setTimeout(() => setStatusMessage(null), 2400);
  }

  function clearFormFields() {
    setTitle("");
    setMessage("");
    setType("Announcements");
    setAudience("");
    setScheduleDate("");
    setScheduleTime("");
    setSendMode("now");
  }

  const canSend =
    title.trim().length > 0 && message.trim().length > 0 && Boolean(audience);

  function validateNotification() {
    if (!canSend) {
      flash("Add a title, message, and audience first.");
      return false;
    }

    return true;
  }

  function openSendConfirmation() {
    setSendMode("now");
    if (!validateNotification()) return;
    setConfirmSendOpen(true);
  }

  async function sendNowNotification() {
    if (!validateNotification()) return;

    setIsSending(true);

    try {
      if (audience === "Admin") {
        await registerCurrentDeviceForPush();
      }
      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          type,
          audience,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as {
        notification?: any;
        sentCount?: number;
        subscriptionCount?: number;
        error?: string;
      };

      if (!response.ok || !json.notification) {
        flash(json.error || "Could not send notification.");
        return;
      }

      const row = notificationRowFromApi(json.notification);
      saveHistory([row, ...history].slice(0, 50));
      setConfirmSendOpen(false);
      const sentCount = json.sentCount ?? 0;
      const subscriptionCount = json.subscriptionCount ?? 0;
      flash(
        sentCount > 0
          ? `Notification sent to ${sentCount} device${sentCount === 1 ? "" : "s"}.`
          : `Notification saved, but no subscribed ${audience} devices were found (${subscriptionCount} subscriptions).`,
      );
    } catch {
      flash("Could not send notification.");
    } finally {
      setIsSending(false);
    }
  }

  async function scheduleNotification() {
    setSendMode("scheduled");

    if (!validateNotification()) return;

    if (!scheduleDate || !scheduleTime) {
      flash("Choose a date and time first.");
      return;
    }

    try {
      const response = await fetch("/api/admin/notifications/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          type,
          audience,
          scheduled_at: new Date(`${scheduleDate}T${scheduleTime}`).toISOString(),
        }),
      });

      const json = (await response.json().catch(() => ({}))) as {
        notification?: any;
        error?: string;
      };

      if (!response.ok || !json.notification) {
        flash(json.error || "Could not schedule notification.");
        return;
      }

      const row = notificationRowFromApi(json.notification);
      saveHistory([row, ...history].slice(0, 50));
      flash("Notification scheduled.");
    } catch {
      flash("Could not schedule notification.");
    }
  }

  function duplicateNotification(row: NotificationHistoryRow) {
    setTitle(row.title);
    setMessage(row.message);
    setAudience(row.audience);
    setSendMode("now");
    flash("Notification duplicated into the form.");
  }

  function editScheduledNotification(row: NotificationHistoryRow) {
    setTitle(row.title);
    setMessage(row.message);
    setAudience(row.audience);
    setSendMode("scheduled");

    const date = new Date(row.sentDate);
    if (!Number.isNaN(date.getTime())) {
      setScheduleDate(date.toISOString().slice(0, 10));
      setScheduleTime(date.toTimeString().slice(0, 5));
    }

    saveHistory(history.filter((item) => item.id !== row.id));
    flash("Scheduled notification moved back to the form.");
  }

  function deleteNotification(id: string) {
    saveHistory(history.filter((item) => item.id !== id));
  }

  return (
    <AdminPageShell active="news">
      <style>{`html, body, main, [data-nextjs-scroll-focus-boundary] { background: ${PAGE_BG} !important; }`}</style>
      <div className="relative min-h-screen px-4 py-5 lg:-m-6 lg:px-8 lg:py-8">
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{ background: PAGE_BG }}
        />

        <AdminMobileHeader />

        <header
          className="mb-5 overflow-hidden rounded-[28px] px-5 py-5 backdrop-blur-2xl lg:mb-6 lg:flex lg:min-h-[132px] lg:items-center lg:justify-between lg:gap-6 lg:rounded-[34px] lg:px-8 lg:py-7"
          style={{ background: GLASS_PANEL }}
        >
          <div className="min-w-0">
            <h1 className="text-[32px] font-black tracking-[-0.04em] text-white">
              Send Notifications
            </h1>
            <p className="mt-2 max-w-3xl text-[12px] font-bold leading-5 text-white/70 lg:text-sm lg:leading-6">
              Create and send push notifications to customers about offers,
              rewards, updates, and campaigns.
            </p>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="grid gap-5">
            <div
              className="rounded-[28px] p-5 backdrop-blur-2xl lg:rounded-[30px] lg:p-6"
              style={{ background: GLASS_CARD }}
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[23px] font-black tracking-[-0.04em] text-white">
                  Message details
                </h2>
                <button
                  type="button"
                  onClick={clearFormFields}
                  className="h-10 rounded-full border border-white/70 bg-transparent px-5 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-white/10"
                >
                  Clear
                </button>
              </div>

              {statusMessage ? (
                <div className="mt-4 rounded-[18px] bg-white/14 px-4 py-3 text-[13px] font-black leading-5 text-white">
                  {statusMessage}
                </div>
              ) : null}

              <div className="mt-5 grid gap-4">
                <label className="relative block">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Notification title"
                    maxLength={TITLE_LIMIT}
                    className="h-12 w-full rounded-[18px] bg-white/95 px-4 pr-20 text-[13px] font-black text-[#365665] outline-none"
                  />
                  <span
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-black tabular-nums"
                    style={{
                      color: counterColor(
                        title.length,
                        TITLE_LIMIT,
                        TITLE_IDEAL_MIN,
                        TITLE_IDEAL_MAX,
                      ),
                    }}
                  >
                    {title.length}/{TITLE_LIMIT}
                  </span>
                </label>

                <label className="relative block">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Notification message"
                    maxLength={MESSAGE_LIMIT}
                    rows={6}
                    className="w-full resize-none rounded-[20px] bg-white/95 px-4 py-4 pb-9 pr-20 text-[13px] font-bold leading-6 text-[#365665] outline-none"
                  />
                  <span
                    className="pointer-events-none absolute bottom-4 right-4 text-[12px] font-black tabular-nums"
                    style={{
                      color: counterColor(
                        message.length,
                        MESSAGE_LIMIT,
                        MESSAGE_IDEAL_MIN,
                        MESSAGE_IDEAL_MAX,
                      ),
                    }}
                  >
                    {message.length}/{MESSAGE_LIMIT}
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/62">
                    Notification Type
                  </span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="h-12 w-full rounded-[18px] bg-white/95 px-4 text-[13px] font-black text-[#365665] outline-none"
                  >
                    {NOTIFICATION_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-2 border-t border-white/12 pt-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                    <select
                      value={audience}
                      onChange={(event) =>
                        setAudience(event.target.value as Audience)
                      }
                      className="h-12 w-full rounded-[18px] bg-white/95 px-4 text-[13px] font-black text-[#365665] outline-none"
                    >
                      <option value="">Choose audience</option>
                      {AUDIENCES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        setSendMode((current) =>
                          current === "scheduled" ? "now" : "scheduled",
                        )
                      }
                      className={`h-12 rounded-full px-8 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                        sendMode === "scheduled"
                          ? "bg-[#ffd66b] text-[#365665] hover:brightness-105"
                          : "bg-transparent text-white hover:bg-white/10"
                      }`}
                    >
                      Schedule later
                    </button>

                    <button
                      type="button"
                      onClick={openSendConfirmation}
                      disabled={isSending}
                      className={`h-12 rounded-full px-8 text-[11px] font-black uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        sendMode === "scheduled"
                          ? "bg-transparent text-white hover:bg-white/10"
                          : "bg-[#ffd66b] text-[#365665] hover:brightness-105"
                      }`}
                    >
                      {isSending ? "Sending..." : "Send now"}
                    </button>
                  </div>

                  {sendMode === "scheduled" ? (
                    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(event) => setScheduleDate(event.target.value)}
                        className="h-12 rounded-[18px] bg-white/95 px-4 text-[13px] font-black text-[#365665] outline-none"
                      />
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(event) => setScheduleTime(event.target.value)}
                        className="h-12 rounded-[18px] bg-white/95 px-4 text-[13px] font-black text-[#365665] outline-none"
                      />
                      <button
                        type="button"
                        onClick={scheduleNotification}
                        className="h-12 rounded-full bg-[#ffd66b] px-8 text-[11px] font-black uppercase tracking-[0.14em] text-[#365665] transition hover:brightness-105"
                      >
                        Schedule
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid content-start gap-5">
            <div
              className="rounded-[28px] p-5 backdrop-blur-2xl lg:rounded-[30px] lg:p-6"
              style={{ background: GLASS_CARD }}
            >
              <h2 className="text-[23px] font-black tracking-[-0.04em] text-white">
                Preview
              </h2>

              <div className="mt-5 rounded-[28px] bg-white/12 p-4">
                <div className="overflow-hidden rounded-[24px] bg-white text-[#365665] shadow-[0_18px_38px_rgba(15,30,32,0.20)]">
                  <div className="px-4 py-4">
                    <div className="text-[16px] font-black leading-tight">
                      {title.trim() || "Notification title"}
                    </div>
                    <div className="mt-1 text-[12px] font-bold leading-5 text-[#365665]/76">
                      {message.trim() || "Notification message"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-[28px] p-5 backdrop-blur-2xl lg:rounded-[30px] lg:p-6"
              style={{ background: GLASS_CARD }}
            >
              <h2 className="text-[23px] font-black tracking-[-0.04em] text-white">
                Scheduled
              </h2>

              <div className="mt-5 space-y-3">
                {history.filter((row) => row.status === "Scheduled").length ===
                0 ? (
                  <div className="rounded-[18px] bg-white/10 px-4 py-5 text-sm font-bold text-white/65">
                    No scheduled notifications.
                  </div>
                ) : (
                  history
                    .filter((row) => row.status === "Scheduled")
                    .map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-3 rounded-[18px] bg-white/10 px-4 py-4"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-black text-white">
                            {row.title}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-white/60">
                            {row.audience} · {formatDisplayDate(row.sentDate)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editScheduledNotification(row)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffd66b] text-[#365665]"
                            aria-label="Edit scheduled notification"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M4 17.3V20h2.7L17.8 8.9l-2.7-2.7L4 17.3ZM19.7 7c.4-.4.4-1 0-1.4l-1.3-1.3a1 1 0 0 0-1.4 0l-1 1L18.7 8l1-1Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteNotification(row.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffb7b7] text-[#d93636]"
                            aria-label="Delete scheduled notification"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2l1 11h4l1-11h2l-1.2 13H8.2L7 9Z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div
              className="rounded-[28px] p-5 backdrop-blur-2xl lg:rounded-[30px] lg:p-6"
              style={{ background: GLASS_CARD }}
            >
              <button
                type="button"
                onClick={() => setHistoryOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <h2 className="text-[23px] font-black tracking-[-0.04em] text-white">
                  History
                </h2>
                <span className="text-[18px] font-black text-[#ffd66b]">
                  {historyOpen ? "−" : "+"}
                </span>
              </button>

              {historyOpen ? (
                <div className="mt-5 space-y-3">
                  {history.length === 0 ? (
                    <div className="px-4 py-5 text-sm font-bold text-white/65">
                      No notifications yet.
                    </div>
                  ) : (
                    history.map((row) => (
                      <div
                        key={row.id}
                        className="grid gap-3 rounded-[18px] bg-white/10 px-4 py-4 lg:grid-cols-[1.35fr_0.65fr_0.55fr_0.75fr_0.9fr] lg:items-center"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-black text-white">
                            {row.title}
                          </div>
                          <div className="mt-1 line-clamp-1 text-[11px] font-bold text-white/55 lg:hidden">
                            {row.message}
                          </div>
                        </div>
                        <div className="text-[11px] font-black text-white/75">
                          {row.audience}
                        </div>
                        <div>
                          <span
                            className={`inline-flex min-w-[68px] justify-center rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
                              row.status === "Sent"
                                ? "bg-emerald-400/20 text-emerald-100"
                                : row.status === "Scheduled"
                                  ? "bg-[#ffd66b]/24 text-[#ffd66b]"
                                  : row.status === "Failed"
                                    ? "bg-red-500/20 text-red-100"
                                    : "bg-white/14 text-white/80"
                            }`}
                          >
                            {row.status}
                          </span>
                        </div>
                        <div className="text-[11px] font-black text-white/75">
                          {formatDisplayDate(row.sentDate)}
                        </div>
                        <div className="flex items-center justify-start gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => duplicateNotification(row)}
                            className="rounded-full bg-white/12 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-white"
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteNotification(row.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffb7b7] text-[#d93636]"
                            aria-label="Delete notification"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2l1 11h4l1-11h2l-1.2 13H8.2L7 9Z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {confirmSendOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] bg-[#365665] p-5 shadow-2xl">
              <h3 className="text-[24px] font-black tracking-[-0.04em] text-white">
                Send notification?
              </h3>
              <p className="mt-2 text-[13px] font-bold leading-6 text-white/72">
                This will send the notification now to{" "}
                {audience || "the selected audience"}.
              </p>
              <div className="mt-5 rounded-[20px] bg-white/12 p-4">
                <div className="text-[14px] font-black text-white">
                  {title.trim() || "Notification title"}
                </div>
                <div className="mt-1 text-[12px] font-bold leading-5 text-white/65">
                  {message.trim() || "Notification message"}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmSendOpen(false)}
                  className="h-12 rounded-full bg-white/12 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={sendNowNotification}
                  disabled={isSending}
                  className="h-12 rounded-full bg-[#ffd66b] text-[11px] font-black uppercase tracking-[0.14em] text-[#365665] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? "Sending..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
