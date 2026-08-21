import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuestionType = "rating" | "select" | "textarea";

type QuestionUpdate = {
  id?: string;
  question_text?: string;
  question_type?: QuestionType;
  is_active?: boolean;
  is_required?: boolean;
  sort_order?: number;
  options?: string[];
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireMasterAdmin() {
  const supabase = await createServerClient();
  const admin = getAdminClient();

  if (!admin) {
    return {
      admin: null as ReturnType<typeof getAdminClient>,
      error: jsonError("Supabase admin client is not configured.", 500),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      admin: null,
      error: jsonError("Unauthorized.", 401),
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      admin: null,
      error: jsonError(profileError.message, 400),
    };
  }

  if (!profile || profile.role !== "master_admin") {
    return {
      admin: null,
      error: jsonError("Master admin access required.", 403),
    };
  }

  return { admin, error: null as Response | null };
}

export async function GET() {
  const { admin, error } = await requireMasterAdmin();
  if (error || !admin) return error;

  const { data, error: queryError } = await admin
    .from("comment_card_questions")
    .select(
      "id, question_key, question_text, question_type, is_active, is_required, sort_order, options, created_at, updated_at",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (queryError) {
    return jsonError(queryError.message, 400);
  }

  return NextResponse.json({ questions: data ?? [] });
}

export async function PATCH(request: Request) {
  const { admin, error } = await requireMasterAdmin();
  if (error || !admin) return error;

  const body = (await request.json().catch(() => null)) as QuestionUpdate | null;

  if (!body?.id) {
    return jsonError("Question id is required.");
  }

  const update: Record<string, unknown> = {};

  if (body.question_text !== undefined) {
    const text = String(body.question_text).trim();
    if (!text) return jsonError("Question text cannot be empty.");
    update.question_text = text;
  }

  if (body.question_type !== undefined) {
    if (!["rating", "select", "textarea"].includes(body.question_type)) {
      return jsonError("Invalid question type.");
    }
    update.question_type = body.question_type;
  }

  if (body.is_active !== undefined) {
    update.is_active = Boolean(body.is_active);
  }

  if (body.is_required !== undefined) {
    update.is_required = Boolean(body.is_required);
  }

  if (body.sort_order !== undefined) {
    const sortOrder = Number(body.sort_order);
    if (!Number.isInteger(sortOrder)) {
      return jsonError("sort_order must be a whole number.");
    }
    update.sort_order = sortOrder;
  }

  if (body.options !== undefined) {
    update.options = Array.isArray(body.options)
      ? body.options.map((item) => String(item).trim()).filter(Boolean)
      : [];
  }

  if (Object.keys(update).length === 0) {
    return jsonError("Nothing to update.");
  }

  const { data, error: updateError } = await admin
    .from("comment_card_questions")
    .update(update)
    .eq("id", body.id)
    .select(
      "id, question_key, question_text, question_type, is_active, is_required, sort_order, options, created_at, updated_at",
    )
    .single();

  if (updateError) {
    return jsonError(updateError.message, 400);
  }

  return NextResponse.json({ question: data });
}
