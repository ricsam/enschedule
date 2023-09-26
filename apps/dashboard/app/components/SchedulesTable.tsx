import type { PublicJobSchedule } from "@enschedule/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import type { ActionFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link as RemixLink } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import assert from "assert";
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
  columnHelper.accessor("runAt", {
    cell: (info) => {
      const value = formatDate(new Date(info.getValue()), false);
      return value.label;
    },
    header: "Next scheduled run",
  }),
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
    }
  ),
  columnHelper.accessor("numRuns", {
    cell: (info) => {
      return info.getValue();
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
        <Button variant="text" color="inherit">
          Edit data
        </Button>
        <Button variant="text" color="inherit">
          Unschedule
        </Button>
        <Button
          variant="text"
          color="inherit"
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
  assert(
    fd.has("schedule"),
    "you must provide schedule field in the form data"
  );
  const action = z
    .union([z.literal("delete"), z.literal("run")])
    .parse(fd.get("action"));
  const selected = z
    .array(z.number().int())
    .parse(fd.getAll("id").map(Number));
  if (action === "run") {
    await Promise.all(
      selected.map(async (id) => {
        return scheduler.runSchedule(id);
      })
    );
  } else if (action === "delete") {
    await scheduler.deleteSchedules(selected);
  }
  return json({ success: true });
};
