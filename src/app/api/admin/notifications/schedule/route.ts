import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Audience = "Client" | "Staff" | "Admin";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "not_authenticated", status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return { error: "profile_not_found", status: 404 as const };
  if (profile.role !== "master_admin") {
    return { error: "not_authorized", status: 403 as const };
  }

  return { user, profile };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    title?: string;
    message?: string;
    type?: string;
    audience?: Audience;
    scheduled_at?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const message = String(body.message ?? "").trim();
  const type = String(body.type ?? "Announcements").trim() || "Announcements";
  const audience = body.audience;
  const scheduledAt = String(body.scheduled_at ?? "").trim();

  if (!title || !message || !audience || !scheduledAt) {
    return NextResponse.json(
      { error: "title_message_audience_schedule_required" },
      { status: 400 },
    );
  }

  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "invalid_schedule_date" }, { status: 400 });
  }

  const admin = getServiceClient();
  const { data, error } = await admin
    .from("admin_notifications")
    .insert({
      title,
      message,
      notification_type: type,
      audience,
      status: "Scheduled",
      send_mode: "scheduled",
      scheduled_at: date.toISOString(),
      sent_by: auth.profile.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, notification: data });
}
