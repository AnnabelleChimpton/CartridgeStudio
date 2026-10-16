// Reads back the 4-bit indexed PNGs our generators write (encodeIndexedPng in
// @cartridge-studio/toolchain), so ejecting a game turns its graphics into
// editable rows again. Only that format: bit depth 4, color type 3, no
// interlace, filter 0 on every row.

import { unzlibSync } from "fflate";

export function decodeIndexedPng(png: Uint8Array): string[] {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (png.length < 33 || dv.getUint32(0) !== 0x89504e47) throw new Error("Not a PNG");
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  for (let at = 8; at + 8 <= png.length; ) {
    const length = dv.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = dv.getUint32(at + 8);
      height = dv.getUint32(at + 12);
      if (data[8] !== 4 || data[9] !== 3 || data[12] !== 0) throw new Error("Only 4-bit indexed PNGs can be edited");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of idat) {
    joined.set(c, o);
    o += c.length;
  }
  const raw = unzlibSync(joined);
  const stride = Math.ceil(width / 2);
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    const base = y * (stride + 1);
    if (raw[base] !== 0) throw new Error("Unsupported PNG filter");
    let row = "";
    for (let x = 0; x < width; x++) {
      const byte = raw[base + 1 + (x >> 1)]!;
      const v = x & 1 ? byte & 15 : byte >> 4;
      if (v > 3) throw new Error("Only colors 0-3 can be edited");
      row += String(v);
    }
    rows.push(row);
  }
  return rows;
}
