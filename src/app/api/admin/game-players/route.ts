import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("game_players_database")
    .select("*")
    .order("full_name", { ascending: true })
    .range(0, 1000);

  if (error) {
    return NextResponse.json(
      { error: error.message, players: [] },
      { status: 500 }
    );
  }

  return NextResponse.json({
    players: data ?? [],
    count: data?.length ?? 0,
  });
}