import Box from '@mui/material/Box';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { SerializeFrom } from '@remix-run/node';
import { Link as RemixLink } from '@remix-run/react';
import type { PublicJobDefinition } from '@enschedule/types';
import type { ColumnDef } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { ReadOnlyEditor } from '~/components/Editor';
import { checkboxCol, ExpandableTable } from '~/components/Table';
import type { getJobDefinitionDocs } from '~/utils/getJobDefinitionDocs';
import type { DefinitionRowData } from './DefinitionTypes';

const columnHelper = createColumnHelper<DefinitionRowData>();

const columns: ColumnDef<DefinitionRowData, any>[] = [
  checkboxCol(),
  columnHelper.accessor('id', {
    cell: (info) => {
      const definitions = info.row.original.id;
      return (
        <MuiLink
          to={`/definitions/${definitions}`}
          component={RemixLink}
          onClick={(ev) => {
            ev.stopPropagation();
          }}
        >
          {info.getValue()}
        </MuiLink>
      );
    },
    header: 'Id',
  }),
  columnHelper.accessor('title', {
    cell: (info) => {
      return info.getValue();
    },
    header: 'Title',
  }),
  columnHelper.accessor('description', {
    cell: (info) => {
      return info.getValue();
    },
    header: 'Description',
  }),
];

export default function DefinitionsTable({
  definitions,
}: {
  definitions: SerializeFrom<(PublicJobDefinition & ReturnType<typeof getJobDefinitionDocs>)[]>;
}) {
  return (
    <Box>
      <Typography variant="body1" color="text.secondary">
        To modify the definitions you have to ask a site administrator to edit the code on the server.
      </Typography>
      <Box pb={3} />
      <ExpandableTable
        rows={definitions}
        columns={columns}
        renderRow={(row) => {
          const { codeBlock } = row.original;
          return (
            <>
              <Typography variant="h6" gutterBottom component="div">
                Schema
              </Typography>
              <ReadOnlyEditor example={codeBlock} lang="typescript" />
            </>
          );
        }}
      />
    </Box>
  );
}
