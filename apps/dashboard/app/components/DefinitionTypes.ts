import type { SerializeFrom } from '@remix-run/node';
import type { PublicJobDefinition } from '@enschedule/types';
import type { getJobDefinitionDocs } from '~/utils/getJobDefinitionDocs';

export type DefinitionRowData = SerializeFrom<PublicJobDefinition & ReturnType<typeof getJobDefinitionDocs>>;
