import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GiftsPageClient from "./GiftsPageClient";

type ProfileRow = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  client_code?: string | null;
  created_at?: string | null;
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

  const [rewardsResult, profilesResult] = await Promise.all([
    supabase
      .from("rewards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("id, full_name, phone, client_code, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  return (
    <GiftsPageClient
      gifts={safeArray<GiftRow>(rewardsResult.data as GiftRow[] | null)}
      profiles={safeArray<ProfileRow>(profilesResult.data as ProfileRow[] | null)}
    />
  );
}
