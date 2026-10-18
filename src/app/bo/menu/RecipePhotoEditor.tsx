"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = { menuItemId: number | null };

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image.");
  if (file.size > 20_000_000) throw new Error("Original photo is too large (maximum 20MB).");
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("Cannot read this image.")); });
    const limit = 1200;
    const scale = Math.min(1, limit / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image processing is unavailable in this browser.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let blob: Blob | null = null;
    for (let i = 0; i < 5; i++) {
      blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size <= 2_000_000) break;
      quality -= 0.14;
    }
    if (!blob || blob.type !== "image/webp" || blob.size > 2_000_000) throw new Error("Could not compress this image under 2MB.");
    return new File([blob], "recipe.webp", { type: "image/webp" });
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function RecipePhotoEditor({ menuItemId }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const savedId = Number(menuItemId) || null;
  const reload = useCallback(async () => {
    if (!savedId) { setUrl(null); return; }
    const res = await fetch(`/api/bo/recipe-photo?item_id=${savedId}`, { cache: "no-store" });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Could not load photo.");
    setUrl(result.url || null);
  }, [savedId]);
  useEffect(() => { setUrl(null); setError(""); setMessage(""); void reload().catch(e => setError(e instanceof Error ? e.message : "Photo unavailable.")); }, [reload]);
  const upload = useCallback(async (file: File) => {
    if (!savedId || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const resized = await compressImage(file);
      const body = new FormData(); body.append("photo", resized);
      const response = await fetch(`/api/bo/recipe-photo?item_id=${savedId}`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Photo upload failed.");
      setUrl(result.url || null); setMessage("Photo saved. Automatically resized to fit.");
    } catch (e) { setError(e instanceof Error ? e.message : "Photo upload failed."); }
    finally { setBusy(false); }
  }, [savedId, busy]);
  useEffect(() => {
    if (!savedId) return;
    const onPaste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.items ?? []).find(item => item.type.startsWith("image/"));
      const file = image?.getAsFile();
      if (file) { event.preventDefault(); void upload(file); }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [savedId, upload]);
  const remove = async () => {
    if (!savedId || !window.confirm("Remove this recipe photo?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/bo/recipe-photo?item_id=${savedId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not remove photo.");
      setUrl(null); setMessage("Photo removed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to remove photo."); }
    finally { setBusy(false); }
  };
  return <aside className="min-w-0 rounded-xl border border-black/10 bg-gray-50 p-2.5" aria-label="Recipe photo">
    <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#444]">Recipe Photo</div>
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const file = Array.from(e.dataTransfer.files).find(x => x.type.startsWith("image/")); if (file) void upload(file); }}
      className="relative mx-auto aspect-square w-full max-w-[322px] overflow-hidden rounded-xl border border-dashed border-black/20 bg-white"
      title="Drop an image here or use Upload Photo"
    >
      {url ? <img src={url} alt="Recipe photo" className="h-full w-full object-cover" />
        : <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-[11px] text-black/50">
            <span className="text-2xl" aria-hidden="true">＋</span>
            <span>{savedId ? "Drop or paste a photo" : "Save recipe to add photo"}</span>
          </div>}
    </div>
    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
    {savedId ? <>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="min-h-9 flex-1 rounded-lg bg-black px-2 py-2 text-[10px] font-bold text-white disabled:opacity-40">{busy ? "WORKING..." : "UPLOAD"}</button>
        {url && <button type="button" disabled={busy} onClick={() => void remove()} className="min-h-9 rounded-lg border border-red-200 bg-white px-2 py-2 text-[10px] font-bold text-red-700">REMOVE</button>}
      </div>
      <p className="mt-1.5 text-[10px] leading-4 text-black/50">Ctrl+V to paste · Auto-resized</p>
    </> : <p className="mt-2 text-[10px] leading-4 text-black/50">Save and reopen to upload a photo.</p>}
    {error && <p role="alert" className="mt-2 break-words text-[10px] font-bold text-red-700">{error}</p>}
    {message && <p role="status" className="mt-2 break-words text-[10px] font-bold text-green-700">{message}</p>}
  </aside>;
}
