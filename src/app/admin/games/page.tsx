import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GamesPage } from "./GamesPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Games — Admin" };

export default async function AdminGamesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <GamesPage />;
}
