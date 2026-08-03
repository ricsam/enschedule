import React from "react";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { WorkerStatus } from "@enschedule/types";
import { createFileRoute } from "@richie-router/react";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { JsonEditor, ReadOnlyEditor } from "~/components/Editor";
import { Loading } from "~/components/Loading";
import { RouteLink } from "~/components/RouteLink";

export const Route = createFileRoute("/run")({ component: Run });

type Timing = "now" | "manual" | "date" | "cron";
const Bubble = ({ children, mine = false }: { children: React.ReactNode; mine?: boolean }) => <Box display="flex" justifyContent={mine ? "flex-end" : "flex-start"}><Paper variant="outlined" sx={{ p: 1.5, maxWidth: 560, bgcolor: mine ? "primary.main" : "background.paper", color: mine ? "primary.contrastText" : "text.primary" }}>{children}</Paper></Box>;
const InputArea = ({ children }: { children: React.ReactNode }) => <Stack direction="row" gap={1} alignItems="center" maxWidth={560}>{children}</Stack>;

function Run() {
  const search = Route.useSearch();
  const definitions = api.listDefinitions.useQuery({ queryKey: ["definitions"], queryData: {} });
  const workers = api.listWorkers.useQuery({ queryKey: ["workers"], queryData: {} });
  const schedules = api.listSchedules.useQuery({
    queryKey: ["schedules", "trigger-options"],
    queryData: { query: {} },
  });
  const create = api.createSchedule.useMutation();
  const [definitionId, setDefinitionId] = React.useState(search.def ?? "");
  const [workerChoice, setWorkerChoice] = React.useState(false);
  const [selectWorker, setSelectWorker] = React.useState(false);
  const [workerId, setWorkerId] = React.useState<string>();
  const [data, setData] = React.useState("{}");
  const [dataConfirmed, setDataConfirmed] = React.useState(false);
  const [timing, setTiming] = React.useState<Timing>();
  const [repeatChoice, setRepeatChoice] = React.useState<boolean>();
  const [runAt, setRunAt] = React.useState("");
  const [cronExpression, setCronExpression] = React.useState("");
  const [timingConfirmed, setTimingConfirmed] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [detailsConfirmed, setDetailsConfirmed] = React.useState(false);
  const [retry, setRetry] = React.useState<boolean>();
  const [maxRetries, setMaxRetries] = React.useState("1");
  const [retryConfirmed, setRetryConfirmed] = React.useState(false);
  const [trigger, setTrigger] = React.useState<boolean>();
  const [failureTrigger, setFailureTrigger] = React.useState<number>();
  const [dataValid, setDataValid] = React.useState(true);
  const [validationError, setValidationError] = React.useState("");

  if (!definitions.data || !workers.data || (trigger === true && !schedules.data)) return <AppShell title="Run" breadcrumbs={[{ title: "Run", href: "/run" }]}><Loading /></AppShell>;
  const definition = definitions.data.payload.find(({ id }) => id === definitionId && id.length > 0);
  const schedulableDefinitions = definitions.data.payload.filter(({ capabilities }) => capabilities.createSchedule);
  const availableSchedules = schedules.data?.payload ?? [];
  const needsData = !!definition?.jsonSchema;
  const availableWorkers = workers.data.payload.filter((worker) => worker.status === WorkerStatus.UP && worker.definitions.some(({ id }) => id === definitionId));
  const resetAfterDefinition = (nextDefinition?: typeof definitions.data.payload[number]) => { setWorkerChoice(false); setSelectWorker(false); setWorkerId(undefined); setData(JSON.stringify(nextDefinition?.example ?? {}, null, 2)); setDataConfirmed(false); setTiming(undefined); setTimingConfirmed(false); setDetailsConfirmed(false); setRetry(undefined); setRetryConfirmed(false); setTrigger(undefined); };
  const confirmData = () => { if (dataValid) setDataConfirmed(true); };
  const chooseTiming = (value: Timing) => { setTiming(value); if (value === "now" || value === "manual") setTimingConfirmed(true); };
  const submit = () => {
    if (!definition || !timing || !title || (trigger && !failureTrigger)) return;
    let parsedData: unknown = undefined;
    try { parsedData = needsData ? JSON.parse(data) : undefined; } catch { setValidationError("Data must be valid JSON"); return; }
    create.mutate({ body: { functionId: definition.id, functionVersion: definition.version, data: parsedData, options: { title, description: description || undefined, runNow: timing === "now", runAt: timing === "date" && runAt ? new Date(runAt) : undefined, cronExpression: timing === "cron" ? cronExpression : undefined, workerId, retryFailedJobs: retry ?? false, maxRetries: retry ? Number(maxRetries) : -1, failureTrigger, defaultRunAccess: undefined, access: undefined } } });
  };

  return <AppShell breadcrumbs={[{ title: "Run", href: "/run" }]}><Box display="flex" flexDirection="column" gap={2} maxWidth={640} pb="30vh">
    <Bubble>Which function would you like to schedule?</Bubble>
    {!definition && <InputArea><Autocomplete data-testid="definition-autocomplete" fullWidth options={schedulableDefinitions} getOptionLabel={(option) => option.title} value={null} onChange={(_event, value) => { setDefinitionId(value?.id ?? ""); resetAfterDefinition(value ?? undefined); }} renderInput={(params) => <TextField {...params} label="Select a function" />} /><IconButton><SendIcon /></IconButton></InputArea>}
    {definition && <><Bubble mine>{definition.title}</Bubble><Bubble>Would you like this job to run on a specific worker?</Bubble>{!workerChoice && !selectWorker && <InputArea><Button data-testid="no-specific-worker" variant="outlined" onClick={() => setWorkerChoice(true)}>No</Button><Button data-testid="select-specific-worker" variant="outlined" onClick={() => setSelectWorker(true)}>Yes</Button></InputArea>}{selectWorker && !workerChoice && <InputArea><Autocomplete data-testid="worker-autocomplete" fullWidth options={availableWorkers} getOptionLabel={(worker) => `${worker.title} (${worker.instanceId})`} onChange={(_event, value) => setWorkerId(value?.workerId)} renderInput={(params) => <TextField {...params} label="Select a worker" />} /><IconButton onClick={() => workerId && setWorkerChoice(true)}><SendIcon /></IconButton></InputArea>}</>}
    {definition && workerChoice && <>{needsData && !dataConfirmed ? <><Bubble>Please provide JSON data matching this schema:{definition.codeBlock && <Box mt={1}><ReadOnlyEditor value={definition.codeBlock} language="json" /></Box>}</Bubble><Box width="100%" maxWidth={560}><JsonEditor value={data} onChange={setData} jsonSchema={definition.jsonSchema} globalEditorRefName="schedule-data-editor" ariaLabel={`${definition.title} job data`} onValidationChange={(valid, message) => { setDataValid(valid); setValidationError(message ?? ""); }} />{validationError && <Typography color="error" variant="caption" whiteSpace="pre-wrap">{validationError}</Typography>}<Box display="flex" justifyContent="flex-end" mt={1}><IconButton onClick={confirmData} disabled={!dataValid} aria-label="Confirm job data"><SendIcon /></IconButton></Box></Box></> : <><Bubble>Do you want to run this job now, later, or manually?</Bubble>{!timing && <InputArea><Button data-testid="run-now" variant="outlined" onClick={() => chooseTiming("now")}>Now</Button><Button data-testid="run-later" variant="outlined" onClick={() => setTiming("date")}>Later</Button><Button data-testid="run-manual" variant="outlined" onClick={() => chooseTiming("manual")}>Manually</Button></InputArea>}</>}</>}
    {timing === "date" && !timingConfirmed && <>{repeatChoice === undefined ? <><Bubble>Do you want this job to repeat?</Bubble><InputArea><Button data-testid="repeat-no" variant="outlined" onClick={() => setRepeatChoice(false)}>No</Button><Button data-testid="repeat-yes" variant="outlined" onClick={() => { setRepeatChoice(true); setTiming("cron"); }}>Yes</Button></InputArea></> : <><Bubble>When should it run?</Bubble><InputArea><TextField fullWidth type="datetime-local" label="Run at" InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "runAt-input" }} value={runAt} onChange={(event) => setRunAt(event.target.value)} /><IconButton data-testid="submit-runAt" onClick={() => runAt && setTimingConfirmed(true)}><SendIcon /></IconButton></InputArea></>}</>}
    {timing === "cron" && !timingConfirmed && <><Bubble>Provide a CRON expression.</Bubble><InputArea><TextField fullWidth label="CRON expression" value={cronExpression} onChange={(event) => setCronExpression(event.target.value)} /><IconButton onClick={() => cronExpression && setTimingConfirmed(true)}><SendIcon /></IconButton></InputArea></>}
    {timingConfirmed && !detailsConfirmed && <><Bubble>Give this schedule a title and optional description.</Bubble><InputArea><Box flex={1}><TextField inputProps={{ "data-testid": "title-input" }} fullWidth required margin="dense" label="Title" value={title} onChange={(event) => setTitle(event.target.value)} /><TextField inputProps={{ "data-testid": "description-input" }} fullWidth margin="dense" label="Description" value={description} onChange={(event) => setDescription(event.target.value)} /></Box><IconButton onClick={() => title && setDetailsConfirmed(true)}><SendIcon /></IconButton></InputArea></>}
    {detailsConfirmed && !retryConfirmed && <><Bubble>Retry this schedule if a run fails?</Bubble>{retry === undefined ? <InputArea><Button data-testid="retry-no" variant="outlined" onClick={() => { setRetry(false); setRetryConfirmed(true); }}>No</Button><Button data-testid="retry-yes" variant="outlined" onClick={() => setRetry(true)}>Yes</Button></InputArea> : <InputArea><TextField fullWidth type="number" label="Max retries (-1 is unlimited)" inputProps={{ "data-testid": "max-retries-input", min: -1 }} value={maxRetries} onChange={(event) => setMaxRetries(event.target.value)} /><IconButton data-testid="submit-max-retries" onClick={() => setRetryConfirmed(true)}><SendIcon /></IconButton></InputArea>}</>}
    {retryConfirmed && trigger === undefined && <><Bubble>Run another schedule if this one fails?</Bubble><InputArea><Button data-testid="trigger-no" variant="outlined" onClick={() => setTrigger(false)}>No</Button><Button data-testid="trigger-yes" variant="outlined" onClick={() => setTrigger(true)}>Yes</Button></InputArea></>}
    {trigger && <InputArea><Autocomplete data-testid="schedule-autocomplete" fullWidth options={availableSchedules} getOptionLabel={(schedule) => schedule.title} onChange={(_event, value) => setFailureTrigger(value?.id)} renderInput={(params) => <TextField {...params} label="Failure trigger schedule" />} /></InputArea>}
    {trigger !== undefined && (!trigger || failureTrigger) && !create.data && <><Bubble>Everything is ready.</Bubble><Button data-testid="submit-button" variant="contained" onClick={submit} disabled={create.isPending}>Create schedule</Button></>}
    {create.isError && <Alert severity="error">Could not save schedule. Check all inputs and try again.</Alert>}
    {create.data && <Alert severity="success">Schedule {create.data.payload.status}. <RouteLink to={`/schedules/${create.data.payload.schedule.id}`} data-testid="schedule-link">View schedule</RouteLink></Alert>}
  </Box></AppShell>;
}
