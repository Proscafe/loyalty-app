import { NextResponse } from "next/server";
import webpush from "web-push";

import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@wissamdesigns.com";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID push notification keys.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError("Please sign in first.", 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "master_admin") {
      return jsonError("Admin access required.", 403);
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      body?: string;
    };

    const title = String(body.title || "Staff announcement").trim();
    const message = String(body.body || "").trim();

    if (!message) {
      return jsonError("Notification message is required.", 400);
    }

    configureWebPush();

    const admin = createAdminClient();

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("role", ["staff", "master_admin"]);

    if (subscriptionsError) {
      throw subscriptionsError;
    }

    const rows = (subscriptions ?? []) as PushSubscriptionRow[];

    if (rows.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: "/staff",
      tag: `staff-announcement-${Date.now()}`,
    });

    let sent = 0;

    await Promise.allSettled(
      rows.map(async (subscription) => {
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
          sent += 1;
        } catch (error: any) {
          const statusCode = Number(error?.statusCode || 0);

          if (statusCode === 404 || statusCode === 410) {
            await admin
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);
            return;
          }

          console.error("Staff announcement push failed", error);
        }
      }),
    );

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not send notification.",
      500,
    );
  }
}
