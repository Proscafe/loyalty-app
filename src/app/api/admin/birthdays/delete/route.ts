import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type DeleteBirthdaySource = "Loyalty" | "Comment Cards" | "Datasheet";

type DeleteBirthdayRow = {
  id?: string | null;
  source?: DeleteBirthdaySource | string | null;
};

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin variables are missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function uniqueIds(rows: DeleteBirthdayRow[], source: DeleteBirthdaySource) {
  return Array.from(
    new Set(
      rows
        .filter((row) => row.source === source)
        .map((row) => String(row.id || "").trim())
        .filter(Boolean),
    ),
  );
}

async function updateProfilesBirthdayToNull(supabase: any, ids: string[]) {
  const attemptedColumns = ["birthday", "birth_date", "date_of_birth", "dob"];
  const errors: string[] = [];
  let updated = false;

  for (const column of attemptedColumns) {
    const updatePayload: Record<string, null> = { [column]: null };

    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .in("id", ids);

    if (!error) {
      updated = true;
    } else if (!/column|schema cache|could not find/i.test(error.message)) {
      errors.push(`${column}: ${error.message}`);
    }
  }

  if (errors.length > 0) return errors.join(" | ");
  if (!updated) return "No birthday column was found on profiles.";
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rows = Array.isArray(body?.rows) ? (body.rows as DeleteBirthdayRow[]) : [];

    if (rows.length === 0) {
      return NextResponse.json({ error: "No birthday rows selected." }, { status: 400 });
    }

    const supabase: any = getAdminSupabase();
    const errors: string[] = [];
    let deletedCount = 0;

    const datasheetIds = uniqueIds(rows, "Datasheet");
    if (datasheetIds.length > 0) {
      const { error } = await supabase
        .from("birthday_datasheet")
        .delete()
        .in("id", datasheetIds);

      if (error) errors.push(`Datasheet: ${error.message}`);
      else deletedCount += datasheetIds.length;
    }

    const commentCardIds = uniqueIds(rows, "Comment Cards");
    if (commentCardIds.length > 0) {
      const { error } = await supabase
        .from("comment_cards")
        .update({ birthday: null })
        .in("id", commentCardIds);

      if (error) errors.push(`Comment Cards: ${error.message}`);
      else deletedCount += commentCardIds.length;
    }

    const loyaltyIds = uniqueIds(rows, "Loyalty");
    if (loyaltyIds.length > 0) {
      const error = await updateProfilesBirthdayToNull(supabase, loyaltyIds);
      if (error) errors.push(`Loyalty: ${error}`);
      else deletedCount += loyaltyIds.length;
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: errors.join(" | "),
          deleted_count: deletedCount,
          errors,
        },
        { status: deletedCount > 0 ? 207 : 500 },
      );
    }

    return NextResponse.json({ success: true, deleted_count: deletedCount });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not delete selected birthday records.",
      },
      { status: 500 },
    );
  }
}
