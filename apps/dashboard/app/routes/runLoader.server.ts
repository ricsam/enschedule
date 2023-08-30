import { scheduler } from '~/scheduler.server';

export async function getLoaderData() {
  const defs = scheduler.getJobDefinitions();
  return defs;
}
