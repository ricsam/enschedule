import type { Params } from '@remix-run/react';
import type { PublicJobRun } from '@enschedule/types';
import { scheduler } from '~/scheduler';

export const getRunData = async (params: Params): Promise<PublicJobRun> => {
  const runId = Number(params.runId);
  if (isNaN(runId)) {
    throw new Error('Invalid runId provided');
  }

  const run = await scheduler.getRun(runId);
  if (!run) {
    throw new Error('Run not found');
  }

  return run;
};
