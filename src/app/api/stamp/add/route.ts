import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddStampRpcResult = {
  success?: boolean;
  new_stamp_count?: number;
  reward_earned?: boolean;
  reward?: {
    id: string;
    reward_type: string;
    category_id: string;
    category_name: string;
    status: string;
    earned_at: string;
  };
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function friendlyStampError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("one_stamp_per_client_per_category_per_day")) {
    return "This client already received today's stamp in this category.";
  }

  if (lower.includes("one_stamp_per_client_per_day")) {
    return "This client already received today's stamp.";
  }

  if (lower.includes("category_not_found")) {
    return "This category is disabled or not found.";
  }

  if (lower.includes("not_authorized") || lower.includes("permission denied")) {
    return "Staff access required to add stamps.";
  }

  if (lower.includes("client") && lower.includes("not")) {
    return "Client profile not found.";
  }

  return message || "Could not add stamp.";
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError("Please sign in first.", 401);
    }

    const body = (await req.json().catch(() => ({}))) as {
      client_id?: string;
      clientId?: string;
      category_id?: string;
      categoryId?: string;
    };

    const clientId = String(body.client_id ?? body.clientId ?? "").trim();
    const categoryId = String(body.category_id ?? body.categoryId ?? "").trim();

    if (!clientId || !categoryId) {
      return jsonError("Missing client_id or category_id.", 400);
    }

    const { data, error } = await supabase.rpc("add_stamp", {
      p_client_id: clientId,
      p_category_id: categoryId,
    });

    if (error) {
      return jsonError(friendlyStampError(error.message), 400);
    }

    const result = data as AddStampRpcResult | null;

    if (!result?.success) {
      return jsonError("Could not add stamp.", 400);
    }

    return NextResponse.json({
      success: true,
      new_stamp_count: Number(result.new_stamp_count ?? 0),
      reward_earned: Boolean(result.reward_earned),
      reward: result.reward,
    });
  } catch (error) {
    return jsonError(
      friendlyStampError(error instanceof Error ? error.message : "Could not add stamp."),
      500,
    );
  }
}
