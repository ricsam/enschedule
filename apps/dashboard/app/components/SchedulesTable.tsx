import type { PublicJobSchedule } from "@enschedule/types";
import { Typography } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import type { ActionFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link as RemixLink } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { z } from "zod";
import { scheduler } from "~/scheduler.server";
import { formatDate } from "~/utils/formatDate";
import { createMsButtons } from "./createMsButtons";
import { ExpandableTable } from "./Table";

export type RowData = SerializeFrom<PublicJobSchedule>;

const columnHelper = createColumnHelper<RowData>();

const columns: ColumnDef<RowData, any>[] = [
  columnHelper.accessor("title", {
    cell: (info) => {
      const scheduleId = info.row.original.id;
      return (
        <MuiLink
          to={String(scheduleId)}
          component={RemixLink}
          onClick={(ev) => ev.stopPropagation()}
          data-testid="schedule-link"
        >
          {info.getValue()}
        </MuiLink>
      );
    },
    header: "Title",
  }),
  columnHelper.accessor("description", {
    cell: (info) => {
      return info.getValue();
    },
    header: "Description",
  }),
  columnHelper.accessor(
    (data) => {
      return data.runAt
        ? formatDate(new Date(data.runAt), false).label
        : "Not scheduled";
    },
    {
      cell: (info) => {
        return (
          <Typography variant="inherit" data-testid="runAt">
            {info.getValue()}
          </Typography>
        );
      },
      header: "Next scheduled run",
      id: "runAt",
      sortingFn: (a, b) => {
        const ad = a.original.runAt ? new Date(a.original.runAt).getTime() : 0;
        const bd = b.original.runAt ? new Date(b.original.runAt).getTime() : 0;
        return ad - bd;
      },
    }
  ),
  columnHelper.accessor(
    (data) => {
      return data.lastRun?.startedAt ?? "-";
    },
    {
      cell: (info) => {
        const lastRun = info.getValue();
        if (lastRun === "-") {
          return "-";
        }
        const value = formatDate(new Date(info.getValue()), false);
        return value.label;
      },
      header: "Last run",
      id: "last-run",
    }
  ),
  columnHelper.accessor("numRuns", {
    cell: (info) => {
      return (
        <Typography variant="inherit" data-testid="num-runs">
          {info.getValue()}
        </Typography>
      );
    },
    header: "Number of runs",
  }),
  columnHelper.accessor("jobDefinition.title", {
    cell: (info) => {
      return info.getValue();
    },
    header: "Job definition",
  }),
];

const { ToolbarWrapper, MsButtons } = createMsButtons({
  formAction: "/schedules?index",
  Buttons: ({ submit }) => {
    return (
      <>
        <Button
          variant="text"
          color="inherit"
          data-testid="ms-unschedule"
          onClick={() => {
            submit("unschedule");
          }}
        >
          Unschedule
        </Button>
        <Button
          variant="text"
          color="inherit"
          data-testid="ms-run"
          onClick={() => {
            submit("run");
          }}
        >
          Run
        </Button>
        <Box
          borderRight={(theme) => `thin solid ${theme.palette.divider}`}
          height={32}
        />
      </>
    );
  },
});

export default function SchedulesTable({
  schedules,
}: {
  schedules: RowData[];
}) {
  return (
    <Box sx={{ width: "100%" }} id="SchedulesTable">
      <ExpandableTable
        defaultSorting={[
          {
            id: "runAt",
            desc: true,
          },
        ]}
        ToolbarWrapper={ToolbarWrapper}
        id="SchedulesTable"
        rows={schedules}
        title="Schedules"
        columns={columns}
        msButtons={<MsButtons />}
      />
    </Box>
  );
}

export const action: ActionFunction = async ({ request }) => {
  const fd = await request.formData();
  const action = z
    .union([z.literal("delete"), z.literal("run"), z.literal("unschedule")])
    .parse(fd.get("action"));
  const selected = z.array(z.number().int()).parse(fd.getAll("id").map(Number));
  if (action === "run") {
    await scheduler.runSchedulesNow(selected);
  } else if (action === "delete") {
    await scheduler.deleteSchedules(selected);
  } else if (action === "unschedule") {
    await scheduler.unschedule(selected);
  }
  return json({ success: true });
};
