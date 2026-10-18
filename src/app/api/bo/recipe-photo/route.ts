import { NextResponse } from "next/server";
import { requireBoAdminDb } from "@/lib/bo/api";

const BUCKET = "bo-recipe-photos";
function menuId(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("item_id"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
async function authorize(request: Request) {
  const auth = await requireBoAdminDb();
  if (auth.error || !auth.admin) return { error: auth.error, admin: null, id: null };
  const id = menuId(request);
  if (id === null) return { error: NextResponse.json({ error: "Valid menu item ID required." }, { status: 400 }), admin: null, id: null };
  const { data, error } = await auth.admin.from("bo_menu_items").select("id").eq("id", id).maybeSingle();
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }), admin: null, id: null };
  if (!data) return { error: NextResponse.json({ error: "Menu item not found." }, { status: 404 }), admin: null, id: null };
  return { error: null, admin: auth.admin, id };
}
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.error || !auth.admin || !auth.id) return auth.error ?? NextResponse.json({ error: "Unable to authorize this menu item." }, { status: 401 });
  const path = `${auth.id}.webp`;
  const { data, error } = await auth.admin.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) {
    if (/not found|does not exist|object not found/i.test(error.message)) return NextResponse.json({ ok: true, url: null });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: data.signedUrl });
}
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.error || !auth.admin || !auth.id) return auth.error ?? NextResponse.json({ error: "Unable to authorize this menu item." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  if (file.type !== "image/webp" || file.size > 2_000_000 || file.size === 0) {
    return NextResponse.json({ error: "Image must be WebP under 2MB. Upload through the recipe editor to resize automatically." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await auth.admin.storage.from(BUCKET).upload(`${auth.id}.webp`, bytes, { upsert: true, contentType: "image/webp", cacheControl: "3600" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data, error: signedError } = await auth.admin.storage.from(BUCKET).createSignedUrl(`${auth.id}.webp`, 3600);
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 500 });
  return NextResponse.json({ ok: true, url: data.signedUrl });
}
export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if (auth.error || !auth.admin || !auth.id) return auth.error ?? NextResponse.json({ error: "Unable to authorize this menu item." }, { status: 401 });
  const { error } = await auth.admin.storage.from(BUCKET).remove([`${auth.id}.webp`]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
