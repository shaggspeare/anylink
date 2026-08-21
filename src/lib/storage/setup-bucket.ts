import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { supabaseAdmin, HERO_IMAGES_BUCKET } = await import("./client");
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) throw listError;

  if (buckets.some((b) => b.name === HERO_IMAGES_BUCKET)) {
    console.log(`Bucket "${HERO_IMAGES_BUCKET}" already exists.`);
    return;
  }

  const { error } = await supabaseAdmin.storage.createBucket(HERO_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: "8MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
  });
  if (error) throw error;
  console.log(`Created public bucket "${HERO_IMAGES_BUCKET}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
