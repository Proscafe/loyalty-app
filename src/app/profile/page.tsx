import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileSettings from "./ProfileSettings";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, client_code, birthday, created_at, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login");
  }

  const [transactionsResult, rewardsResult, categoriesResult] = await Promise.all([
    supabase
      .from("stamp_transactions")
      .select("*")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),

    supabase
      .from("rewards")
      .select("*")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),

    supabase.from("loyalty_categories").select("id, name"),
  ]);

  const categoryNameById = new Map(
    (categoriesResult.data ?? []).map((category: any) => [
      String(category.id),
      category.name,
    ]),
  );

  const recentTransactions = (transactionsResult.data ?? []).map((item: any) => ({
    ...item,
    category_name:
      item.category_name ||
      item.loyalty_categories?.name ||
      categoryNameById.get(String(item.category_id)) ||
      categoryNameById.get(String(item.loyalty_category_id)) ||
      item.category ||
      null,
  }));

  return (
    <ProfileSettings
      profile={profile}
      recentTransactions={recentTransactions}
      recentRewards={rewardsResult.data ?? []}
    />
  );
}
