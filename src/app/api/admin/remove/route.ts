import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RemoveStampBody = {
  client_id?: string;
  category_id?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: staffProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !staffProfile) {
    return NextResponse.json(
      { error: "Your staff profile could not be verified." },
      { status: 403 },
    );
  }

  if (
    staffProfile.is_active === false ||
    !["staff", "master_admin"].includes(String(staffProfile.role))
  ) {
    return NextResponse.json(
      { error: "Only active staff and admins can remove stamps." },
      { status: 403 },
    );
  }

  let body: RemoveStampBody;

  try {
    body = (await request.json()) as RemoveStampBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const clientId = String(body.client_id ?? "").trim();
  const categoryId = String(body.category_id ?? "").trim();

  if (!clientId || !categoryId) {
    return NextResponse.json(
      { error: "client_id and category_id are required." },
      { status: 400 },
    );
  }

  const { data: stampRow, error: stampLookupError } = await supabase
    .from("client_stamps")
    .select("id, client_id, category_id, stamp_count")
    .eq("client_id", clientId)
    .eq("category_id", categoryId)
    .maybeSingle();

  if (stampLookupError) {
    return NextResponse.json(
      { error: stampLookupError.message },
      { status: 500 },
    );
  }

  const currentCount = Math.max(0, Number(stampRow?.stamp_count ?? 0));

  if (!stampRow || currentCount <= 0) {
    return NextResponse.json(
      { error: "This customer has no stamp to remove in this category." },
      { status: 409 },
    );
  }

  const nextCount = currentCount - 1;
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("client_stamps")
    .update({
      stamp_count: nextCount,
      updated_at: now,
    })
    .eq("client_id", clientId)
    .eq("category_id", categoryId)
    .eq("stamp_count", currentCount);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("stamp_transactions")
    .insert({
      client_id: clientId,
      category_id: categoryId,
      action_type: "remove_stamp",
      stamp_count: -1,
      staff_id: user.id,
      created_at: now,
    })
    .select("*")
    .single();

  if (transactionError) {
    // Restore the original count when the audit row cannot be saved.
    await supabase
      .from("client_stamps")
      .update({
        stamp_count: currentCount,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId)
      .eq("category_id", categoryId);

    return NextResponse.json(
      { error: `Stamp removal was rolled back: ${transactionError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    stamp_count: nextCount,
    transaction,
  });
}
