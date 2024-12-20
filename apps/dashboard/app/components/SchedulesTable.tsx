import type { PublicJobSchedule } from "@enschedule/types";
import { ScheduleStatus } from "@enschedule/types";
import { Tooltip, Typography } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import type { ActionFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link as RemixLink, useHref } from "@remix-run/react";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { sentenceCase } from "sentence-case";
import { z } from "zod";
import { getWorker } from "~/createWorker.server";
import { formatDate } from "~/utils/formatDate";
import { createMsButtons } from "./createMsButtons";
import { ExpandableTable } from "./Table";

export type RowData = SerializeFrom<PublicJobSchedule>;

const columnHelper = createColumnHelper<RowData>();

const columns: ColumnDef<RowData, any>[] = [
  columnHelper.accessor("status", {
    cell: (info) => {
      const s: ScheduleStatus = info.getValue();
      const icons: { [key in ScheduleStatus]: string } = {
        [ScheduleStatus.FAILED]: "❌",
        [ScheduleStatus.SCHEDULED]: "📅",
        [ScheduleStatus.UNSCHEDULED]: "💭",
        [ScheduleStatus.RETRYING]: "🔄",
        [ScheduleStatus.RUNNING]: "🚀",
        [ScheduleStatus.SUCCESS]: "✅",
        [ScheduleStatus.NO_WORKER]: "⚠️",
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
      return data.runNow
        ? "Now"
        : data.runAt
        ? formatDate(new Date(data.runAt), { verbs: false }).label
        : "Not scheduled";
    },
    {
      cell: (info) => {
        return (
          <Typography
            variant="inherit"
            data-testid="runAt"
            suppressHydrationWarning
          >
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
        const value = formatDate(new Date(info.getValue()), { verbs: false });
        return (
          <Typography variant="inherit" suppressHydrationWarning>
            {value.label}
          </Typography>
        );
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
  columnHelper.accessor("retryFailedJobs", {
    cell: (info) => {
      return info.getValue() ? "Yes" : "No";
    },
    header: "Retry failed jobs",
  }),
  columnHelper.accessor("maxRetries", {
    cell: (info) => {
      if (!info.row.getValue("retryFailedJobs")) {
        return "-";
      }
      if (info.getValue() === -1) {
        return (
          <Typography
            variant="inherit"
            component="div"
            display="flex"
            gap={0.5}
            alignItems="center"
          >
            Unlimited
            {info.row.getValue("status") === ScheduleStatus.RETRYING && (
              <>
                {" "}
                <CancelRetryForm id={info.row.original.id} />
              </>
            )}
          </Typography>
        );
      }
      return info.getValue();
    },
    header: "Max retries",
  }),
  columnHelper.accessor("retries", {
    cell: (info) => {
      if (!info.row.getValue("retryFailedJobs")) {
        return "-";
      }
      return info.getValue();
    },
    header: "Num retries",
  }),
  columnHelper.accessor("jobDefinition", {
    cell: (info) => {
      return typeof info.getValue() === "string"
        ? info.getValue()
        : info.getValue().title;
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

export const action: ActionFunction = async ({ request, context }) => {
  const fd = await request.formData();
  const action = z
    .union([z.literal("delete"), z.literal("run"), z.literal("unschedule")])
    .parse(fd.get("action"));
  const selected = z.array(z.number().int()).parse(fd.getAll("id").map(Number));
  if (action === "run") {
    await (await getWorker(context.worker)).runSchedulesNow(selected);
  } else if (action === "delete") {
    await (await getWorker(context.worker)).deleteSchedules(selected);
  } else if (action === "unschedule") {
    await (await getWorker(context.worker)).unschedule(selected);
  }
  return json({ success: true });
};

function CancelRetryForm({ id }: { id: number }) {
  const url = useHref("");
  return (
    <Form
      action={`${id}/edit-details?parentUrl=${encodeURIComponent(url)}`}
      method="post"
      style={{ display: "contents" }}
    >
      <input type="hidden" value="false" name="retryFailedJobs" />
      <input type="hidden" value={""} name="runAt" />
      <MuiLink
        component="button"
        data-testid="stop-unlimited-retries"
        type="submit"
        onClick={(ev) => ev.stopPropagation()}
      >
        (stop)
      </MuiLink>
    </Form>
  );
}
