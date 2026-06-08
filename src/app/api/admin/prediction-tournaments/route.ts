import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireAdmin() {
  const supabase = await createClient();
  const admin = getAdminClient();

  if (!admin) return { admin: null as any, error: jsonError("Supabase admin client is not configured.", 500) };

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { admin: null as any, error: jsonError("Please sign in as admin first.", 401) };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return { admin: null as any, error: jsonError(profileError.message, 400) };
  if (!profile || profile.role !== "master_admin") return { admin: null as any, error: jsonError("Admin access required.", 403) };

  return { admin, error: null as Response | null };
}

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const { data, error: queryError } = await admin
    .from("prediction_tournaments")
    .select("id, name, sport_type, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (queryError) return jsonError(queryError.message, 400);

  return NextResponse.json({ tournaments: data ?? [] });
}

export async function POST(req: Request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    sport_type?: string;
  };

  const name = String(body.name ?? "").trim();
  const sportType = body.sport_type === "football" ? "football" : body.sport_type === "basketball" ? "basketball" : "";

  if (!name) return jsonError("Tournament name is required.", 400);
  if (!sportType) return jsonError("Choose Football or Basketball.", 400);

  const { data, error: insertError } = await admin
    .from("prediction_tournaments")
    .insert({ name, sport_type: sportType, is_active: true })
    .select("id, name, sport_type, is_active, created_at")
    .maybeSingle();

  if (insertError) return jsonError(insertError.message, 400);

  return NextResponse.json({ tournament: data });
}

export async function DELETE(req: Request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();

  if (!id) return jsonError("Tournament id is required.", 400);

  await admin.from("prediction_matches").update({ tournament_id: null }).eq("tournament_id", id);
  await admin.from("prediction_tournament_scores").delete().eq("tournament_id", id);

  const { error: deleteError } = await admin.from("prediction_tournaments").delete().eq("id", id);

  if (deleteError) return jsonError(deleteError.message, 400);

  return NextResponse.json({ success: true });
}
