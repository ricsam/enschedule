import type { PublicJobRun } from "@enschedule/types";
import MuiLink from "@mui/material/Link";
import type { ActionFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link as RemixLink } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { z } from "zod";
import { ExpandableTable } from "~/components/Table";
import { getWorker } from "~/createWorker";
import { formatDate } from "~/utils/formatDate";
import { createMsButtons } from "./createMsButtons";
import RunPage from "./RunPage";
import { Tooltip, Typography } from "@mui/material";

type RowData = SerializeFrom<PublicJobRun>;

const columnHelper = createColumnHelper<RowData>();

const columns: ColumnDef<RowData, any>[] = [
  columnHelper.accessor("exitSignal", {
    cell: (info) => {
      const exitSignal = info.getValue();

      return (
        <Tooltip
          title={exitSignal === "0" ? "Success" : "Fail️"}
          disableInteractive
        >
          <Typography variant="inherit" sx={{ cursor: "default" }}>
            {exitSignal === "0" ? "✅" : "⚠️"}
          </Typography>
        </Tooltip>
      );
    },
    header: "Status",
  }),
  columnHelper.accessor("id", {
    cell: (info) => {
      const runId = info.row.original.id;
      return (
        <MuiLink
          to={`${runId}`}
          data-testid="run-link"
          component={RemixLink}
          onClick={(ev) => {
            ev.stopPropagation();
          }}
        >
          {info.getValue()}
        </MuiLink>
      );
    },
    header: "Id",
  }),
  columnHelper.accessor("startedAt", {
    cell: (info) => {
      const value = info.getValue();
      return formatDate(new Date(value), false).label;
    },
    header: "Started",
  }),
  {
    cell: ({ row, getValue }) => {
      return (
        <>
          {getValue()}
          ms
        </>
      );
    },
    enableSorting: true,
    header: "Duration",
    id: "duration",
    accessorFn: (run) => {
      return (
        new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
      );
    },
  },
  columnHelper.accessor("finishedAt", {
    cell: (info) => {
      const value = info.getValue();
      return formatDate(new Date(value), false).label;
    },
    header: "Completed",
  }),
  columnHelper.accessor("scheduledToRunAt", {
    cell: (info) => {
      const value = info.getValue();
      return formatDate(new Date(value), false).label;
    },
    header: "Scheduled for",
  }),
  columnHelper.accessor("exitSignal", {
    cell: (info) => {
      const value = info.getValue();
      return value;
    },
    header: "Exit signal",
  }),
  columnHelper.accessor("stdout", {
    cell: (info) => {
      const value = info.getValue();
      return String(!!value);
    },
    header: "Has stdout",
  }),
  columnHelper.accessor("stderr", {
    cell: (info) => {
      const value = info.getValue();
      return String(!!value);
    },
    header: "Has stderr",
  }),
];

const { ToolbarWrapper, MsButtons } = createMsButtons({
  formAction: "/runs?index",
});

export default function RunsTable({
  runs,
}: SerializeFrom<{
  runs: PublicJobRun[];
}>) {
  return (
    <ExpandableTable
      id="RunsTable"
      defaultSorting={[
        {
          id: "startedAt",
          desc: true,
        },
      ]}
      rows={runs}
      title="Runs"
      columns={columns}
      ToolbarWrapper={ToolbarWrapper}
      renderRow={(row) => {
        const run = row.original;
        return (
          <RunPage
            run={run}
            schedule={run.jobSchedule}
            handler={run.jobDefinition}
          />
        );
      }}
      msButtons={<MsButtons />}
    />
  );
}

export const action: ActionFunction = async ({ request, context }) => {
  const fd = await request.formData();
  const action = z
    .union([z.literal("delete"), z.literal("placeholder")])
    .parse(fd.get("action"));
  const selected = z.array(z.number().int()).parse(fd.getAll("id").map(Number));

  if (action === "delete") {
    const deletedIds = await (
      await getWorker(context.worker)
    ).deleteRuns(selected);
    return json(deletedIds);
  }
  return json({
    success: true,
  });
};
