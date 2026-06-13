import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type StampTransactionRow = {
  id: string;
  client_id: string | null;
  category_id: string | null;
  staff_id: string | null;
  action_type: string | null;
  stamp_count_before: number | null;
  stamp_count_after: number | null;
  reward_id: string | null;
  created_at: string | null;
};

type RewardRow = {
  id: string;
  status: string | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isClearlyNotStamp(actionType: string) {
  const value = actionType.toLowerCase();
  return (
    value.includes("reward") ||
    value.includes("redeem") ||
    value.includes("remove") ||
    value.includes("claim") ||
    value.includes("expire")
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const transactionId = String(id || "").trim();

    if (!transactionId) {
      return jsonError("Missing transaction id.", 400);
    }

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
      .maybeSingle();

    if (profileError || !profile || profile.role !== "master_admin") {
      return jsonError("Only master admins can delete stamp activity.", 403);
    }

    const admin = createAdminClient();

    const { data: transaction, error: transactionError } = await admin
      .from("stamp_transactions")
      .select(
        "id, client_id, category_id, staff_id, action_type, stamp_count_before, stamp_count_after, reward_id, created_at",
      )
      .eq("id", transactionId)
      .maybeSingle<StampTransactionRow>();

    if (transactionError) {
      return jsonError(transactionError.message, 500);
    }

    if (!transaction) {
      return jsonError("Stamp transaction not found.", 404);
    }

    const actionType = String(transaction.action_type || "").toLowerCase();

    if (isClearlyNotStamp(actionType)) {
      return jsonError("Only stamp rows can be deleted from Activity.", 400);
    }

    if (!transaction.client_id || !transaction.category_id) {
      return jsonError("This stamp row is missing client or category data.", 400);
    }

    const stampBefore = Number(transaction.stamp_count_before ?? 0);
    const stampAfter = Number(transaction.stamp_count_after ?? stampBefore + 1);
    const createdAt = transaction.created_at ? new Date(transaction.created_at) : null;

    let reversedRewardId: string | null = null;
    let reversedRewardEarnedTransactionId: string | null = null;

    // If this stamp completed the card, add_stamp created a reward and a reward_earned row
    // in the same transaction. Deleting this stamp should reverse that reward too.
    if (stampAfter >= 5 && createdAt && !Number.isNaN(createdAt.getTime())) {
      const startWindow = new Date(createdAt.getTime() - 10_000).toISOString();
      const endWindow = new Date(createdAt.getTime() + 60_000).toISOString();

      let rewardEarnedQuery = admin
        .from("stamp_transactions")
        .select("id, reward_id, created_at")
        .eq("client_id", transaction.client_id)
        .eq("category_id", transaction.category_id)
        .eq("action_type", "reward_earned")
        .gte("created_at", startWindow)
        .lte("created_at", endWindow)
        .order("created_at", { ascending: true })
        .limit(1);

      if (transaction.staff_id) {
        rewardEarnedQuery = rewardEarnedQuery.eq("staff_id", transaction.staff_id);
      }

      const { data: rewardEarnedRows, error: rewardEarnedError } =
        await rewardEarnedQuery;

      if (rewardEarnedError) {
        return jsonError(rewardEarnedError.message, 500);
      }

      const rewardEarned = rewardEarnedRows?.[0] as
        | { id: string; reward_id: string | null; created_at: string | null }
        | undefined;

      if (rewardEarned?.reward_id) {
        const { data: reward, error: rewardError } = await admin
          .from("rewards")
          .select("id, status")
          .eq("id", rewardEarned.reward_id)
          .maybeSingle<RewardRow>();

        if (rewardError) {
          return jsonError(rewardError.message, 500);
        }

        const rewardStatus = String(reward?.status || "").toLowerCase();

        if (reward && rewardStatus === "redeemed") {
          return jsonError(
            "This stamp created a reward that was already redeemed. Reverse the redeemed gift first before deleting this stamp.",
            409,
          );
        }

        // available/claimed rewards can safely be reversed.
        const { error: deleteRewardError } = await admin
          .from("rewards")
          .delete()
          .eq("id", rewardEarned.reward_id);

        if (deleteRewardError) {
          return jsonError(deleteRewardError.message, 500);
        }

        reversedRewardId = rewardEarned.reward_id;
      }

      if (rewardEarned?.id) {
        const { error: deleteRewardTxnError } = await admin
          .from("stamp_transactions")
          .delete()
          .eq("id", rewardEarned.id);

        if (deleteRewardTxnError) {
          return jsonError(deleteRewardTxnError.message, 500);
        }

        reversedRewardEarnedTransactionId = rewardEarned.id;
      }
    }

    const { error: deleteStampError } = await admin
      .from("stamp_transactions")
      .delete()
      .eq("id", transactionId);

    if (deleteStampError) {
      return jsonError(deleteStampError.message, 500);
    }

    const { data: stampRow, error: stampRowError } = await admin
      .from("client_stamps")
      .select("id, stamp_count")
      .eq("client_id", transaction.client_id)
      .eq("category_id", transaction.category_id)
      .maybeSingle();

    if (stampRowError) {
      return jsonError(stampRowError.message, 500);
    }

    if (stampRow?.id) {
      const nextCount = stampAfter >= 5
        ? Math.max(0, stampBefore)
        : Math.max(0, Number(stampRow.stamp_count || 0) - 1);

      const { error: updateStampError } = await admin
        .from("client_stamps")
        .update({ stamp_count: nextCount })
        .eq("id", stampRow.id);

      if (updateStampError) {
        return jsonError(updateStampError.message, 500);
      }
    }

    return NextResponse.json({
      success: true,
      deleted_id: transactionId,
      reversed_reward_id: reversedRewardId,
      reversed_reward_earned_transaction_id: reversedRewardEarnedTransactionId,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not delete stamp.",
      500,
    );
  }
}
