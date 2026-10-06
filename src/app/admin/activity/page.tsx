import ActivityPageClient from "./ActivityPageClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;
type ProfileRow = AnyRow & {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  client_code?: string | null;
  role?: string | null;
  created_at?: string | null;
};
type CategoryRow = { id: string; name?: string | null };

function safeDate(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function profileLabel(row?: AnyRow | null) {
  if (!row) return null;
  return row.full_name || row.email || row.client_code || null;
}

function clientIdFromRow(row: AnyRow) {
  return String(
    row.client_id ??
      row.profile_id ??
      row.customer_id ??
      row.user_id ??
      row.source_id ??
      "",
  ).trim();
}

function rewardLabel(row: AnyRow) {
  return String(
    row.reward_label ??
      row.reward_name ??
      row.title ??
      row.reward_type ??
      row.gift_type ??
      "Gift",
  ).trim();
}

function isBirthdayReward(row: AnyRow) {
  const text = [
    row.source,
    row.reward_source,
    row.description,
    row.reward_note,
    row.action_type,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return Boolean(
    row.is_birthday === true ||
      row.birthday_reward === true ||
      row.is_birthday_reward === true ||
      row.birthday_id ||
      text.includes("birthday")
  );
}

function isSystemReward(row: AnyRow) {
  const text = [
    row.source,
    row.reward_source,
    row.description,
    row.reward_note,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return (
    isBirthdayReward(row) ||
    text.includes("game_prediction") ||
    text.includes("prediction_match:") ||
    text.includes("winner in") ||
    Boolean(
      row.source_match_id ||
        row.game_id ||
        row.match_id ||
        row.prediction_match_id ||
        row.prediction_entry_id,
    )
  );
}

function stampDelta(row: AnyRow) {
  const before = Number(row.stamp_count_before);
  const after = Number(row.stamp_count_after);

  if (Number.isFinite(before) && Number.isFinite(after)) {
    return after - before;
  }

  const explicit = Number(row.stamp_delta ?? row.quantity);
  if (Number.isFinite(explicit) && explicit !== 0) return explicit;

  const action = String(row.action_type ?? "").toLowerCase();
  if (/remove|deduct|redeem|spent/.test(action)) return -1;

  return 1;
}

export default async function AdminActivityPage() {
  const supabase = await createClient();

  const [
    { data: profiles },
    { data: categories },
    { data: stamps },
    { data: rewards },
    { data: contacts },
  ] = await Promise.all([
    supabase.from("profiles").select("*").limit(3000),
    supabase.from("loyalty_categories").select("id, name").limit(500),
    supabase
      .from("stamp_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1500),
    supabase
      .from("rewards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("contact_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  let profileRows = profiles ?? [];
  const categoryRows = categories ?? [];

  const referencedProfileIds = new Set<string>();

  for (const rawStamp of stamps ?? []) {
    const row = rawStamp as AnyRow;
    const clientId = clientIdFromRow(row);
    if (clientId) referencedProfileIds.add(clientId);

    for (const value of [row.staff_id, row.created_by]) {
      const id = String(value ?? "").trim();
      if (id) referencedProfileIds.add(id);
    }
  }

  for (const rawReward of rewards ?? []) {
    const row = rawReward as AnyRow;
    const clientId = clientIdFromRow(row);
    if (clientId) referencedProfileIds.add(clientId);

    for (const value of [
      row.redeemed_by,
      row.staff_id,
      row.issued_by,
      row.created_by,
      row.issuer_id,
    ]) {
      const id = String(value ?? "").trim();
      if (id) referencedProfileIds.add(id);
    }
  }

  for (const rawContact of contacts ?? []) {
    const row = rawContact as AnyRow;
    const clientId = clientIdFromRow(row);
    if (clientId) referencedProfileIds.add(clientId);

    const contactedBy = String(row.contacted_by ?? "").trim();
    if (contactedBy) referencedProfileIds.add(contactedBy);
  }

  if (referencedProfileIds.size > 0) {
    const { data: referencedProfiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", Array.from(referencedProfileIds));

    const merged = new Map<string, AnyRow>();

    for (const profile of profileRows as AnyRow[]) {
      merged.set(String(profile.id), profile);
    }

    for (const profile of referencedProfiles ?? []) {
      merged.set(String((profile as AnyRow).id), profile as AnyRow);
    }

    profileRows = Array.from(merged.values());
  }

  const profileById = new Map(
    profileRows.map((profile: AnyRow) => [String(profile.id), profile]),
  );

  const categoryById = new Map(
    categoryRows.map((category: AnyRow) => [String(category.id), category]),
  );

  const staffIds = new Set<string>();

  for (const rawStamp of stamps ?? []) {
    const row = rawStamp as AnyRow;
    if (row.staff_id) staffIds.add(String(row.staff_id));
    if (row.created_by) staffIds.add(String(row.created_by));
  }

  for (const rawReward of rewards ?? []) {
    const row = rawReward as AnyRow;
    for (const value of [
      row.redeemed_by,
      row.staff_id,
      row.issued_by,
      row.created_by,
      row.issuer_id,
    ]) {
      if (value) staffIds.add(String(value));
    }
  }

  for (const rawContact of contacts ?? []) {
    const row = rawContact as AnyRow;
    if (row.contacted_by) staffIds.add(String(row.contacted_by));
  }

  const staffById = new Map<string, AnyRow>();

  for (const staffId of staffIds) {
    const profile = profileById.get(staffId);
    if (profile) staffById.set(staffId, profile);
  }

  const stampByRewardId = new Map<string, AnyRow>();

  for (const rawStamp of stamps ?? []) {
    const row = rawStamp as AnyRow;
    const rewardId = String(row.reward_id ?? "").trim();
    if (!rewardId) continue;

    const existing = stampByRewardId.get(rewardId);
    if (!existing) {
      stampByRewardId.set(rewardId, row);
      continue;
    }

    const currentTime = safeDate(row.created_at)?.getTime() ?? 0;
    const existingTime = safeDate(existing.created_at)?.getTime() ?? 0;

    if (currentTime > existingTime) stampByRewardId.set(rewardId, row);
  }

  const activities: AnyRow[] = [];

  const rewardEarnEvents = (rewards ?? [])
    .map((rawReward) => {
      const reward = rawReward as AnyRow;
      const earnedAt = safeDate(reward.earned_at ?? reward.created_at);
      if (!earnedAt) return null;

      return {
        clientId: clientIdFromRow(reward),
        categoryId: String(reward.category_id ?? ""),
        time: earnedAt.getTime(),
        rewardId: String(reward.id ?? ""),
      };
    })
    .filter(
      (
        item,
      ): item is {
        clientId: string;
        categoryId: string;
        time: number;
        rewardId: string;
      } => Boolean(item),
    );

  function stampBelongsToReward(row: AnyRow) {
    const rewardId = String(row.reward_id ?? "").trim();

    if (rewardId && rewardEarnEvents.some((event) => event.rewardId === rewardId)) {
      return true;
    }

    const clientId = clientIdFromRow(row);
    const categoryId = String(row.category_id ?? "");
    const stampTime = safeDate(row.created_at)?.getTime();

    if (!clientId || !categoryId || !stampTime) return false;

    // When earning a loyalty reward creates multiple stamp log rows at the
    // same moment, hide those stamp rows and show only the resulting gift.
    return rewardEarnEvents.some(
      (event) =>
        event.clientId === clientId &&
        event.categoryId === categoryId &&
        Math.abs(event.time - stampTime) <= 120000,
    );
  }

  function nearestStaffForReward(row: AnyRow) {
    const clientId = clientIdFromRow(row);
    const redemptionTime = safeDate(
      row.redeemed_at ?? row.updated_at ?? row.claimed_at,
    )?.getTime();

    if (!clientId || !redemptionTime) return null;

    let bestStaff: AnyRow | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const rawStamp of stamps ?? []) {
      const stamp = rawStamp as AnyRow;

      if (clientIdFromRow(stamp) !== clientId) continue;

      const stampTime = safeDate(stamp.created_at)?.getTime();
      if (!stampTime) continue;

      const distance = Math.abs(stampTime - redemptionTime);

      // Only infer from a stamp action essentially happening at the same time.
      if (distance > 120000 || distance >= bestDistance) continue;

      const staff =
        staffById.get(String(stamp.staff_id ?? "")) ??
        staffById.get(String(stamp.created_by ?? ""));

      if (!staff) continue;

      bestStaff = staff;
      bestDistance = distance;
    }

    return bestStaff;
  }

  for (const rawStamp of stamps ?? []) {
    const row = rawStamp as AnyRow;
    const delta = stampDelta(row);

    if (delta === 0) continue;
    if (stampBelongsToReward(row)) continue;

    const client = profileById.get(clientIdFromRow(row));
    const category = categoryById.get(String(row.category_id ?? ""));
    const staff =
      staffById.get(String(row.staff_id ?? "")) ??
      staffById.get(String(row.created_by ?? ""));

    activities.push({
      ...row,
      activity_source: "stamp",
      stamp_delta: Math.abs(delta),
      stamp_direction: delta < 0 ? "redeemed" : "earned",
      client_name: profileLabel(client) ?? "Client",
      category_name: category?.name ?? null,
      issued_by_name:
        profileLabel(staff) ||
        String(
          row.staff_name ??
            row.issued_by_name ??
            row.created_by_name ??
            "System",
        ).trim(),
      created_at: row.created_at,
    });
  }

  for (const rawReward of rewards ?? []) {
    const row = rawReward as AnyRow;
    const client = profileById.get(clientIdFromRow(row));
    const birthday = isBirthdayReward(row);
    const systemReward = isSystemReward(row);
    const clientName = profileLabel(client) ?? "Client";
    const rewardName = rewardLabel(row);

    const linkedStamp = stampByRewardId.get(String(row.id ?? ""));
    const linkedStaff = linkedStamp
      ? staffById.get(
          String(linkedStamp.staff_id ?? linkedStamp.created_by ?? ""),
        )
      : null;

    const directStaff =
      staffById.get(
        String(
          row.staff_id ??
            row.issued_by ??
            row.created_by ??
            row.issuer_id ??
            "",
        ),
      ) ?? null;

    const issuerName = systemReward
      ? "System"
      : profileLabel(directStaff) ||
        profileLabel(linkedStaff) ||
        String(
          row.issued_by_name ??
            row.staff_name ??
            row.issuer_name ??
            "System",
        ).trim();

    activities.push({
      ...row,
      id: `${row.id}-issued`,
      activity_source: "reward",
      action_type: birthday ? "birthday_gift_issued" : "gift_issued",
      reward_label: rewardName,
      client_name: clientName,
      issued_by_name: issuerName || "System",
      is_birthday: birthday,
      birthday_reward: birthday,
      created_at: row.earned_at ?? row.created_at,
    });

    const isRedeemed =
      Boolean(row.redeemed_at) ||
      String(row.status ?? row.reward_status ?? "").toLowerCase() ===
        "redeemed";

    if (isRedeemed) {
      const redeemedStaff = staffById.get(String(row.redeemed_by ?? ""));
      const nearbyStaff = nearestStaffForReward(row);

      activities.push({
        ...row,
        id: `${row.id}-redeemed`,
        activity_source: "reward",
        action_type: "redeemed",
        reward_label: rewardName,
        client_name: clientName,
        issued_by_name:
          profileLabel(redeemedStaff) ||
          profileLabel(nearbyStaff) ||
          profileLabel(linkedStaff) ||
          profileLabel(directStaff) ||
          String(
            row.redeemed_by_name ??
              row.staff_name ??
              row.issued_by_name ??
              "Unknown staff",
          ).trim(),
        is_birthday: birthday,
        birthday_reward: birthday,
        created_at:
          row.redeemed_at ??
          row.updated_at ??
          row.claimed_at ??
          row.created_at,
      });
    }
  }

  for (const rawContact of contacts ?? []) {
    const row = rawContact as AnyRow;
    const clientId = clientIdFromRow(row);
    const client = profileById.get(clientId) ?? null;
    const contactedById = String(row.contacted_by ?? "").trim();
    const contactedBy =
      (contactedById ? staffById.get(contactedById) : null) ?? null;

    activities.push({
      ...row,
      activity_source: "contact",
      action_type: "contacted",
      client_id: clientId || null,
      client_name:
        profileLabel(client) ??
        String(row.client_name ?? row.contact_key ?? "Client"),
      issued_by_name:
        profileLabel(contactedBy) ||
        String(
          row.contacted_by_name ??
            row.staff_name ??
            row.issued_by_name ??
            "System",
        ).trim(),
      created_at: row.contacted_at ?? row.created_at,
    });
  }

  activities.sort((a, b) => {
    const aTime = safeDate(a.created_at)?.getTime() ?? 0;
    const bTime = safeDate(b.created_at)?.getTime() ?? 0;
    return bTime - aTime;
  });

  return (
    <ActivityPageClient
      activities={activities.slice(0, 2000)}
      profiles={profileRows as ProfileRow[]}
      categories={categoryRows as CategoryRow[]}
    />
  );
}
