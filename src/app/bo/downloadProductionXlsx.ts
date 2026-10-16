"use client";

// Dependency-free XLSX writer: a compact OOXML workbook in an uncompressed ZIP.
// Data is exported from the currently visible, filtered and sorted table.
type Cell = string | number | null;
const encoder = new TextEncoder();
const encode = (text: string) => encoder.encode(text);
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const u16 = (buffer: Uint8Array, offset: number, n: number) => { buffer[offset] = n & 255; buffer[offset + 1] = (n >>> 8) & 255; };
const u32 = (buffer: Uint8Array, offset: number, n: number) => { u16(buffer, offset, n); u16(buffer, offset + 2, n >>> 16); };
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) { c ^= byte; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
}
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = encode(name); const checksum = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    u32(local, 0, 0x04034b50); u16(local, 4, 20); u16(local, 6, 0x0800);
    u32(local, 14, checksum); u32(local, 18, data.length); u32(local, 22, data.length);
    u16(local, 26, nameBytes.length); local.set(nameBytes, 30);
    const directory = new Uint8Array(46 + nameBytes.length);
    u32(directory, 0, 0x02014b50); u16(directory, 4, 20); u16(directory, 6, 20); u16(directory, 8, 0x0800);
    u32(directory, 16, checksum); u32(directory, 20, data.length); u32(directory, 24, data.length);
    u16(directory, 28, nameBytes.length); u32(directory, 42, offset); directory.set(nameBytes, 46);
    locals.push(local, data); central.push(directory); offset += local.length + data.length;
  }
  const centralOffset = offset; const centralLength = central.reduce((s, a) => s + a.length, 0);
  const end = new Uint8Array(22); u32(end, 0, 0x06054b50); u16(end, 8, files.length); u16(end, 10, files.length);
  u32(end, 12, centralLength); u32(end, 16, centralOffset);
  const output = new Uint8Array(offset + centralLength + end.length); let pos = 0;
  for (const part of [...locals, ...central, end]) { output.set(part, pos); pos += part.length; }
  return output;
}
function columnName(i: number) {
  let name = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) name = String.fromCharCode(65 + (i - 1) % 26) + name;
  return name;
}
export function downloadProductionXlsx(rows: Cell[][]) {
  const headers = ["Type", "Production", "Yield Qty", "Yield Unit", "Items", "Notes"];
  const all = [headers, ...rows];
  const percent = new Set<number>();
  const cellXml = (cell: Cell, column: number, row: number) => {
    if (cell === null || cell === undefined || cell === "") return "";
    const ref = `${columnName(column)}${row}`;
    if (typeof cell === "number" && Number.isFinite(cell)) {
      const style = row === 1 ? 1 : row % 2 === 0 ? 4 : 3;
      return `<c r="${ref}" s="${style}"><v>${cell}</v></c>`;
    }
    return `<c r="${ref}"${row === 1 ? ' s="1"' : row % 2 === 0 ? ' s="4"' : ' s="3"'} t="inlineStr"><is><t>${xml(String(cell))}</t></is></c>`;
  };
  const sheetRows = all.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => cellXml(v, j, i + 1)).join("")}</row>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="21" customWidth="1"/><col min="2" max="2" width="32" customWidth="1"/><col min="3" max="6" width="19" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:F${all.length}"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF213529"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F5F3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/></cellXfs></styleSheet>`;
  const files = [
    { name: "[Content_Types].xml", data: encode(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: "_rels/.rels", data: encode(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: encode(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Production" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: encode(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/worksheets/sheet1.xml", data: encode(sheet) }, { name: "xl/styles.xml", data: encode(styles) },
  ];
  const bytes = zip(files);
  const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `pros-production-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
