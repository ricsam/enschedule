import { WorkerAPI } from '@enschedule/worker-api';

export const scheduler = new WorkerAPI();
scheduler.logJobs = true;
