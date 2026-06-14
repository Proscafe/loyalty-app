import { NextResponse } from "next/server";

const ZAFRONIX_BASE_URL = "https://api.zafronix.com/fifa/worldcup/v1";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ZAFRONIX_WC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ZAFRONIX_WC_API_KEY is missing" },
      { status: 500 }
    );
  }

  const endpoints = [
    `${ZAFRONIX_BASE_URL}/`,
    `${ZAFRONIX_BASE_URL}/health`,
    `${ZAFRONIX_BASE_URL}/tournaments`,
    `${ZAFRONIX_BASE_URL}/tournaments/2026`,
    `${ZAFRONIX_BASE_URL}/matches?year=2026`,
    `${ZAFRONIX_BASE_URL}/matches/live?year=2026`,
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const text = await response.text();

      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        // Keep raw text if the endpoint does not return JSON.
      }

      results.push({
        endpoint,
        status: response.status,
        ok: response.ok,
        data,
      });
    } catch (error) {
      results.push({
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    baseUrl: ZAFRONIX_BASE_URL,
    checked: results.length,
    results,
  });
}
