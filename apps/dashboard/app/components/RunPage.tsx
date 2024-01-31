import type {
  PublicJobDefinition,
  PublicJobSchedule,
  SerializedRun,
} from "@enschedule/types";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Link as MuiLink,
} from "@mui/material";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SerializeFrom } from "@remix-run/node";
import { Link, useHref } from "@remix-run/react";
import { sentenceCase } from "sentence-case";
import { ReadOnlyEditor } from "~/components/Editor";
import { formatDate, formatDuration } from "~/utils/formatDate";

const ScheduleLink = ({
  title,
  id,
}: {
  title: string;
  id: number;
}): JSX.Element => {
  const link = useHref("../../../../schedules/" + id, { relative: "path" });
  return (
    <MuiLink
      component={Link}
      to={link}
      underline="hover"
      data-testid="schedule-link"
    >
      {title}
    </MuiLink>
  );
};

export default function RunPage({
  run,
  schedule,
  handler,
}: {
  run: SerializeFrom<SerializedRun>;
  schedule: SerializeFrom<PublicJobSchedule | string>;
  handler: SerializeFrom<PublicJobDefinition | string>;
}) {
  const jobDefinitionId = typeof handler === "string" ? handler : handler.id;
  const definitionLink = useHref(
    "../../../../../../definitions/" + jobDefinitionId,
    {
      relative: "path",
    }
  );
  return (
    <>
      <Box display="flex" flexDirection="column" gap={3} id="RunPage">
        <Box display="flex" gap={3} flexWrap="wrap">
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
                <Typography color="text.secondary">Status</Typography>
                <Typography color="text.primary">
                  {sentenceCase(run.status)}
                </Typography>
                <Typography color="text.secondary">Schedule</Typography>
                {typeof schedule === "string" ? (
                  <Typography component="span">
                    Schedule not defined on the server ({schedule})
                  </Typography>
                ) : (
                  <ScheduleLink title={schedule.title} id={schedule.id} />
                )}
                <Typography color="text.secondary">Definition</Typography>
                {typeof handler === "string" ? (
                  <Typography component="span">
                    Job not defined on the server ({handler})
                  </Typography>
                ) : (
                  <MuiLink
                    underline="hover"
                    component={Link}
                    to={definitionLink}
                    data-testid="definition-link"
                  >
                    {handler.title}
                  </MuiLink>
                )}
                <Typography color="text.secondary">Started</Typography>
                <Typography color="text.primary">
                  {formatDate(new Date(run.startedAt), { verbs: false }).label}
                </Typography>
                <Typography color="text.secondary">
                  Duration{run.finishedAt ? "" : " (running)"}
                </Typography>
                <Typography color="text.primary" suppressHydrationWarning>
                  {formatDuration(
                    (run.finishedAt
                      ? new Date(run.finishedAt).getTime()
                      : Date.now()) - new Date(run.startedAt).getTime()
                  )}
                </Typography>
                {run.finishedAt && (
                  <>
                    <Typography color="text.secondary">Completed</Typography>
                    <Typography color="text.primary">
                      {
                        formatDate(new Date(run.finishedAt), { verbs: false })
                          .label
                      }
                    </Typography>
                  </>
                )}
                <Typography color="text.secondary">Scheduled for</Typography>
                <Typography color="text.primary">
                  {
                    formatDate(new Date(run.scheduledToRunAt), { verbs: false })
                      .label
                  }
                </Typography>
                <Typography color="text.secondary">Exit signal</Typography>
                <Typography color="text.primary">{run.exitSignal}</Typography>
                <Typography color="text.secondary">Has stdout</Typography>
                <Typography color="text.primary">
                  {String(!!run.stdout)}
                </Typography>
                <Typography color="text.secondary">Has stderr</Typography>
                <Typography color="text.primary">
                  {String(!!run.stderr)}
                </Typography>
              </Box>
            </CardContent>
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
                Job
              </Typography>
              <Typography color="text.secondary">
                This run ran{" "}
                {typeof handler === "string" ? (
                  <Typography component="span">
                    a job that currently is not defined on the server ({handler}
                    )
                  </Typography>
                ) : (
                  <>
                    the{" "}
                    <MuiLink component={Link} to="/" underline="hover">
                      {handler.title}
                    </MuiLink>{" "}
                    definition
                  </>
                )}{" "}
                with the following data:
              </Typography>
              <Box pb={1} />
              <Box maxWidth="320px" overflow="hidden">
                <ReadOnlyEditor
                  example={JSON.stringify(JSON.parse(run.data), null, 2)}
                  lang="json"
                ></ReadOnlyEditor>
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box display="flex" gap={3} flexWrap="wrap">
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
                stdout
              </Typography>
              {run.stdout ? (
                <ReadOnlyEditor
                  example={run.stdout}
                  lang="text"
                  withLineNumbers
                ></ReadOnlyEditor>
              ) : (
                "Job did not emit anything to stdout"
              )}
            </CardContent>
            <CardActions>
              <Button>Copy</Button>
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
                stderr
              </Typography>
              {run.stderr ? (
                <ReadOnlyEditor
                  example={run.stderr}
                  lang="text"
                  withLineNumbers
                ></ReadOnlyEditor>
              ) : (
                "Job did not emit anything to stderr"
              )}
            </CardContent>
            <CardActions>
              <Button>Copy</Button>
            </CardActions>
          </Card>
        </Box>
      </Box>
    </>
  );
}
