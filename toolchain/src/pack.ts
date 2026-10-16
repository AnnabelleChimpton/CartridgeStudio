// Reader for the toolchain archive written by scripts/fetch-7800basic.mjs.

export interface ToolchainPack {
  name: string;
  version: string;
  sha256: string;
  files: Map<string, Uint8Array>;
}

const MAGIC = "CSPACK01";

export function readPack(buffer: ArrayBuffer | Uint8Array): ToolchainPack {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const magic = new TextDecoder().decode(bytes.subarray(0, 8));
  if (magic !== MAGIC) throw new Error(`Not a toolchain pack (magic ${JSON.stringify(magic)})`);

  const headerLength = new DataView(bytes.buffer, bytes.byteOffset + 8, 4).getUint32(0, true);
  const dataStart = 12 + headerLength;
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, dataStart))) as {
    name: string;
    version: string;
    sha256: string;
    files: { path: string; offset: number; size: number }[];
  };

  const files = new Map<string, Uint8Array>();
  for (const f of header.files) {
    files.set(f.path, bytes.subarray(dataStart + f.offset, dataStart + f.offset + f.size));
  }
  return { name: header.name, version: header.version, sha256: header.sha256, files };
}
