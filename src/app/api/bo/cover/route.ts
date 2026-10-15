import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";
import { createBoEngine, loadBoSnapshot } from "@/lib/bo/costing";

export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  try {
    const snapshot = await loadBoSnapshot(supabase);
    const engine = createBoEngine(snapshot);

    const sections = snapshot.coverSections.map((section: any) => ({
      ...section,
      items: snapshot.menuItems
        .filter((item: any) => Number(item.cover_section_id) === Number(section.id) && item.active !== false)
        .sort((a: any, b: any) => Number(a.cover_sort ?? 0) - Number(b.cover_sort ?? 0))
        .map((item: any) => engine.menuCost(item)),
    }));

    const unsectioned = snapshot.menuItems
      .filter((item: any) => !item.cover_section_id && item.active !== false)
      .map((item: any) => engine.menuCost(item));

    return NextResponse.json({
      sections,
      unsectioned,
      rate: engine.rate,
      threshold: engine.threshold,
      adjustment: engine.adjustment,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to load Cover." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const body = await request.json();
  const id = Number(body?.id);
  const spUsd =
    body?.sp_usd === null || body?.sp_usd === "" ? null : Number(body?.sp_usd);

  if (!Number.isInteger(id) || id <= 0 || (spUsd !== null && !Number.isFinite(spUsd))) {
    return NextResponse.json({ error: "Invalid Cover row." }, { status: 400 });
  }

  const { data: old } = await supabase
    .from("bo_menu_items")
    .select("sp_usd")
    .eq("id", id)
    .maybeSingle();

  const { error: updateError } = await supabase
    .from("bo_menu_items")
    .update({
      sp_usd: spUsd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (old && Number(old.sp_usd ?? 0) !== Number(spUsd ?? 0)) {
    await supabase.from("bo_menu_price_history").insert({
      menu_item_id: id,
      old_sp_usd: old.sp_usd,
      new_sp_usd: spUsd,
    });
  }

  return NextResponse.json({ id, sp_usd: spUsd });
}
