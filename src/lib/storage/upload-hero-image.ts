import sharp from "sharp";
import { supabaseAdmin, HERO_IMAGES_BUCKET } from "./client";

const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 1600;

/** Downloads a crawled hero image, resizes it, and re-hosts it in Supabase Storage.
 * Returns undefined (leaving the original hotlinked URL in place) on any failure —
 * a missing hero image is not worth failing the save over. */
export async function reuploadHeroImage(sourceUrl: string, linkId: string): Promise<string | undefined> {
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return undefined;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return undefined;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_DOWNLOAD_BYTES) return undefined;

    const resized = await sharp(buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const path = `${linkId}.webp`;
    const { error } = await supabaseAdmin.storage.from(HERO_IMAGES_BUCKET).upload(path, resized, {
      contentType: "image/webp",
      upsert: true,
    });
    if (error) throw error;

    return supabaseAdmin.storage.from(HERO_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.error("hero image reupload failed:", err);
    return undefined;
  }
}

export async function deleteHeroImage(linkId: string) {
  await supabaseAdmin.storage.from(HERO_IMAGES_BUCKET).remove([`${linkId}.webp`]);
}
