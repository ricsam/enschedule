import { PrivateBackend } from '@enschedule/pg-driver';

export const scheduler = new PrivateBackend();
scheduler.logJobs = true;
