import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/server";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type ClaimNotificationInput = {
  rewardId: string;
  rewardType: string;
  clientName: string;
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@wissamdesigns.com";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID push notification keys.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendNewRewardClaimNotification({
  rewardId,
  rewardType,
  clientName,
}: ClaimNotificationInput) {
  configureWebPush();

  const supabase = createAdminClient();

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("role", ["staff", "master_admin"]);

  if (error) {
    throw error;
  }

  if (!subscriptions?.length) {
    return;
  }

  const payload = JSON.stringify({
    title: "New reward claim",
    body: `${clientName} claimed ${rewardType}`,
    url: "/staff",
    tag: `reward-claim-${rewardId}`,
  });

  await Promise.allSettled(
    (subscriptions as PushSubscriptionRow[]).map(async (subscription) => {
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
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || 0);

        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        } else {
          console.error("Push notification send failed", error);
        }
      }
    }),
  );
}
