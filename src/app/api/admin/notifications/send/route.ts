import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Audience = "Client" | "Staff" | "Admin";

type PushSubscriptionRow = {
  id: string;
  profile_id?: string | null;
  audience?: string | null;
  role?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeAudience(value: unknown): Audience | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "client" || normalized === "clients") return "Client";
  if (normalized === "staff") return "Staff";
  if (normalized === "admin" || normalized === "admins" || normalized === "master_admin") return "Admin";
  return null;
}

function roleForAudience(audience: Audience) {
  if (audience === "Client") return "client";
  if (audience === "Staff") return "staff";
  return "master_admin";
}

function audienceMatches(row: PushSubscriptionRow, audience: Audience) {
  const wantedAudience = audience.toLowerCase();
  const wantedRole = roleForAudience(audience).toLowerCase();
  const rowAudience = String(row.audience ?? "").trim().toLowerCase();
  const rowRole = String(row.role ?? "").trim().toLowerCase();

  return rowAudience === wantedAudience || rowRole === wantedRole;
}

function invalidSubscription(row: PushSubscriptionRow) {
  return !row.endpoint || !row.p256dh || !row.auth;
}

export async function GET() {
  try {
    const admin = getServiceClient();
    const { data, error } = await admin
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "server_error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: {
    title?: string;
    message?: string;
    type?: string;
    notification_type?: string;
    audience?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const message = String(body.message ?? "").trim();
  const type = String(body.type ?? body.notification_type ?? "Announcements").trim() || "Announcements";
  const audience = normalizeAudience(body.audience);

  if (!title || !message || !audience) {
    return NextResponse.json(
      { error: "title_message_audience_required" },
      { status: 400 },
    );
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:info@proscafe.net";

  if (!publicKey || !privateKey) {
    return NextResponse.json(
      { error: "missing_vapid_keys" },
      { status: 500 },
    );
  }

  try {
    const admin = getServiceClient();
    const now = new Date().toISOString();

    const { data: notification, error: insertError } = await admin
      .from("admin_notifications")
      .insert({
        title,
        message,
        notification_type: type,
        audience,
        status: "Sent",
        send_mode: "now",
        sent_at: now,
        sent_by: null,
      })
      .select("*")
      .single();

    if (insertError || !notification) {
      return NextResponse.json(
        { error: insertError?.message ?? "could_not_save_notification" },
        { status: 400 },
      );
    }

    const { data: allSubscriptions, error: subError } = await admin
      .from("push_subscriptions")
      .select("id, profile_id, audience, role, endpoint, p256dh, auth");

    if (subError) {
      await admin
        .from("admin_notifications")
        .update({ status: "Failed", error: subError.message })
        .eq("id", notification.id);

      return NextResponse.json({ error: subError.message }, { status: 400 });
    }

    const subscriptions = ((allSubscriptions ?? []) as PushSubscriptionRow[])
      .filter((subscription) => audienceMatches(subscription, audience))
      .filter((subscription) => !invalidSubscription(subscription));

    if (subscriptions.length === 0) {
      await admin
        .from("admin_notifications")
        .update({
          status: "No subscribers",
          recipient_count: 0,
          success_count: 0,
          failed_count: 0,
          error: `No subscribed ${audience} devices were found.`,
        })
        .eq("id", notification.id);

      return NextResponse.json({
        ok: true,
        message: `Notification saved, but no subscribed ${audience} devices were found (${allSubscriptions?.length ?? 0} subscriptions).`,
        notification,
        sentCount: 0,
        failedCount: 0,
        subscriptionCount: 0,
        totalSavedSubscriptions: allSubscriptions?.length ?? 0,
      });
    }

    const webpushModule = await import("web-push");
    const webpush = webpushModule.default ?? webpushModule;
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const payload = JSON.stringify({
      title,
      body: message,
      type,
      audience,
      url: "/",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    });

    let sentCount = 0;
    let failedCount = 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload,
          );
          sentCount += 1;

          await admin.from("admin_notification_recipients").insert({
            notification_id: notification.id,
            subscription_id: subscription.id,
            status: "sent",
          });
        } catch (error) {
          failedCount += 1;
          const errorMessage = error instanceof Error ? error.message : "send_failed";

          await admin.from("admin_notification_recipients").insert({
            notification_id: notification.id,
            subscription_id: subscription.id,
            status: "failed",
            error: errorMessage,
          });
        }
      }),
    );

    await admin
      .from("admin_notifications")
      .update({
        status: failedCount > 0 && sentCount === 0 ? "Failed" : "Sent",
        recipient_count: subscriptions.length,
        sent_count: sentCount,
        success_count: sentCount,
        failed_count: failedCount,
        error: failedCount > 0 && sentCount === 0 ? "All notification sends failed." : null,
      })
      .eq("id", notification.id);

    return NextResponse.json({
      ok: true,
      message: `Notification sent to ${sentCount} device${sentCount === 1 ? "" : "s"}.`,
      notification: { ...notification, sent_count: sentCount, failed_count: failedCount },
      sentCount,
      failedCount,
      subscriptionCount: subscriptions.length,
      totalSavedSubscriptions: allSubscriptions?.length ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "server_error" },
      { status: 500 },
    );
  }
}
