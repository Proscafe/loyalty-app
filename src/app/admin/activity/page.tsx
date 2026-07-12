import ActivityPageClient from "./ActivityPageClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;
type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  client_code?: string | null;
  role?: string | null;
  created_at?: string | null;
};
type CategoryRow = { id: string; name?: string | null };

function iso(value?: string | null) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function rewardLabel(row: AnyRow) {
  const type = String(row.reward_type ?? "").trim();
  if (type) return type.toLowerCase().startsWith("free") ? type : `Free ${type}`;
  return "Gift";
}

function profileLabel(row?: AnyRow | null) {
  if (!row) return null;
  return row.full_name || row.email || row.client_code || null;
}

function cleanLabel(value?: string | null) {
  return String(value ?? "").trim();
}

function activityText(name: string, action: string, item?: string | null) {
  const cleanName = cleanLabel(name) || "Client";
  const cleanItem = cleanLabel(item);
  return cleanItem ? `${cleanName} ${action} ${cleanItem}` : `${cleanName} ${action}`;
}

export default async function AdminActivityPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: categories }, { data: stamps }, { data: rewards }, { data: contacts }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, client_code, role, created_at").limit(2000),
    supabase.from("loyalty_categories").select("id, name").limit(500),
    supabase
      .from("stamp_transactions")
      .select("id, client_id, category_id, staff_id, reward_id, action_type, stamp_count_before, stamp_count_after, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("rewards")
      .select("id, client_id, category_id, reward_type, status, earned_at, redeemed_at, claimed_at, expires_at, bounced_at, redeemed_by, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("contact_history")
      .select("id, contact_key, contacted_at, source, source_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const profileRows = profiles ?? [];
  const categoryRows = categories ?? [];
  const profileById = new Map(profileRows.map((profile: AnyRow) => [String(profile.id), profile]));
  const categoryById = new Map(categoryRows.map((category: AnyRow) => [String(category.id), category]));
  const profileByContact = new Map<string, AnyRow>();

  for (const profile of profileRows as AnyRow[]) {
    for (const value of [profile.client_code, profile.email, profile.phone]) {
      const key = String(value ?? "").trim().toLowerCase();
      if (key) profileByContact.set(key, profile);
    }
  }

  const staffIds = new Set<string>();
  for (const stamp of stamps ?? []) {
    const row = stamp as AnyRow;
    if (row.staff_id) staffIds.add(String(row.staff_id));
  }
  for (const reward of rewards ?? []) {
    const row = reward as AnyRow;
    if (row.redeemed_by) staffIds.add(String(row.redeemed_by));
  }

  let staffById = new Map<string, AnyRow>();
  if (staffIds.size > 0) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name, email, client_code")
      .in("id", Array.from(staffIds));
    staffById = new Map((staff ?? []).map((profile: AnyRow) => [String(profile.id), profile]));
  }

  const stampByRewardId = new Map<string, AnyRow>();
  for (const stamp of stamps ?? []) {
    const row = stamp as AnyRow;
    const rewardId = String(row.reward_id ?? "").trim();
    if (rewardId && !stampByRewardId.has(rewardId)) stampByRewardId.set(rewardId, row);
  }

  const rewardById = new Map<string, AnyRow>();
  for (const reward of rewards ?? []) {
    const row = reward as AnyRow;
    rewardById.set(String(row.id), row);
  }

  const activities: AnyRow[] = [];

  // New customers appear in the same activity feed.
  for (const profile of profileRows as AnyRow[]) {
    const role = String(profile.role ?? "").toLowerCase();
    if (role.includes("admin") || role.includes("staff")) continue;
    if (!profile.created_at) continue;

    const clientName = profileLabel(profile) ?? "New member";
    activities.push({
      id: `${profile.id}-joined`,
      activity_source: "profile",
      action_type: "joined",
      client_id: profile.id,
      client_name: clientName,
      issued_by_name: "System",
      activity_text: activityText(clientName, "joined Pro’s Club"),
      created_at: profile.created_at,
    });
  }

  for (const stamp of stamps ?? []) {
    const row = stamp as AnyRow;
    const before = Number(row.stamp_count_before ?? 0);
    const after = Number(row.stamp_count_after ?? before + 1);
    const rawDelta = after - before;
    const delta = Math.max(1, Math.abs(rawDelta || 1));
    const client = profileById.get(String(row.client_id ?? ""));
    const staff = staffById.get(String(row.staff_id ?? ""));
    const category = categoryById.get(String(row.category_id ?? ""));

    const linkedReward = rewardById.get(String(row.reward_id ?? ""));

    // A reward-producing fifth stamp is represented by one clean “unlocked”
    // activity below, instead of three separate stamp/reward rows.
    if (linkedReward && rawDelta >= 0) continue;

    const clientName = profileLabel(client) ?? "Client";
    const categoryName = category?.name ?? "loyalty";
    const stampWord = delta === 1 ? "stamp" : "stamps";
    const direction = rawDelta < 0 ? "redeemed" : "earned";

    activities.push({
      ...row,
      activity_source: "stamp",
      stamp_delta: delta,
      stamp_direction: direction,
      category_name: category?.name ?? null,
      client_name: clientName,
      issued_by_name: profileLabel(staff) ?? "Staff user",
      activity_text: activityText(
        clientName,
        `${direction} ${delta} ${categoryName} ${stampWord}`,
      ),
      created_at: row.created_at,
    });
  }

  for (const reward of rewards ?? []) {
    const row = reward as AnyRow;
    const client = profileById.get(String(row.client_id ?? ""));
    const redeemedStaff = staffById.get(String(row.redeemed_by ?? ""));
    const creatorStamp = stampByRewardId.get(String(row.id ?? ""));
    const creatorStaff = creatorStamp ? staffById.get(String(creatorStamp.staff_id ?? "")) : null;
    const category = categoryById.get(String(row.category_id ?? creatorStamp?.category_id ?? ""));
    const rewardName = rewardLabel(row);
    const staffName = profileLabel(redeemedStaff) ?? profileLabel(creatorStaff) ?? "System";

    const clientName = profileLabel(client) ?? "Client";
    const earnedAt = row.earned_at ?? row.created_at;
    const redeemedAt = row.redeemed_at ?? row.claimed_at ?? null;
    const earnedTime = earnedAt ? new Date(earnedAt).getTime() : 0;
    const redeemedTime = redeemedAt ? new Date(redeemedAt).getTime() : 0;
    const immediateRedemption =
      earnedTime > 0 && redeemedTime > 0 && Math.abs(redeemedTime - earnedTime) <= 120000;

    activities.push({
      ...row,
      id: `${row.id}-earned`,
      activity_source: "reward",
      reward_label: rewardName,
      category_name: category?.name ?? null,
      action_type: "unlocked",
      client_name: clientName,
      issued_by_name: profileLabel(creatorStaff) ?? "System",
      activity_text: activityText(clientName, "unlocked a", rewardName),
      created_at: earnedAt,
    });

    if (!immediateRedemption && (row.redeemed_at || row.claimed_at || String(row.status ?? "").toLowerCase() === "redeemed")) {
      activities.push({
        ...row,
        id: `${row.id}-redeemed`,
        activity_source: "reward",
        reward_label: rewardName,
        category_name: category?.name ?? null,
        action_type: "redeemed",
        client_name: clientName,
        issued_by_name: staffName,
        activity_text: activityText(clientName, "redeemed a", rewardName),
        created_at: row.redeemed_at ?? row.claimed_at ?? row.updated_at ?? row.created_at,
      });
    }

    if (String(row.status ?? "").toLowerCase() === "expired") {
      activities.push({
        ...row,
        id: `${row.id}-expired`,
        activity_source: "reward",
        reward_label: rewardName,
        category_name: category?.name ?? null,
        action_type: "expired",
        expired_activity: true,
        client_name: profileLabel(client) ?? "Client",
        issued_by_name: "System",
        created_at: row.expires_at ?? row.updated_at ?? row.created_at,
      });
    }
  }

  for (const contact of contacts ?? []) {
    const row = contact as AnyRow;
    const contactKey = String(row.contact_key ?? "").trim().toLowerCase();
    const sourceId = String(row.source_id ?? "").trim();
    const client = profileByContact.get(contactKey) ?? profileById.get(sourceId);
    activities.push({
      ...row,
      activity_source: "contact",
      action_type: "contacted",
      client_id: client?.id ?? null,
      client_name: profileLabel(client) ?? row.contact_key ?? "Client",
      issued_by_name: "Staff user",
      activity_text: activityText(profileLabel(client) ?? row.contact_key ?? "Client", "was contacted"),
      created_at: row.contacted_at ?? row.created_at,
    });
  }

  activities.sort((a, b) => new Date(iso(b.created_at)).getTime() - new Date(iso(a.created_at)).getTime());

  return (
    <ActivityPageClient
      activities={activities.slice(0, 500)}
      profiles={profileRows as ProfileRow[]}
      categories={categoryRows as CategoryRow[]}
    />
  );
}
