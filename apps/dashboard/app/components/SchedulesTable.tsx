import type { PublicJobSchedule } from "@enschedule/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import type { SerializeFrom } from "@remix-run/node";
import { Link as RemixLink, useFetcher } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { formatDate } from "~/utils/formatDate";
import { useSelected } from "./EnhancedTableToolbar";
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
        id="SchedulesTable"
        rows={schedules}
        title="Schedules"
        columns={columns}
        msButtons={<MsButtons />}
      />
    </Box>
  );
}

function MsButtons() {
  const { table } = useSelected();
  const fetcher = useFetcher();

  const submit = (action: "delete" | "run") => {
    const formData = new FormData();
    formData.set("action", action);
    const selected = table
      .getSelectedRowModel()
      .rows.map(({ original: { id } }) => id);
    selected.forEach((selected) => {
      formData.append("schedule", String(selected));
    });
    fetcher.submit(formData, { method: "post", action: "/schedules?index" });
  };

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
      <Button
        variant="text"
        color="inherit"
        onClick={() => {
          submit("delete");
        }}
      >
        Delete
      </Button>
    </>
  );
}
