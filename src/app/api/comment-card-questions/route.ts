import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("comment_card_questions")
    .select(
      "id, question_key, question_text, question_type, is_active, is_required, sort_order, options",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not load comment card questions." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }

  return NextResponse.json(
    {
      questions: Array.isArray(data) ? data : [],
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
