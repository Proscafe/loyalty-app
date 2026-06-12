import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendNewRewardClaimNotification } from "@/lib/push";

// Reads auth cookies and updates rewards server-side — must run on Node, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClaimRewardBody = {
  reward_id?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("not_authenticated", 401);
  }

  let body: ClaimRewardBody;

  try {
    body = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const rewardId = String(body.reward_id || "").trim();

  if (!rewardId) {
    return jsonError("missing_reward_id", 400);
  }

  const { data: reward, error: rewardError } = await admin
    .from("rewards")
    .select("id, client_id, reward_type, status, claimed_at")
    .eq("id", rewardId)
    .maybeSingle();

  if (rewardError) {
    return jsonError(rewardError.message || "Could not load reward.", 400);
  }

  if (!reward) {
    return jsonError("reward_not_found", 404);
  }

  if (reward.client_id !== user.id) {
    return jsonError("not_authorized", 403);
  }

  if (reward.status === "redeemed") {
    return jsonError("This gift was already redeemed.", 409);
  }

  if (reward.status === "expired") {
    return jsonError("This gift has expired.", 410);
  }

  // If the user taps more than once, do not loop or send duplicate staff alerts.
  if (reward.status === "claimed") {
    return NextResponse.json({
      ok: true,
      alreadyClaimed: true,
      reward,
    });
  }

  const { data: updatedReward, error: updateError } = await admin
    .from("rewards")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
    })
    .eq("id", rewardId)
    .eq("client_id", user.id)
    .eq("status", "available")
    .select("id, client_id, reward_type, status, claimed_at")
    .maybeSingle();

  if (updateError) {
    return jsonError(updateError.message || "Could not claim gift.", 400);
  }

  if (!updatedReward) {
    return jsonError("This gift is not available to claim.", 409);
  }

  try {
    let clientName = "A client";

    const { data: clientProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", updatedReward.client_id)
      .maybeSingle();

    clientName = clientProfile?.full_name || clientName;

    await sendNewRewardClaimNotification({
      rewardId,
      rewardType: updatedReward.reward_type || "Reward",
      clientName,
    });
  } catch (notificationError) {
    // Claim should still succeed even if push notification delivery fails.
    console.error("Claim push notification failed", notificationError);
  }

  return NextResponse.json({
    ok: true,
    reward: updatedReward,
  });
}
