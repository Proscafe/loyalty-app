import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RewardRow = {
  id: string;
  client_id: string | null;
  category_id: string | null;
  reward_type: string | null;
  status: string | null;
  redeemed_at?: string | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isAllowedStaffRole(role?: string | null) {
  return role === "staff" || role === "admin" || role === "master_admin";
}

async function updateRewardAsRedeemed(
  admin: ReturnType<typeof createAdminClient>,
  rewardId: string,
) {
  const redeemedAt = new Date().toISOString();

  const attempts: Array<Record<string, string>> = [
    { status: "redeemed", redeemed_at: redeemedAt, updated_at: redeemedAt },
    { status: "redeemed", redeemed_at: redeemedAt },
    { status: "redeemed" },
  ];

  let lastError: string | null = null;

  for (const patch of attempts) {
    const { data, error } = await admin
      .from("rewards")
      .update(patch)
      .eq("id", rewardId)
      .select("*")
      .maybeSingle();

    if (!error && data) return data as RewardRow;

    lastError = error?.message ?? "Could not redeem reward.";

    const lower = lastError.toLowerCase();
    if (!lower.includes("column") && !lower.includes("schema cache")) break;
  }

  throw new Error(lastError || "Could not redeem reward.");
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

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
      .maybeSingle();

    if (profileError || !profile || !isAllowedStaffRole(profile.role)) {
      return jsonError("Staff access required to confirm gifts.", 403);
    }

    const body = (await req.json().catch(() => ({}))) as {
      reward_id?: string;
      rewardId?: string;
    };

    const rewardId = String(body.reward_id ?? body.rewardId ?? "").trim();

    if (!rewardId) {
      return jsonError("Missing reward_id.", 400);
    }

    const { data: reward, error: rewardError } = await admin
      .from("rewards")
      .select("*")
      .eq("id", rewardId)
      .maybeSingle<RewardRow>();

    if (rewardError) return jsonError(rewardError.message, 500);
    if (!reward) return jsonError("Gift not found.", 404);

    const rawStatus = String(reward.status || "").toLowerCase();

    if (rawStatus === "expired") {
      return jsonError("This gift is expired and cannot be confirmed.", 409);
    }

    if (rawStatus === "redeemed" || rawStatus === "used") {
      return NextResponse.json({ ok: true, reward });
    }

    const updatedReward = await updateRewardAsRedeemed(admin, rewardId);

    try {
      await admin.from("stamp_transactions").insert({
        client_id: reward.client_id,
        staff_id: user.id,
        category_id: reward.category_id,
        reward_id: reward.id,
        action_type: "reward_redeemed",
        created_at: new Date().toISOString(),
      });
    } catch {
      // The reward status is the source of truth. Activity logging should not block redemption.
    }

    return NextResponse.json({ ok: true, reward: updatedReward });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not confirm gift.",
      500,
    );
  }
}
