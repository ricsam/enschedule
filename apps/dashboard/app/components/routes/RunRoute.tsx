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
import { getWorker } from "~/createWorker";
import type { Breadcrumb } from "~/types";
import { formatDate } from "~/utils/formatDate";
import { getParentUrl } from "../../utils/getParentUrl";

export const action: ActionFunction = async ({ request, context }) => {
  const fd = await request.formData();
  const url = getParentUrl(request.url);
  const id = z
    .number()
    .int()
    .positive()
    .parse(Number(fd.get("id")));
  await (await getWorker(context.worker)).deleteRun(id);
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
        subTitle: `Ran ${
          typeof run.jobSchedule === "string"
            ? `deleted schedule (${run.jobSchedule})`
            : run.jobSchedule.title
        } which completed ${
          formatDate(run.finishedAt).label
        } and took ${differenceInMilliseconds(
          new Date(run.finishedAt),
          new Date(run.startedAt)
        )} ms to run`,
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
