import { describe, expect, test } from "bun:test";
import { databaseUrlFromEnv } from "./database";

describe("PostgreSQL configuration", () => {
  test("uses DATABASE_URL when supplied", () => {
    expect(databaseUrlFromEnv({
      DATABASE_URL: "postgres://user:pass@db:5432/enschedule",
    } as NodeJS.ProcessEnv)).toBe("postgres://user:pass@db:5432/enschedule");
  });

  test("builds a PostgreSQL URL from component variables", () => {
    expect(databaseUrlFromEnv({
      DB_USER: "user",
      DB_PASSWORD: "p@ss",
      DB_HOST: "db",
      DB_PORT: "5433",
      DB_DATABASE: "enschedule",
    } as NodeJS.ProcessEnv)).toBe("postgres://user:p%40ss@db:5433/enschedule");
  });
});
