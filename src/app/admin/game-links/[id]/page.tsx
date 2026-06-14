import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { GameLinkDetailsClient } from "./GameLinkDetailsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export default async function AdminGameLinkPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = getAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "master_admin") {
    redirect("/dashboard");
  }

  const { data: match } = await admin
    .from("prediction_matches")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!match) {
    redirect("/admin?tab=Game%20Links");
  }

  const { data: entries } = await admin
    .from("prediction_entries")
    .select("*")
    .eq("match_id", id)
    .order("points", { ascending: false });

  const clientIds = Array.from(new Set((entries ?? []).map((entry: any) => entry.client_id).filter(Boolean)));
  let profileNames: Record<string, { name: string; code: string; role: string }> = {};

  if (clientIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email, client_code, role")
      .in("id", clientIds);

    profileNames = Object.fromEntries(
      (profiles ?? []).map((row: any) => [
        row.id,
        {
          name: row.full_name || row.email || row.client_code || "Client",
          code: row.client_code || "",
          role: row.role || "client",
        },
      ]),
    );
  }

  const clientEntries = (entries ?? []).filter(
    (entry: any) => profileNames[entry.client_id]?.role === "client",
  );

  let giftSentClientIds: string[] = [];

  if (clientIds.length > 0) {
    const { data: sentRewards } = await admin
      .from("rewards")
      .select("client_id, reward_type, description")
      .in("client_id", clientIds)
      .eq("reward_type", "Free Dessert")
      .ilike("description", `%prediction_match:${id}%`);

    giftSentClientIds = Array.from(
      new Set((sentRewards ?? []).map((reward: any) => reward.client_id).filter(Boolean)),
    );
  }

  return (
    <GameLinkDetailsClient
      match={match}
      entries={clientEntries}
      profileNames={profileNames}
      giftSentClientIds={giftSentClientIds}
    />
  );
}
