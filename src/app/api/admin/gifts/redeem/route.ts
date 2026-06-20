import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const giftId = String(body?.giftId ?? body?.id ?? "").trim();
    const redeemedById = String(body?.redeemedById ?? "").trim();

    if (!giftId) {
      return NextResponse.json({ error: "Missing giftId." }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const redeemedAt = new Date().toISOString();

    const redeemedByPayload = isUuid(redeemedById) ? { redeemed_by: redeemedById } : {};

    const attempts: Array<Record<string, unknown>> = [
      { redeemed_at: redeemedAt, status: "redeemed", reward_status: "redeemed", ...redeemedByPayload },
      { redeemed_at: redeemedAt, status: "redeemed", ...redeemedByPayload },
      { redeemed_at: redeemedAt, reward_status: "redeemed", ...redeemedByPayload },
      { redeemed_at: redeemedAt, status: "redeemed" },
      { redeemed_at: redeemedAt, reward_status: "redeemed" },
      { status: "redeemed" },
      { reward_status: "redeemed" },
    ];

    let lastError: unknown = null;

    for (const payload of attempts) {
      const { data, error } = await supabase.from("rewards").update(payload).eq("id", giftId).select("*").single();

      if (!error) {
        return NextResponse.json({ ok: true, redeemed_at: redeemedAt, reward: data });
      }

      lastError = error;
    }

    throw lastError instanceof Error ? lastError : new Error("Could not redeem gift.");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not redeem gift." },
      { status: 500 },
    );
  }
}
