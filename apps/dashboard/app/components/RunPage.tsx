import type { PublicJobSchedule, SerializedRun } from "@enschedule/types";
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
import { ReadOnlyEditor } from "~/components/Editor";
import { formatDate } from "~/utils/formatDate";

export default function RunPage({
  run,
  schedule,
}: {
  run: SerializeFrom<SerializedRun>;
  schedule: SerializeFrom<PublicJobSchedule>;
}) {
  const scheduleLink = useHref("../../../../schedules/" + schedule.id, {
    relative: "path",
  });
  const jobDefinitionId =
    typeof schedule.jobDefinition === "string"
      ? schedule.jobDefinition
      : schedule.jobDefinition.id;
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
                <Typography color="text.secondary">Schedule</Typography>
                <MuiLink
                  underline="hover"
                  component={Link}
                  to={scheduleLink}
                  data-testid="schedule-link"
                >
                  {schedule.title}
                </MuiLink>
                <Typography color="text.secondary">Definition</Typography>
                {typeof schedule.jobDefinition === "string" ? (
                  <Typography component="span">
                    Job not defined on the server ({schedule.jobDefinition})
                  </Typography>
                ) : (
                  <MuiLink
                    underline="hover"
                    component={Link}
                    to={definitionLink}
                    data-testid="definition-link"
                  >
                    {schedule.jobDefinition.title}
                  </MuiLink>
                )}
                <Typography color="text.secondary">Started</Typography>
                <Typography color="text.primary">
                  {formatDate(new Date(run.startedAt), false).label}
                </Typography>
                <Typography color="text.secondary">Duration</Typography>
                <Typography color="text.primary">
                  {new Date(run.finishedAt).getTime() -
                    new Date(run.startedAt).getTime()}
                  ms
                </Typography>
                <Typography color="text.secondary">Completed</Typography>
                <Typography color="text.primary">
                  {formatDate(new Date(run.finishedAt), false).label}
                </Typography>
                <Typography color="text.secondary">Scheduled for</Typography>
                <Typography color="text.primary">
                  {formatDate(new Date(run.scheduledToRunAt), false).label}
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
                {typeof schedule.jobDefinition === "string" ? (
                  <Typography component="span">
                    a job that currently is not defined on the server ({schedule.jobDefinition})
                  </Typography>
                ) : (
                  <>
                    the{" "}
                    <MuiLink component={Link} to="/" underline="hover">
                      {schedule.jobDefinition.title}
                    </MuiLink>{" "}
                    definition
                  </>
                )}
                {' '}with the following data:
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
