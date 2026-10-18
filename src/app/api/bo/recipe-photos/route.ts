import { NextResponse } from "next/server";
import { requireBoAdminDb } from "@/lib/bo/api";

const BUCKET = "bo-recipe-photos";
const MAX_IDS = 100;

// Check the same exact storage paths used by the recipe photo upload/preview API.
// A root bucket listing alone can miss existing photos in some projects.
export async function POST(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const candidate = (body as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(candidate) || candidate.length > MAX_IDS) {
    return NextResponse.json({ error: `Provide up to ${MAX_IDS} menu item IDs.` }, { status: 400 });
  }
  const ids = [...new Set(candidate.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0))];
  const existing: number[] = [];
  for (let index = 0; index < ids.length; index += 10) {
    const batch = ids.slice(index, index + 10);
    const found = await Promise.all(batch.map(async (id) => {
      const { data, error } = await auth.admin!.storage.from(BUCKET).createSignedUrl(`${id}.webp`, 60);
      return !error && !!data?.signedUrl ? id : null;
    }));
    existing.push(...found.filter((id): id is number => id !== null));
  }
  return NextResponse.json({ ok: true, ids: existing }, { headers: { "Cache-Control": "no-store" } });
}

// Retain GET compatibility for older clients.
export async function GET() {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ids: number[] = [];
  const limit = 1000;
  for (let offset = 0; offset < 100000; offset += limit) {
    const { data, error } = await auth.admin.storage.from(BUCKET).list("", { limit, offset });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const entries = data ?? [];
    for (const entry of entries) {
      const match = /^(\d+)\.webp$/i.exec(entry.name);
      if (match) ids.push(Number(match[1]));
    }
    if (entries.length < limit) break;
  }
  return NextResponse.json({ ok: true, ids }, { headers: { "Cache-Control": "no-store" } });
}
