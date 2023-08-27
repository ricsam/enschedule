/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { TestBackend } from "./backend";

const backend = new TestBackend({
  pgUser: process.env.PGUSER!,
  pgHost: process.env.PGHOST!,
  pgPassword: process.env.PGPASSWORD!,
  pgDatabase: process.env.PGDATABASE!,
  pgPort: process.env.PGPORT!,
});

export const migrate = async (): Promise<never> => {
  await backend.sequelize.sync();
  console.log('Finished migrating');
  process.exit(0);
};
