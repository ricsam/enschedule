import type {
  PublicJobSchedule,
  PublicWorker,
  ScheduleUpdatePayloadSchema,
} from "@enschedule/types";
import { DateSchema } from "@enschedule/types";
import CloseIcon from "@mui/icons-material/Close";
import {
  CircularProgress,
  DialogContent,
  FormControlLabel,
  IconButton,
  Snackbar,
  Switch,
  TextField,
  Tooltip,
} from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { ActionFunction, SerializeFrom } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import {
  Form,
  Link,
  useNavigate,
  useNavigation,
  useRevalidator,
} from "@remix-run/react";
import format from "date-fns/format";
import parseISO from "date-fns/parseISO";
import React from "react";
import { sentenceCase } from "sentence-case";
import { z } from "zod";
import { Editor } from "~/components/Editor";
import { getWorker } from "~/createWorker.server";
import { getAuthHeader } from "~/sessions";
import { formatDate } from "~/utils/formatDate";
import { getParentUrl } from "~/utils/getParentUrl";
import RunPage from "./RunPage";

export const editDetailsAction: ActionFunction = async ({
  request,
  params,
  context,
}) => {
  const scheduleId = getScheduleId(params);
  const authHeader = await getAuthHeader(request);
  const schedule = await (
    await getWorker(context.worker)
  ).getSchedule(authHeader, scheduleId);
  if (!schedule) {
    throw new Error("Invalid scheduleId");
  }
  const fd = await request.formData();
  const scheduleUpdatePayload: z.output<typeof ScheduleUpdatePayloadSchema> = {
    id: scheduleId,
  };
  const init = {
    runAt: schedule.runAt ? normalizeDate(schedule.runAt.toJSON()) : "",
    description: schedule.description || "",
    runNow: schedule.runNow,
    title: schedule.title,
    data: schedule.data,
    retryFailedJobs: schedule.retryFailedJobs,
    maxRetries: schedule.maxRetries,
  };

  const p = (k: string) => z.string().nullable().parse(fd.get(k));

  const runAt = p("runAt");
  const runNow = p("runNow");
  const description = p("description");
  const title = p("title");
  const data = p("data");
  const retryFailedJobs = p("retryFailedJobs");
  const maxRetries = p("maxRetries");

  let updated = false;
  if (runAt !== null && init.runAt !== runAt) {
    scheduleUpdatePayload.runAt = runAt === "" ? null : DateSchema.parse(runAt);
    updated = true;
  }
  if (runNow !== null && init.runNow !== (runNow === "true")) {
    if (runNow === "true") {
      scheduleUpdatePayload.runNow = true;
      updated = true;
    } else {
      scheduleUpdatePayload.runNow = false;
      updated = true;
    }
  }
  if (description !== null && init.description !== description) {
    scheduleUpdatePayload.description = description || null;
    updated = true;
  }
  if (data !== null && init.data !== data) {
    scheduleUpdatePayload.data = data;
    updated = true;
  }
  if (title !== null && init.title !== title) {
    scheduleUpdatePayload.title = title;
    updated = true;
  }
  if (retryFailedJobs !== null) {
    if (["true", "false"].includes(retryFailedJobs)) {
      const value = retryFailedJobs === "true";
      if (value !== init.retryFailedJobs) {
        scheduleUpdatePayload.retryFailedJobs = value;
        updated = true;
      }
    }
  }
  if (maxRetries !== null) {
    const parsed = parseInt(maxRetries, 10);
    if (!Number.isNaN(parsed) && parsed >= -1 && parsed !== init.maxRetries) {
      scheduleUpdatePayload.maxRetries = parsed;
      updated = true;
    }
  }
  if (updated) {
    await (
      await getWorker(context.worker)
    ).updateSchedule(authHeader, scheduleUpdatePayload);
  }
  return redirect(getParentUrl(request.url));
};

const dateToLocal = (dt: string) => {
  const date = parseISO(dt);
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
};

