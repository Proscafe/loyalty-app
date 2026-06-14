import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const date = url.searchParams.get("date") || "2026-06-13";

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.API_FOOTBALL_KEY;
  const league = process.env.API_FOOTBALL_WORLD_CUP_LEAGUE_ID || "1";
  const season = process.env.API_FOOTBALL_WORLD_CUP_SEASON || "2026";

  if (!apiKey) {
    return NextResponse.json({ error: "API_FOOTBALL_KEY is missing" }, { status: 500 });
  }

  const apiUrl = `https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}&date=${date}`;

  const response = await fetch(apiUrl, {
    headers: {
      "x-apisports-key": apiKey,
    },
    cache: "no-store",
  });

  const json = await response.json();

  return NextResponse.json({
    requested: {
      league,
      season,
      date,
      apiUrl: apiUrl.replace(apiKey, "hidden"),
    },
    apiStatus: response.status,
    errors: json.errors,
    results: json.results,
    fixtures: (json.response || []).map((item: any) => ({
      fixtureId: item.fixture?.id,
      date: item.fixture?.date,
      status: item.fixture?.status,
      home: item.teams?.home?.name,
      away: item.teams?.away?.name,
      score: item.goals,
      league: item.league,
    })),
  });
}