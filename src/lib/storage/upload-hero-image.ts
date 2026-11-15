import sharp from "sharp";
import { supabaseAdmin, HERO_IMAGES_BUCKET } from "./client";
import { USER_AGENT } from "../crawler/fetch-page";

const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 1600;

/** Downloads a crawled hero image, resizes it, and re-hosts it in Supabase Storage.
 * Returns undefined (leaving the original hotlinked URL in place) on any failure —
 * a missing hero image is not worth failing the save over.
 *
 * `pageUrl` goes out as the Referer: CDNs with hotlink protection 403 a bare
 * request but serve the image to the page it belongs to. */
export async function reuploadHeroImage(
  sourceUrl: string,
  linkId: string,
  pageUrl?: string
): Promise<string | undefined> {
  try {
    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        ...(pageUrl ? { Referer: pageUrl } : {}),
      },
    });
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

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// Screenshots are text more often than not: keep them wide enough to read and the
// quality high enough that the text doesn't smear.
const MAX_IMAGE_SIDE = 2400;

/** The formats a saved image is kept in as uploaded. Anything else is only kept as the webp preview. */
const ORIGINAL_EXT: Record<string, string> = { gif: "gif", png: "png", jpeg: "jpg", webp: "webp" };
const EXTENSIONS = ["webp", ...new Set(Object.values(ORIGINAL_EXT))];

export type StoredImage = {
  /** The file as uploaded (a GIF still moves, a PNG pastes as a PNG): what Copy, Share and "Open full size" use. */
  url: string;
  /** A webp sized for the web: the card and the model read this one. */
  preview: string;
  previewBytes: Buffer;
};

/** A saved image (screenshot, photo, meme). The original goes up as `<id>.<ext>` next to a
 * `<id>.webp` preview, so purging the row cleans both up via deleteHeroImage.
 * ponytail: the bucket is public — unguessable uuid URLs, nothing more. Private bucket +
 * signed URLs when screenshots of sensitive things become a real concern. */
export async function uploadImage(bytes: Buffer, linkId: string): Promise<StoredImage> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error("That image is too large (25 MB max).");
  let webp: Buffer;
  let format: string | undefined;
  try {
    const image = sharp(bytes);
    format = (await image.metadata()).format;
    webp = await image
      .rotate() // honour EXIF orientation before it's stripped
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
  } catch {
    throw new Error("That file isn't an image we can read.");
  }
  const bucket = supabaseAdmin.storage.from(HERO_IMAGES_BUCKET);
  const { error } = await bucket.upload(`${linkId}.webp`, webp, { contentType: "image/webp", upsert: true });
  if (error) throw new Error("Couldn't store the image. Try again.");
  const preview = bucket.getPublicUrl(`${linkId}.webp`).data.publicUrl;

  const ext = format && ORIGINAL_EXT[format];
  if (ext && ext !== "webp") {
    const path = `${linkId}.${ext}`;
    const { error } = await bucket.upload(path, bytes, { contentType: `image/${format}`, upsert: true });
    if (!error) return { url: bucket.getPublicUrl(path).data.publicUrl, preview, previewBytes: webp };
    console.error("original image upload failed:", error);
  }
  return { url: preview, preview, previewBytes: webp };
}

/** The webp preview of a stored image, for the model to read. Null when it isn't ours or is gone. */
export async function downloadPreview(previewUrl: string, linkId: string): Promise<Buffer | null> {
  const bucket = supabaseAdmin.storage.from(HERO_IMAGES_BUCKET);
  if (previewUrl.split("?")[0] !== bucket.getPublicUrl(`${linkId}.webp`).data.publicUrl) return null;
  const { data, error } = await bucket.download(`${linkId}.webp`);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Every file a link may have in the bucket: the preview and whichever original was kept. Missing ones are ignored. */
export async function deleteHeroImage(linkId: string) {
  await supabaseAdmin.storage.from(HERO_IMAGES_BUCKET).remove(EXTENSIONS.map((ext) => `${linkId}.${ext}`));
}

/** A copy of `fromId`'s stored file under `toId`, when `url` is that stored file (any of its
 * extensions) — a saved copy of someone else's link must survive them purging theirs. Undefined
 * for anything else (hotlinked images stay hotlinked) or when the copy fails. */
export async function copyStoredImage(url: string, fromId: string, toId: string): Promise<string | undefined> {
  const bucket = supabaseAdmin.storage.from(HERO_IMAGES_BUCKET);
  const bare = url.split("?")[0];
  const ext = EXTENSIONS.find((e) => bare === bucket.getPublicUrl(`${fromId}.${e}`).data.publicUrl);
  if (!ext) return undefined;
  const { error } = await bucket.copy(`${fromId}.${ext}`, `${toId}.${ext}`);
  if (error) {
    console.error("image copy failed:", error);
    return undefined;
  }
  return bucket.getPublicUrl(`${toId}.${ext}`).data.publicUrl;
}
