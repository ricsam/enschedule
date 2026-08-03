import { SQL } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { databaseUrlFromEnv } from "./database";

const migrationsDirectory = new URL("./drizzle/", import.meta.url).pathname;

export async function migrateDatabase(url = databaseUrlFromEnv()) {
  const sql = new SQL(url);
  try {
    await sql.unsafe(`
      CREATE SCHEMA IF NOT EXISTS drizzle;
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id serial PRIMARY KEY,
        hash text NOT NULL UNIQUE,
        created_at bigint NOT NULL
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const fileName of files) {
      const alreadyApplied = await sql`
        SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${fileName} LIMIT 1
      `;
      if (alreadyApplied.length > 0) continue;

      const migration = await Bun.file(join(migrationsDirectory, fileName)).text();
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migration);
        await transaction`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${fileName}, ${Date.now()})
        `;
      });
    }
  } finally {
    await sql.close();
  }
}

if (import.meta.main) {
  await migrateDatabase();
  console.log("Enschedule Drizzle migrations completed");
}
