import React from "react";
import { Box, Button, Card, CardActions, CardContent, Link as MuiLink, Typography } from "@mui/material";
import type { PublicJobRun } from "@enschedule/types";
import { RunStatus } from "@enschedule/types";
import { api } from "../api";
import { CodeBlock } from "./CodeBlock";
import { RouteLink } from "./RouteLink";
import { Status } from "./Status";

const date = (value: Date | string) => new Date(value).toLocaleString();
const duration = (run: PublicJobRun) => {
  if (run.status === RunStatus.LOST) return "-";
  const ms = (run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now()) - new Date(run.startedAt).getTime();
  return ms < 1000 ? `${ms}ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
};

export function RunDetails({ run }: { run: PublicJobRun }) {
  const [logs, setLogs] = React.useState("");
  React.useEffect(() => {
    let active = true;
    let abort: (() => void) | undefined;
    void api.streamLogs.stream({ params: { id: run.id } }).then((result) => {
      abort = () => result.abort();
      result.on("chunk", ({ text }) => active && setLogs((current) => current + text));
    });
    return () => { active = false; abort?.(); };
  }, [run.id]);
  const schedule = run.jobSchedule;
  const definition = run.jobDefinition;
  return <Box id="RunPage" display="flex" flexDirection="column" gap={3}>
    <Box display="flex" flexWrap="wrap" gap={3}>
      <Card sx={{ flex: 1, minWidth: 300 }}><CardContent><Typography variant="h5" gutterBottom>Details</Typography><Box display="grid" gridTemplateColumns="auto 1fr" gap={1} columnGap={2}><Typography color="text.secondary">Status</Typography><Status value={run.status} /><Typography color="text.secondary">Schedule</Typography>{typeof schedule === "string" ? <Typography>Deleted schedule ({schedule})</Typography> : <MuiLink component={RouteLink} to={`/schedules/${schedule.id}`} data-testid="schedule-link">{schedule.title}</MuiLink>}<Typography color="text.secondary">Definition</Typography>{typeof definition === "string" ? <Typography>{definition}</Typography> : <MuiLink component={RouteLink} to={`/definitions/${definition.id}`} data-testid="definition-link">{definition.title}</MuiLink>}<Typography color="text.secondary">Started</Typography><Typography>{date(run.startedAt)}</Typography><Typography color="text.secondary">Duration{run.finishedAt ? "" : " (running)"}</Typography><Typography>{duration(run)}</Typography>{run.finishedAt && <><Typography color="text.secondary">Completed</Typography><Typography>{date(run.finishedAt)}</Typography></>}<Typography color="text.secondary">Scheduled for</Typography><Typography>{date(run.scheduledToRunAt)}</Typography><Typography color="text.secondary">Exit signal</Typography><Typography>{run.exitSignal ?? "-"}</Typography></Box></CardContent></Card>
      {run.data && <Card sx={{ flex: 1, minWidth: 300 }}><CardContent><Typography variant="h5" gutterBottom>Job</Typography><Typography color="text.secondary" mb={1}>Input data supplied to this run.</Typography><CodeBlock language="json" value={JSON.stringify(JSON.parse(run.data), null, 2)} /></CardContent></Card>}
    </Box>
    <Card><CardContent><Typography variant="h5" gutterBottom>stdout / stderr</Typography>{logs ? <CodeBlock language="text" value={logs} /> : <Typography color="text.secondary">No output.</Typography>}</CardContent><CardActions><Button disabled={!logs} onClick={() => navigator.clipboard.writeText(logs)}>Copy</Button></CardActions></Card>
  </Box>;
}
