import { SQL } from "bun";
import { drizzle, type BunSQLDatabase } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

export interface DatabaseOptions {
  url?: string;
  max?: number;
  idleTimeout?: number;
}

export function databaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.POSTGRES?.startsWith("postgres://") || env.POSTGRES?.startsWith("postgresql://")) {
    return env.POSTGRES;
  }

  const user = env.DB_USER ?? "postgres";
  const password = env.DB_PASSWORD ?? "postgres";
  const host = env.DB_HOST ?? "127.0.0.1";
  const port = env.DB_PORT ?? "5432";
  const database = env.DB_DATABASE ?? "postgres";
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export type EnscheduleDatabase = BunSQLDatabase<typeof schema>;

export interface DatabaseHandle {
  client: SQL;
  db: EnscheduleDatabase;
  close: () => Promise<void>;
}

export function createDatabase(options: DatabaseOptions = {}): DatabaseHandle {
  const client = new SQL({
    url: options.url ?? databaseUrlFromEnv(),
    max: options.max ?? Number(process.env.DB_POOL_SIZE ?? 20),
    idleTimeout: options.idleTimeout ?? 30,
  });
  return {
    client,
    db: drizzle({ client, schema }),
    close: () => client.close(),
  };
}
