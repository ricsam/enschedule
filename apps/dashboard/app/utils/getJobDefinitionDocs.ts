import type { PublicJobDefinition } from '@enschedule/types';
import { pascalCase } from 'pascal-case';
import zodToJsonSchema from 'zod-to-json-schema';
import { createTypeAlias, printNode, zodToTs } from 'zod-to-ts';

export type DefDoc = {
  codeBlock: string;
  jsonSchema: {
    definitions: Record<string, unknown>;
  };
  example: unknown;
};

export const getJobDefinitionDocs = (job: PublicJobDefinition): DefDoc => {
  const identifier = pascalCase(job.title);
  const { node } = zodToTs(job.dataSchema, identifier);
  const typeAlias = createTypeAlias(node, identifier);
  const codeBlock = printNode(typeAlias).replace(/^( {4})+/gm, '  ');
  const jsonSchema: DefDoc['jsonSchema'] = zodToJsonSchema(job.dataSchema, identifier);
  const example = job.example;
  return {
    codeBlock,
    jsonSchema,
    example,
  };
};
