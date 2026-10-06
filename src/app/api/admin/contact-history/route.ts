import { NextResponse } from "next/server";

import {
  createAdminClient,
  createClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_ROLES = new Set([
  "master_admin",
  "staff",
  "supervisor",
]);

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

async function requireAuthorizedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      admin: null,
      error: json({ error: "Please sign in first." }, 401),
    };
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      user: null,
      admin: null,
      error: json({ error: profileError.message }, 500),
    };
  }

  const role = String(profile?.role ?? "").trim();

  if (!ALLOWED_ROLES.has(role)) {
    return {
      user: null,
      admin: null,
      error: json({ error: "Admin access required." }, 403),
    };
  }

  return {
    user,
    admin,
    error: null,
  };
}

export async function GET() {
  const auth = await requireAuthorizedUser();

  if (auth.error || !auth.admin) {
    return auth.error;
  }

  const { data, error } = await auth.admin
    .from("contact_history")
    .select(
      "id, contact_key, contacted_at, source, source_id, created_at",
    )
    .order("contacted_at", { ascending: false })
    .limit(5000);

  if (error) {
    return json(
      {
        error:
          error.message ||
          "Could not load persisted contact history.",
      },
      500,
    );
  }

  const rows = Array.isArray(data) ? data : [];
  const history: Record<string, string[]> = {};

  for (const row of rows) {
    const key = String(row.contact_key ?? "").trim();
    const contactedAt = String(
      row.contacted_at ?? row.created_at ?? "",
    ).trim();

    if (!key || !contactedAt) continue;

    history[key] = Array.from(
      new Set([...(history[key] ?? []), contactedAt]),
    )
      .sort(
        (a, b) =>
          new Date(b).getTime() - new Date(a).getTime(),
      )
      .slice(0, 20);

    const sourceId = String(row.source_id ?? "").trim();

    if (sourceId) {
      const stableClientKey = `contact-client-${sourceId}`;

      history[stableClientKey] = Array.from(
        new Set([
          ...(history[stableClientKey] ?? []),
          contactedAt,
        ]),
      )
        .sort(
          (a, b) =>
            new Date(b).getTime() - new Date(a).getTime(),
        )
        .slice(0, 20);
    }
  }

  return json({
    history,
    rows,
  });
}

export async function POST(request: Request) {
  const auth = await requireAuthorizedUser();

  if (auth.error || !auth.admin) {
    return auth.error;
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const contactedAt = String(
    body?.contacted_at ?? new Date().toISOString(),
  ).trim();

  const source = String(
    body?.source ?? "Customer behavior",
  ).trim();

  const sourceId = String(
    body?.source_id ?? "",
  ).trim();

  const incomingKeys = Array.isArray(body?.keys)
    ? body.keys
    : body?.contact_key
      ? [body.contact_key]
      : [];

  const keys = incomingKeys
    .map((value: unknown) => String(value ?? "").trim())
    .filter(Boolean);

  if (sourceId) {
    keys.push(`contact-client-${sourceId}`);
  }

  const uniqueKeys = Array.from(new Set(keys));

  if (uniqueKeys.length === 0) {
    return json(
      { error: "At least one contact key is required." },
      400,
    );
  }

  const rowsToInsert = uniqueKeys.map((contactKey) => ({
    contact_key: contactKey,
    contacted_at: contactedAt,
    source: source || "Customer behavior",
    source_id: sourceId || null,
  }));

  const { data, error } = await auth.admin
    .from("contact_history")
    .insert(rowsToInsert)
    .select(
      "id, contact_key, contacted_at, source, source_id, created_at",
    );

  if (error) {
    return json(
      {
        error:
          error.message ||
          "Could not save contact history.",
      },
      500,
    );
  }

  return json({
    ok: true,
    rows: data ?? [],
  });
}
