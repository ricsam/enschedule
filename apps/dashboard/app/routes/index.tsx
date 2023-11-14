import { Box, Typography } from "@mui/material";
import type { LoaderFunction } from "@remix-run/node";
import { ReadOnlyEditor } from "~/components/Editor";
import { RootLayout } from "~/components/Layout";

export const loader: LoaderFunction = ({ context }) => {
  console.log("@context", context);
  return {};
};

export default function () {
  return (
    <RootLayout>
      <Box>
        <Typography variant="h3">Enschedule</Typography>
        <Typography variant="body1">
          You can schedule to run code repeatedly or on a specific time. The
          code you want to run are created in a definition. A definition can run
          according to a schedule.
        </Typography>
        <Typography variant="body1">
          The core objects in Enschedule is the definition, schedule and run.
        </Typography>
        <br />
        <Typography variant="h4">Definition</Typography>
        <Typography variant="body1">
          You write the definitions in your server side code like this:
        </Typography>
        <br />
        <ReadOnlyEditor
          example={`scheduler.registerJob({
  id: 'send-http-request',
  title: 'Send HTTP request',
  // we define the schema for the data that can be passed to this job definition
  dataSchema: z.object({
    url: z.string(),
  }),
  job: async (data, console) => {
    // when doing a console log it is important to use the console passed in to store the logs in the database
    console.log('Will now send a HTTP request to ', data.url);
    await fetch(data.url);
  },
  description: 'Provide HTTP parameters as data to send a request',
  example: {
    url: 'http://localhost:3000',
  },
});
`}
          lang="typescript"
        />

        <Typography variant="h4">Schedule</Typography>
        <Typography variant="body1">
          The schedule contains data that is passed to the job definition as
          well as an optional time parameter for when the job should run.
        </Typography>
        <Typography variant="body1">
          The time parameter can be "now", "manual", "cron", "date"
        </Typography>
        <ul>
          <li>now - the schedule will instantly run the defined job</li>
          <li>
            manual - the schedule will not do anything, but you can manually
            trigger the job to run by navigating to the schedule in the UI
          </li>
          <li>cron - will run the job according to the cron expression</li>
          <li>date - will run the job once on the specified date</li>
        </ul>
        <Typography variant="h4">Run</Typography>
        <Typography variant="body1">
          A run is created when a job runs. The run will store logged output and
          output from errors
        </Typography>
      </Box>
    </RootLayout>
  );
}
