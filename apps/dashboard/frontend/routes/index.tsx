import { Box, Typography } from "@mui/material";
import { createFileRoute } from "@richie-router/react";
import { AppShell } from "~/components/AppShell";
import { CodeBlock } from "~/components/CodeBlock";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <AppShell><Box maxWidth={900}><Typography variant="h3" gutterBottom>Enschedule</Typography><Typography>Schedule code repeatedly, manually, or at a specific time. The core objects in Enschedule are functions, schedules, and runs.</Typography><Typography variant="h4" mt={4} mb={1}>Function</Typography><Typography mb={2}>Functions are registered in worker code:</Typography><CodeBlock value={`worker.registerJob({
  id: "send-http-request",
  version: 1,
  title: "Send HTTP request",
  dataSchema: z.object({ url: z.string().url() }),
  job: async ({ url }) => {
    console.log("Sending request to", url);
    await fetch(url);
  },
});`} /><Typography variant="h4" mt={4} mb={1}>Schedule</Typography><Typography>A schedule contains the data passed to a function and when it should run: now, manually, on a date, or on a CRON expression.</Typography><Typography variant="h4" mt={4} mb={1}>Run</Typography><Typography>A run records each execution, its status, timing, worker, input data, and stdout/stderr output.</Typography></Box></AppShell>;
}
