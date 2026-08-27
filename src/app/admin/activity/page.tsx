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

function iso(value?: string | null) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function profileLabel(row?: AnyRow | null) {
  if (!row) return null;
  return row.full_name || row.email || row.client_code || null;
}

function rewardLabel(row: AnyRow) {
  const value = String(row.reward_type ?? "").trim();
  return value || "Gift";
}

function isBirthdayReward(row: AnyRow) {
  const text = [
    row.source,
    row.reward_source,
    row.description,
    row.reward_note,
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

export default async function AdminActivityPage() {
  // One-time-safe repair: creates only missing birthday reward rows

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
      .limit(1000),
    supabase
      .from("rewards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1500),
    supabase
      .from("contact_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const profileRows = profiles ?? [];
  const categoryRows = categories ?? [];
  const profileById = new Map(
    profileRows.map((profile: AnyRow) => [String(profile.id), profile]),
  );
  const categoryById = new Map(
    categoryRows.map((category: AnyRow) => [String(category.id), category]),
  );

  const staffIds = new Set<string>();
  for (const stamp of stamps ?? []) {
    if ((stamp as AnyRow).staff_id) staffIds.add(String((stamp as AnyRow).staff_id));
  }
  for (const reward of rewards ?? []) {
    if ((reward as AnyRow).redeemed_by) {
      staffIds.add(String((reward as AnyRow).redeemed_by));
    }
  }

  let staffById = new Map<string, AnyRow>();
  if (staffIds.size > 0) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name, email, client_code")
      .in("id", Array.from(staffIds));

    staffById = new Map(
      (staff ?? []).map((profile: AnyRow) => [String(profile.id), profile]),
    );
  }

  const activities: AnyRow[] = [];

  for (const stamp of stamps ?? []) {
    const row = stamp as AnyRow;
    const client = profileById.get(String(row.client_id ?? ""));
    const category = categoryById.get(String(row.category_id ?? ""));
    const staff = staffById.get(String(row.staff_id ?? ""));

    activities.push({
      ...row,
      activity_source: "stamp",
      client_name: profileLabel(client) ?? "Client",
      category_name: category?.name ?? null,
      issued_by_name: profileLabel(staff) ?? "Staff user",
    });
  }

  for (const reward of rewards ?? []) {
    const row = reward as AnyRow;
    const client = profileById.get(String(row.client_id ?? ""));
    const birthday = isBirthdayReward(row);
    const clientName = profileLabel(client) ?? "Client";
    const rewardName = rewardLabel(row);

    activities.push({
      ...row,
      id: `${row.id}-issued`,
      activity_source: "reward",
      action_type: birthday ? "birthday_gift_issued" : "gift_issued",
      reward_label: rewardName,
      client_name: clientName,
      issued_by_name: birthday ? "System" : "System",
      is_birthday: birthday,
      birthday_reward: birthday,
      created_at: row.earned_at ?? row.created_at,
    });

    if (row.redeemed_at || String(row.status ?? "").toLowerCase() === "redeemed") {
      activities.push({
        ...row,
        id: `${row.id}-redeemed`,
        activity_source: "reward",
        action_type: "redeemed",
        reward_label: rewardName,
        client_name: clientName,
        issued_by_name:
          profileLabel(staffById.get(String(row.redeemed_by ?? ""))) ?? "Staff user",
        is_birthday: birthday,
        birthday_reward: birthday,
        created_at: row.redeemed_at ?? row.updated_at ?? row.created_at,
      });
    }
  }

  for (const contact of contacts ?? []) {
    const row = contact as AnyRow;
    activities.push({
      ...row,
      activity_source: "contact",
      action_type: "contacted",
      client_id: row.source_id ?? null,
      issued_by_name: "Staff user",
      created_at: row.contacted_at ?? row.created_at,
    });
  }

  activities.sort(
    (a, b) =>
      new Date(iso(b.created_at)).getTime() -
      new Date(iso(a.created_at)).getTime(),
  );

  return (
    <ActivityPageClient
      activities={activities.slice(0, 1500)}
      profiles={profileRows as ProfileRow[]}
      categories={categoryRows as CategoryRow[]}
    />
  );
}
