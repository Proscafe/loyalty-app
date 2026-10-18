"use client";

/** Bulk MENU recipe cards. Separate from the Settings Production PDF export. */
type Row = Record<string, any>;
export type MenuRecipeReport = { recipes: Row[]; all_recipes?: Row[]; ingredients: Row[]; utilities?: Row[]; items: Row[]; rate: number; categories?: Row[] };
type Photo = { data: Uint8Array; width: number; height: number };
const plain = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?");
const pdfText = (v: unknown) => plain(v).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const numberText = (v: unknown) => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? "-" : String(+Number(v).toFixed(3));
const inUsd = (lbp: unknown, rate: number) => lbp === null || lbp === undefined || lbp === "" || !Number.isFinite(Number(lbp)) || rate <= 0 ? "-" : "$" + (Number(lbp) / rate).toFixed(2);
const get = (rows: Row[], id: unknown) => rows.find(r => String(r.id) === String(id));
async function jpeg(source: string, maxDim = 1000): Promise<Photo | null> {
  try {
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d"); if (!ctx) return null;
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, width, height); ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
      return blob ? { data: new Uint8Array(await blob.arrayBuffer()), width, height } : null;
    } finally { bitmap.close(); }
  } catch { return null; }
}
const kitchenQty = (raw: unknown, unitRaw: string) => {
  if (/^(kg|kgs|kilogram|kilograms)$/i.test(unitRaw.trim()) && raw !== "" && raw !== null && raw !== undefined && Number.isFinite(Number(raw))) {
    return { qty: numberText(Number(raw) * 1000), unit: "g" };
  }
  return { qty: numberText(raw), unit: unitRaw };
};

