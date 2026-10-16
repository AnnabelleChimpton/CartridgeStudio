// Minimal, deterministic encoder for the 4-bit indexed PNGs that 7800basic's
// `incgraphic` reads. Rows use the project format from SPEC.md: one string per
// row, `0` transparent and `1`-`3` the sprite's three colors. The RGB values
// are placeholders; console colors come from the palette registers.

const PLACEHOLDER_RGB = [
  [0, 0, 0],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
] as const;

export function encodeIndexedPng(rows: string[]): Uint8Array {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error("Sprite has no pixels");

  const stride = Math.ceil(width / 2);
  const raw = new Uint8Array(height * (stride + 1));
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Row ${y} is ${row.length} wide, expected ${width}`);
    const base = y * (stride + 1); // first byte of each row is filter type 0
    for (let x = 0; x < width; x++) {
      const v = row.charCodeAt(x) - 48;
      if (v < 0 || v > 3) throw new Error(`Invalid pixel ${JSON.stringify(row[x])} at ${x},${y}`);
      raw[base + 1 + (x >> 1)]! |= x & 1 ? v : v << 4;
    }
  });

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr.set([4, 3, 0, 0, 0], 8); // bit depth 4, color type 3 (indexed)

  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", new Uint8Array(PLACEHOLDER_RGB.flat())),
    chunk("tRNS", new Uint8Array([0])), // index 0 is transparent
    chunk("IDAT", zlibStored(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** zlib stream made of uncompressed deflate blocks; sprites are tiny. */
function zlibStored(data: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let i = 0; i === 0 || i < data.length; i += 0xffff) {
    const part = data.subarray(i, i + 0xffff);
    const last = i + 0xffff >= data.length ? 1 : 0;
    const head = new Uint8Array(5);
    head[0] = last;
    new DataView(head.buffer).setUint16(1, part.length, true);
    new DataView(head.buffer).setUint16(3, ~part.length & 0xffff, true);
    blocks.push(head, part);
  }
  const adler = new Uint8Array(4);
  new DataView(adler.buffer).setUint32(0, adler32(data));
  blocks.push(adler);
  return concat(blocks);
}

let crcTable: Uint32Array | undefined;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of data) crc = crcTable[(crc ^ b) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
