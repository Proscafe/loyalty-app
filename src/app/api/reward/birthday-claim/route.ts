import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BIRTHDAY_REWARDS = ["20% Discount", "Free Dessert"] as const;

type BirthdayRewardType = (typeof BIRTHDAY_REWARDS)[number];

type BirthdayCategory = {
  id: string;
  name: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type BirthdayProfile = {
  id: string;
  birthday: string | null;
};

function isBirthdayToday(birthday?: string | null) {
  if (!birthday) return false;

  const today = new Date();
  const raw = String(birthday);

  const monthDayMatch = raw.match(/(?:^\d{4}-)?(\d{2})-(\d{2})/);
  if (monthDayMatch) {
    const month = Number(monthDayMatch[1]);
    const day = Number(monthDayMatch[2]);

    return today.getMonth() + 1 === month && today.getDate() === day;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return false;

  return today.getMonth() === parsed.getMonth() && today.getDate() === parsed.getDate();
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

async function findBirthdayCategoryId(db: any) {
  const { data: categories } = await db
    .from("loyalty_categories")
    .select("id, name, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = (categories ?? []) as BirthdayCategory[];

  const birthdayCategory =
    rows.find((category) =>
      String(category.name ?? "").toLowerCase().includes("dessert"),
    ) ??
    rows.find((category) =>
      String(category.name ?? "").toLowerCase().includes("hooka"),
    ) ??
    rows[0];

  return birthdayCategory?.id ?? null;
}

export async function POST(req: Request) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { reward_type?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rewardType = String(body.reward_type ?? "") as BirthdayRewardType;

  if (!BIRTHDAY_REWARDS.includes(rewardType)) {
    return NextResponse.json({ error: "invalid_birthday_reward" }, { status: 400 });
  }

  const admin = getAdminClient();
  const db = admin ?? supabase;

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, birthday")
    .eq("id", user.id)
    .single();

  const birthdayProfile = profile as BirthdayProfile | null;

  if (profileError || !birthdayProfile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  if (!isBirthdayToday(birthdayProfile.birthday)) {
    return NextResponse.json({ error: "birthday_not_today" }, { status: 403 });
  }

  const todayStart = startOfTodayIso();

  const { data: existing } = await db
    .from("rewards")
    .select("*")
    .eq("client_id", user.id)
    .eq("reward_type", rewardType)
    .gte("created_at", todayStart)
    .maybeSingle();

  if (existing) {
    if (existing.status !== "claimed") {
      const { data: updated, error: updateError } = await db
        .from("rewards")
        .update({ status: "claimed" })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({ reward: updated });
    }

    return NextResponse.json({ reward: existing });
  }

  const categoryId = await findBirthdayCategoryId(db);

  if (!categoryId) {
    return NextResponse.json({ error: "birthday_category_not_found" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data: reward, error: insertError } = await db
    .from("rewards")
    .insert({
      client_id: user.id,
      category_id: categoryId,
      reward_type: rewardType,
      status: "claimed",
      earned_at: now,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ reward });
}
