import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QuestionType = "rating" | "select" | "textarea";

const QUESTION_TYPES: QuestionType[] = [
  "rating",
  "select",
  "textarea",
];

function normalizeOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

export async function GET() {
  await requireRole(["master_admin"]);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("comment_card_questions")
    .select(
      "id, question_key, question_text, question_type, is_active, is_required, sort_order, options, created_at, updated_at",
    )
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not load questions." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    questions: Array.isArray(data) ? data : [],
  });
}

export async function PATCH(request: Request) {
  await requireRole(["master_admin"]);

  const body = await request.json().catch(() => null);

  const id = String(body?.id ?? "").trim();

  if (!id) {
    return NextResponse.json(
      { error: "Question id is required." },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {};

  if ("question_text" in (body ?? {})) {
    const questionText = String(body?.question_text ?? "").trim();

    if (!questionText) {
      return NextResponse.json(
        { error: "Question text cannot be empty." },
        { status: 400 },
      );
    }

    update.question_text = questionText;
  }

  if ("is_active" in (body ?? {})) {
    update.is_active = Boolean(body?.is_active);
  }

  if ("is_required" in (body ?? {})) {
    update.is_required = Boolean(body?.is_required);
  }

  if ("sort_order" in (body ?? {})) {
    const sortOrder = Number(body?.sort_order);

    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json(
        { error: "Invalid sort order." },
        { status: 400 },
      );
    }

    update.sort_order = sortOrder;
  }

  if ("options" in (body ?? {})) {
    update.options = normalizeOptions(body?.options);
  }

  if ("question_type" in (body ?? {})) {
    const questionType = String(body?.question_type ?? "") as QuestionType;

    if (!QUESTION_TYPES.includes(questionType)) {
      return NextResponse.json(
        { error: "Invalid question type." },
        { status: 400 },
      );
    }

    update.question_type = questionType;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json(
      { error: "No changes were provided." },
      { status: 400 },
    );
  }

  update.updated_at = new Date().toISOString();

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("comment_card_questions")
    .update(update)
    .eq("id", id)
    .select(
      "id, question_key, question_text, question_type, is_active, is_required, sort_order, options, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not save question." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Question not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    question: data,
  });
}
