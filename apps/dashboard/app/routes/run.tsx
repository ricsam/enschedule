import type {
  PublicJobDefinition,
  PublicJobSchedule,
  ScheduleJobResult,
} from "@enschedule/types";
import {
  ScheduleJobOptionsSchema,
  ScheduleJobResultSchema,
} from "@enschedule/types";
import Send from "@mui/icons-material/Send";
import type { SxProps } from "@mui/material";
import {
  Avatar,
  CardHeader,
  Link as MuiLink,
  Typography,
  useTheme,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import type { IconButtonProps } from "@mui/material/IconButton";
import IconButton from "@mui/material/IconButton";
import OutlinedInput from "@mui/material/OutlinedInput";
import TextField from "@mui/material/TextField";
import type {
  ActionFunction,
  LinksFunction,
  LoaderFunction,
  SerializeFrom,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import cronParser from "cron-parser";
import { format, parse } from "date-fns";
import { pascalCase } from "pascal-case";
import React from "react";
import { z } from "zod";
import { Editor, ReadOnlyEditor } from "~/components/Editor";
import { RootLayout } from "~/components/Layout";
import { getWorker } from "~/createWorker";
import icon from "~/icon.svg";
import { getLoaderData } from "./runLoader.server";

const SerializedJobEventSchema = z.intersection(
  z.object({
    data: z.string(),
    handlerId: z.string(),
    handlerVersion: z.number(),
    runAt: z.string().optional(),
  }),
  ScheduleJobOptionsSchema.omit({ runAt: true })
);

export const action: ActionFunction = async ({ request, context }) => {
  const body = await request.formData();
  const jsonString = z.string().parse(body.get("jsonData"));

  const jsonValue = JSON.parse(jsonString);

  const serializedEv = SerializedJobEventSchema.parse(jsonValue);

  const data = JSON.parse(serializedEv.data);
  const handlerId = serializedEv.handlerId;
  const handlerVersion = serializedEv.handlerVersion;

  const response = await (
    await getWorker(context.worker)
  ).scheduleJob(
    handlerId,
    handlerVersion,
    data,
    ScheduleJobOptionsSchema.parse(serializedEv)
  );

  return json(response);
};

export const links: LinksFunction = () => {
  return [];
};

export type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const Message = ({
  message,
  outgoing,
  sx,
}: {
  message: React.ReactNode;
  outgoing: boolean;
  sx?: SxProps;
}) => {
  const theme = useTheme();
  const mode = theme.palette.mode;

  return (
    <Chip
      label={message}
      color={outgoing ? (mode === "dark" ? "primary" : "primary") : "default"}
      sx={{
        maxWidth: "50%",
        whiteSpace: "normal",
        height: "auto",
        py: "8px",
        ".MuiChip-label": {
          whiteSpace: "normal",
        },
        ...sx,
      }}
    />
  );
};

const EnscheduleBotMessage = ({
  message,
  sx,
}: {
  message: React.ReactNode;
  sx?: SxProps<{}> | undefined;
}) => {
  return (
    <Box display="flex" alignItems="flex-end">
      <Avatar
        src={icon}
        alt="Enschedule bot"
        sx={{ width: 24, height: 24, p: 1, backgroundColor: "action.selected" }}
      />
      <Box pr={1} />
      <Message message={message} outgoing={false} sx={sx} />
    </Box>
  );
};

const MyMessage = ({
  asIncoming,
  message,
  onMount,
  sx,
}: {
  asIncoming?: boolean;
  message: React.ReactNode;
  onMount?: () => void;
  sx?: SxProps;
}) => {
  const onMountRef = React.useRef(onMount);
  onMountRef.current = onMount;

  React.useEffect(() => {
    if (onMountRef.current) {
      onMountRef.current();
    }
  }, []);

  return (
    <Box display="flex" alignItems="flex-end" justifyContent="flex-end">
      <Message message={message} outgoing={asIncoming ? false : true} sx={sx} />
    </Box>
  );
};

export const loader: LoaderFunction = async ({ context }) => {
  return json<LoaderData>(await getLoaderData(await getWorker(context.worker)));
};

const SendButton = (props: IconButtonProps) => (
  <Box pl={1}>
    <IconButton
      color="primary"
      edge="end"
      sx={{ transform: "rotate(-45deg)" }}
      {...props}
    >
      <Send />
    </IconButton>
  </Box>
);

const LightB = ({ children }: { children: React.ReactNode }) => {
  return <MuiLink>{children}</MuiLink>;
};

const FormattedJson = ({ data }: { data: any }) => {
  return (
    <Box minWidth="fill-available" flex="1">
      <ReadOnlyEditor example={JSON.stringify(data, null, 2)} lang="json" />
    </Box>
  );
};

export type Definition = SerializeFrom<PublicJobDefinition>;
export type Schedule = SerializeFrom<PublicJobSchedule>;

const InputArea = ({ children }: { children: React.ReactNode }) => {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="flex-end"
      sx={{
        borderTopStyle: "solid",
        borderTopWidth: "thin",
        borderTopColor: "divider",
        pt: 2,
        mt: 2,
      }}
    >
      {children}
    </Box>
  );
};

export default function Run() {
  const { definitions, schedules } = useLoaderData<LoaderData>();
  const fetcher = useFetcher<PublicJobSchedule>();
  const qps: { def?: string } = Object.fromEntries(
    useSearchParams()[0].entries()
  );
  const [selectedSchedule, setSelectedSchedule] = React.useState<
    Schedule | undefined
  >(undefined);
  const [selectedDef, setSelectedJob] = React.useState<Definition | undefined>(
    () => {
      if (qps.def) {
        const def = definitions.find((def) => def.id === qps.def);
        return def;
      }
    }
  );
  const dataValueRef = React.useRef<undefined | (() => string)>(undefined);
  const [isValid, setIsValid] = React.useState(true);
  // const [data, setData] = React.useState<any>({
  //   url: 'http://localhost:3000',
  // });
  const [data, setData] = React.useState<any>(undefined);
  const [isCron, setIsCron] = React.useState<boolean | undefined>(undefined);

  const [runLater, setRunLater] = React.useState(
    format(new Date(), "yyyy-MM-dd'T'HH:mm:ss")
  );
  const [acceptRunLater, setAcceptRunLater] = React.useState(false);

  const parsedRunLater = parse(runLater, "yyyy-MM-dd'T'HH:mm:ss", new Date());

  const [whenToSend, setWhenToSend] = React.useState<
    undefined | "now" | "later" | "manual"
  >();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [retryFailedJobs, setRetryFailedJobs] = React.useState<
    undefined | boolean
  >(undefined);
  const [maxRetriesEntry, setMaxRetriesEntry] = React.useState("-1");
  const [maxRetries, setMaxRetries] = React.useState<undefined | number>();
  const [submitTitleAndDescription, setSubmitTitleAndDescription] =
    React.useState(false);
  const [cronExpression, setCronExpression] = React.useState("");
  const [cronDefined, setCronDefined] = React.useState(false);
  const hasSubmitted = React.useRef(false);
  if (hasSubmitted.current === false && fetcher.state === "submitting") {
    hasSubmitted.current = true;
  }

  let parsedCron: undefined | string;
  try {
    parsedCron = cronParser.parseExpression(cronExpression).stringify(true);
  } catch (err) {}

  const hasSaved = React.useRef<undefined | ScheduleJobResult>(undefined);
  if (hasSaved.current === undefined && fetcher.data) {
    hasSaved.current = ScheduleJobResultSchema.parse(fetcher.data);
  }

  const saveJob = selectedDef && (
    <>
      <EnscheduleBotMessage
        message={`Do you want to save this ${
          whenToSend === "manual" ? "job" : "schedule"
        }?`}
      />

      {!hasSubmitted.current ? (
        <Box display="flex" alignItems="flex-end" justifyContent="flex-end">
          <>
            <Button
              variant="outlined"
              color="primary"
              data-testid="submit-button"
              onClick={() => {
                const job: z.input<typeof SerializedJobEventSchema> = {
                  title,
                  description,
                  handlerId: selectedDef.id,
                  data: JSON.stringify(data),
                  retryFailedJobs,
                  maxRetries,
                  handlerVersion: selectedDef.version,
                  failureTrigger: selectedSchedule
                    ? selectedSchedule.id
                    : undefined,
                };

                if (whenToSend === "now") {
                  job.runAt = new Date().toJSON();
                } else if (whenToSend === "later") {
                  if (cronDefined) {
                    job.cronExpression = parsedCron;
                  } else {
                    job.runAt = parsedRunLater.toJSON();
                  }
                }
                fetcher.submit(
                  { jsonData: JSON.stringify(job) },
                  { method: "post" }
                );
              }}
            >
              Yes
            </Button>
          </>
        </Box>
      ) : (
        <>
          <MyMessage message="Yes" />

          <EnscheduleBotMessage message="Saving the job to the database..." />
        </>
      )}

      {hasSaved.current && (
        <>
          <EnscheduleBotMessage
            message={
              <div>
                Successfully saved the job to the database! Click{" "}
                <MuiLink
                  data-testid="schedule-link"
                  to={`/schedules/${hasSaved.current.schedule.id}`}
                  component={Link}
                >
                  here
                </MuiLink>{" "}
                to view the newly created schedule.
              </div>
            }
          />
        </>
      )}
    </>
  );

  const parsedMaxRetriesEntry = parseInt(maxRetriesEntry, 10);

  const [trigger, setTrigger] = React.useState<undefined | boolean>(undefined);

  const onError = (
    <>
      <EnscheduleBotMessage
        message={"If the job fails, would you like to trigger another job?"}
      />
      {trigger === undefined ? (
        <InputArea>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setTrigger(false);
            }}
            data-testid="trigger-no"
          >
            No
          </Button>
          <Box pr={1} />
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setTrigger(true);
            }}
            data-testid="trigger-yes"
          >
            Yes
          </Button>
        </InputArea>
      ) : (
        <>
          <MyMessage message={trigger ? "Yes" : "No"} />
          {trigger ? (
            <>
              <EnscheduleBotMessage message="Which schedule would you like to trigger?" />
              {!selectedSchedule ? (
                <>
                  <InputArea>
                    <Autocomplete
                      data-testid="schedule-autocomplete"
                      disablePortal
                      options={schedules}
                      getOptionLabel={(schedule) => schedule.title}
                      value={selectedSchedule ?? null}
                      onChange={(ev, value) => {
                        if (value) {
                          setSelectedSchedule(value);
                        }
                      }}
                      fullWidth
                      renderInput={(params) => (
                        <TextField {...params} label="Select a schedule" />
                      )}
                    />
                    <SendButton onClick={() => {}} />
                  </InputArea>
                </>
              ) : (
                <>
                  <MyMessage message={selectedSchedule.title} />
                  <EnscheduleBotMessage
                    message={`Will trigger the job associated with the schedule: "${selectedSchedule.title}"`}
                  />
                  {saveJob}
                </>
              )}
            </>
          ) : (
            saveJob
          )}
        </>
      )}
    </>
  );

  const describeJob = selectedDef && (
    <>
      <EnscheduleBotMessage message="What will this job do? E.g. will it send out a news letter or reset a database? Please provide a title and a description to help you and others understand why this job is scheduled." />

      {!submitTitleAndDescription ? (
        <Box display="flex" alignItems="center">
          <Box width="100%">
            <OutlinedInput
              inputProps={{
                "data-testid": "title-input",
              }}
              placeholder="Title..."
              type="text"
              value={title}
              onChange={(ev) => {
                setTitle(ev.target.value);
              }}
              fullWidth
            />
            <Box pt={1} />
            <OutlinedInput
              inputProps={{
                "data-testid": "description-input",
              }}
              placeholder="Description..."
              multiline
              rows={4}
              type="text"
              value={description}
              onChange={(ev) => {
                setDescription(ev.target.value);
              }}
              fullWidth
            />
          </Box>
          <SendButton
            disabled={!title || !description}
            onClick={() => {
              setSubmitTitleAndDescription(true);
            }}
          />
        </Box>
      ) : (
        <>
          <MyMessage
            message={
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  columnGap: 1,
                }}
              >
                <Box component="span" sx={{ opacity: 0.87 }}>
                  Title:
                </Box>{" "}
                <span>{title}</span>
                <Box component="span" sx={{ opacity: 0.87 }}>
                  Description:
                </Box>
                <span>{description}</span>
              </Box>
            }
          />

          <EnscheduleBotMessage
            message={`You will create the following ${
              whenToSend === "manual" ? "job" : "schedule for the defined job"
            }:`}
          />

          <Box width="100%" pl={4}>
            <React.Fragment>
              <Card variant="outlined">
                <CardHeader
                  title={title}
                  subheader={description}
                  sx={{ pb: 0.5 }}
                />
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    {whenToSend === "manual" ? (
                      <>Will create a job</>
                    ) : (
                      <>
                        Will run the <MuiLink>{selectedDef.title}</MuiLink>{" "}
                        definition{" "}
                        {whenToSend === "now" ? (
                          <Typography
                            data-testid="run-now-button"
                            color="text.primary"
                            variant="body2"
                            component="span"
                          >
                            now
                          </Typography>
                        ) : cronDefined ? (
                          <>
                            later according the following expression{" "}
                            <Typography
                              component="span"
                              sx={{ whiteSpace: "nowrap" }}
                              color="text.primary"
                              variant="body2"
                            >
                              {parsedCron}
                            </Typography>
                          </>
                        ) : (
                          <>
                            {"on "}
                            <Typography
                              color="text.primary"
                              variant="body2"
                              component="span"
                              sx={{ whiteSpace: "nowrap" }}
                            >
                              {parsedRunLater.toString()}
                            </Typography>
                          </>
                        )}
                      </>
                    )}{" "}
                    with the following data:
                  </Typography>
                  <Box pb={1} />
                  <FormattedJson data={data} />
                </CardContent>
              </Card>
            </React.Fragment>
          </Box>

          <EnscheduleBotMessage
            message={"Would you like this job to retry on error?"}
          />
          {retryFailedJobs === undefined ? (
            <InputArea>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => {
                  setRetryFailedJobs(false);
                }}
                data-testid="retry-no"
              >
                No
              </Button>
              <Box pr={1} />
              <Button
                variant="outlined"
                color="primary"
                onClick={() => {
                  setRetryFailedJobs(true);
                }}
                data-testid="retry-yes"
              >
                Yes
              </Button>
            </InputArea>
          ) : (
            <>
              <MyMessage message={retryFailedJobs ? "Yes" : "No"} />
              {retryFailedJobs ? (
                <>
                  <EnscheduleBotMessage
                    message={
                      "The default grace period between retries is 5 seconds. You can configure this with the scheduler.retryStrategy to for example implement an exponential backoff."
                    }
                  />
                  <EnscheduleBotMessage
                    message={
                      "How many times would you like retry the job? (-1 is infinite retries until succeeds)"
                    }
                  />
                  {maxRetries === undefined ? (
                    <InputArea>
                      <OutlinedInput
                        inputProps={{
                          "data-testid": "max-retries-input",
                        }}
                        value={maxRetriesEntry}
                        onChange={(ev) => {
                          setMaxRetriesEntry(ev.target.value);
                        }}
                        fullWidth
                      />
                      <SendButton
                        data-testid="submit-max-retries"
                        disabled={
                          Number.isNaN(parsedMaxRetriesEntry) ||
                          parsedMaxRetriesEntry < -1
                        }
                        onClick={() => {
                          setMaxRetries(parsedMaxRetriesEntry);
                        }}
                      />
                    </InputArea>
                  ) : (
                    <>
                      <MyMessage
                        message={
                          parsedMaxRetriesEntry === -1
                            ? "Until the job succeeds"
                            : `max ${parsedMaxRetriesEntry} times`
                        }
                      />
                      {parsedMaxRetriesEntry === -1 ? saveJob : onError}
                    </>
                  )}
                </>
              ) : (
                onError
              )}
            </>
          )}
        </>
      )}
    </>
  );

  return (
    <RootLayout breadcrumbs={[{ title: "Run", href: "/run" }]}>
      <Box
        height="100%"
        display="flex"
        flexDirection="column"
        alignItems="stretch"
        justifyContent="flex-start"
        gap={2}
        maxWidth={"640px"}
        pb={"50vh"}
      >
        <EnscheduleBotMessage message="Which definition would you like to schedule?" />

        {selectedDef && (
          <>
            <MyMessage message={selectedDef.title} />

            <EnscheduleBotMessage
              message={
                <div>
                  The <LightB>{selectedDef.title}</LightB> definition is
                  described as <i>{selectedDef.description}</i>
                </div>
              }
            />

            <EnscheduleBotMessage
              message={
                <div>
                  <div>
                    Let's create a schedule for the{" "}
                    <LightB>{selectedDef.title}</LightB> definition, please
                    provide the data according to the following schema:
                  </div>
                  <Box pt={1}>
                    <ReadOnlyEditor
                      example={selectedDef.codeBlock}
                      lang="typescript"
                    />
                  </Box>
                </div>
              }
            />
          </>
        )}
        {!selectedDef ? (
          <InputArea>
            <Autocomplete
              data-testid="definition-autocomplete"
              disablePortal
              options={definitions}
              getOptionLabel={(job) => job.title}
              value={selectedDef}
              onChange={(ev, value) => {
                if (value) {
                  setSelectedJob(value);
                }
              }}
              fullWidth
              renderInput={(params) => (
                <TextField {...params} label="Select a job definition" />
              )}
            />
            <SendButton onClick={() => {}} />
          </InputArea>
        ) : (
          <>
            {data && (
              <>
                <MyMessage
                  message={<FormattedJson data={data} />}
                  sx={{
                    flex: 1,
                    ".MuiChip-label": {
                      flex: 1,
                    },
                    ".read-only-editor": {
                      /* the up most container of the editor */
                      filter:
                        "invert(1) hue-rotate(100deg) brightness(1) grayscale(0)",
                    },
                  }}
                />

                <EnscheduleBotMessage message="Congratulations, we have not defined a job, a definition + data = job" />
                <EnscheduleBotMessage message="Do you want to run this job now, later or manually?" />
                {whenToSend === undefined ? (
                  <InputArea>
                    <>
                      <Button
                        data-testid="run-now"
                        variant="outlined"
                        color="primary"
                        onClick={() => {
                          setWhenToSend("now");
                        }}
                      >
                        Now
                      </Button>
                      <Box pr={1} />
                      <Button
                        data-testid="run-later"
                        variant="outlined"
                        color="primary"
                        onClick={() => {
                          setWhenToSend("later");
                        }}
                      >
                        Later
                      </Button>
                      <Box pr={1} />
                      <Button
                        data-testid="run-manual"
                        variant="outlined"
                        color="primary"
                        onClick={() => {
                          setWhenToSend("manual");
                        }}
                      >
                        Manually
                      </Button>
                    </>
                  </InputArea>
                ) : (
                  <>
                    <MyMessage message={pascalCase(whenToSend)} />

                    {whenToSend === "later" ? (
                      <>
                        <EnscheduleBotMessage message="Do you want this job to repeat?" />

                        {isCron === undefined ? (
                          <InputArea>
                            <>
                              <Button
                                variant="outlined"
                                color="primary"
                                onClick={() => {
                                  setIsCron(false);
                                }}
                                data-testid="repeat-no"
                              >
                                No
                              </Button>
                              <Box pr={1} />
                              <Button
                                variant="outlined"
                                color="primary"
                                onClick={() => {
                                  setIsCron(true);
                                }}
                                data-testid="repeat-yes"
                              >
                                Yes
                              </Button>
                            </>
                          </InputArea>
                        ) : isCron ? (
                          <>
                            <MyMessage message={"Yes"} />
                            <EnscheduleBotMessage
                              sx={{
                                maxWidth: "none",
                                width: "536px",
                                ".MuiChip-label": { width: "100%" },
                              }}
                              message={
                                <div>
                                  <div>
                                    Please provide a CRON expression according
                                    to the following schema:
                                  </div>
                                  <Box pt={1}>
                                    <ReadOnlyEditor
                                      example={`*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    |
│    │    │    │    │    └ day of week (0 - 7, 1L - 7L) (0 or 7 is Sun)
│    │    │    │    └───── month (1 - 12)
│    │    │    └────────── day of month (1 - 31, L)
│    │    └─────────────── hour (0 - 23)
│    └──────────────────── minute (0 - 59)
└───────────────────────── second (0 - 59, optional)

The range 0L - 7L is accepted in the weekday position of the cron
expression, where the L means "last occurrence of this weekday
for the month in progress".

For example, the following expression will run on the last monday
of the month at midnight:
0 0 * * * 1L

You can also combine L expressions with other weekday expressions.
For example, the following cron will run every Monday as well as
the last Wednesday of the month:
0 0 * * * 1,3L`}
                                      lang="md"
                                    />
                                  </Box>
                                </div>
                              }
                            />
                            {!cronDefined ? (
                              <>
                                <InputArea>
                                  <TextField
                                    placeholder="CRON expression"
                                    type="text"
                                    value={cronExpression}
                                    error={!parsedCron}
                                    helperText={
                                      parsedCron ? (
                                        <Box
                                          component="span"
                                          sx={{
                                            display: "grid",
                                            gridTemplateColumns: "auto 1fr",
                                            columnGap: 1,
                                          }}
                                        >
                                          <span>Parses to:</span>
                                          <span>{parsedCron}</span>
                                          <span>Next run:</span>
                                          <span>
                                            {cronParser
                                              .parseExpression(parsedCron)
                                              .next()
                                              .toString()}
                                          </span>
                                          <span>Next next run:</span>
                                          <span>
                                            {(() => {
                                              const expr =
                                                cronParser.parseExpression(
                                                  parsedCron
                                                );
                                              expr.next();
                                              return expr.next().toString();
                                            })()}
                                          </span>
                                        </Box>
                                      ) : undefined
                                    }
                                    onChange={(ev) => {
                                      // setComment(ev.target.value);
                                      setCronExpression(ev.target.value);
                                    }}
                                    fullWidth
                                  />
                                  <SendButton
                                    disabled={!parsedCron}
                                    onClick={() => {
                                      setCronDefined(true);
                                    }}
                                  />
                                </InputArea>
                              </>
                            ) : (
                              <>
                                <MyMessage message={parsedCron} />
                                {describeJob}
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <MyMessage message={"No"} />
                            <EnscheduleBotMessage message="When would you like to run this job?" />
                            {!acceptRunLater ? (
                              <InputArea>
                                <TextField
                                  fullWidth
                                  inputProps={{
                                    type: "datetime-local",
                                    pattern:
                                      "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}",
                                    "data-testid": "runAt-input",
                                  }}
                                  value={runLater}
                                  onChange={(ev) => {
                                    setRunLater(ev.target.value);
                                  }}
                                ></TextField>
                                <SendButton
                                  data-testid="submit-runAt"
                                  onClick={() => {
                                    setAcceptRunLater(true);
                                  }}
                                />
                              </InputArea>
                            ) : (
                              <>
                                <MyMessage
                                  message={parsedRunLater.toString()}
                                />
                                {describeJob}
                              </>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      describeJob
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {selectedDef && !data && (
          <InputArea>
            <Box
              display="flex"
              flex="1"
              sx={{
                borderWidth: 2,
                borderStyle: "solid",
                borderColor: isValid ? "transparent" : "error.main",
              }}
            >
              <Editor
                globalEditorRefName="schedule-data-editor"
                jsonSchema={selectedDef.jsonSchema}
                example={selectedDef.example}
                getValueRef={dataValueRef}
                setIsValid={setIsValid}
              />
            </Box>
            <SendButton
              disabled={!isValid}
              onClick={() => {
                const value = dataValueRef.current
                  ? dataValueRef.current()
                  : JSON.stringify(selectedDef.example, null, 2);
                setData(JSON.parse(value));
              }}
            />
          </InputArea>
        )}
      </Box>
    </RootLayout>
  );
}
