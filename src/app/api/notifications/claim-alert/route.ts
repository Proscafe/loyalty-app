import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubscriptionRow = {
  id: string;
  audience?: string | null;
  role?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type RewardRow = {
  id: string;
  status: string | null;
  reward_type: string | null;
  client_id: string | null;
  claim_alert_sent_at?: string | null;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
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

function normalizeVapidSubject(value?: string | null) {
  const clean = String(value || "mailto:info@proscafe.net").trim();
  if (clean.includes(":")) return clean;
  if (clean.includes("@")) return `mailto:${clean}`;
  return "mailto:info@proscafe.net";
}

function isStaffSubscription(row: PushSubscriptionRow) {
  return (
    String(row.audience ?? "").trim().toLowerCase() === "staff" ||
    String(row.role ?? "").trim().toLowerCase() === "staff"
  );
}

function invalidSubscription(row: PushSubscriptionRow) {
  return !row.endpoint || !row.p256dh || !row.auth;
}

function prettyRewardName(value?: string | null) {
  const clean = String(value || "reward").trim();
  if (!clean) return "reward";
  return clean;
}

export async function POST(req: Request) {
  let body: { rewardId?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rewardId = String(body.rewardId ?? "").trim();

  if (!rewardId) {
    return NextResponse.json({ error: "reward_id_required" }, { status: 400 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = normalizeVapidSubject(process.env.VAPID_SUBJECT);

  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "missing_vapid_keys" }, { status: 500 });
  }

  try {
    const admin = getServiceClient();

    const { data: reward, error: rewardError } = await admin
      .from("rewards")
      .select("id, status, reward_type, client_id, claim_alert_sent_at")
      .eq("id", rewardId)
      .maybeSingle();

    if (rewardError) {
      return NextResponse.json({ error: rewardError.message }, { status: 400 });
    }

    if (!reward) {
      return NextResponse.json({ error: "reward_not_found" }, { status: 404 });
    }

    const rewardRow = reward as RewardRow;

    if (String(rewardRow.status ?? "").toLowerCase() !== "claimed") {
      return NextResponse.json({ ok: true, skipped: true, reason: "reward_not_claimed" });
    }

    if (rewardRow.claim_alert_sent_at) {
      return NextResponse.json({ ok: true, skipped: true, reason: "claim_alert_already_sent" });
    }

    const now = new Date().toISOString();

    const { data: lockedReward, error: lockError } = await admin
      .from("rewards")
      .update({ claim_alert_sent_at: now })
      .eq("id", rewardId)
      .is("claim_alert_sent_at", null)
      .select("id")
      .maybeSingle();

    if (lockError) {
      return NextResponse.json({ error: lockError.message }, { status: 400 });
    }

    if (!lockedReward) {
      return NextResponse.json({ ok: true, skipped: true, reason: "claim_alert_already_locked" });
    }

    let clientName = "A client";

    if (rewardRow.client_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, full_name, name, email")
        .eq("id", rewardRow.client_id)
        .maybeSingle();

      const profileRow = profile as ProfileRow | null;
      clientName =
        profileRow?.full_name?.trim() ||
        profileRow?.name?.trim() ||
        profileRow?.email?.trim() ||
        "A client";
    }

    const rewardName = prettyRewardName(rewardRow.reward_type);
    const title = "New claim request";
    const message = `${clientName} requested ${rewardName}.`;

    const { data: allSubscriptions, error: subError } = await admin
      .from("push_subscriptions")
      .select("id, audience, role, endpoint, p256dh, auth");

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 400 });
    }

    const staffSubscriptions = ((allSubscriptions ?? []) as PushSubscriptionRow[])
      .filter(isStaffSubscription)
      .filter((subscription) => !invalidSubscription(subscription));

    if (staffSubscriptions.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "Claim alert saved, but no Staff push subscriptions were found.",
        sentCount: 0,
        failedCount: 0,
        totalSavedSubscriptions: allSubscriptions?.length ?? 0,
      });
    }

    const webpushModule = await import("web-push");
    const webpush = webpushModule.default ?? webpushModule;
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const payload = JSON.stringify({
      title,
      body: message,
      type: "Claim Request",
      audience: "Staff",
      url: "/staff",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      rewardId,
    });

    let sentCount = 0;
    let failedCount = 0;

    await Promise.all(
      staffSubscriptions.map(async (subscription) => {
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
        } catch {
          failedCount += 1;
        }
      }),
    );

    await admin.from("admin_notifications").insert({
      title,
      message,
      notification_type: "Claim Request",
      audience: "Staff",
      status: failedCount > 0 && sentCount === 0 ? "Failed" : "Sent",
      send_mode: "auto_claim_alert",
      sent_at: now,
      recipient_count: staffSubscriptions.length,
      sent_count: sentCount,
      success_count: sentCount,
      failed_count: failedCount,
      error: failedCount > 0 && sentCount === 0 ? "All claim alert sends failed." : null,
    }).throwOnError();

    return NextResponse.json({
      ok: true,
      message: `Claim alert sent to ${sentCount} Staff device${sentCount === 1 ? "" : "s"}.`,
      sentCount,
      failedCount,
      subscriptionCount: staffSubscriptions.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "server_error" },
      { status: 500 },
    );
  }
}
