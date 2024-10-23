import type { PublicJobRun } from "@enschedule/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { ActionFunction, SerializeFrom } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { differenceInMilliseconds } from "date-fns";
import { z } from "zod";
import { RootLayout } from "~/components/Layout";
import RunPage from "~/components/RunPage";
import { getWorker } from "~/createWorker.server";
import type { Breadcrumb } from "~/types";
import { formatDate } from "~/utils/formatDate";
import { getParentUrl } from "../../utils/getParentUrl";
import { Typography } from "@mui/material";
import { getAuthHeader } from "~/sessions";

export const action: ActionFunction = async ({ request, context }) => {
  const authHeader = await getAuthHeader(request);
  const fd = await request.formData();
  const url = getParentUrl(request.url);
  const id = z
    .number()
    .int()
    .positive()
    .parse(Number(fd.get("id")));
  await (await getWorker(context.worker)).deleteRun(authHeader, id);
  return redirect(url);
};

function Actions({ id }: { id: number }) {
  return (
    <>
      <Box display="flex" gap={2}>
        <Form method="post">
          <Button type="submit" variant="outlined" data-testid="delete-run">
            Delete
          </Button>
          <input type="hidden" name="id" value={id} />
        </Form>
      </Box>
    </>
  );
}

export function RunRoute({
  run,
  breadcrumbs,
}: {
  run: SerializeFrom<PublicJobRun>;
  breadcrumbs: Breadcrumb[];
}) {
  return (
    <RootLayout
      breadcrumbs={breadcrumbs}
      navbar={{
        title: `Run #${run.id}`,
        subTitle: (
          <Typography suppressHydrationWarning component="span">
            {run.finishedAt
              ? `Ran ${
                  typeof run.jobSchedule === "string"
                    ? `deleted schedule (${run.jobSchedule})`
                    : run.jobSchedule.title
                } which completed ${
                  formatDate(run.finishedAt).label
                } and took ${differenceInMilliseconds(
                  new Date(run.finishedAt),
                  new Date(run.startedAt)
                )} ms to run`
              : `Running ${
                  typeof run.jobSchedule === "string"
                    ? `deleted schedule (${run.jobSchedule})`
                    : run.jobSchedule.title
                } for ${differenceInMilliseconds(
                  new Date(),
                  new Date(run.startedAt)
                )} ms`}
          </Typography>
        ),
        actions: <Actions id={run.id} />,
      }}
    >
      <RunPage
        run={run}
        schedule={run.jobSchedule}
        handler={run.jobDefinition}
      />
    </RootLayout>
  );
}
