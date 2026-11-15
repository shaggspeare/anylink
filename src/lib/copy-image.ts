/** Puts an image on the clipboard as a PNG — the one format every browser's clipboard takes, and what
 * X, Threads and Instagram paste. A GIF copies as its first frame; sharing or downloading keeps it moving.
 * The blob promise is made inside the click, which is what Safari needs to allow the write. */
export async function copyImage(url: string): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("unsupported");
  const png = toPng(url);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

async function toPng(url: string): Promise<Blob> {
  const bitmap = await createImageBitmap(await (await fetch(url, { mode: "cors" })).blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/png"));
}
