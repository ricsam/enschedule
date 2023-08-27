import type { SerializeFrom } from '@remix-run/node';
import type { PublicJobRun } from '@enschedule/types';

export const useRunBreadcrumbs = (run: SerializeFrom<PublicJobRun>) => {
  const title = `Run #${run.id}`;

  return [{ title, href: '/' + String(run.id) }];
};
