import type { PublicJobRun } from "@enschedule/types";
import { RunStatus } from "@enschedule/types";
import { Tooltip, Typography } from "@mui/material";
import MuiLink from "@mui/material/Link";
import type { ActionFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link as RemixLink } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { sentenceCase } from "sentence-case";
import { z } from "zod";
import { ExpandableTable } from "~/components/Table";
import { getWorker } from "~/createWorker.server";
import { formatDate, formatDuration } from "~/utils/formatDate";
import RunPage from "./RunPage";
import { createMsButtons } from "./createMsButtons";

type RowData = SerializeFrom<PublicJobRun>;

const columnHelper = createColumnHelper<RowData>();

const columns: ColumnDef<RowData, any>[] = [
  columnHelper.accessor("status", {
    id: "status",
    cell: (info) => {
      const s: RunStatus = info.getValue();
      const icons: { [key in RunStatus]: string } = {
        [RunStatus.RUNNING]: "🚀",
        [RunStatus.FAILED]: "⚠️",
        [RunStatus.LOST]: "🤷‍♂️",
        [RunStatus.SUCCESS]: "✅",
      };

      return (
        <Tooltip title={sentenceCase(s)} disableInteractive>
          <Typography
            variant="inherit"
            data-testid="status"
            data-status={s}
            sx={{ cursor: "default" }}
          >
            {icons[s]}
          </Typography>
        </Tooltip>
      );
    },
    header: "Status",
    enableSorting: false,
    enableMultiSort: false
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
      return formatDate(new Date(value), { verbs: false }).label;
    },
    header: "Started",
  }),
  {
    cell: ({ row, getValue }) => {
      return (
        <Typography suppressHydrationWarning fontSize="inherit">
          {getValue()}
        </Typography>
      );
    },
    enableSorting: true,
    header: "Duration",
    id: "duration",
    accessorFn: (run) => {
      if (run.status === RunStatus.LOST) {
        return "-";
      }
      return formatDuration(
        run.finishedAt
          ? new Date(run.finishedAt).getTime() -
              new Date(run.startedAt).getTime()
          : Date.now() - new Date(run.startedAt).getTime()
      );
    },
  },
  columnHelper.accessor("finishedAt", {
    cell: (info) => {
      const value = info.getValue();
      if (!value) {
        return "-";
      }
      return formatDate(new Date(value), { verbs: false }).label;
    },
    header: "Completed",
  }),
  {
    cell: (info) => {
      const val = info.row.original.worker;
      if (typeof val === "string") {
        return `Deleted worker (${val})`;
      }
      return (
        <MuiLink
          to={`/workers/${val.id}`}
          data-testid="worker-link"
          component={RemixLink}
          onClick={(ev) => {
            ev.stopPropagation();
          }}
        >
          {val.title}
        </MuiLink>
      );
    },
    enableSorting: true,
    header: "Worker",
    id: "worker",
  },
  columnHelper.accessor("scheduledToRunAt", {
    cell: (info) => {
      const value = info.getValue();
      return formatDate(new Date(value), { verbs: false }).label;
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
  {
    cell: (info) => {
      const text = info.getValue();
      const val = info.row.original.jobSchedule;
      if (typeof val === "string") {
        return `Deleted schedule (${text})`;
      }
      return (
        <MuiLink
          to={`/schedules/${val.id}`}
          data-testid="schedule-link"
          component={RemixLink}
          onClick={(ev) => {
            ev.stopPropagation();
          }}
        >
          {text}
        </MuiLink>
      );
    },
    enableSorting: true,
    header: "Schedule",
    id: "schedule",
    accessorFn: (run) => {
      if (typeof run.jobSchedule === "string") {
        return run.jobSchedule;
      }
      return run.jobSchedule.title;
    },
  },
  {
    cell: (info) => {
      const text = info.getValue();
      const val = info.row.original.jobDefinition;
      if (typeof val === "string") {
        return `Function could not be found (${text})`;
      }
      return (
        <MuiLink
          to={`/definitions/${val.id}`}
          data-testid="definition-link"
          component={RemixLink}
          onClick={(ev) => {
            ev.stopPropagation();
          }}
        >
          {text}
        </MuiLink>
      );
    },
    enableSorting: true,
    header: "Function",
    id: "handler",
    accessorFn: (run) => {
      if (typeof run.jobDefinition === "string") {
        return run.jobDefinition;
      }
      return run.jobDefinition.title;
    },
  },
];

const { ToolbarWrapper, MsButtons } = createMsButtons({
  formAction: "/runs?index",
});

export default function RunsTable({
  runs,
  count,
}: SerializeFrom<{
  runs: PublicJobRun[];
  count: number;
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
      count={count}
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