export async function downloadAllMenuRecipesPdf(input: MenuRecipeReport, includePrices: boolean, mode: "menu" | "production" = "menu", selectedCategoryIds?: number[]): Promise<void> {
  const recipes = input.recipes ?? [];
  const items: Row[] = (mode === "production" ? recipes.filter(r => r.kind === "prep" || r.kind === "sauce").map(r => ({ id: null, recipe_id: r.id, name: r.name })) : [...(input.items ?? [])].filter(item => item.active === true && item.recipe_id != null && item.recipe_id !== ""))
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base", numeric: true }));
  if (mode === "menu" && selectedCategoryIds) {
    const chosen = new Set(selectedCategoryIds.map(String));
    for (let i = items.length - 1; i >= 0; i--) {
      if (!chosen.has(String(items[i].menu_category_id ?? ""))) items.splice(i, 1);
    }
  }
  if (!items.length) throw new Error(mode === "production" ? "There are no saved Prep/Sauce recipes to export." : "There are no menu items linked to recipes to export.");
  const rate = Number(input.rate) || 0;
  if (includePrices && rate <= 0) throw new Error("Set the USD/LBP exchange rate in Settings before downloading priced PDFs.");
  const logo = await jpeg("/icon.png", 360);
  const enc = new TextEncoder(); const bytes = (s: string) => enc.encode(s);
  const join = (arr: Uint8Array[]) => { const out = new Uint8Array(arr.reduce((t, p) => t + p.length, 0)); let n = 0; for (const part of arr) { out.set(part, n); n += part.length; } return out; };
  const objects: Uint8Array[] = []; const add = (value: string | Uint8Array) => (objects.push(typeof value === "string" ? bytes(value) : value), objects.length);
  const catalog = add(""); const pagesRoot = add("");
  const fontNormal = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const photoObj = (p: Photo | null) => p ? add(join([bytes(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>\nstream\n`), p.data, bytes("\nendstream")])) : 0;
  const logoId = photoObj(logo);
  const pageIds: number[] = []; const W = 595; const H = 842; const L = 42; const R = 553;
  let commands: string[] = []; let y = 0; let page = 0; let currentPhoto = 0; let currentPhotoData: Photo | null = null; let contentStart = 0;
  const ink = "0.11 0.11 0.11";
  const text = (x: number, yy: number, s: unknown, size = 9, bold = false, color = ink) => commands.push(`${color} rg BT /${bold ? "FB" : "FR"} ${size} Tf 1 0 0 1 ${x} ${yy} Tm (${pdfText(s)}) Tj ET`);
  const box = (x: number, yy: number, w: number, h: number, shade = "0.95 0.95 0.95") => commands.push(`${shade} rg ${x} ${yy} ${w} ${h} re f`);
  const rule = (yy: number) => commands.push(`0.85 G 0.65 w ${L} ${yy} m ${R} ${yy} l S`);
  const drawPhoto = (id: number, p: Photo | null, x: number, yy: number, w: number, h: number, resource: string) => {
    if (!id || !p) return;
    const scale = Math.min(w / p.width, h / p.height), dw = p.width * scale, dh = p.height * scale;
    commands.push(`q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${(x + (w - dw) / 2).toFixed(2)} ${(yy + (h - dh) / 2).toFixed(2)} cm /${resource} Do Q`);
  };
  const beginPage = () => {
    page++; commands = []; box(0, H - 8, W, 8, "0.06 0.06 0.06");
    drawPhoto(logoId, logo, L, 755, 55, 55, "Logo");
    text(logoId ? 110 : L, 797, "PRO'S CAFE", 14, true); text(logoId ? 110 : L, 782, "RECIPE CARD", 9, true, "0.45 0.45 0.45");
    text(495, 788, `PAGE ${page}`, 8, false, "0.45 0.45 0.45"); rule(741); y = 710; contentStart = commands.length;
  };
  const finishPage = () => {
    // Keep each recipe on one A4 page. Scale only the recipe body, not the
    // branded header or clickable footer. No automatic page breaks.
    const top = 710;
    const bodyHeight = Math.max(1, top - y);
    const scale = Math.min(1, (top - 86) / bodyHeight);
    if (scale < 1) {
      commands.splice(contentStart, 0, `q ${scale.toFixed(5)} 0 0 ${scale.toFixed(5)} ${(L * (1 - scale)).toFixed(3)} ${(top * (1 - scale)).toFixed(3)} cm`);
      commands.push("Q");
    }
    rule(53); commands.push(`0.43 0.43 0.43 rg BT /FR 9 Tf 1 0 0 1 ${L} 35 Tm (\\251 2026) Tj ET`);
    text(102, 35, "wissamdesigns.com", 9, true, "0.16 0.31 0.49");
    const stream = bytes(commands.join("\n") + "\n");
    const contentId = add(join([bytes(`<< /Length ${stream.length} >>\nstream\n`), stream, bytes("endstream")]));
    const linkId = add("<< /Type /Annot /Subtype /Link /Rect [99 28 204 47] /Border [0 0 0] /A << /S /URI /URI (https://wissamdesigns.com) >> >>");
    const resources = `<< /Font << /FR ${fontNormal} 0 R /FB ${fontBold} 0 R >> /XObject << ${logoId ? `/Logo ${logoId} 0 R` : ""} ${currentPhoto ? `/Photo ${currentPhoto} 0 R` : ""} >> >>`;
    pageIds.push(add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${resources} /Annots [${linkId} 0 R] /Contents ${contentId} 0 R >>`));
  };
  const ensure = (_needed: number) => { /* recipe body fitted to a single page in finishPage */ };

  let count = 0;
  for (const item of items) {
    const recipe = get(recipes, item.recipe_id);
    if (!recipe) continue;
    if (count) finishPage();
    count++; currentPhoto = 0; currentPhotoData = null;
    try {
      if (item.id != null) {
      const res = await fetch(`/api/bo/recipe-photo?item_id=${encodeURIComponent(String(item.id))}`, { cache: "no-store" });
      if (res.ok) { const result = await res.json(); if (typeof result.url === "string" && result.url) currentPhotoData = await jpeg(result.url, 900); }
      }
    } catch { /* A missing photo must not prevent the export. */ }
    currentPhoto = photoObj(currentPhotoData);
    beginPage();
    const category = mode === "menu" ? get(input.categories ?? [], item.menu_category_id) : null;
    const categoryLabel = mode === "menu" ? String(category?.name ?? "UNCATEGORIZED") : String(recipe.kind ?? "PRODUCTION").toUpperCase();
    text(L, y, categoryLabel.toUpperCase().slice(0, 65), 9, true, "0.42 0.42 0.42"); y -= 27;
    text(L, y, String(item.name || recipe.name || "Recipe").slice(0, 52), 21, true); y -= 30;
    if (mode === "production") { text(L, y, `${String(recipe.kind).toUpperCase()}  ·  YIELD: ${numberText(recipe.yield_qty)} ${String(recipe.yield_unit ?? "")}`, 9, true, "0.4 0.4 0.4"); y -= 24; }
    if (currentPhoto) {
      ensure(200); box(L, y - 173, R - L, 187, "0.96 0.96 0.96");
      drawPhoto(currentPhoto, currentPhotoData, L + 8, y - 164, R - L - 16, 168, "Photo"); y -= 205;
    }
    if (includePrices && mode === "menu") {
      ensure(78);
      const rateSafe = rate > 0 ? rate : 1;
      const sell = Number(item.sp_usd ?? 0);
      const costLb = Number(item.cost_lbp ?? 0);
      const utilityKnown = item.utility_cost_lbp ?? item.utility_lbp;
      // The menu API does not always return a utility subtotal. Calculate it
      // from saved utility/fixed lines when absent, avoiding a fake dash.
      const savedUtilityLines = (recipe.lines ?? []).filter((line: Row) => line.line_type === "utility" || line.line_type === "fixed");
      const utilityFallback = savedUtilityLines.reduce((sum: number, line: Row) => {
        if (line.line_type === "utility") {
          const utility = get(input.utilities ?? [], line.utility_id);
          const lineCost = line.lineCost ?? (utility?.unit_cost_lbp != null ? Number(utility.unit_cost_lbp) * Number(line.qty ?? 0) : null);
          return sum + (lineCost == null || !Number.isFinite(Number(lineCost)) ? 0 : Number(lineCost));
        }
        const fixedValue = Number(line.fixed_price ?? 0);
        const amount = String(line.fixed_currency).toUpperCase() === "USD" ? fixedValue * rateSafe : fixedValue;
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      const utilityLb = utilityKnown != null && Number.isFinite(Number(utilityKnown)) ? Number(utilityKnown) : utilityFallback;
      const profitLb = Number(item.gross_profit_lbp ?? (sell * rateSafe - costLb));
      const costPct = sell > 0 ? (Number.isFinite(Number(item.food_cost_pct)) ? Number(item.food_cost_pct) * 100 : 100 * costLb / (sell * rateSafe)) : 0;
      const margin = sell > 0 ? 100 * profitLb / (sell * rateSafe) : 0;
      const stats = [
        ["SELLING PRICE", "$" + sell.toFixed(2)], ["TOTAL COST", "$" + (costLb / rateSafe).toFixed(2)],
        ["UTILITY COST", utilityLb == null ? "-" : "$" + (utilityLb / rateSafe).toFixed(2)], ["FOOD COST %", costPct.toFixed(1) + "%"],
        ["NET PROFIT", "$" + (profitLb / rateSafe).toFixed(2)], ["MARGIN %", margin.toFixed(1) + "%"],
      ];
      const gap = 5, cardW = ((R - L) - gap * 5) / 6;
      stats.forEach(([label, value], i) => {
        const x = L + i * (cardW + gap);
        box(x, y - 43, cardW, 54, "0.94 0.94 0.94");
        text(x + 5, y - 5, label, 6.2, true, "0.34 0.34 0.34");
        const ratio = label === "FOOD COST %" ? costPct : label === "MARGIN %" ? 100 - margin : null;
        const valueColor = ratio == null ? ink : ratio <= 30 ? "0.04 0.48 0.30" : ratio <= 35 ? "0.70 0.39 0.04" : "0.72 0.13 0.13";
        text(x + 5, y - 26, value, 10.1, true, valueColor);
      });
      y -= 69;
    }
    const rows: { name: string; qty: string; unit: string; cost: string }[] = [];
    const utilityRows: { name: string; qty: string; unit: string; cost: string }[] = [];
    for (const line of recipe.lines ?? []) {
      const type = String(line.line_type ?? "");
      if (type !== "ingredient" && type !== "recipe" && !(includePrices && (type === "utility" || type === "fixed"))) continue;
      const source = type === "ingredient" ? get(input.ingredients ?? [], line.ingredient_id) : type === "recipe" ? get(input.all_recipes ?? recipes, line.sub_recipe_id) : type === "utility" ? get(input.utilities ?? [], line.utility_id) : null;
      const unit = String(type === "ingredient" ? (source?.consumption_unit ?? source?.purchase_unit ?? line.sourceUnit ?? "") : type === "recipe" ? (source?.yield_unit ?? line.sourceUnit ?? "") : type === "utility" ? (source?.unit_label ?? line.sourceUnit ?? "") : (line.fixed_currency ?? ""));
      const quantity = kitchenQty(line.qty, unit);
      const unitCost = type === "ingredient" ? source?.unit_cost_lbp : type === "recipe" ? (source?.ingredient_unit_cost_lbp ?? source?.unit_cost_lbp) : type === "utility" ? source?.unit_cost_lbp : null;
      const calculated = unitCost == null ? null : Number(unitCost) * Number(line.qty);
      const target = type === "utility" || type === "fixed" ? utilityRows : rows;
      target.push({ name: String(source?.name ?? line.sourceName ?? line.label ?? (type === "fixed" ? "Fixed cost" : "Unresolved item")), qty: quantity.qty, unit: quantity.unit,
        cost: type === "fixed" && line.fixed_currency === "USD" && line.lineCost == null
          ? (Number.isFinite(Number(line.fixed_price)) ? "$" + Number(line.fixed_price).toFixed(2) : "-")
          : inUsd(line.lineCost ?? calculated ?? (type === "fixed" ? line.fixed_price : null), rate) });
    }
    ensure(70); box(L, y - 10, R - L, 30, "0.91 0.91 0.91"); text(L + 12, y, "INGREDIENTS", 11, true); y -= 35;
    text(L + 12, y, "ITEM", 8, true); text(includePrices ? 367 : 425, y, "QTY", 8, true);
    text(includePrices ? 430 : 500, y, "UNIT", 8, true); if (includePrices) text(497, y, "COST USD", 8, true);
    y -= 13; rule(y); y -= 16;
    if (!rows.length) { text(L + 12, y, "No ingredients saved", 9); y -= 28; }
    for (let i = 0; i < rows.length; i++) {
      ensure(34); if (i % 2 === 0) box(L, y - 9, R - L, 29, "0.975 0.975 0.975");
      const row = rows[i]; text(L + 12, y, row.name.slice(0, includePrices ? 43 : 56), 9, true);
      text(includePrices ? 367 : 425, y, row.qty, 9); text(includePrices ? 430 : 500, y, row.unit.slice(0, 9), 8);
      if (includePrices) text(497, y, row.cost, 8); y -= 29;
    }
    y -= 17;
    // Utilities are included ONLY in priced PDFs, in their own cost table.
    if (includePrices && utilityRows.length) {
      box(L, y - 10, R - L, 30, "0.91 0.91 0.91");
      text(L + 12, y, "UTILITY COST", 11, true); y -= 35;
      text(L + 12, y, "ITEM", 8, true); text(367, y, "QTY", 8, true);
      text(430, y, "UNIT", 8, true); text(497, y, "COST USD", 8, true);
      y -= 13; rule(y); y -= 16;
      for (let i = 0; i < utilityRows.length; i++) {
        if (i % 2 === 0) box(L, y - 9, R - L, 29, "0.975 0.975 0.975");
        const row = utilityRows[i];
        text(L + 12, y, row.name.slice(0, 43), 9, true);
        text(367, y, row.qty, 9); text(430, y, row.unit.slice(0, 9), 8);
        text(497, y, row.cost, 8); y -= 29;
      }
      y -= 17;
    }
    if (String(recipe.notes ?? "").trim()) {
      ensure(65); box(L, y - 10, R - L, 28, "0.91 0.91 0.91"); text(L + 12, y, "RECIPE NOTES", 10, true); y -= 32;
      const words = plain(recipe.notes).split(/\s+/); let current = "";
      for (const word of words) {
        if ((current + " " + word).length > 90) { ensure(19); text(L + 9, y, current, 9); y -= 16; current = word; }
        else current = current ? `${current} ${word}` : word;
      }
      if (current) { ensure(19); text(L + 9, y, current, 9); y -= 16; }
    }
  }
  if (!count) throw new Error("No linked menu recipes were found in the Recipes API response.");
  finishPage();
  objects[catalog - 1] = bytes(`<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`);
  objects[pagesRoot - 1] = bytes(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => id + " 0 R").join(" ")}] >>`);
  const parts: Uint8Array[] = [bytes("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")]; const offsets: number[] = [0]; let offset = parts[0].length;
  objects.forEach((object, i) => { offsets.push(offset); const entry = join([bytes(`${i + 1} 0 obj\n`), object, bytes("\nendobj\n")]); parts.push(entry); offset += entry.length; });
  const xref = offset; parts.push(bytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  for (const position of offsets.slice(1)) parts.push(bytes(`${String(position).padStart(10, "0")} 00000 n \n`));
  parts.push(bytes(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`));
  const blob = new Blob([join(parts) as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url;
  a.download = `${mode === "production" ? "all-production" : "all-menu-recipes"}-${includePrices ? "with" : "without"}-prices.pdf`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 25000);
}
