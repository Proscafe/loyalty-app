import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ScoreRow = {
  user_id: string;
  first_name: string;
  best_score: number;
  position: number;
  is_me: boolean;
};

async function getSession() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

export async function GET() {
  const { supabase, user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("santa_game_rankings");
  if (error) return NextResponse.json({ error: "Leaderboard unavailable. Run the supplied SQL setup." }, { status: 503 });
  const rows = (data || []) as ScoreRow[];
  const me = rows.find(row => row.is_me);
  return NextResponse.json({
    top: rows.filter(row => row.position <= 10).map(row => ({
      firstName: row.first_name, bestScore: row.best_score,
      position: row.position, isMe: row.is_me,
    })),
    myBest: me?.best_score ?? 0,
    myRank: me?.position ?? null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { supabase, user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const score = (payload as { score?: unknown } | null)?.score;
  if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > 5000) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }
  const { error } = await supabase.rpc("save_santa_game_score", { p_score: score });
  if (error) return NextResponse.json({ error: "Score could not be saved" }, { status: 503 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
