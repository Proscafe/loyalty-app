import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BIRTHDAY_REWARDS = ["20% Discount", "Free Dessert"] as const;

type BirthdayProfile = {
  id: string;
  birthday?: string | null;
  birth_date?: string | null;
  date_of_birth?: string | null;
  dob?: string | null;
};

function birthdayValue(profile: BirthdayProfile | null) {
  return (
    profile?.birthday ??
    profile?.birth_date ??
    profile?.date_of_birth ??
    profile?.dob ??
    null
  );
}

function isBirthdayToday(value?: string | null) {
  if (!value) return false;

  const today = new Date();
  const raw = String(value);
  const match = raw.match(/(?:^\d{4}-)?(\d{2})-(\d{2})/);

  if (match) {
    return (
      today.getMonth() + 1 === Number(match[1]) &&
      today.getDate() === Number(match[2])
    );
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return false;

  return (
    today.getMonth() === parsed.getMonth() &&
    today.getDate() === parsed.getDate()
  );
}

function startOfBirthdayYear() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).toISOString();
}

async function findBirthdayCategoryId(admin: ReturnType<typeof createAdminClient>) {
  const { data: categories } = await admin
    .from("loyalty_categories")
    .select("id, name, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = categories ?? [];
  return (
    rows.find((category: any) =>
      String(category.name ?? "").toLowerCase().includes("dessert"),
    ) ??
    rows.find((category: any) =>
      String(category.name ?? "").toLowerCase().includes("hooka"),
    ) ??
    rows[0] ??
    null
  )?.id ?? null;
}

async function ensureBirthdayRewards(profileId: string) {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id,birthday,birth_date,date_of_birth,dob")
    .eq("id", profileId)
    .maybeSingle();

  const birthdayProfile = profile as BirthdayProfile | null;

  if (!birthdayProfile || !isBirthdayToday(birthdayValue(birthdayProfile))) {
    return;
  }

  const categoryId = await findBirthdayCategoryId(admin);
  if (!categoryId) return;

  const { data: existingRows } = await admin
    .from("rewards")
    .select("id,reward_type")
    .eq("client_id", profileId)
    .in("reward_type", [...BIRTHDAY_REWARDS])
    .gte("created_at", startOfBirthdayYear());

  const existingTypes = new Set(
    (existingRows ?? []).map((row: any) => String(row.reward_type ?? "")),
  );

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const missingRows = BIRTHDAY_REWARDS
    .filter((rewardType) => !existingTypes.has(rewardType))
    .map((rewardType) => ({
      client_id: profileId,
      category_id: categoryId,
      reward_type: rewardType,
      reward_name: rewardType,
      title: rewardType,
      description: `Birthday Gift - ${rewardType}`,
      status: "available",
      reward_status: "available",
      earned_at: now.toISOString(),
      expires_at: expiresAt,
      source: "birthday",
      reward_source: "birthday",
      is_birthday: true,
      birthday_reward: true,
      reward_icon: "birthday-cake",
    }));

  if (missingRows.length > 0) {
    const { error } = await admin.from("rewards").insert(missingRows);
    if (error) {
      console.error("Could not create birthday rewards", error);
    }
  }
}

export async function GET() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  try {
    await ensureBirthdayRewards(profile.id);
  } catch (error) {
    // Do not break the dashboard if birthday provisioning fails.
    console.error("Birthday reward provisioning failed", error);
  }

  const { data: rewards, error } = await supabase
    .from("rewards")
    .select("*")
    .eq("client_id", profile.id)
    .in("status", ["available", "claimed", "redeemed", "expired"])
    .order("earned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rewards: rewards ?? [] });
}
