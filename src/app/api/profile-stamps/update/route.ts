import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type RequestBody = {
  clientId?: string;
  categoryId?: string;
  direction?: 1 | -1;
  staffId?: string | null;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function displayCategoryName(name?: string | null) {
  if (!name) return "Reward";
  return name === "Desserts 2" ? "Hooka" : name;
}

function rewardTitleFor(categoryName: string) {
  const normalized = categoryName.trim();

  if (!normalized) return "Free Reward";
  if (/hooka/i.test(normalized)) return "Free Hooka";
  if (/coffee/i.test(normalized)) return "Free Coffee";
  if (/dessert/i.test(normalized)) return "Free Dessert";
  if (/sandwich/i.test(normalized)) return "Free Sandwich";
  if (/main/i.test(normalized)) return "Free Main Course";

  return `Free ${normalized}`;
}

function beirutDay(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;

    const clientId = String(body.clientId || "").trim();
    const categoryId = String(body.categoryId || "").trim();
    const direction = body.direction === -1 ? -1 : 1;
    const staffId = body.staffId ? String(body.staffId) : null;

    if (!clientId || !categoryId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing client or category.",
        },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const now = new Date().toISOString();

    const { data: category, error: categoryError } = await supabase
      .from("loyalty_categories")
      .select("id,name")
      .eq("id", categoryId)
      .maybeSingle();

    if (categoryError) {
      return NextResponse.json(
        {
          ok: false,
          error: categoryError.message,
        },
        { status: 500 },
      );
    }

    const categoryName = displayCategoryName(category?.name);

    /*
     * ADD STAMP RULES
     *
     * 1. If an active gift exists for this category, it must be redeemed first.
     * 2. If a gift from this category was redeemed today, stamping starts
     *    again tomorrow.
     * 3. These restrictions apply only when ADDING a stamp.
     * 4. Removing a stamp is always allowed when a stamp exists.
     */
    if (direction > 0) {
      const { data: activeReward, error: activeRewardError } = await supabase
        .from("rewards")
        .select("id")
        .eq("client_id", clientId)
        .eq("category_id", categoryId)
        .eq("status", "available")
        .limit(1)
        .maybeSingle();

      if (activeRewardError) {
        return NextResponse.json(
          {
            ok: false,
            error: activeRewardError.message,
          },
          { status: 500 },
        );
      }

      if (activeReward) {
        return NextResponse.json(
          {
            ok: false,
            error: `Redeem the active ${categoryName} gift before collecting new ${categoryName} stamps.`,
          },
          { status: 409 },
        );
      }

      const { data: redeemedRewards, error: redeemedRewardsError } =
        await supabase
          .from("rewards")
          .select("id, redeemed_at")
          .eq("client_id", clientId)
          .eq("category_id", categoryId)
          .eq("status", "redeemed")
          .not("redeemed_at", "is", null)
          .order("redeemed_at", { ascending: false })
          .limit(10);

      if (redeemedRewardsError) {
        return NextResponse.json(
          {
            ok: false,
            error: redeemedRewardsError.message,
          },
          { status: 500 },
        );
      }

      const todayInBeirut = beirutDay(new Date());

      const redeemedToday = (redeemedRewards ?? []).some((reward) => {
        if (!reward.redeemed_at) return false;

        return beirutDay(String(reward.redeemed_at)) === todayInBeirut;
      });

      if (redeemedToday) {
        return NextResponse.json(
          {
            ok: false,
            error: `${categoryName} gift was redeemed today. New ${categoryName} stamps can start tomorrow.`,
          },
          { status: 409 },
        );
      }
    }

    /*
     * GET CURRENT STAMP COUNT
     */
    const { data: currentRows, error: currentError } = await supabase
      .from("client_stamps")
      .select("id, stamp_count")
      .eq("client_id", clientId)
      .eq("category_id", categoryId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (currentError) {
      return NextResponse.json(
        {
          ok: false,
          error: currentError.message,
        },
        { status: 500 },
      );
    }

    const current = currentRows?.[0] ?? null;

    const currentCount = Math.max(
      0,
      Math.min(5, Number(current?.stamp_count ?? 0)),
    );

    /*
     * REMOVE STAMP
     */
    if (direction < 0 && currentCount <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "This customer has no stamp to remove.",
        },
        { status: 409 },
      );
    }

    const nextCount = Math.max(
      0,
      Math.min(5, currentCount + direction),
    );

    const completed = direction > 0 && nextCount >= 5;
    const stampCountToSave = completed ? 0 : nextCount;

    /*
     * NORMAL ADD / REMOVE
     */
    if (!completed) {
      if (current?.id) {
        const { error } = await supabase
          .from("client_stamps")
          .update({
            stamp_count: stampCountToSave,
            updated_at: now,
          })
          .eq("id", current.id);

        if (error) {
          return NextResponse.json(
            {
              ok: false,
              error: error.message,
            },
            { status: 500 },
          );
        }
      } else {
        const { error } = await supabase
          .from("client_stamps")
          .insert({
            client_id: clientId,
            category_id: categoryId,
            stamp_count: stampCountToSave,
            updated_at: now,
          });

        if (error) {
          return NextResponse.json(
            {
              ok: false,
              error: error.message,
            },
            { status: 500 },
          );
        }
      }

      /*
       * IMPORTANT:
       *
       * Database CHECK constraint only allows:
       * add_stamp
       * reward_earned
       * reward_redeemed
       * manual_adjustment
       *
       * A removal therefore uses:
       * action = remove_stamp
       * action_type = manual_adjustment
       */
      const action =
        direction > 0 ? "add_stamp" : "remove_stamp";

      const actionType =
        direction > 0 ? "add_stamp" : "manual_adjustment";

      const { data: transaction, error: transactionError } =
        await supabase
          .from("stamp_transactions")
          .insert({
            client_id: clientId,
            profile_id: clientId,
            category_id: categoryId,
            category: categoryName,
            action,
            action_type: actionType,
            amount: direction,
            stamp_count_before: currentCount,
            stamp_count_after: nextCount,
            staff_id: staffId,
            note:
              direction > 0
                ? null
                : "Stamp removed manually",
            created_at: now,
          })
          .select("*")
          .single();

      if (transactionError) {
        /*
         * Restore old count if transaction logging fails.
         */
        if (current?.id) {
          await supabase
            .from("client_stamps")
            .update({
              stamp_count: currentCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", current.id);
        } else {
          await supabase
            .from("client_stamps")
            .delete()
            .eq("client_id", clientId)
            .eq("category_id", categoryId);
        }

        return NextResponse.json(
          {
            ok: false,
            error: `Stamp update was rolled back: ${transactionError.message}`,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        completed: false,
        stamp_count: stampCountToSave,
        transaction,
      });
    }

    /*
     * 5TH STAMP — CREATE REWARD
     */
    const rewardType = rewardTitleFor(categoryName);

    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    /*
     * Create reward BEFORE resetting the card.
     *
     * expiry_date and valid_until are intentionally NOT included because
     * they do not exist in the current rewards schema.
     */
    const { data: reward, error: rewardError } = await supabase
      .from("rewards")
      .insert({
        client_id: clientId,
        profile_id: clientId,
        category_id: categoryId,

        title: rewardType,
        reward_name: rewardType,
        reward_type: rewardType,
        reward_label: rewardType,
        gift_type: rewardType,

        description: `${categoryName} loyalty card completed`,

        status: "available",
        reward_status: "available",

        earned_at: now,
        created_at: now,
        expires_at: expiresAt,

        source: "loyalty_card",
        source_label: categoryName,
      })
      .select("id")
      .single();

    if (rewardError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Reward was not created: ${rewardError.message}`,
        },
        { status: 500 },
      );
    }

    /*
     * RESET CARD AFTER SUCCESSFUL REWARD CREATION
     */
    if (current?.id) {
      const { error } = await supabase
        .from("client_stamps")
        .update({
          stamp_count: 0,
          updated_at: now,
        })
        .eq("id", current.id);

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          { status: 500 },
        );
      }
    } else {
      const { error } = await supabase
        .from("client_stamps")
        .insert({
          client_id: clientId,
          category_id: categoryId,
          stamp_count: 0,
          updated_at: now,
        });

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          { status: 500 },
        );
      }
    }

    /*
     * RECORD REWARD EARNED
     */
    const { error: completionTransactionError } = await supabase
      .from("stamp_transactions")
      .insert({
        client_id: clientId,
        profile_id: clientId,
        category_id: categoryId,
        category: categoryName,

        action: "reward_earned",
        action_type: "reward_earned",

        amount: 5,
        stamp_count_before: currentCount,
        stamp_count_after: 0,

        reward_id: reward?.id ?? null,
        staff_id: staffId,

        note: `${rewardType} created after ${categoryName} card completion`,
        created_at: now,
      });

    if (completionTransactionError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Reward was created, but the completion transaction could not be logged: ${completionTransactionError.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      completed: true,
      reward_id: reward?.id ?? null,
      reward_type: rewardType,
      stamp_count: 0,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update stamps.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}