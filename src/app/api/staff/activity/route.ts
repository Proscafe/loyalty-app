import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function profileLabel(row?: AnyRow | null) {
  if (!row) return null;

  return (
    String(
      row.full_name ??
        row.email ??
        row.client_code ??
        "",
    ).trim() || null
  );
}

function rewardLabel(row: AnyRow) {
  const type = String(row.reward_type ?? "").trim();

  if (!type) return "Gift";

  return type.toLowerCase().startsWith("free")
    ? type
    : `Free ${type}`;
}

function isBirthdayReward(row: AnyRow) {
  const text = [
    row.reward_type,
    row.reward_source,
    row.source,
    row.description,
    row.reward_note,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return (
    row.is_birthday_reward === true ||
    text.includes("birthday") ||
    String(row.reward_type ?? "").trim() === "20% Discount"
  );
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError("Please sign in first.", 401);
    }

    const admin = createAdminClient();

    const { data: viewer, error: viewerError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (viewerError || !viewer) {
      return jsonError("Profile not found.", 403);
    }

    if (
      !["staff", "supervisor", "master_admin"].includes(
        String(viewer.role),
      )
    ) {
      return jsonError("Staff access required.", 403);
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);
    cutoff.setHours(0, 0, 0, 0);
    const cutoffIso = cutoff.toISOString();

    const [
      { data: profiles, error: profilesError },
      { data: categories, error: categoriesError },
      { data: stamps, error: stampsError },
      { data: rewards, error: rewardsError },
    ] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "id, full_name, email, client_code, role, created_at",
        )
        .limit(2500),

      admin
        .from("loyalty_categories")
        .select("id, name")
        .limit(500),

      admin
        .from("stamp_transactions")
        .select(
          "id, client_id, category_id, staff_id, reward_id, action_type, stamp_count_before, stamp_count_after, notes, created_at",
        )
        .gte("created_at", cutoffIso)
        .order("created_at", { ascending: false })
        .limit(1000),

      admin
        .from("rewards")
        .select(
          "id, client_id, category_id, reward_type, status, earned_at, redeemed_at, claimed_at, expires_at, bounced_at, redeemed_by, created_at, updated_at",
        )
        .or(
          `earned_at.gte.${cutoffIso},redeemed_at.gte.${cutoffIso},claimed_at.gte.${cutoffIso},created_at.gte.${cutoffIso},updated_at.gte.${cutoffIso}`,
        )
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    if (profilesError) {
      return jsonError(profilesError.message, 500);
    }

    if (categoriesError) {
      return jsonError(categoriesError.message, 500);
    }

    if (stampsError) {
      return jsonError(stampsError.message, 500);
    }

    if (rewardsError) {
      return jsonError(rewardsError.message, 500);
    }

    const profileRows = (profiles ?? []) as AnyRow[];
    const categoryRows = (categories ?? []) as AnyRow[];
    const stampRows = (stamps ?? []) as AnyRow[];
    const rewardRows = (rewards ?? []) as AnyRow[];

    const profileById = new Map(
      profileRows.map((row) => [String(row.id), row]),
    );

    const categoryById = new Map(
      categoryRows.map((row) => [String(row.id), row]),
    );

    const stampByRewardId = new Map<string, AnyRow>();

    for (const stamp of stampRows) {
      const rewardId = String(stamp.reward_id ?? "").trim();

      if (rewardId && !stampByRewardId.has(rewardId)) {
        stampByRewardId.set(rewardId, stamp);
      }
    }

    const rewardById = new Map(
      rewardRows.map((row) => [String(row.id), row]),
    );

    const activities: AnyRow[] = [];

    // New client registrations, matching the main Activity feed.
    for (const profile of profileRows) {
      const role = String(profile.role ?? "").toLowerCase();

      if (
        role.includes("admin") ||
        role.includes("staff") ||
        role.includes("supervisor")
      ) {
        continue;
      }

      if (
        !profile.created_at ||
        new Date(profile.created_at).getTime() <
          new Date(cutoffIso).getTime()
      ) {
        continue;
      }

      activities.push({
        id: `${profile.id}-joined`,
        activity_source: "profile",
        action_type: "joined",
        client_id: String(profile.id),
        client_name: profileLabel(profile) ?? "New member",
        staff_name: "System",
        created_at: profile.created_at,
      });
    }

    // Stamp activity for every customer, including the staff member who stamped.
    for (const row of stampRows) {
      const before = Number(row.stamp_count_before ?? 0);
      const after = Number(row.stamp_count_after ?? before + 1);
      const rawDelta = after - before;
      const delta = Math.max(1, Math.abs(rawDelta || 1));

      const linkedReward = rewardById.get(
        String(row.reward_id ?? ""),
      );

      // Same behavior as admin Activity: reward-producing stamp is represented
      // by the reward event instead of a duplicate fifth-stamp row.
      if (linkedReward && rawDelta >= 0) {
        continue;
      }

      const client = profileById.get(
        String(row.client_id ?? ""),
      );

      const staff = profileById.get(
        String(row.staff_id ?? ""),
      );

      const category = categoryById.get(
        String(row.category_id ?? ""),
      );

      activities.push({
        id: `stamp-${row.id}`,
        activity_source: "stamp",
        action_type:
          rawDelta < 0 ? "redeemed_stamp" : "earned_stamp",
        client_id: String(row.client_id ?? ""),
        client_name: profileLabel(client) ?? "Client",
        category_name:
          String(category?.name ?? "Loyalty"),
        stamp_delta: delta,
        staff_name: profileLabel(staff) ?? "Staff user",
        created_at: row.created_at,
      });
    }

    // Gift / birthday / redemption / expiry activity.
    for (const row of rewardRows) {
      const client = profileById.get(
        String(row.client_id ?? ""),
      );

      const creatorStamp = stampByRewardId.get(
        String(row.id ?? ""),
      );

      const creatorStaff = creatorStamp
        ? profileById.get(
            String(creatorStamp.staff_id ?? ""),
          )
        : null;

      const redeemedStaff = profileById.get(
        String(row.redeemed_by ?? ""),
      );

      const category = categoryById.get(
        String(
          row.category_id ??
            creatorStamp?.category_id ??
            "",
        ),
      );

      const label = rewardLabel(row);
      const birthday = isBirthdayReward(row);

      const earnedAt = row.earned_at ?? row.created_at;

      if (
        earnedAt &&
        new Date(earnedAt).getTime() >=
          new Date(cutoffIso).getTime()
      ) {
        activities.push({
          id: `${row.id}-earned`,
          activity_source: "reward",
          action_type: "received",
          client_id: String(row.client_id ?? ""),
          client_name: profileLabel(client) ?? "Client",
          category_name: category?.name ?? null,
          reward_label: label,
          birthday,
          staff_name:
            profileLabel(creatorStaff) ??
            (birthday ? "System" : "System"),
          created_at: earnedAt,
        });
      }

      const redeemedAt =
        row.redeemed_at ??
        row.claimed_at ??
        (String(row.status ?? "").toLowerCase() ===
        "redeemed"
          ? row.updated_at ?? row.created_at
          : null);

      if (
        redeemedAt &&
        new Date(redeemedAt).getTime() >=
          new Date(cutoffIso).getTime()
      ) {
        activities.push({
          id: `${row.id}-redeemed`,
          activity_source: "reward",
          action_type: "redeemed",
          client_id: String(row.client_id ?? ""),
          client_name: profileLabel(client) ?? "Client",
          category_name: category?.name ?? null,
          reward_label: label,
          birthday,
          staff_name:
            profileLabel(redeemedStaff) ??
            profileLabel(creatorStaff) ??
            "Staff user",
          created_at: redeemedAt,
        });
      }

      if (
        String(row.status ?? "").toLowerCase() ===
          "expired" &&
        row.expires_at &&
        new Date(row.expires_at).getTime() >=
          new Date(cutoffIso).getTime()
      ) {
        activities.push({
          id: `${row.id}-expired`,
          activity_source: "reward",
          action_type: "expired",
          client_id: String(row.client_id ?? ""),
          client_name: profileLabel(client) ?? "Client",
          category_name: category?.name ?? null,
          reward_label: label,
          birthday,
          staff_name: "System",
          created_at: row.expires_at,
        });
      }
    }

    activities.sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    );

    return NextResponse.json({
      rows: activities.slice(0, 700),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Could not load activity.",
      500,
    );
  }
}
