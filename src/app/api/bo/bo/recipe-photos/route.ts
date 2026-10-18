import { NextResponse } from "next/server";
import { requireBoAdminDb } from "@/lib/bo/api";

// Only list photo presence. Signed image URLs are fetched on demand through /api/bo/recipe-photo.
export async function GET() {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ids: number[] = [];
  const limit = 1000;
  for (let offset = 0; offset < 100000; offset += limit) {
    const { data, error } = await auth.admin.storage.from("bo-recipe-photos").list("", { limit, offset });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const entries = data ?? [];
    for (const entry of entries) {
      const match = /^(\d+)\.webp$/.exec(entry.name);
      if (match) ids.push(Number(match[1]));
    }
    if (entries.length < limit) break;
  }
  return NextResponse.json({ ok: true, ids }, { headers: { "Cache-Control": "no-store" } });
}
