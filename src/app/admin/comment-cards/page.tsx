import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import CommentCardsPageClient from "./CommentCardsPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCommentCardsPage() {
  await requireRole(["master_admin"]);

  const supabase = createAdminClient();

  const [
    { data: comments, error: commentsError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    supabase
      .from("comment_cards")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, phone, client_code, created_at"),
  ]);

  if (commentsError) {
    throw new Error(
      `Could not load comment cards: ${commentsError.message}`,
    );
  }

  if (profilesError) {
    throw new Error(
      `Could not load profiles: ${profilesError.message}`,
    );
  }

  return (
    <CommentCardsPageClient
      comments={Array.isArray(comments) ? comments : []}
      profiles={Array.isArray(profiles) ? profiles : []}
    />
  );
}
