import { scheduler } from '~/scheduler';
import { getJobDefinitionDocs } from '~/utils/getJobDefinitionDocs';

export async function getLoaderData() {
  const defs = scheduler.getDefinitions();
  return defs.map((def) => ({ ...def, ...getJobDefinitionDocs(def) }));
}
