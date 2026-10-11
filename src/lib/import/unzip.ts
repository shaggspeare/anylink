/** Just enough zip to open the exports iPhones hand out: Safari's "Safari Export
 * <date>.zip" and WhatsApp's "WhatsApp Chat - <name>.zip". Stored and deflated entries,
 * read through the central directory (local headers may defer their sizes to a data
 * descriptor). Inflation is the platform's own `DecompressionStream`, in the browser and
 * in Node alike. ponytail: no zip64 or encryption — neither export uses them. */

export function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;
}

export async function unzip(
  bytes: Uint8Array,
  wanted: (name: string) => boolean
): Promise<{ name: string; data: Uint8Array }[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End-of-central-directory record: 22 bytes plus a comment of up to 64 KB.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const names = new TextDecoder();
  const out: { name: string; data: Uint8Array }[] = [];

  for (let n = 0; n < count && view.getUint32(p, true) === 0x02014b50; n++) {
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = names.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    p += 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);

    if ((flags & 1) || !wanted(name) || (method !== 0 && method !== 8)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.slice(start, start + size);
    const data =
      method === 0
        ? raw
        : new Uint8Array(
            await new Response(
              new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
            ).arrayBuffer()
          );
    out.push({ name, data });
  }
  return out;
}
