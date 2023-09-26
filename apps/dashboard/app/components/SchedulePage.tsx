import type { PublicJobRun, PublicJobSchedule } from "@enschedule/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { ActionFunction, SerializeFrom } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { Form, Link } from "@remix-run/react";
import { z } from "zod";
import { ReadOnlyEditor } from "~/components/Editor";
import { scheduler } from "~/scheduler.server";
import { formatDate } from "~/utils/formatDate";
import { getParentUrl } from "~/utils/getParentUrl";
import RunPage from "./RunPage";

export default function SchedulePage({
  schedule,
  runs,
}: SerializeFrom<{
  schedule: PublicJobSchedule;
  runs: PublicJobRun[];
}>) {
  const lastRun = schedule.lastRun;

  return (
    <Box>
      <Box display="flex" gap={3} flexWrap="wrap" id="SchedulePage">
        <Card
          sx={{
            flex: 1,
            minWidth: "fit-content",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <CardContent sx={{ flex: 1 }}>
            <Typography variant="h5" gutterBottom>
              Details
            </Typography>
            <Box display="grid" gridTemplateColumns="auto 1fr" columnGap={2}>
              {schedule.runAt ? (
                <>
                  <Typography color="text.secondary">Next run</Typography>
                  <Typography color="text.primary">
                    {formatDate(new Date(schedule.runAt), false).label}
                  </Typography>
                </>
              ) : null}
              <Typography color="text.secondary">Title</Typography>
              <Typography color="text.primary">{schedule.title}</Typography>
              <Typography color="text.secondary">Description</Typography>
              <Typography color="text.primary">
                {schedule.description}
              </Typography>
              <Typography color="text.secondary">Definition</Typography>
              <MuiLink
                underline="hover"
                component={Link}
                data-testid="definition-link"
                to={"/definitions/" + schedule.jobDefinition.id}
              >
                {schedule.jobDefinition.title}
              </MuiLink>
              {schedule.cronExpression ? (
                <>
                  <Typography color="text.secondary">CRON</Typography>
                  <Typography color="text.primary">
                    {schedule.cronExpression}
                  </Typography>
                </>
              ) : null}
              <Typography color="text.secondary">Created</Typography>
              <Typography color="text.primary">
                {formatDate(new Date(schedule.createdAt), false).label}
              </Typography>
              <Typography color="text.secondary">Last run</Typography>
              <Typography color="text.primary">
                {lastRun
                  ? formatDate(new Date(lastRun.startedAt), false).label
                  : "-"}
              </Typography>
              <Typography color="text.secondary">Number of runs</Typography>
              <Typography color="text.primary">{schedule.numRuns}</Typography>
            </Box>
          </CardContent>
          <CardActions>
            <Button>Update</Button>
          </CardActions>
        </Card>
        <Card
          sx={{
            flex: 1,
            minWidth: "fit-content",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <CardContent sx={{ flex: 1 }}>
            <Typography variant="h5" gutterBottom>
              Data
            </Typography>
            <Typography color="text.secondary">
              This schedule will run{" "}
              <MuiLink component={Link} to="/" underline="hover">
                {schedule.jobDefinition.title}
              </MuiLink>{" "}
              with the following data:
            </Typography>
            <Box pb={1} />
            <Box maxWidth="320px" overflow="hidden">
              <ReadOnlyEditor
                example={JSON.stringify(JSON.parse(schedule.data), null, 2)}
                lang="json"
              ></ReadOnlyEditor>
            </Box>
          </CardContent>
          <CardActions>
            <Button>Update</Button>
          </CardActions>
        </Card>
      </Box>

      {lastRun ? (
        <>
          <Box py={3}>
            <Typography variant="h5">Last run</Typography>
            <Typography variant="body1" color="text.secondary">
              This is the last run, run number{" "}
              {runs.findIndex((run) => run.id === lastRun.id) + 1}. To see
              previous run click{" "}
              <MuiLink component={Link} to="/" underline="hover">
                here
              </MuiLink>
              .
            </Typography>
          </Box>
          <RunPage run={lastRun} schedule={schedule} />
        </>
      ) : null}
    </Box>
  );
}

export function Actions({
  action,
  runRedirect,
}: {
  action: string;
  runRedirect: string;
}) {
  return (
    <>
      <Box display="flex" gap={2}>
        <Form method="post" action={action}>
          <Button
            type="submit"
            variant="outlined"
            data-testid="delete-schedule"
          >
            Delete
          </Button>
          <input type="hidden" name="action" value="delete" />
        </Form>
        <Form method="post" action={action}>
          <Button type="submit" variant="contained" data-testid="run-now">
            Run now
          </Button>
          <input type="hidden" name="action" value="run" />
          <input type="hidden" name="redirect" value={runRedirect} />;
        </Form>
      </Box>
    </>
  );
}

export const getScheduleId = (params: Params<string>): number => {
  const scheduleId = params.scheduleId;
  const id = Number(scheduleId);
  if (Number.isNaN(id)) {
    throw new Error("invalid id");
  }
  return id;
};

export const action: ActionFunction = async (arg) => {
  const { request, params } = arg;
  const fd = await request.formData();
  const action = z
    .union([z.literal("delete"), z.literal("run")])
    .parse(fd.get("action"));

  const id = getScheduleId(params);
  if (action === "run") {
    const redirectTo = z.string().parse(fd.get("redirect"));
    await scheduler.runSchedule(id);
    return redirect(redirectTo);
  } else {
    await scheduler.deleteSchedule(id);
    return redirect(getParentUrl(request.url));
  }
};
