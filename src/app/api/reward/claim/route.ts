import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendNewRewardClaimNotification } from "@/lib/push";

// Reads auth cookies and calls Supabase RPCs — must run on Node, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let body: { reward_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body.reward_id) return NextResponse.json({ error: "missing_reward_id" }, { status: 400 });

  const { data, error } = await supabase.rpc("redeem_reward", { p_reward_id: body.reward_id });
  if (error) {
    const status = error.message?.includes("not_authorized") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  try {
    const { data: reward } = await supabase
      .from("rewards")
      .select("id, reward_type, client_id")
      .eq("id", body.reward_id)
      .maybeSingle();

    let clientName = "A client";

    if (reward?.client_id) {
      const { data: clientProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", reward.client_id)
        .maybeSingle();

      clientName = clientProfile?.full_name || clientName;
    }

    await sendNewRewardClaimNotification({
      rewardId: body.reward_id,
      rewardType: reward?.reward_type || "Reward",
      clientName,
    });
  } catch (notificationError) {
    console.error("Claim push notification failed", notificationError);
  }

  return NextResponse.json(data);
}
