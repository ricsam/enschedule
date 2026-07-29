import { defineConfig } from "drizzle-kit";
import { databaseUrlFromEnv } from "./database";

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrlFromEnv() },
  strict: true,
  verbose: true,
});
