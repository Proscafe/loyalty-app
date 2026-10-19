"use client";

/** PRO'S BO recipe card PDF (different from the production batch export in Settings). */
type Row = Record<string, any>;
type Lookup = { ingredients: Row[]; utilities: Row[]; allRecipes: Row[]; rate: number; menuItemId?: number | null; displayName?: string; categoryName?: string };

type PdfImage = { bytes: Uint8Array; width: number; height: number };
const ascii = (value: unknown) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?");
const escapePdf = (value: unknown) => ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const num = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? String(+n.toFixed(4)) : "—"; };

async function imageAsJpeg(url: string, maximum = 1100): Promise<PdfImage | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    try {
      const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d"); if (!context) return null;
      context.fillStyle = "#fff"; context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.83));
      return jpeg ? { bytes: new Uint8Array(await jpeg.arrayBuffer()), width, height } : null;
    } finally { bitmap.close(); }
  } catch { return null; }
}

export async function downloadProductionRecipePdf(recipe: Row, lookup: Lookup): Promise<void> {
  const itemId = Number(lookup.menuItemId);
  // Resolve linked menu recipe names using the latest menu items rather than
  // stale imported names on bo_recipes or bo_recipe_lines.
  const menuNameByRecipe = new Map<string, string[]>();
  let resolvedCategory = String(lookup.categoryName ?? "").trim();
  try {
    const response = await fetch("/api/bo/menu", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      const items: Row[] = Array.isArray(data.items) ? data.items : Array.isArray(data.menuItems) ? data.menuItems : [];
      const categories: Row[] = Array.isArray(data.categories) ? data.categories : [];
      const currentItem = items.find((item: Row) => String(item.id) === String(lookup.menuItemId));
      const matchingCategory = categories.find((category: Row) =>
        String(category.id) === String(currentItem?.menu_category_id ?? "")
      );
      if (matchingCategory?.name) resolvedCategory = String(matchingCategory.name).trim();
      for (const item of items) {
        if (item.recipe_id == null || !String(item.name ?? "").trim()) continue;
        const key = String(item.recipe_id);
        menuNameByRecipe.set(key, [...(menuNameByRecipe.get(key) ?? []), String(item.name).trim()]);
      }
    }
  } catch { /* Continue with the supplied labels if the menu lookup fails. */ }
  const currentMenuName = (id: unknown, fallback: string) => {
    const names = menuNameByRecipe.get(String(id)) ?? [];
    return names.length === 1 ? names[0] : fallback;
  };
  const photo = Number.isSafeInteger(itemId) && itemId > 0
    ? await (async () => {
      try {
        const res = await fetch(`/api/bo/recipe-photo?item_id=${itemId}`, { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data.url === "string" && data.url ? imageAsJpeg(data.url) : null;
      } catch { return null; }
    })()
    : null;
  const logo = await imageAsJpeg("/icon.png", 350);
  const ingredients: { item: string; qty: string; unit: string }[] = [];
  // Display kilograms in grams for kitchen-friendly recipe PDFs.
  // Conversion affects PDF display only; stored ingredient quantities/costing stay unchanged.
  const displayQuantity = (rawQty: unknown, rawUnit: string) => {
    const unit = rawUnit.trim();
    if (/^(kg|kilogram|kilograms|kgs)$/i.test(unit)) {
      const n = Number(rawQty);
      if (rawQty !== null && rawQty !== undefined && String(rawQty).trim() !== "" && Number.isFinite(n)) {
        return { qty: num(n * 1000), unit: "g" };
      }
    }
    return { qty: num(rawQty), unit };
  };
  for (const line of recipe.lines ?? []) {
    const type = String(line.line_type ?? "ingredient");
    const source = type === "ingredient" ? lookup.ingredients.find(x => String(x.id) === String(line.ingredient_id))
      : type === "recipe" ? lookup.allRecipes.find(x => String(x.id) === String(line.sub_recipe_id))
      : type === "utility" ? lookup.utilities.find(x => String(x.id) === String(line.utility_id)) : null;
    const item = type === "recipe" ? currentMenuName(line.sub_recipe_id, String(source?.name || line.sourceName || line.label || "Unresolved item")) : String(source?.name || line.sourceName || line.label || (type === "fixed" ? "Fixed cost" : "Unresolved item"));
    const unit = type === "ingredient" ? String(source?.consumption_unit || source?.purchase_unit || "")
      : type === "recipe" ? String(source?.yield_unit || "") : type === "utility" ? String(source?.unit_label || "") : "";
    const displayed = displayQuantity(line.qty, unit);
    const row = { item, qty: displayed.qty, unit: displayed.unit };
    // Individual recipe PDF lists ingredients and linked prep/sauces only.
    if (type === "ingredient" || type === "recipe") ingredients.push(row);
  }

  const encoder = new TextEncoder();
  const textBytes = (s: string) => encoder.encode(s);
  const concat = (parts: Uint8Array[]): Uint8Array => {
    const size = parts.reduce((n, p) => n + p.length, 0);
    const output = new Uint8Array(size); let at = 0;
    for (const part of parts) { output.set(part, at); at += part.length; }
    return output;
  };
  const objects: Uint8Array[] = [];
  const add = (value: string | Uint8Array) => { objects.push(typeof value === "string" ? textBytes(value) : value); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const regularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const imageObject = (data: PdfImage | null) => data ? add(concat([
    textBytes(`<< /Type /XObject /Subtype /Image /Width ${data.width} /Height ${data.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.bytes.length} >>\nstream\n`),
    data.bytes, textBytes("\nendstream")
  ])) : 0;
  const logoId = imageObject(logo);
  const photoId = imageObject(photo);
  const pageIds: number[] = [];
  const W = 595, H = 842, L = 42, R = 553;
  let commands: string[] = []; let y = 750; let pageNumber = 0; let contentStart = 0;
  const color = (r: number, g: number, b: number) => `${r} ${g} ${b} rg`;
  const rect = (x: number, yy: number, w: number, h: number, rgb = "0.96 0.96 0.96") => commands.push(`${rgb} rg ${x} ${yy} ${w} ${h} re f`);
  const line = (yy: number) => commands.push(`0.86 G 0.6 w ${L} ${yy} m ${R} ${yy} l S`);
  const text = (x: number, yy: number, value: unknown, size = 10, weight: "normal" | "bold" = "normal", rgb = "0.1 0.1 0.1") =>
    commands.push(`${rgb} rg BT /F${weight === "bold" ? "B" : "R"} ${size} Tf 1 0 0 1 ${x} ${yy} Tm (${escapePdf(value)}) Tj ET`);
  const image = (id: number, imageData: PdfImage | null, x: number, yy: number, w: number, h: number) => {
    if (!id || !imageData) return;
    const scale = Math.min(w / imageData.width, h / imageData.height);
    const iw = imageData.width * scale, ih = imageData.height * scale;
    commands.push(`q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${(x + (w - iw)/2).toFixed(2)} ${(yy + (h - ih)/2).toFixed(2)} cm /${id === logoId ? "Logo" : "Photo"} Do Q`);
  };
  const pageStart = () => {
    pageNumber++;
    rect(0, H - 8, W, 8, "0.06 0.06 0.06");
    if (logoId) image(logoId, logo, L, 755, 55, 55);
    text(logoId ? 110 : L, 797, "PRO'S CAFE", 14, "bold");
    text(logoId ? 110 : L, 782, "RECIPE CARD", 9, "bold", "0.45 0.45 0.45");
    text(505, 788, `PAGE ${pageNumber}`, 8, "normal", "0.45 0.45 0.45");
    line(741); y = 715; contentStart = commands.length;
  };
  const pageEnd = () => {
    // Fit the full recipe on one A4 sheet, keeping header/footer fixed.
    const top = 715;
    const scale = Math.min(1, (top - 86) / Math.max(1, top - y));
    if (scale < 1) {
      commands.splice(contentStart, 0, `q ${scale.toFixed(5)} 0 0 ${scale.toFixed(5)} ${(L * (1 - scale)).toFixed(3)} ${(top * (1 - scale)).toFixed(3)} cm`);
      commands.push("Q");
    }
    line(53);
    commands.push(`0.43 0.43 0.43 rg BT /FR 8 Tf 1 0 0 1 ${L} 35 Tm (\\251 2026) Tj ET`);
    text(102, 35, "proscafe.net", 9, "bold", "0.16 0.31 0.49");
    const stream = textBytes(commands.join("\n") + "\n");
    const contentId = add(concat([textBytes(`<< /Length ${stream.length} >>\nstream\n`), stream, textBytes("endstream") ]));
    const linkId = add('<< /Type /Annot /Subtype /Link /Rect [99 28 204 47] /Border [0 0 0] /A << /S /URI /URI (https://proscafe.net) >> >>');
    const resources = `<< /Font << /FR ${regularId} 0 R /FB ${boldId} 0 R >> /XObject << ${logoId ? `/Logo ${logoId} 0 R` : ""} ${photoId ? `/Photo ${photoId} 0 R` : ""} >> >>`;
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${resources} /Annots [${linkId} 0 R] /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId); commands = [];
  };
  const ensure = (_height: number) => { /* fitted on one page at pageEnd */ };
  const section = (title: string, rows: typeof ingredients) => {
    ensure(65);
    rect(L, y - 11, R - L, 30, "0.91 0.91 0.91");
    text(L + 12, y, title, 11, "bold"); y -= 35;
    text(L + 12, y, "ITEM", 8, "bold", "0.35 0.35 0.35");
    text(425, y, "QTY", 8, "bold", "0.35 0.35 0.35");
    text(500, y, "UNIT", 8, "bold", "0.35 0.35 0.35"); y -= 13; line(y); y -= 16;
    if (!rows.length) { text(L + 12, y, "No items", 9, "normal", "0.5 0.5 0.5"); y -= 28; }
    for (let i = 0; i < rows.length; i++) {
      ensure(33);
      if (i % 2 === 0) rect(L, y - 9, R - L, 29, "0.975 0.975 0.975");
      const row = rows[i];
      const name = ascii(row.item);
      text(L + 12, y, name.slice(0, 56), 9, "bold");
      text(425, y, row.qty, 9);
      text(500, y, row.unit.slice(0, 10), 8);
      y -= 29;
    }
    y -= 17;
  };
  pageStart();
  const name = currentMenuName(recipe.id, String(lookup.displayName || recipe.name || "Recipe"));
  text(L, y, ascii(resolvedCategory || "UNCATEGORIZED").toUpperCase().slice(0, 65), 9, "bold", "0.45 0.45 0.45"); y -= 30;
  text(L, y, ascii(name).slice(0, 55), 22, "bold"); y -= 27;
  text(L, y, "RECIPE DETAILS", 9, "bold", "0.48 0.48 0.48"); y -= 22;
  if (photoId) {
    ensure(205);
    rect(L, y - 175, R - L, 190, "0.96 0.96 0.96");
    image(photoId, photo, L + 8, y - 166, R - L - 16, 172);
    y -= 205;
  }
  section("INGREDIENTS", ingredients);
  if (String(recipe.notes || "").trim()) {
    ensure(72);
    rect(L, y - 9, R - L, 26, "0.91 0.91 0.91"); text(L + 12, y, "RECIPE NOTES", 10, "bold"); y -= 32;
    const words = ascii(recipe.notes).split(/\s+/); let row = "";
    for (const word of words) {
      if ((row + " " + word).length > 92) { ensure(16); text(L + 10, y, row, 9); y -= 16; row = word; }
      else row = row ? `${row} ${word}` : word;
    }
    if (row) { ensure(16); text(L + 10, y, row, 9); y -= 16; }
  }
  pageEnd();
  objects[catalogId - 1] = textBytes(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects[pagesId - 1] = textBytes(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] >>`);
  const parts: Uint8Array[] = [textBytes("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets: number[] = [0]; let offset = parts[0].length;
  objects.forEach((data, index) => {
    offsets.push(offset);
    const bytes = concat([textBytes(`${index + 1} 0 obj\n`), data, textBytes("\nendobj\n")]);
    parts.push(bytes); offset += bytes.length;
  });
  const xref = offset;
  parts.push(textBytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  for (const pos of offsets.slice(1)) parts.push(textBytes(`${String(pos).padStart(10, "0")} 00000 n \n`));
  parts.push(textBytes(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`));
  const blob = new Blob([concat(parts) as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `recipe-${ascii(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}
