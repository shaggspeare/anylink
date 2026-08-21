import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx src/lib/db/seed.ts <email>");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(sql, { schema });

  const [user] = await db.insert(schema.users).values({ email }).returning();
  console.log("Seeded user:", user.id, user.email);

  const starterCollections = [
    { name: "Reading", color: "#ff5a1f" },
    { name: "Design", color: "#d6f24b" },
    { name: "Build", color: "#7c8cff" },
    { name: "Watch later", color: "#9aa3ad" },
    { name: "Recipes", color: "#e0855a" },
  ];
  await db
    .insert(schema.collections)
    .values(starterCollections.map((c) => ({ ...c, userId: user.id })));
  console.log(`Seeded ${starterCollections.length} collections.`);

  console.log(`\nAdd this to .env.local:\nCURRENT_USER_ID=${user.id}`);

  await sql.end({ timeout: 1 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
