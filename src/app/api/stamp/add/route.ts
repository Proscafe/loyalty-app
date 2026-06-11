import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

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

const BEIRUT_OFFSET_MS = 3 * 60 * 60 * 1000;

function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

function friendlyStampError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("one_stamp_per_client_per_category_per_day") ||
    lower.includes("one_stamp_per_client_per_day")
  ) {
    return "This client already received a stamp during the current stamp window.";
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

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function datePartsToBeirutDateString(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDaysToBeirutDateString(
  year: number,
  month: number,
  day: number,
  daysToAdd: number,
) {
  const date = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  return datePartsToBeirutDateString(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

function beirutLocalToUtcIso(beirutDate: string, beirutTime: string) {
  return new Date(`${beirutDate}T${beirutTime}+03:00`).toISOString();
}

function getBeirutStampWindow(now = new Date()) {
  const beirutNow = new Date(now.getTime() + BEIRUT_OFFSET_MS);
  const year = beirutNow.getUTCFullYear();
  const month = beirutNow.getUTCMonth() + 1;
  const day = beirutNow.getUTCDate();
  const hour = beirutNow.getUTCHours();

  const today = datePartsToBeirutDateString(year, month, day);
  const yesterday = addDaysToBeirutDateString(year, month, day, -1);
  const tomorrow = addDaysToBeirutDateString(year, month, day, 1);

  // Closed from 5:00 AM until 8:59:59 AM Beirut time.
  if (hour >= 5 && hour < 9) {
    return {
      isOpen: false,
      startUtc: "",
      endUtc: "",
      message: "Stamping is available from 9:00 AM until 5:00 AM Beirut time.",
    };
  }

  // After midnight and before 5:00 AM belongs to the previous day's stamp window.
  if (hour < 5) {
    return {
      isOpen: true,
      startUtc: beirutLocalToUtcIso(yesterday, "09:00:00.000"),
      endUtc: beirutLocalToUtcIso(today, "05:00:00.000"),
      message: "",
    };
  }

  // From 9:00 AM until midnight belongs to today's stamp window.
  return {
    isOpen: true,
    startUtc: beirutLocalToUtcIso(today, "09:00:00.000"),
    endUtc: beirutLocalToUtcIso(tomorrow, "05:00:00.000"),
    message: "",
  };
}

async function assertNoStampInCurrentWindow(clientId: string, categoryId: string) {
  const stampWindow = getBeirutStampWindow();

  if (!stampWindow.isOpen) {
    return {
      ok: false,
      status: 403,
      code: "STAMP_WINDOW_CLOSED",
      message: stampWindow.message,
    };
  }

  const supabaseAdmin = createAdminClient();

  const { data: existingStamp, error } = await supabaseAdmin
    .from("stamp_transactions")
    .select("id")
    .eq("client_id", clientId)
    .eq("category_id", categoryId)
    .eq("action_type", "add_stamp")
    .gte("created_at", stampWindow.startUtc)
    .lt("created_at", stampWindow.endUtc)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      code: "STAMP_WINDOW_CHECK_FAILED",
      message: "Could not check this client's stamp history.",
    };
  }

  if (existingStamp) {
    return {
      ok: false,
      status: 409,
      code: "ALREADY_STAMPED_IN_WINDOW",
      message: "This client already received a stamp in this category during the current stamp window.",
    };
  }

  return {
    ok: true,
    status: 200,
    code: "",
    message: "",
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError("Please sign in first.", 401, "NOT_SIGNED_IN");
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
      return jsonError("Missing client_id or category_id.", 400, "MISSING_FIELDS");
    }

    const stampWindowCheck = await assertNoStampInCurrentWindow(clientId, categoryId);

    if (!stampWindowCheck.ok) {
      return jsonError(
        stampWindowCheck.message,
        stampWindowCheck.status,
        stampWindowCheck.code,
      );
    }

    const { data, error } = await supabase.rpc("add_stamp", {
      p_client_id: clientId,
      p_category_id: categoryId,
    });

    if (error) {
      return jsonError(friendlyStampError(error.message), 400, "ADD_STAMP_FAILED");
    }

    const result = data as AddStampRpcResult | null;

    if (!result?.success) {
      return jsonError("Could not add stamp.", 400, "ADD_STAMP_FAILED");
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
      "ADD_STAMP_EXCEPTION",
    );
  }
}
