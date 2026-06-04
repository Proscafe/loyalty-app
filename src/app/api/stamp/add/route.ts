import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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

    const admin = getAdminClient();

    const { data: staffProfile, error: staffError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (staffError) {
      return jsonError(staffError.message, 400);
    }

    if (!staffProfile || !["staff", "admin", "master_admin"].includes(staffProfile.role)) {
      return jsonError("Staff access required.", 403);
    }

    const body = (await req.json().catch(() => ({}))) as {
      client_id?: string;
      clientId?: string;
      category_id?: string;
      categoryId?: string;
      amount?: number;
    };

    const clientId = String(body.client_id ?? body.clientId ?? "").trim();
    const categoryId = String(body.category_id ?? body.categoryId ?? "").trim();
    const amount = Number.isFinite(Number(body.amount)) ? Math.max(1, Number(body.amount)) : 1;

    if (!clientId || !categoryId) {
      return jsonError("Missing client_id or category_id.", 400);
    }

    const { data: clientProfile, error: clientError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) {
      return jsonError(clientError.message, 400);
    }

    if (!clientProfile || clientProfile.role !== "client") {
      return jsonError("Client profile not found.", 404);
    }

    const { data: existingStamp, error: stampReadError } = await admin
      .from("client_stamps")
      .select("id, count")
      .eq("client_id", clientId)
      .eq("category_id", categoryId)
      .maybeSingle();

    if (stampReadError) {
      return jsonError(stampReadError.message, 400);
    }

    const currentCount = Number(existingStamp?.count ?? 0);
    const nextCount = currentCount + amount;

    if (existingStamp?.id) {
      const { error: updateError } = await admin
        .from("client_stamps")
        .update({
          count: nextCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingStamp.id);

      if (updateError) {
        return jsonError(updateError.message, 400);
      }
    } else {
      const { error: insertError } = await admin.from("client_stamps").insert({
        client_id: clientId,
        category_id: categoryId,
        count: nextCount,
      });

      if (insertError) {
        return jsonError(insertError.message, 400);
      }
    }

    await admin.from("stamp_transactions").insert({
      client_id: clientId,
      staff_id: user.id,
      category_id: categoryId,
      action: "add_stamp",
      amount,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      client_id: clientId,
      category_id: categoryId,
      count: nextCount,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not add stamp.", 500);
  }
}
