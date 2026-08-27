import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GiftsPageClient from "./GiftsPageClient";

type ProfileRow = Record<string, any> & {
  id: string;
};

type GiftRow = Record<string, any>;

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export default async function AdminGiftsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Repairs missing birthday rewards/logs for the previous 30 days.
  // It checks for existing rows first, so refreshing does not duplicate gifts.

  const [rewardsResult, profilesResult] = await Promise.all([
    supabase
      .from("rewards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1500),
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3000),
  ]);

  return (
    <GiftsPageClient
      gifts={safeArray<GiftRow>(rewardsResult.data as GiftRow[] | null)}
      profiles={safeArray<ProfileRow>(
        profilesResult.data as ProfileRow[] | null,
      )}
    />
  );
}
