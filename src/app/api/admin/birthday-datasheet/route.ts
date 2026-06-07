import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type BirthdayDatasheetRow = {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  birthday?: string | null;
  source?: string | null;
  created_at?: string | null;
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

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isValidDateText(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

export async function GET() {
  try {
    const supabase = getAdminSupabase();

    const { data, error } = await supabase
      .from("birthday_datasheet")
      .select("id, name, phone, birthday, source, created_at")
      .order("birthday", { ascending: true })
      .limit(10000);

    if (error) {
      return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });
    }

    return NextResponse.json({
      rows: ((data ?? []) as BirthdayDatasheetRow[]).map((row) => ({
        ...row,
        source: row.source || "Datasheet",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load birthday datasheet.",
        rows: [],
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = cleanText(body?.name);
    const phone = cleanText(body?.phone);
    const birthday = cleanText(body?.birthday);

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    if (!birthday || !isValidDateText(birthday)) {
      return NextResponse.json(
        { error: "Birthday must be in YYYY-MM-DD format." },
        { status: 400 },
      );
    }

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("birthday_datasheet")
      .insert({
        name,
        phone: phone || null,
        birthday,
        source: "Datasheet",
      })
      .select("id, name, phone, birthday, source, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, row: data as BirthdayDatasheetRow });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not add birthday datasheet row.",
      },
      { status: 500 },
    );
  }
}
