import MuiLink from '@mui/material/Link';
import type { SerializeFrom } from '@remix-run/node';
import { Link as RemixLink } from '@remix-run/react';
import type { PublicJobSchedule, SerializedRun } from '@enschedule/types';
import type { ColumnDef } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { checkboxCol, ExpandableTable } from '~/components/Table';
import { formatDate } from '~/utils/formatDate';
import RunPage from './RunPage';

type RowData = SerializeFrom<SerializedRun & { jobSchedule: PublicJobSchedule }>;

const columnHelper = createColumnHelper<RowData>();

const columns: ColumnDef<RowData, any>[] = [
  checkboxCol(),
  columnHelper.accessor('id', {
    cell: (info) => {
      const runId = info.row.original.id;
      return (
        <MuiLink
          to={`${runId}`}
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
  columnHelper.accessor('startedAt', {
    cell: (info) => {
      const value = info.getValue();
      return formatDate(new Date(value), false).label;
    },
    header: 'Started',
  }),
  {
    cell: ({ row }) => {
      const run = row.original;
      return <>{new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()}ms</>;
    },
    header: 'Duration',
    id: 'duration',
  },
  columnHelper.accessor('finishedAt', {
    cell: (info) => {
      const value = info.getValue();
      return formatDate(new Date(value), false).label;
    },
    header: 'Completed',
  }),
  columnHelper.accessor('scheduledToRunAt', {
    cell: (info) => {
      const value = info.getValue();
      return formatDate(new Date(value), false).label;
    },
    header: 'Scheduled for',
  }),
  columnHelper.accessor('stdout', {
    cell: (info) => {
      const value = info.getValue();
      return String(!!value);
    },
    header: 'Has stdout',
  }),
  columnHelper.accessor('stderr', {
    cell: (info) => {
      const value = info.getValue();
      return String(!!value);
    },
    header: 'Has stderr',
  }),
];

export default function RunsTable({
  runs,
}: SerializeFrom<{
  runs: (SerializedRun & { jobSchedule: PublicJobSchedule })[];
}>) {
  return (
    <ExpandableTable
      rows={runs}
      columns={columns}
      renderRow={(row) => {
        const run = row.original;
        return <RunPage run={run} schedule={run.jobSchedule} />;
      }}
    />
  );
}
