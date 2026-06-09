import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdmin() {
  const supabase = await createClient();
  const admin = getAdminClient();
  if (!admin) return { admin: null as any, error: jsonError("Admin client not configured.", 500) };

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { admin: null as any, error: jsonError("Not authenticated.", 401) };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "master_admin")
    return { admin: null as any, error: jsonError("Admin access required.", 403) };

  return { admin, error: null };
}

// Returns a YYYY-MM-DD key for grouping visits by day (Beirut UTC+3)
function visitDayKey(isoString: string | null): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  // Shift to Beirut time (+3h) for day grouping
  const beirut = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return `${beirut.getUTCFullYear()}-${String(beirut.getUTCMonth() + 1).padStart(2, "0")}-${String(beirut.getUTCDate()).padStart(2, "0")}`;
}

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const [
    profilesResult,
    stampsResult,
    txnsResult,
    rewardsResult,
    categoriesResult,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, phone, client_code, role, is_active, gender, birthday, created_at")
      .order("created_at", { ascending: false }),

    admin
      .from("client_stamps")
      .select("id, client_id, category_id, stamp_count, updated_at"),

    admin
      .from("stamp_transactions")
      .select("id, client_id, category_id, action_type, stamp_count, created_at")
      .neq("action_type", "manual_adjustment")
      .order("created_at", { ascending: false })
      .limit(10000),

    admin
      .from("rewards")
      .select("id, client_id, category_id, reward_type, status, earned_at, redeemed_at, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),

    admin
      .from("loyalty_categories")
      .select("id, name, average_price, sort_order")
      .order("sort_order", { ascending: true }),
  ]);

  if (profilesResult.error) return jsonError(profilesResult.error.message);

  const profiles  = profilesResult.data ?? [];
  const stamps    = stampsResult.data ?? [];
  const txns      = txnsResult.data ?? [];
  const rewards   = rewardsResult.data ?? [];
  const categories = categoriesResult.data ?? [];

  // Category price map
  const priceByCategory = new Map<string, number>();
  for (const cat of categories) {
    if (cat.average_price) priceByCategory.set(cat.id, Number(cat.average_price));
  }

  // Per-user stamp counts
  const stampsByUser = new Map<string, { category_id: string; stamp_count: number }[]>();
  for (const s of stamps as any[]) {
    if (!s.client_id) continue;
    const arr = stampsByUser.get(s.client_id) ?? [];
    arr.push({ category_id: s.category_id, stamp_count: s.stamp_count ?? 0 });
    stampsByUser.set(s.client_id, arr);
  }

  // Per-user: unique visit days, last visit, transaction count
  const visitDaysByUser   = new Map<string, Set<string>>();
  const lastVisitByUser   = new Map<string, string>();
  const lifetimeByUser    = new Map<string, number>();

  for (const txn of txns as any[]) {
    if (!txn.client_id) continue;

    // Visit day
    const dayKey = visitDayKey(txn.created_at);
    if (dayKey) {
      if (!visitDaysByUser.has(txn.client_id)) visitDaysByUser.set(txn.client_id, new Set());
      visitDaysByUser.get(txn.client_id)!.add(dayKey);
    }

    // Last visit
    const existing = lastVisitByUser.get(txn.client_id);
    if (!existing || txn.created_at > existing) lastVisitByUser.set(txn.client_id, txn.created_at);

    // Lifetime value
    if (txn.action_type === "add_stamp") {
      const price = priceByCategory.get(txn.category_id ?? "") ?? 0;
      lifetimeByUser.set(txn.client_id, (lifetimeByUser.get(txn.client_id) ?? 0) + price);
    }
  }

  // Per-user gift/reward count
  const rewardsByUser = new Map<string, number>();
  for (const r of rewards as any[]) {
    if (!r.client_id) continue;
    rewardsByUser.set(r.client_id, (rewardsByUser.get(r.client_id) ?? 0) + 1);
  }

  const enriched = (profiles as any[]).map((p) => {
    const visitDays   = visitDaysByUser.get(p.id)?.size ?? 0;
    const lastVisit   = lastVisitByUser.get(p.id) ?? null;
    const daysSinceLastVisit = lastVisit
      ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000)
      : null;

    return {
      ...p,
      stamps:              stampsByUser.get(p.id) ?? [],
      totalVisits:         visitDays,           // unique visit days
      lastVisit,
      daysSinceLastVisit,
      giftsCount:          rewardsByUser.get(p.id) ?? 0,
      lifetimeValue:       lifetimeByUser.get(p.id) ?? 0,
    };
  });

  return NextResponse.json({
    users:        enriched,
    categories,
    recentTxns:   (txns as any[]).slice(0, 2000),
    recentRewards: (rewards as any[]).slice(0, 500),
  });
}

export async function PATCH(req: Request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({})) as {
    user_id?: string;
    action?: "set_role" | "deactivate" | "reactivate" | "set_gender";
    role?: string;
    gender?: string;
  };

  const userId = String(body.user_id ?? "").trim();
  if (!userId) return jsonError("user_id is required.");

  if (body.action === "set_role") {
    const role = body.role;
    if (!["client", "staff", "master_admin"].includes(role ?? "")) return jsonError("Invalid role.");
    const { error: e } = await admin.from("profiles").update({ role }).eq("id", userId);
    if (e) return jsonError(e.message);
    return NextResponse.json({ success: true });
  }

  if (body.action === "deactivate") {
    const { error: e } = await admin.from("profiles").update({ is_active: false }).eq("id", userId);
    if (e) return jsonError(e.message);
    return NextResponse.json({ success: true });
  }

  if (body.action === "reactivate") {
    const role = body.role ?? "client";
    const { error: e } = await admin.from("profiles").update({ is_active: true, role }).eq("id", userId);
    if (e) return jsonError(e.message);
    return NextResponse.json({ success: true });
  }

  if (body.action === "set_gender") {
    const { error: e } = await admin.from("profiles").update({ gender: body.gender ?? null }).eq("id", userId);
    if (e) return jsonError(e.message);
    return NextResponse.json({ success: true });
  }

  return jsonError("Unknown action.");
}
