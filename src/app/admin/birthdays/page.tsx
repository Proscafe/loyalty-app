import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BirthdaysPageClient from "./BirthdaysPageClient";

export default async function AdminBirthdaysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <BirthdaysPageClient />;
}
