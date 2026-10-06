import { NextRequest, NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_ROLES = new Set([
  "master_admin",
  "staff",
  "supervisor",
]);

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

async function requireAuthorizedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      admin: null,
      profile: null,
      error: json({ error: "Please sign in first." }, 401),
    };
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, full_name, email, client_code")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      user: null,
      admin: null,
      profile: null,
      error: json({ error: profileError.message }, 500),
    };
  }

  const role = String(profile?.role ?? "").trim();

  if (!ALLOWED_ROLES.has(role)) {
    return {
      user: null,
      admin: null,
      profile: null,
      error: json({ error: "Admin access required." }, 403),
    };
  }

  return {
    user,
    admin,
    profile,
    error: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthorizedUser();

    if (auth.error || !auth.admin || !auth.user) {
      return auth.error;
    }

    const body = await request.json().catch(() => ({}));
    const giftId = String(body?.giftId ?? body?.id ?? "").trim();

    if (!giftId) {
      return json({ error: "Missing giftId." }, 400);
    }

    const redeemedAt = new Date().toISOString();

    const staffName =
      String(auth.profile?.full_name ?? "").trim() ||
      String(auth.profile?.email ?? "").trim() ||
      String(auth.profile?.client_code ?? "").trim() ||
      String(auth.user.email ?? "").trim() ||
      "Staff user";

    const attempts: Array<Record<string, unknown>> = [
      {
        redeemed_at: redeemedAt,
        status: "redeemed",
        reward_status: "redeemed",
        redeemed_by: auth.user.id,
        redeemed_by_name: staffName,
      },
      {
        redeemed_at: redeemedAt,
        status: "redeemed",
        redeemed_by: auth.user.id,
        redeemed_by_name: staffName,
      },
      {
        redeemed_at: redeemedAt,
        reward_status: "redeemed",
        redeemed_by: auth.user.id,
        redeemed_by_name: staffName,
      },
      {
        redeemed_at: redeemedAt,
        status: "redeemed",
        redeemed_by: auth.user.id,
      },
      {
        redeemed_at: redeemedAt,
        reward_status: "redeemed",
        redeemed_by: auth.user.id,
      },
      {
        redeemed_at: redeemedAt,
        status: "redeemed",
      },
      {
        redeemed_at: redeemedAt,
        reward_status: "redeemed",
      },
    ];

    let lastError: any = null;

    for (const payload of attempts) {
      const { data, error } = await auth.admin
        .from("rewards")
        .update(payload)
        .eq("id", giftId)
        .select("*")
        .single();

      if (!error) {
        return json({
          ok: true,
          redeemed_at: redeemedAt,
          redeemed_by: auth.user.id,
          redeemed_by_name: staffName,
          reward: data,
        });
      }

      lastError = error;
    }

    return json(
      {
        error:
          lastError?.message ||
          "Could not redeem gift.",
      },
      500,
    );
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not redeem gift.",
      },
      500,
    );
  }
}
