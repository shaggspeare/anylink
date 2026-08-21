export const CURRENT_USER_ID = process.env.CURRENT_USER_ID!;

if (!CURRENT_USER_ID) {
  throw new Error("CURRENT_USER_ID is not set — run `npx tsx src/lib/db/seed.ts <email>` first.");
}
