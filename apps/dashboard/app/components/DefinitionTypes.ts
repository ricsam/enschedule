import type { PublicJobDefinition } from "@enschedule/types";
import type { SerializeFrom } from "@remix-run/node";

export type DefinitionRowData = SerializeFrom<PublicJobDefinition>;
