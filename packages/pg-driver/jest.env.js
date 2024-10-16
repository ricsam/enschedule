const { Client } = require("pg");

const TEST_DB = "enschedule_test";

Object.assign(process.env, {
  // `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`
  POSTGRES: "true",
  DB_USER: "postgres",
  DB_HOST: "localhost",
  DB_PASSWORD: "postgres",
  DB_DATABASE: "postgres",
  DB_PORT: "6543",
  ACCESS_TOKEN_SECRET: "secret",
  REFRESH_TOKEN_SECRET: "secret",
  API_KEY: "secret",
});

module.exports = async () => {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT),
  });
  await client.connect();
  const dbExists = await client.query(
    `SELECT 1 FROM pg_database WHERE datname='${TEST_DB}'`
  );
  if (dbExists.rowCount > 0) {
    // delete database
    // disconnect clients
    await client.query(
      `SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${TEST_DB}' AND pid <> pg_backend_pid();`
    );
    // drop db
    await client.query(`DROP DATABASE ${TEST_DB}`);
  }
  // create database
  await client.query(`CREATE DATABASE ${TEST_DB}`);

  await client.end();
  Object.assign(process.env, {
    DB_DATABASE: TEST_DB,
  });
};
