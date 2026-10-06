import { NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

async function requireMasterAdmin() {
  const authSupabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized.", status: 401 as const };
  }

  const adminSupabase = createAdminClient();
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.is_active === false ||
    profile.role !== "master_admin"
  ) {
    return { error: "Forbidden.", status: 403 as const };
  }

  return { adminSupabase };
}

export async function GET() {
  const auth = await requireMasterAdmin();

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: NO_CACHE_HEADERS },
    );
  }

  const { data, error } = await auth.adminSupabase
    .from("comment_card_questions")
    .select(
      "id, question_key, question_text, question_type, is_active, is_required, sort_order, options, created_at, updated_at",
    )
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not load comment card questions." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  return NextResponse.json(
    { questions: Array.isArray(data) ? data : [] },
    { headers: NO_CACHE_HEADERS },
  );
}

export async function PATCH(request: Request) {
  const auth = await requireMasterAdmin();

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: NO_CACHE_HEADERS },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";

  if (!id) {
    return NextResponse.json(
      { error: "Question id is required." },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const updates: Record<string, unknown> = {};

  if ("question_text" in body) {
    const questionText =
      typeof body.question_text === "string" ? body.question_text.trim() : "";

    if (!questionText) {
      return NextResponse.json(
        { error: "Question text cannot be empty." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    updates.question_text = questionText;
  }

  if ("is_active" in body) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active must be true or false." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }
    updates.is_active = body.is_active;
  }

  if ("is_required" in body) {
    if (typeof body.is_required !== "boolean") {
      return NextResponse.json(
        { error: "is_required must be true or false." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }
    updates.is_required = body.is_required;
  }

  if ("sort_order" in body) {
    const sortOrder = Number(body.sort_order);

    if (!Number.isInteger(sortOrder)) {
      return NextResponse.json(
        { error: "sort_order must be an integer." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    updates.sort_order = sortOrder;
  }

  if ("options" in body) {
    if (!Array.isArray(body.options)) {
      return NextResponse.json(
        { error: "options must be an array." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    updates.options = body.options
      .map((option) => String(option).trim())
      .filter(Boolean);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No supported changes were provided." },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const { data, error } = await auth.adminSupabase
    .from("comment_card_questions")
    .update(updates)
    .eq("id", id)
    .select(
      "id, question_key, question_text, question_type, is_active, is_required, sort_order, options, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not save question." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Question not found." },
      { status: 404, headers: NO_CACHE_HEADERS },
    );
  }

  return NextResponse.json(
    { question: data },
    { headers: NO_CACHE_HEADERS },
  );
}
