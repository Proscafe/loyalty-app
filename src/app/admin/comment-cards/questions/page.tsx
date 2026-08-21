import { requireRole } from "@/lib/auth";
import CommentCardQuestionsClient from "./CommentCardQuestionsClient";

export const dynamic = "force-dynamic";

export default async function CommentCardQuestionsPage() {
  await requireRole(["master_admin"]);
  return <CommentCardQuestionsClient />;
}
