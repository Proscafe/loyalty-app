import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await requireRole(["master_admin"]);

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Report id is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: deleted, error } = await supabase
    .from("internal_reports")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not delete report." },
      { status: 500 },
    );
  }

  if (!deleted) {
    return NextResponse.json(
      { error: "Report not found or could not be deleted." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, id: deleted.id });
}
