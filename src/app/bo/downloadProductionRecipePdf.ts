"use client";

type Row = Record<string, any>;
type Lookup = { ingredients: Row[]; utilities: Row[]; allRecipes: Row[]; rate: number };

// Print-ready, price-free recipe PDF using built-in PDF primitives.
export function downloadProductionRecipePdf(recipe: Row, lookup: Lookup) {
  const clean = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[^\x20-\x7e]/g, "?");
  const enc = new TextEncoder();
  const esc = (s: unknown) => clean(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const qty = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? String(Number(n.toFixed(4))) : ""; };
  const lines = (recipe.lines || []).map((line: Row, i: number) => {
    const type = String(line.line_type || "ingredient");
    let source: Row | undefined;
    let label = "";
    let unit = "";
    if (type === "ingredient") {
      source = lookup.ingredients.find(x => String(x.id) === String(line.ingredient_id));
      label = String(source?.name || "Ingredient"); unit = String(source?.consumption_unit || source?.purchase_unit || "");
    } else if (type === "recipe") {
      source = lookup.allRecipes.find(x => String(x.id) === String(line.sub_recipe_id));
      label = String(source?.name || "Preparation / sauce"); unit = String(source?.yield_unit || "");
    } else if (type === "utility") {
      source = lookup.utilities.find(x => String(x.id) === String(line.utility_id));
      label = String(source?.name || "Utility"); unit = String(source?.unit_label || "");
    } else { label = String(line.fixed_label || line.name || "Fixed item"); unit = ""; }
    return [String(i + 1), label, qty(line.qty), unit];
  });
  const pageWidth = 595, pageHeight = 842, left = 42, right = 553;
  const objects: string[] = ["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  const pages: number[] = [];
  const commands: string[] = [];
  let y = 800;
  let page = 1;
  const txt = (x: number, yy: number, value: unknown, size = 10, bold = false) => {
    commands.push(`BT /F${bold ? 2 : 1} ${size} Tf 1 0 0 1 ${x} ${yy} Tm (${esc(value)}) Tj ET`);
  };
  const line = (yy: number, x1 = left, x2 = right) => commands.push(`0.79 G 0.6 w ${x1} ${yy} m ${x2} ${yy} l S`);
  const rect = (x: number, yy: number, w: number, h: number, gray: number) => commands.push(`${gray} g ${x} ${yy} ${w} ${h} re f 0 g`);
  const endPage = () => {
    const stream = commands.join("\n") + "\n";
    const streamId = objects.push(`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`);
    const pageId = objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
    pages.push(pageId); commands.length = 0;
  };
  const top = () => {
    txt(left, 795, "PRO'S  /  PRODUCTION", 10, true);
    txt(right - 70, 795, `PAGE ${page}`, 8);
    line(784);
    y = 765;
  };
  const header = () => {
    rect(left, y - 8, right - left, 24, 0.91);
    txt(52, y, "#", 9, true); txt(82, y, "INGREDIENT / ITEM", 9, true);
    txt(425, y, "QTY", 9, true); txt(495, y, "UNIT", 9, true); y -= 26;
  };
  top();
  txt(left, y, clean(recipe.name || "Production Recipe").slice(0, 68), 17, true); y -= 28;
  txt(left, y, `TYPE: ${String(recipe.kind).toLowerCase() === "sauce" ? "SAUCE" : "PREPARATION"}`, 10);
  txt(310, y, `YIELD: ${qty(recipe.yield_qty)} ${clean(recipe.yield_unit)}`, 10, true); y -= 30;
  header();
  for (let i = 0; i < lines.length; i++) {
    if (y < 85) { endPage(); page++; top(); header(); }
    const [n, name, quantity, unit] = lines[i];
    if (i % 2 === 1) rect(left, y - 7, right - left, 23, 0.96);
    txt(52, y, n, 9); txt(82, y, clean(name).slice(0, 54), 9);
    txt(425, y, quantity, 9); txt(495, y, clean(unit).slice(0, 12), 9);
    line(y - 10); y -= 23;
  }
  if (!lines.length) { txt(82, y, "No recipe ingredients", 10); y -= 25; }
  if (recipe.notes) {
    if (y < 135) { endPage(); page++; top(); }
    y -= 20; txt(left, y, "NOTES", 11, true); y -= 20;
    const words = clean(recipe.notes).split(/\s+/);
    let chunk = "";
    const noteLines: string[] = [];
    for (const word of words) {
      if ((chunk + " " + word).length > 95) { noteLines.push(chunk); chunk = word; }
      else chunk = chunk ? chunk + " " + word : word;
    }
    if (chunk) noteLines.push(chunk);
    for (const value of noteLines) {
      if (y < 75) { endPage(); page++; top(); }
      txt(left, y, value, 9); y -= 15;
    }
  }
  endPage();
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(n => `${n} 0 R`).join(" ")}] >>`;
  let out = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(enc.encode(out).length);
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = enc.encode(out).length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob = new Blob([out], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `production-${clean(recipe.name || "recipe").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
