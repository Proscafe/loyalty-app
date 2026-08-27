import { createAdminClient } from "@/lib/supabase/server";

const BIRTHDAY_REWARDS = ["20% Discount", "Free Dessert"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

type ProfileRow = Record<string, any> & {
  id: string;
};

type RewardRow = Record<string, any> & {
  id: string;
  client_id?: string | null;
  reward_type?: string | null;
  status?: string | null;
  earned_at?: string | null;
  created_at?: string | null;
  redeemed_at?: string | null;
  claimed_at?: string | null;
  expires_at?: string | null;
};

function birthdayValue(profile: ProfileRow) {
  return (
    profile.birthday ??
    profile.birth_date ??
    profile.date_of_birth ??
    profile.dob ??
    null
  );
}

function parseBirthday(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const match = raw.match(/(?:^\d{4}-)?(\d{2})-(\d{2})/);
  if (match) {
    return { month: Number(match[1]), day: Number(match[2]) };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return { month: date.getMonth() + 1, day: date.getDate() };
}

function birthdayOccurrenceWithinLast30Days(value: unknown) {
  const parsed = parseBirthday(value);
  if (!parsed) return null;

  const now = new Date();
  const candidates = [
    new Date(now.getFullYear(), parsed.month - 1, parsed.day, 12, 0, 0, 0),
    new Date(now.getFullYear() - 1, parsed.month - 1, parsed.day, 12, 0, 0, 0),
  ];

  return (
    candidates.find((candidate) => {
      const diff = now.getTime() - candidate.getTime();
      return diff >= 0 && diff < 30 * DAY_MS;
    }) ?? null
  );
}

function dateKey(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function statusPriority(row: RewardRow) {
  const status = String(row.status ?? "").toLowerCase();

  // Keep a redeemed/claimed record over an unused duplicate so history is not lost.
  if (status === "redeemed" || row.redeemed_at) return 0;
  if (status === "claimed" || row.claimed_at) return 1;
  if (status === "available") return 2;
  return 3;
}

function createdTime(row: RewardRow) {
  const date = new Date(row.created_at ?? row.earned_at ?? "");
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function isExplicitGameReward(row: RewardRow) {
  const text = [
    row.source,
    row.reward_source,
    row.description,
    row.reward_note,
    row.source_match_id,
    row.prediction_match_id,
    row.prediction_entry_id,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return Boolean(
    row.source_match_id ||
      row.game_id ||
      row.match_id ||
      row.prediction_match_id ||
      row.prediction_entry_id ||
      text.includes("game_prediction") ||
      text.includes("prediction_match:") ||
      text.includes("winner in")
  );
}

function isBirthdayRewardForOccurrence(
  row: RewardRow,
  birthdayDate: Date,
) {
  if (isExplicitGameReward(row)) return false;

  const rewardType = String(row.reward_type ?? "").trim();
  if (!BIRTHDAY_REWARDS.includes(rewardType as any)) return false;

  const explicitText = [
    row.source,
    row.reward_source,
    row.description,
    row.reward_note,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  const explicitBirthday =
    row.is_birthday === true ||
    row.birthday_reward === true ||
    row.is_birthday_reward === true ||
    row.birthday_id ||
    explicitText.includes("birthday");

  if (explicitBirthday) return true;

  const rewardDay = dateKey(row.earned_at ?? row.created_at);
  return Boolean(rewardDay && rewardDay === dateKey(birthdayDate));
}

async function findBirthdayCategoryId(admin: ReturnType<typeof createAdminClient>) {
  const { data: categories } = await admin
    .from("loyalty_categories")
    .select("id, name, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = categories ?? [];

  return (
    rows.find((row: any) =>
      String(row.name ?? "").toLowerCase().includes("dessert"),
    ) ??
    rows.find((row: any) =>
      String(row.name ?? "").toLowerCase().includes("hooka"),
    ) ??
    rows[0] ??
    null
  )?.id ?? null;
}

async function dedupeRecentBirthdayRewards(
  admin: ReturnType<typeof createAdminClient>,
  candidates: Array<{ profile: ProfileRow; birthdayDate: Date }>,
  rewards: RewardRow[],
) {
  const duplicateIds: string[] = [];

  for (const { profile, birthdayDate } of candidates) {
    for (const rewardType of BIRTHDAY_REWARDS) {
      const matches = rewards
        .filter(
          (row) =>
            String(row.client_id ?? "") === String(profile.id) &&
            String(row.reward_type ?? "") === rewardType &&
            isBirthdayRewardForOccurrence(row, birthdayDate),
        )
        .sort((a, b) => {
          const statusDiff = statusPriority(a) - statusPriority(b);
          if (statusDiff !== 0) return statusDiff;
          return createdTime(a) - createdTime(b);
        });

      // Keep exactly one. Delete only extra birthday duplicates.
      duplicateIds.push(...matches.slice(1).map((row) => String(row.id)));
    }
  }

  const ids = Array.from(new Set(duplicateIds.filter(Boolean)));

  if (ids.length === 0) return 0;

  const { error } = await admin.from("rewards").delete().in("id", ids);

  if (error) {
    console.error(
      "Birthday duplicate cleanup failed",
      error.message || error,
    );
    return 0;
  }

  return ids.length;
}

export async function repairRecentBirthdayRewards() {
  const admin = createAdminClient();

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("*")
    .limit(3000);

  if (profilesError) {
    console.error(
      "Birthday repair profiles error",
      profilesError.message || profilesError,
    );
    return { inserted: 0, deletedDuplicates: 0 };
  }

  const candidates = (profiles ?? [])
    .map((profile: ProfileRow) => ({
      profile,
      birthdayDate: birthdayOccurrenceWithinLast30Days(birthdayValue(profile)),
    }))
    .filter(
      (item): item is { profile: ProfileRow; birthdayDate: Date } =>
        Boolean(item.birthdayDate),
    );

  if (candidates.length === 0) {
    return { inserted: 0, deletedDuplicates: 0 };
  }

  const clientIds = candidates.map((item) => item.profile.id);
  const earliestBirthday = new Date(
    Math.min(...candidates.map((item) => item.birthdayDate.getTime())),
  ).toISOString();

  const { data: rewardData, error: existingError } = await admin
    .from("rewards")
    .select("*")
    .in("client_id", clientIds)
    .gte("created_at", earliestBirthday);

  if (existingError) {
    console.error(
      "Birthday repair existing rewards error",
      existingError.message || existingError,
    );
    return { inserted: 0, deletedDuplicates: 0 };
  }

  let rewards = (rewardData ?? []) as RewardRow[];

  // First remove duplicates already created by the previous repair version.
  const deletedDuplicates = await dedupeRecentBirthdayRewards(
    admin,
    candidates,
    rewards,
  );

  if (deletedDuplicates > 0) {
    const { data: refreshedRewards } = await admin
      .from("rewards")
      .select("*")
      .in("client_id", clientIds)
      .gte("created_at", earliestBirthday);

    rewards = (refreshedRewards ?? []) as RewardRow[];
  }

  const categoryId = await findBirthdayCategoryId(admin);
  if (!categoryId) {
    return { inserted: 0, deletedDuplicates };
  }

  const rowsToInsert: Record<string, any>[] = [];

  for (const { profile, birthdayDate } of candidates) {
    for (const rewardType of BIRTHDAY_REWARDS) {
      const alreadyExists = rewards.some(
        (row) =>
          String(row.client_id ?? "") === String(profile.id) &&
          String(row.reward_type ?? "") === rewardType &&
          isBirthdayRewardForOccurrence(row, birthdayDate),
      );

      if (alreadyExists) continue;

      const earnedAt = birthdayDate.toISOString();
      const expiresAt = new Date(
        birthdayDate.getTime() + 30 * DAY_MS,
      ).toISOString();

      rowsToInsert.push({
        client_id: profile.id,
        category_id: categoryId,
        reward_type: rewardType,
        description: `Birthday Gift - ${rewardType}`,
        status: "available",
        earned_at: earnedAt,
        expires_at: expiresAt,
        source: "birthday",
      });
    }
  }

  if (rowsToInsert.length === 0) {
    return { inserted: 0, deletedDuplicates };
  }

  // Insert only the core fields that exist in the current production schema.
  const { data: insertedRows, error: insertError } = await admin
    .from("rewards")
    .insert(rowsToInsert)
    .select("id");

  if (insertError) {
    console.error(
      "Birthday repair insert failed",
      insertError.message || insertError,
    );
    return { inserted: 0, deletedDuplicates };
  }

  // A concurrent render can still race. Run one final dedupe so the
  // database converges back to exactly one birthday reward per type.
  const { data: finalRewardData } = await admin
    .from("rewards")
    .select("*")
    .in("client_id", clientIds)
    .gte("created_at", earliestBirthday);

  const finalDeleted = await dedupeRecentBirthdayRewards(
    admin,
    candidates,
    (finalRewardData ?? []) as RewardRow[],
  );

  return {
    inserted: insertedRows?.length ?? 0,
    deletedDuplicates: deletedDuplicates + finalDeleted,
  };
}
