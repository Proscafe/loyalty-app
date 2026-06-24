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
    auth: { persistSession: false, autoRefreshToken: false },
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

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const clientId = String(body.clientId || "").trim();
    const categoryId = String(body.categoryId || "").trim();
    const direction = body.direction === -1 ? -1 : 1;
    const staffId = body.staffId ? String(body.staffId) : null;

    if (!clientId || !categoryId) {
      return NextResponse.json(
        { ok: false, error: "Missing client or category." },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const now = new Date().toISOString();

    const { data: category } = await supabase
      .from("loyalty_categories")
      .select("id,name")
      .eq("id", categoryId)
      .maybeSingle();

    const categoryName = displayCategoryName(category?.name);

    const { data: currentRows, error: currentError } = await supabase
      .from("client_stamps")
      .select("id, stamp_count")
      .eq("client_id", clientId)
      .eq("category_id", categoryId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (currentError) {
      return NextResponse.json(
        { ok: false, error: currentError.message },
        { status: 500 },
      );
    }

    const current = currentRows?.[0] ?? null;
    const currentCount = Math.max(0, Math.min(5, Number(current?.stamp_count ?? 0)));
    const nextCount = Math.max(0, Math.min(5, currentCount + direction));
    const completed = direction > 0 && (nextCount >= 5 || currentCount >= 5);
    const stampCountToSave = completed ? 0 : nextCount;

    if (!completed) {
      if (current?.id) {
        const { error } = await supabase
          .from("client_stamps")
          .update({ stamp_count: stampCountToSave, updated_at: now })
          .eq("id", current.id);

        if (error) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }
      } else {
        const { error } = await supabase.from("client_stamps").insert({
          client_id: clientId,
          category_id: categoryId,
          stamp_count: stampCountToSave,
          updated_at: now,
        });

        if (error) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }
      }

      await supabase.from("stamp_transactions").insert({
        client_id: clientId,
        profile_id: clientId,
        category_id: categoryId,
        category: categoryName,
        action: direction > 0 ? "add_stamp" : "remove_stamp",
        action_type: direction > 0 ? "add_stamp" : "remove_stamp",
        amount: 1,
        stamp_count: 1,
        stamp_count_before: currentCount,
        stamp_count_after: nextCount,
        staff_id: staffId,
        created_at: now,
      });

      return NextResponse.json({
        ok: true,
        completed: false,
        stamp_count: stampCountToSave,
      });
    }

    const rewardType = rewardTitleFor(categoryName);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // IMPORTANT: create the reward first. If reward insert fails, we do not reset stamps.
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
        expiry_date: expiresAt,
        valid_until: expiresAt,
        source: "loyalty_card",
        source_label: categoryName,
      })
      .select("id")
      .single();

    if (rewardError) {
      return NextResponse.json(
        { ok: false, error: `Reward was not created: ${rewardError.message}` },
        { status: 500 },
      );
    }

    if (current?.id) {
      const { error } = await supabase
        .from("client_stamps")
        .update({ stamp_count: 0, updated_at: now })
        .eq("id", current.id);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase.from("client_stamps").insert({
        client_id: clientId,
        category_id: categoryId,
        stamp_count: 0,
        updated_at: now,
      });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    await supabase.from("stamp_transactions").insert({
      client_id: clientId,
      profile_id: clientId,
      category_id: categoryId,
      category: categoryName,
      action: "reward_earned",
      action_type: "reward_earned",
      amount: 5,
      stamp_count: 5,
      stamp_count_before: currentCount,
      stamp_count_after: 0,
      reward_id: reward?.id ?? null,
      staff_id: staffId,
      note: `${rewardType} created after ${categoryName} card completion`,
      created_at: now,
    });

    return NextResponse.json({
      ok: true,
      completed: true,
      reward_id: reward?.id ?? null,
      reward_type: rewardType,
      stamp_count: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update stamps.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
