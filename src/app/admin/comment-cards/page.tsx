import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CommentCardsPageClient from "./CommentCardsPageClient";

type ProfileRow = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  client_code?: string | null;
  created_at?: string | null;
};

type CommentCardRow = Record<string, any>;

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export default async function AdminCommentCardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [commentsResult, profilesResult] = await Promise.all([
    supabase
      .from("comment_cards")
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
    <CommentCardsPageClient
      comments={safeArray<CommentCardRow>(commentsResult.data as CommentCardRow[] | null)}
      profiles={safeArray<ProfileRow>(profilesResult.data as ProfileRow[] | null)}
    />
  );
}
