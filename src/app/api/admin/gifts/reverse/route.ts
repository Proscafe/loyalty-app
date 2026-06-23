import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type ReverseGiftBody = {
  giftId?: string;
};

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ReverseGiftBody;
    const giftId = String(body.giftId ?? "").trim();

    if (!giftId) {
      return NextResponse.json({ error: "missing_gift_id" }, { status: 400 });
    }

    const supabase = adminSupabase();
    const { data, error } = await supabase
      .from("rewards")
      .update({
        status: "available",
        reward_status: "available",
        redeemed_at: null,
        redeemed_by: null,
        redeemed_by_id: null,
        redeemed_by_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", giftId)
      .select("id,status,reward_status,redeemed_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "gift_not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, gift: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "reverse_failed" },
      { status: 500 },
    );
  }
}
