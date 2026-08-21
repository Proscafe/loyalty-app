import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type QuestionCreate = {
  question_text?: string;
  question_type?: QuestionType;
  is_required?: boolean;
  options?: string[];
};

type ProfileRoleRow = {
  id: string;
  role: string | null;
};

type AuthSuccess = {
  ok: true;
  admin: any;
};

type AuthFailure = {
  ok: false;
  response: NextResponse;
};

type AuthResult = AuthSuccess | AuthFailure;

const selectFields =
  "id, question_key, question_text, question_type, is_active, is_required, sort_order, options, is_system, created_at, updated_at";

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    },
  );
}

function getAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  /*
   * We intentionally use an untyped Supabase client here.
   *
   * comment_card_questions was added after the project's
   * generated Supabase TypeScript definitions, so the generated
   * Database type currently resolves this new table to `never`.
   *
   * This route remains server-only and protected by the
   * master_admin authorization check below.
   */
  return createSupabaseClient<any>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function requireMasterAdmin(): Promise<AuthResult> {
  const supabase = await createServerClient();
  const admin = getAdminClient();

  if (!admin) {
    return {
      ok: false,
      response: jsonError(
        "Supabase admin client is not configured.",
        500,
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: jsonError(
        "Unauthorized.",
        401,
      ),
    };
  }

  const {
    data: profileData,
    error: profileError,
  } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile =
    profileData as ProfileRoleRow | null;

  if (profileError) {
    return {
      ok: false,
      response: jsonError(
        profileError.message,
        400,
      ),
    };
  }

  if (
    !profile ||
    profile.role !== "master_admin"
  ) {
    return {
      ok: false,
      response: jsonError(
        "Master admin access required.",
        403,
      ),
    };
  }

  return {
    ok: true,
    admin,
  };
}

export async function GET(): Promise<Response> {
  const auth = await requireMasterAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { admin } = auth;

  const {
    data,
    error: queryError,
  } = await admin
    .from("comment_card_questions")
    .select(selectFields)
    .order("sort_order", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    });

  if (queryError) {
    return jsonError(
      queryError.message,
      400,
    );
  }

  return NextResponse.json(
    {
      questions: data ?? [],
    },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export async function POST(
  request: Request,
): Promise<Response> {
  const auth = await requireMasterAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { admin } = auth;

  const body = (await request
    .json()
    .catch(() => null)) as QuestionCreate | null;

  if (!body) {
    return jsonError(
      "Invalid request.",
    );
  }

  const questionText = String(
    body.question_text ?? "",
  ).trim();

  const questionType =
    body.question_type ?? "rating";

  if (!questionText) {
    return jsonError(
      "Question text is required.",
    );
  }

  if (
    ![
      "rating",
      "select",
      "textarea",
    ].includes(questionType)
  ) {
    return jsonError(
      "Invalid question type.",
    );
  }

  const {
    data: lastQuestionData,
    error: lastQuestionError,
  } = await admin
    .from("comment_card_questions")
    .select("sort_order")
    .order("sort_order", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (lastQuestionError) {
    return jsonError(
      lastQuestionError.message,
      400,
    );
  }

  const lastQuestion =
    lastQuestionData as {
      sort_order?: number | null;
    } | null;

  const sortOrder =
    Number(
      lastQuestion?.sort_order ?? 0,
    ) + 10;

  const questionKey =
    `custom_${crypto
      .randomUUID()
      .replace(/-/g, "")}`;

  const options =
    questionType === "select"
      ? Array.isArray(body.options)
        ? body.options
            .map((item) =>
              String(item).trim(),
            )
            .filter(Boolean)
        : []
      : [];

  const {
    data,
    error: insertError,
  } = await admin
    .from("comment_card_questions")
    .insert({
      question_key: questionKey,
      question_text: questionText,
      question_type: questionType,
      is_active: true,
      is_required: Boolean(
        body.is_required,
      ),
      sort_order: sortOrder,
      options,
      is_system: false,
    })
    .select(selectFields)
    .single();

  if (insertError) {
    return jsonError(
      insertError.message,
      400,
    );
  }

  return NextResponse.json({
    question: data,
  });
}

export async function PATCH(
  request: Request,
): Promise<Response> {
  const auth = await requireMasterAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { admin } = auth;

  const body = (await request
    .json()
    .catch(() => null)) as QuestionUpdate | null;

  if (!body?.id) {
    return jsonError(
      "Question id is required.",
    );
  }

  const update: Record<
    string,
    unknown
  > = {};

  if (
    body.question_text !== undefined
  ) {
    const questionText = String(
      body.question_text,
    ).trim();

    if (!questionText) {
      return jsonError(
        "Question text cannot be empty.",
      );
    }

    update.question_text =
      questionText;
  }

  if (
    body.question_type !== undefined
  ) {
    if (
      ![
        "rating",
        "select",
        "textarea",
      ].includes(body.question_type)
    ) {
      return jsonError(
        "Invalid question type.",
      );
    }

    update.question_type =
      body.question_type;
  }

  if (
    body.is_active !== undefined
  ) {
    update.is_active = Boolean(
      body.is_active,
    );
  }

  if (
    body.is_required !== undefined
  ) {
    update.is_required = Boolean(
      body.is_required,
    );
  }

  if (
    body.sort_order !== undefined
  ) {
    const sortOrder = Number(
      body.sort_order,
    );

    if (!Number.isInteger(sortOrder)) {
      return jsonError(
        "sort_order must be a whole number.",
      );
    }

    update.sort_order =
      sortOrder;
  }

  if (
    body.options !== undefined
  ) {
    update.options =
      Array.isArray(body.options)
        ? body.options
            .map((item) =>
              String(item).trim(),
            )
            .filter(Boolean)
        : [];
  }

  if (
    Object.keys(update).length === 0
  ) {
    return jsonError(
      "Nothing to update.",
    );
  }

  const {
    data,
    error: updateError,
  } = await admin
    .from("comment_card_questions")
    .update(update)
    .eq("id", body.id)
    .select(selectFields)
    .single();

  if (updateError) {
    return jsonError(
      updateError.message,
      400,
    );
  }

  return NextResponse.json({
    question: data,
  });
}