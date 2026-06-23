import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BrowserPushSubscription = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

type SubscribeBody = {
  subscription?: BrowserPushSubscription;
  audience?: string;
  role?: string;
  profileId?: string | null;
};

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

function normalizeRole(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "admin" || clean === "master_admin" || clean === "master admin") {
    return "master_admin";
  }

  if (clean === "staff") return "staff";
  if (clean === "client" || clean === "customer") return "client";

  return "client";
}

function audienceForRole(role: string) {
  if (role === "master_admin") return "Admin";
  if (role === "staff") return "Staff";
  return "Client";
}

export async function POST(req: Request) {
  let body: SubscribeBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const subscription = body.subscription;

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  // This route intentionally does NOT require Supabase Auth.
  // Staff and installed PWA sessions can save a browser push endpoint even when
  // the staff login flow does not create a Supabase auth session.
  const role = normalizeRole(body.role || body.audience);
  const audience = audienceForRole(role);
  const profileId = body.profileId || null;

  try {
    const serviceSupabase = getServiceClient();

    const { error } = await serviceSupabase.from("push_subscriptions").upsert(
      {
        profile_id: profileId,
        role,
        audience,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: req.headers.get("user-agent"),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint,audience" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, role, audience });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "subscription_save_failed" },
      { status: 500 },
    );
  }
}
