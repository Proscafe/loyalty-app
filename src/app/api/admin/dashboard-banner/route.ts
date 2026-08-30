import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireRole(["master_admin"]);
  const supabase = createAdminClient();

  const body = await request.json().catch(() => ({}));

  const imageUrl = String(body.image_url ?? "").trim();
  const linkUrl = String(body.link_url ?? "").trim() || null;
  const sortOrder = Math.max(0, Math.min(2, Number(body.sort_order ?? 0)));
  const isActive = body.is_active !== false;

  if (!imageUrl) {
    return NextResponse.json(
      { error: "Image is required." },
      { status: 400 },
    );
  }

  const { count } = await supabase
    .from("client_dashboard_banners")
    .select("id", { count: "exact", head: true });

  const existingId = String(body.id ?? "").trim();

  if (!existingId && (count ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Maximum 3 dashboard cards allowed." },
      { status: 400 },
    );
  }

  const payload = {
    image_url: imageUrl,
    link_url: linkUrl,
    sort_order: sortOrder,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  const query = existingId
    ? supabase
        .from("client_dashboard_banners")
        .update(payload)
        .eq("id", existingId)
        .select("*")
        .single()
    : supabase
        .from("client_dashboard_banners")
        .insert(payload)
        .select("*")
        .single();

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ banner: data });
}

export async function DELETE(request: Request) {
  await requireRole(["master_admin"]);
  const supabase = createAdminClient();

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") ?? "").trim();

  if (!id) {
    return NextResponse.json(
      { error: "Card id is required." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("client_dashboard_banners")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
