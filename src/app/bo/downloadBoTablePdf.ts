"use client";

/** Branded printable BO table PDF; no external PDF package required. */
type PdfValue = string | number | null | undefined;
export type BoTablePdfGroup = { title: string; rows: PdfValue[][] };
const safe = (value: PdfValue) => String(value ?? "—").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?");
const pdfSafe = (value: PdfValue) => safe(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const concatBytes = (arrays: Uint8Array[]) => { const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0)); let offset = 0; arrays.forEach(a => { out.set(a, offset); offset += a.length; }); return out; };
async function loadLogo(): Promise<{ jpeg: Uint8Array; width: number; height: number } | null> {
  try {
    const response = await fetch("/icon.png", { cache: "force-cache" });
    if (!response.ok) return null;
    const bmp = await createImageBitmap(await response.blob());
    try {
      const width = 180, height = Math.max(1, Math.round(bmp.height * width / bmp.width));
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d"); if (!context) return null;
      context.fillStyle = "white"; context.fillRect(0, 0, width, height); context.drawImage(bmp, 0, 0, width, height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.78));
      return blob ? { jpeg: new Uint8Array(await blob.arrayBuffer()), width, height } : null;
    } finally { bmp.close(); }
  } catch { return null; }
}
export async function downloadBoTablePdf({ title, columns, groups, fileName, subtitle = "" }: {
  title: string; columns: string[]; groups: BoTablePdfGroup[]; fileName: string; subtitle?: string;
}): Promise<void> {
  if (!groups.some(group => group.rows.length)) throw new Error("There are no rows to export.");
  const encoder = new TextEncoder(); const asBytes = (s: string) => encoder.encode(s);
  const objects: Uint8Array[] = [];
  const add = (source: string | Uint8Array) => { objects.push(typeof source === "string" ? asBytes(source) : source); return objects.length; };
  const catalog = add(""); const pages = add("");
  const regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const logo = await loadLogo();
  const logoId = logo ? add(concatBytes([asBytes(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.jpeg.length} >>\nstream\n`), logo.jpeg, asBytes("\nendstream")])) : 0;
  const W = 842, H = 595, left = 34, right = 808, rowHeight = 21;
  const pagesMade: number[] = []; let commands: string[] = []; let y = 0; let pageNumber = 0;
  const text = (x: number, yy: number, value: PdfValue, size = 9, strong = false, color = "0.13 0.13 0.13") => commands.push(`${color} rg BT /${strong ? "FB" : "FR"} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${yy.toFixed(1)} Tm (${pdfSafe(value)}) Tj ET`);
  const box = (x: number, yy: number, w: number, h: number, color: string) => commands.push(`${color} rg ${x} ${yy} ${w} ${h} re f`);
  const rule = (yy: number) => commands.push(`0.84 G 0.6 w ${left} ${yy} m ${right} ${yy} l S`);
  const colWidth = (right - left) / columns.length;
  const line = (values: PdfValue[], yy: number, strong = false) => values.forEach((value, index) => {
    const maxChars = Math.max(5, Math.floor((colWidth - 10) / (strong ? 5.15 : 4.65)));
    const source = safe(value), cut = source.length > maxChars ? source.slice(0, maxChars - 1) + "..." : source;
    text(left + index * colWidth + 7, yy, cut, strong ? 8 : 8.5, strong);
  });
  const start = () => {
    pageNumber++; commands = []; box(0, H - 7, W, 7, "0.145 0.125 0.435");
    if (logoId && logo) {
      const factor = Math.min(43 / logo.width, 43 / logo.height), dw = logo.width * factor, dh = logo.height * factor;
      commands.push(`q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${left} ${H - 65} cm /Logo Do Q`);
    }
    text(logoId ? 95 : left, H - 47, "PRO'S CAFE", 12, true);
    text(logoId ? 95 : left, H - 64, title.toUpperCase(), 15, true);
    if (subtitle) text(left, H - 93, subtitle.slice(0, 140), 8, false, "0.42 0.42 0.42");
    rule(H - 108); y = H - 130;
  };
  const finish = () => {
    rule(42); text(left, 26, "(c) 2026", 9); text(left + 52, 26, "wissamdesigns.com", 9, true, "0.145 0.125 0.435");
    text(right - 52, 26, `Page ${pageNumber}`, 8, false, "0.4 0.4 0.4");
    const content = asBytes(commands.join("\n") + "\n");
    const stream = add(concatBytes([asBytes(`<< /Length ${content.length} >>\nstream\n`), content, asBytes("endstream") ]));
    const link = add(`<< /Type /Annot /Subtype /Link /Rect [84 20 186 39] /Border [0 0 0] /A << /S /URI /URI (https://wissamdesigns.com) >> >>`);
    pagesMade.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /FR ${regular} 0 R /FB ${bold} 0 R >> /XObject << ${logoId ? `/Logo ${logoId} 0 R` : ""} >> >> /Annots [${link} 0 R] /Contents ${stream} 0 R >>`));
  };
  const headers = () => { box(left, y - 8, right - left, 23, "0.90 0.90 0.90"); line(columns, y, true); y -= 31; };
  start();
  for (const group of groups) {
    if (!group.rows.length) continue;
    if (y < 110) { finish(); start(); }
    box(left, y - 10, right - left, 29, "0.955 0.955 0.955"); text(left + 9, y, group.title.toUpperCase(), 10, true); y -= 40;
    headers();
    group.rows.forEach((row, index) => {
      if (y < 68) { finish(); start(); text(left, y, `${group.title} (continued)`, 9, true); y -= 25; headers(); }
      if (index % 2 === 0) box(left, y - 8, right - left, rowHeight, "0.975 0.975 0.975");
      line(row, y); y -= rowHeight;
    });
    y -= 17;
  }
  finish();
  objects[catalog - 1] = asBytes(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  objects[pages - 1] = asBytes(`<< /Type /Pages /Count ${pagesMade.length} /Kids [${pagesMade.map(id => `${id} 0 R`).join(" ")}] >>`);
  const parts = [asBytes("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")]; const offsets = [0]; let offset = parts[0].length;
  objects.forEach((object, index) => { offsets.push(offset); const entry = concatBytes([asBytes(`${index + 1} 0 obj\n`), object, asBytes("\nendobj\n")]); parts.push(entry); offset += entry.length; });
  const xref = offset; parts.push(asBytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  offsets.slice(1).forEach(position => parts.push(asBytes(`${String(position).padStart(10, "0")} 00000 n \n`)));
  parts.push(asBytes(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`));
  const blob = new Blob([concatBytes(parts) as BlobPart], { type: "application/pdf" }); const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 25000);
}
