const { Client } = require('pg');

const TEST_DB = 'enschedule_test';

Object.assign(process.env, {
  PGUSER: 'postgres',
  PGHOST: 'localhost',
  PGPASSWORD: 'postgres',
  PGDATABASE: 'postgres',
  PGPORT: '6543',
});

module.exports = async () => {
  const client = new Client();
  await client.connect();
  const dbExists = await client.query(`SELECT 1 FROM pg_database WHERE datname='${TEST_DB}'`);
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
    PGDATABASE: TEST_DB,
  });
};
