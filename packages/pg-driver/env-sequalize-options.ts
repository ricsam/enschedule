import type { Dialect, Options } from "sequelize";

const assertEnvs = (...envs: string[]): string[] => {
  const missingEnvs: string[] = [];
  const definedEnvs: string[] = [];
  envs.forEach((env) => {
    const envVal = process.env[env];
    if (!envVal) {
      missingEnvs.push(env);
    } else {
      definedEnvs.push(envVal);
    }
  });
  if (missingEnvs.length > 0) {
    throw new Error(
      `The environment variables ${missingEnvs.join(", ")} must be defined`
    );
  }
  return definedEnvs;
};

export type SeqConstructorOptions = Options & { uri?: string };

const dialects: Dialect[] = [
  "mysql",
  "postgres",
  "sqlite",
  "mariadb",
  "mssql",
  "db2",
  "snowflake",
  "oracle",
];

export const envSequalizeOptions = (): SeqConstructorOptions => {
  const options: SeqConstructorOptions = {
    logging: Boolean(process.env.ORM_LOGGING),
    storage: process.env.SQLITE_STORAGE,
  };

  console.log({
    sqlite3: require.resolve("sqlite3"),
    pwd: process.cwd(),
    nm: require.resolve("sequelize"),
  });

  if (process.env.SEQUALIZE_DIALECT_MODULE_PATH) {
    options.dialectModulePath = process.env.SEQUALIZE_DIALECT_MODULE_PATH;
  }

  let dialect: { value: string; type: Dialect } | undefined;

  for (const dialectType of dialects) {
    const value = process.env[dialectType.toUpperCase()];
    if (value) {
      dialect = {
        value,
        type: dialectType,
      };
      break;
    }
  }

  if (dialect) {
    if (dialect.value.startsWith(`${dialect.type}://`)) {
      return {
        ...options,
        uri: dialect.value,
      };
    }
    if (dialect.type === "sqlite") {
      return { ...options, dialect: "sqlite", storage: dialect.value };
    }
    const [dbUser, dbHost, dbPassword, dbDatabase, dbPort] = assertEnvs(
      "DB_USER",
      "DB_HOST",
      "DB_PASSWORD",
      "DB_DATABASE",
      "DB_PORT"
    );
    return {
      ...options,
      dialect: dialect.type,
      database: dbDatabase,
      host: dbHost,
      username: dbUser,
      password: dbPassword,
      port: dbPort ? Number(dbPort) : undefined,
    };
  }

  throw new Error(
    "Invalid environment variables passed. Could not create a sequalize options object"
  );
};
