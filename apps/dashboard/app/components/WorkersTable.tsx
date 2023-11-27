import type { PublicWorkerSchema } from "@enschedule/types";
import { WorkerStatus } from "@enschedule/types";
import { Tooltip, Typography } from "@mui/material";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import type { SerializeFrom } from "@remix-run/node";
import { Link as RemixLink } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { sentenceCase } from "sentence-case";
import type { z } from "zod";
import { formatDate } from "~/utils/formatDate";
import { ExpandableTable } from "./Table";

export type RowData = SerializeFrom<z.output<typeof PublicWorkerSchema>>;

const columnHelper = createColumnHelper<RowData>();

const columns: ColumnDef<RowData, any>[] = [
  columnHelper.accessor("status", {
    cell: (info) => {
      const s: WorkerStatus = info.getValue();
      const icons: { [key in WorkerStatus]: string } = {
        [WorkerStatus.PENDING]: "⚠️",
        [WorkerStatus.UP]: "✅",
        [WorkerStatus.DOWN]: "❗️",
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
  }),
  columnHelper.accessor("title", {
    cell: (info) => {
      const workerId = info.row.original.id;
      return (
        <MuiLink
          to={String(workerId)}
          component={RemixLink}
          onClick={(ev) => ev.stopPropagation()}
          data-testid="worker-link"
        >
          {info.getValue()}
        </MuiLink>
      );
    },
    header: "Title",
  }),
  columnHelper.accessor("workerId", {
    cell: (info) => {
      return info.getValue();
    },
    header: "ID",
  }),
  columnHelper.accessor("description", {
    cell: (info) => {
      return info.getValue() ?? "-";
    },
    header: "Description",
  }),
  columnHelper.accessor("version", {
    cell: (info) => {
      return info.getValue();
    },
    header: "Version",
  }),
  columnHelper.accessor("hostname", {
    cell: (info) => {
      return info.getValue();
    },
    header: "Hostname",
  }),
  columnHelper.accessor("instanceId", {
    cell: (info) => {
      return info.getValue();
    },
    header: "Instance ID",
  }),
  columnHelper.accessor("lastReached", {
    cell: (info) => {
      const date = info.getValue();
      return formatDate(new Date(date), false).label;
    },
    header: "Last reached",
    sortingFn: (a, b) => {
      const ad = a.original.lastReached
        ? new Date(a.original.lastReached).getTime()
        : 0;
      const bd = b.original.lastReached
        ? new Date(b.original.lastReached).getTime()
        : 0;
      return ad - bd;
    },
  }),
  columnHelper.accessor("createdAt", {
    cell: (info) => {
      const date = info.getValue();
      return formatDate(new Date(date), false).label;
    },
    header: "Age",
  }),
  columnHelper.accessor(
    (data) => {
      return data.runs.length;
    },
    {
      cell: (info) => {
        return info.getValue();
      },
      header: "Runs",
      id: "rumRuns",
    }
  ),
  columnHelper.accessor(
    (data) => {
      return data.definitions.length;
    },
    {
      cell: (info) => {
        return info.getValue();
      },
      header: "Handlers",
      id: "rumHandlers",
    }
  ),
  // columnHelper.accessor(
  //   (data) => {
  //     return data.runAt
  //       ? formatDate(new Date(data.runAt), false).label
  //       : "Not scheduled";
  //   },
  //   {
  //     cell: (info) => {
  //       return (
  //         <Typography variant="inherit" data-testid="runAt">
  //           {info.getValue()}
  //         </Typography>
  //       );
  //     },
  //     header: "Next scheduled run",
  //     id: "runAt",
  //     sortingFn: (a, b) => {
  //       const ad = a.original.runAt ? new Date(a.original.runAt).getTime() : 0;
  //       const bd = b.original.runAt ? new Date(b.original.runAt).getTime() : 0;
  //       return ad - bd;
  //     },
  //   }
  // ),
  // columnHelper.accessor(
  //   (data) => {
  //     return data.lastRun?.startedAt ?? "-";
  //   },
  //   {
  //     cell: (info) => {
  //       const lastRun = info.getValue();
  //       if (lastRun === "-") {
  //         return "-";
  //       }
  //       const value = formatDate(new Date(info.getValue()), false);
  //       return value.label;
  //     },
  //     header: "Last run",
  //     id: "last-run",
  //   }
  // ),
  // columnHelper.accessor("numRuns", {
  //   cell: (info) => {
  //     return (
  //       <Typography variant="inherit" data-testid="num-runs">
  //         {info.getValue()}
  //       </Typography>
  //     );
  //   },
  //   header: "Number of runs",
  // }),
  // columnHelper.accessor("retryFailedJobs", {
  //   cell: (info) => {
  //     return info.getValue() ? "Yes" : "No";
  //   },
  //   header: "Retry failed jobs",
  // }),
  // columnHelper.accessor("maxRetries", {
  //   cell: (info) => {
  //     if (!info.row.getValue("retryFailedJobs")) {
  //       return "-";
  //     }
  //     if (info.getValue() === -1) {
  //       return (
  //         <Typography
  //           variant="inherit"
  //           component="div"
  //           display="flex"
  //           gap={0.5}
  //           alignItems="center"
  //         >
  //           Unlimited
  //           {info.row.getValue("status") === ScheduleStatus.RETRYING && (
  //             <>
  //               {" "}
  //               <CancelRetryForm id={info.row.original.id} />
  //             </>
  //           )}
  //         </Typography>
  //       );
  //     }
  //     return info.getValue();
  //   },
  //   header: "Max retries",
  // }),
  // columnHelper.accessor("retries", {
  //   cell: (info) => {
  //     if (!info.row.getValue("retryFailedJobs")) {
  //       return "-";
  //     }
  //     return info.getValue();
  //   },
  //   header: "Num retries",
  // }),
  // columnHelper.accessor("jobDefinition.title", {
  //   cell: (info) => {
  //     return info.getValue();
  //   },
  //   header: "Job definition",
  // }),
];

export default function WorkersTable({ workers }: { workers: RowData[] }) {
  return (
    <Box sx={{ width: "100%" }} id="WorkersTable">
      <ExpandableTable
        id="WorkersTable"
        defaultSorting={[{ id: "lastReached", desc: true }]}
        rows={workers}
        title="Workers"
        columns={columns}
      />
    </Box>
  );
}
