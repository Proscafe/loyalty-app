import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type DeleteGiftBody = {
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
    const body = (await request.json().catch(() => ({}))) as DeleteGiftBody;
    const giftId = String(body.giftId ?? "").trim();

    if (!giftId) {
      return NextResponse.json({ error: "missing_gift_id" }, { status: 400 });
    }

    const supabase = adminSupabase();
    const { error } = await supabase.from("rewards").delete().eq("id", giftId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted_id: giftId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "delete_failed" },
      { status: 500 },
    );
  }
}