/**
 * ### 3 step conversion:
 * 1. utc   2023-09-26T18:30:18.381Z
 * 2. local 2023-09-26T20:30:18
 * 3. utc   2023-09-26T18:30:18.000Z
 */
const normalizeDate = (input: string) => {
  if (!input) {
    return undefined;
  }
  const localTime = dateToLocal(input);
  return parseISO(localTime).toJSON();
};
function EditForm({
  schedule,
  onClose,
}: {
  schedule: SerializeFrom<PublicJobSchedule>;
  onClose: () => void;
}) {
  const [title, setTitle] = React.useState(schedule.title);
  const [description, setDescription] = React.useState(
    schedule.description || ""
  );
  const initScheduledFor = schedule.runAt
    ? normalizeDate(schedule.runAt)
    : undefined;
  const [scheduledFor, setScheduledFor] = React.useState(initScheduledFor);
  const [runNow, setRunNow] = React.useState(schedule.runNow);
  const [retryFailedJobs, setRetryFailedJobs] = React.useState(
    schedule.retryFailedJobs
  );
  const [maxRetries, setMaxRetries] = React.useState(
    String(schedule.maxRetries)
  );
  const dateInputValue = scheduledFor ? dateToLocal(scheduledFor) : "";

  // use formValues just to track if it has updated or not
  const formValues: Record<string, string | null> = {};
  if (title !== schedule.title) {
    formValues.title = title;
  }
  if (description !== (schedule.description || "")) {
    formValues.description = description;
  }
  if (scheduledFor !== initScheduledFor) {
    formValues.runAt = scheduledFor ?? null;
  }
  if (runNow !== schedule.runNow) {
    formValues.runNow = runNow ? "true" : "false";
  }
  if (retryFailedJobs !== schedule.retryFailedJobs) {
    formValues.retryFailedJobs = String(retryFailedJobs);
  }
  if (
    parseInt(maxRetries, 10) !== schedule.maxRetries &&
    parseInt(maxRetries, 10) >= -1
  ) {
    formValues.maxRetries = maxRetries;
  }
  const canSubmit = Object.values(formValues).length > 0;

  return (
    <Form action="" method="post" data-testid="edit-details-form">
      <Box
        pt={1}
        sx={{
          "& > *": {
            my: "8px !important",
          },
        }}
      >
        <TextField
          label="Title"
          fullWidth
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          name="title"
          inputProps={{
            "data-testid": "title-field",
          }}
        ></TextField>
        <TextField
          label="Description"
          fullWidth
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          name="description"
          inputProps={{
            "data-testid": "description-field",
          }}
        ></TextField>

        <Box sx={{ display: "flex", alignItems: "flex-end" }} gap={0.5}>
          <input type="hidden" value={scheduledFor ?? ""} name="runAt" />
          <input
            type="hidden"
            value={runNow ? "true" : "false"}
            name="runNow"
          />
          <TextField
            InputLabelProps={{ shrink: true }}
            label="Next run (local time)"
            type="datetime-local"
            fullWidth
            value={dateInputValue}
            onChange={(ev) => {
              return setScheduledFor(parseISO(ev.target.value).toJSON());
            }}
            inputProps={{
              "data-testid": "runAt-field",
            }}
          ></TextField>
          <Box
            sx={{
              flexShrink: 0,
              height: "56px",
              display: "flex",
              alignItems: "stretch",
              width: "140px",
            }}
          >
            {(!scheduledFor && "runAt" in formValues) ||
            (!runNow && schedule.runNow) ? (
              <Button
                size="large"
                variant="text"
                color="inherit"
                fullWidth
                onClick={() => {
                  setScheduledFor(initScheduledFor);
                  setRunNow(schedule.runNow);
                }}
              >
                Reset
              </Button>
            ) : (
              <Button
                size="large"
                fullWidth
                variant="text"
                color="inherit"
                disabled={!scheduledFor && !schedule.runNow}
                onClick={() => {
                  setScheduledFor(undefined);
                  setRunNow(false);
                }}
                data-testid="unschedule"
              >
                Unschedule
              </Button>
            )}
          </Box>
        </Box>
        {!retryFailedJobs && (
          <input type="hidden" value="false" name="retryFailedJobs" />
        )}
        <FormControlLabel
          control={
            <Switch
              checked={retryFailedJobs}
              onChange={(ev, checked) => setRetryFailedJobs(checked)}
              name="retryFailedJobs"
              value={"true"}
            />
          }
          label="Retry failed jobs"
        />
        <TextField
          label="Max retries"
          fullWidth
          disabled={!retryFailedJobs}
          value={retryFailedJobs ? maxRetries : ""}
          onChange={(ev) => setMaxRetries(ev.target.value)}
          name="maxRetries"
        ></TextField>
      </Box>
      <Box display="flex" justifyContent="flex-end" gap={1} pt={2}>
        <Button
          variant="text"
          onClick={() => {
            onClose();
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSubmit}
          type="submit"
          data-testid="submit"
        >
          Save
        </Button>
      </Box>
    </Form>
  );
}

export default function SchedulePage({
  schedule,
  editDetails,
}: SerializeFrom<{
  schedule: PublicJobSchedule;
  editDetails?: boolean;
}>) {
  const lastRun = schedule.lastRun;
  const navigate = useNavigate();
  const goBack = () => {
    navigate("../", { relative: "path", preventScrollReset: true });
  };

  return (
    <Box>
      <Box display="flex" gap={3} flexWrap="wrap" id="SchedulePage">
        <Card
          data-testid="schedule-details"
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
              <Typography color="text.secondary">Status</Typography>
              <Typography color="text.primary">
                {sentenceCase(schedule.status)}
              </Typography>
              <Typography color="text.secondary">Next run</Typography>
              <Tooltip
                title={
                  schedule.runAt
                    ? format(new Date(schedule.runAt), "yyyy-MM-dd HH:mm:ss")
                    : null
                }
                placement="left-start"
              >
                <Typography
                  color="text.primary"
                  data-testid="next-run"
                  component={"div"}
                  sx={{ cursor: "help" }}
                >
                  {schedule.runNow ? (
                    "Scheduled to run now"
                  ) : schedule.runAt ? (
                    formatDate(new Date(schedule.runAt), { verbs: false }).label
                  ) : (
                    <>
                      Not scheduled, click{" "}
                      <MuiLink
                        data-testid="no-run-at-edit"
                        component={Link}
                        to="edit-details"
                        preventScrollReset
                        underline="hover"
                      >
                        here
                      </MuiLink>{" "}
                      to schedule
                    </>
                  )}
                </Typography>
              </Tooltip>
              <Typography color="text.secondary">Title</Typography>
              <Typography color="text.primary" data-testid="schedule-title">
                {schedule.title}
              </Typography>
              <Typography color="text.secondary">Description</Typography>
              <Typography
                color="text.primary"
                data-testid="schedule-description"
              >
                {schedule.description || "-"}
              </Typography>
              <Typography color="text.secondary">Definition</Typography>
              {typeof schedule.jobDefinition === "string" ? (
                <Typography component="span">
                  Job not defined on the server ({schedule.jobDefinition})
                </Typography>
              ) : (
                <MuiLink
                  underline="hover"
                  component={Link}
                  data-testid="definition-link"
                  to={"/definitions/" + schedule.jobDefinition.id}
                >
                  {schedule.jobDefinition.title} (v
                  {schedule.jobDefinition.version})
                </MuiLink>
              )}
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
                {
                  formatDate(new Date(schedule.createdAt), { verbs: false })
                    .label
                }
              </Typography>
              <Typography color="text.secondary">Last run</Typography>
              <Typography color="text.primary">
                {lastRun
                  ? formatDate(new Date(lastRun.startedAt), { verbs: false })
                      .label
                  : "-"}
              </Typography>
              <Typography color="text.secondary">Number of runs</Typography>
              <Typography color="text.primary" data-testid="number-of-runs">
                {schedule.numRuns}
              </Typography>
              <Typography color="text.secondary">Retry failed jobs</Typography>
              <Typography color="text.primary" data-testid="retry-failed-jobs">
                {schedule.retryFailedJobs ? "Yes" : "No"}
              </Typography>
              {schedule.retryFailedJobs && (
                <>
                  <Typography color="text.secondary">Max retries</Typography>
                  <Typography color="text.primary" data-testid="max-retries">
                    {schedule.maxRetries === -1
                      ? "Unlimited"
                      : schedule.maxRetries}
                  </Typography>
                  <Typography color="text.secondary">Num retries</Typography>
                  <Typography color="text.primary" data-testid="num-retries">
                    {schedule.retries === -1 ? "None" : schedule.retries}
                  </Typography>
                </>
              )}
            </Box>
          </CardContent>
          <CardActions>
            <Button
              component={Link}
              LinkComponent={Link}
              to="edit-details"
              preventScrollReset
              data-testid="edit-details"
            >
              Update
            </Button>
          </CardActions>
        </Card>

        <Dialog
          onClose={() => {
            goBack();
          }}
          open={!!editDetails}
        >
          <DialogTitle>Update details</DialogTitle>
          <DialogContent>
            <EditForm schedule={schedule} onClose={goBack} />
          </DialogContent>
        </Dialog>

        {typeof schedule.jobDefinition !== "string" &&
        schedule.jobDefinition.jsonSchema &&
        schedule.data ? (
          <DataCard schedule={schedule} />
        ) : null}
      </Box>

      {lastRun ? (
        <>
          <Box py={3}>
            <Typography variant="h5">Last run</Typography>
            <Typography variant="body1" color="text.secondary">
              This is the last run,{" "}
              <MuiLink
                component={Link}
                to={`runs/${lastRun.id}`}
                underline="hover"
              >
                Run #{lastRun.id}
              </MuiLink>
              . To see all previous runs click{" "}
              <MuiLink component={Link} to="runs" underline="hover">
                here
              </MuiLink>
              .
            </Typography>
          </Box>
          <RunPage
            run={lastRun}
            schedule={schedule}
            handler={schedule.jobDefinition}
          />
        </>
      ) : null}
    </Box>
  );
}

interface Size {
  width: number;
  height: number;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function useElementSize<T extends HTMLElement = HTMLDivElement>(): [
  (node: T | null) => void,
  Size | undefined
] {
  const [ref, setRef] = React.useState<T | null>(null);
  const [size, setSize] = React.useState<Size | undefined>();

  React.useEffect(() => {
    const handleSize = () => {
      if (ref) {
        setSize({
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        });
      } else {
        setSize(undefined);
      }
    };
    window.addEventListener("resize", handleSize);
    return () => {
      window.removeEventListener("resize", handleSize);
    };
  }, [ref]);

  useIsomorphicLayoutEffect(() => {
    if (ref) {
      setSize({
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
    } else {
      setSize(undefined);
    }
  }, [ref]);

  return [setRef, size];
}

function DataCard({
  schedule,
}: {
  schedule: SerializeFrom<PublicJobSchedule>;
}) {
  const dataValueRef = React.useRef<undefined | (() => string)>(undefined);
  const [isValid, setIsValid] = React.useState(true);
  const [editorRef, size] = useElementSize();
  const dataRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <Card
      sx={{
        flex: 1,
        minWidth: "fit-content",
        display: "flex",
        flexDirection: "column",
      }}
      component={Form}
      method="post"
      action="edit-details"
      data-testid="data-card"
    >
      <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Typography variant="h5" gutterBottom>
          Data
        </Typography>
        <Typography color="text.secondary">
          This schedule will run{" "}
          {typeof schedule.jobDefinition === "string" ? (
            <Typography component="span">
              a job that currently is not defined on the server (
              {schedule.jobDefinition})
            </Typography>
          ) : (
            <>
              <MuiLink component={Link} to="/" underline="hover">
                {schedule.jobDefinition.title} (v
                {schedule.jobDefinition.version})
              </MuiLink>
              {" with the following data:"}
            </>
          )}
        </Typography>
        {typeof schedule.jobDefinition !== "string" &&
          schedule.jobDefinition.jsonSchema &&
          schedule.data && (
            <>
              <Box pb={1} />
              <Box
                maxWidth="600px"
                flex={1}
                ref={editorRef}
                sx={{ minHeight: "200px" }}
              >
                {size && (
                  <Editor
                    jsonSchema={schedule.jobDefinition.jsonSchema}
                    example={JSON.parse(schedule.data)}
                    getValueRef={dataValueRef}
                    setIsValid={setIsValid}
                    height={size.height}
                  />
                )}
              </Box>
            </>
          )}
      </CardContent>
      {typeof schedule.jobDefinition !== "string" && (
        <CardActions>
          <input type="hidden" name="data" value="" ref={dataRef} />
          <Button
            disabled={!isValid}
            type="submit"
            data-testid="submit-edit-data"
            onClick={() => {
              if (dataValueRef.current) {
                dataRef.current?.setAttribute("value", dataValueRef.current());
              }
            }}
          >
            Save
          </Button>
        </CardActions>
      )}
    </Card>
  );
}

export function Actions({
  action,
  activeWorkers,
  pendingRunNow,
}: {
  action: string;
  activeWorkers: SerializeFrom<PublicWorker>[];
  pendingRunNow: boolean;
}) {
  const navigation = useNavigation();
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const runNowRoute = navigation?.formData?.get("action") === "run";
  const revalidator = useRevalidator();
  React.useEffect(() => {
    if (runNowRoute) {
      revalidator.revalidate();
      setSnackbarOpen(true);
    }
  }, [revalidator, runNowRoute]);
  return (
    <>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => {
          setSnackbarOpen(false);
        }}
        data-testid="run-now-snackbar"
        message={
          <>
            <Box>
              This job has been marked to be claimed by a worker. It will run on
              the next tick on one of the following active workers:
            </Box>
            <Box>
              {activeWorkers.map((worker) => {
                return (
                  <Box key={worker.id} display="flex" alignItems={"center"}>
                    {"• "}
                    <MuiLink to={`/workers/${worker.id}`} component={Link}>
                      <b>{worker.title}</b> ({worker.instanceId})
                    </MuiLink>
                    <Box component={"span"} sx={{ ml: 1 }}>
                      <b>Polling every</b> {worker.pollInterval}s
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </>
        }
        action={
          <IconButton
            size="small"
            color="inherit"
            onClick={() => {
              setSnackbarOpen(false);
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
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
          <Button
            type="submit"
            variant="contained"
            data-testid="run-now"
            endIcon={
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {pendingRunNow ? (
                  <CircularProgress
                    style={{
                      width: 24,
                      height: 24,
                    }}
                  />
                ) : (
                  "🚀"
                )}
              </Box>
            }
            disabled={pendingRunNow}
          >
            Run now
          </Button>
          <input type="hidden" name="action" value="run" />
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
  const { request, params, context } = arg;
  const fd = await request.formData();
  const action = z
    .union([z.literal("delete"), z.literal("run")])
    .parse(fd.get("action"));

  const authHeader = await getAuthHeader(request);

  const id = getScheduleId(params);
  if (action === "run") {
    const redirectTo = z
      .string()
      .parse(new URL(request.url).searchParams.get("postActionRedirect"));
    await (await getWorker(context.worker)).runScheduleNow(id);
    return redirect(redirectTo);
  } else {
    await (await getWorker(context.worker)).deleteSchedule(authHeader, id);
    return redirect(getParentUrl(request.url));
  }
};
