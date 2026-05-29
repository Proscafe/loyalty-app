import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

type AnyRecord = Record<string, any>;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategoryName(name?: string | null) {
  const safeName = cleanText(name);
  const lower = safeName.toLowerCase();

  if (lower === "sandwich" || lower === "sandwiches") return "Sandwiches";
  if (lower === "main course" || lower === "main courses" || lower === "maincourse") return "Main Courses";
  if (lower === "dessert" || lower === "desserts") return "Desserts";
  if (lower === "coffee" || lower === "coffees") return "Coffee";
  if (lower === "desserts 2" || lower === "hooka" || lower === "hookah" || lower === "hookas" || lower === "hookahs") return "Hooka";

  return safeName || "Reward";
}

function extractCategoryName(item: AnyRecord) {
  const directName =
    cleanText(item.category_name) ||
    cleanText(item.name) ||
    cleanText(item.category?.name) ||
    cleanText(item.loyalty_categories?.name) ||
    cleanText(item.categories?.name) ||
    cleanText(item.loyalty_category?.name);

  if (directName) return normalizeCategoryName(directName);

  const rewardType = cleanText(item.reward_type);
  if (rewardType) {
    return normalizeCategoryName(
      rewardType
        .replace(/^1\s+Free\s+/i, "")
        .replace(/^Free\s+/i, "")
        .replace(/\s+Item$/i, "")
        .trim()
    );
  }

  return "Reward";
}

function getSingularCategory(name: string) {
  const normalized = normalizeCategoryName(name);
  const map: Record<string, string> = {
    Sandwiches: "Sandwich",
    "Main Courses": "Main Course",
    Desserts: "Dessert",
    Coffee: "Coffee",
    Hooka: "Hooka",
  };

  return map[normalized] ?? normalized;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");

  if (!memberId) {
    return NextResponse.json({ history: [] }, { status: 400 });
  }

  const supabase = createAdminClient();

  const [stampEventsResult, rewardsResult] = await Promise.all([
    supabase
      .from("stamp_events")
      .select("id, action, created_at, category_id, loyalty_categories(name)")
      .eq("client_id", memberId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("rewards")
      .select("id, status, created_at, earned_at, redeemed_at, reward_type, category_id, loyalty_categories(name)")
      .eq("client_id", memberId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const stampEvents = stampEventsResult.data ?? [];
  const rewards = rewardsResult.data ?? [];

  const stampHistory = stampEvents.map((item: AnyRecord) => ({
    id: `stamp-${item.id}`,
    type: "stamp_added",
    category: extractCategoryName(item),
    date: item.created_at,
  }));

  const rewardHistory = rewards
    .filter((reward: AnyRecord) => reward.status === "claimed" || reward.status === "redeemed")
    .map((reward: AnyRecord) => {
      const category = extractCategoryName(reward);
      const rewardName = `Free ${getSingularCategory(category)}`;
      const isApproved = reward.status === "redeemed";

      return {
        id: `reward-${reward.id}`,
        type: isApproved ? "gift_approved" : "gift_claimed",
        rewardName,
        date: reward.redeemed_at || reward.earned_at || reward.created_at,
      };
    });

  const history = [...stampHistory, ...rewardHistory]
    .sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime())
    .slice(0, 30);

  return NextResponse.json({ history });
}
