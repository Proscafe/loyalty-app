import { NextResponse } from "next/server";
import { requireBoAdminApi } from "@/lib/bo/auth";
import { createBoEngine, loadBoSnapshot } from "@/lib/bo/costing";

function n(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function GET() {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  try {
    const snapshot = await loadBoSnapshot(supabase);
    const engine = createBoEngine(snapshot);

    const rows = snapshot.utilities.map((row: any) => ({
      ...row,
      cost_per_use_lbp: engine.utilityCost(Number(row.id)),
      count_lines: snapshot.utilityCountLines.filter(
        (line: any) => Number(line.utility_id) === Number(row.id),
      ),
    }));

    return NextResponse.json({
      utilities: rows,
      ingredients: snapshot.ingredients.map((row: any) => ({
        id: row.id,
        name: row.name,
      })),
      usd_lbp_rate: engine.rate,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to load utilities." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const body = await request.json();
  const name = String(body?.name ?? "").trim();
  const mode = body?.mode === "ingredient" ? "ingredient" : "pool";

  if (!name) {
    return NextResponse.json({ error: "Utility name is required." }, { status: 400 });
  }

  const row = {
    name,
    mode,
    ingredient_id: mode === "ingredient" ? n(body?.ingredient_id) : null,
    ingredient_rate: mode === "ingredient" ? n(body?.ingredient_rate) : null,
    base_amount: mode === "pool" ? n(body?.base_amount) : null,
    base_currency: body?.base_currency === "LBP" ? "LBP" : "USD",
    divisor: n(body?.divisor),
    unit_label: String(body?.unit_label ?? "").trim() || null,
    notes: String(body?.notes ?? "").trim() || null,
  };

  const { data, error: insertError } = await supabase
    .from("bo_utilities")
    .insert(row)
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const body = await request.json();
  const id = Number(body?.id);
  const name = String(body?.name ?? "").trim();
  const mode = body?.mode === "ingredient" ? "ingredient" : "pool";

  if (!Number.isInteger(id) || id <= 0 || !name) {
    return NextResponse.json({ error: "Invalid utility." }, { status: 400 });
  }

  const row = {
    name,
    mode,
    ingredient_id: mode === "ingredient" ? n(body?.ingredient_id) : null,
    ingredient_rate: mode === "ingredient" ? n(body?.ingredient_rate) : null,
    base_amount: mode === "pool" ? n(body?.base_amount) : null,
    base_currency: body?.base_currency === "LBP" ? "LBP" : "USD",
    divisor: n(body?.divisor),
    unit_label: String(body?.unit_label ?? "").trim() || null,
    notes: String(body?.notes ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("bo_utilities")
    .update(row)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ id });
}

export async function DELETE(request: Request) {
  const { supabase, error } = await requireBoAdminApi();
  if (error) return error;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));

  const { error: deleteError } = await supabase
    .from("bo_utilities")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          deleteError.code === "23503"
            ? "This utility is used by a recipe and cannot be deleted."
            : deleteError.message,
      },
      { status: deleteError.code === "23503" ? 409 : 500 },
    );
  }

  return NextResponse.json({ deleted: id });
}
