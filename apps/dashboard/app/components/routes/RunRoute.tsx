import type { PublicJobRun } from "@enschedule/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { SerializeFrom, ActionFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useHref } from "@remix-run/react";
import { differenceInMilliseconds } from "date-fns";
import { z } from "zod";
import { RootLayout } from "~/components/Layout";
import RunPage from "~/components/RunPage";
import { scheduler } from "~/scheduler.server";
import type { Breadcrumb } from "~/types";
import { formatDate } from "~/utils/formatDate";

export const action: ActionFunction = async ({ request }) => {
  const fd = await request.formData();
  const url = new URL(request.url);
  if (url.pathname !== "/") {
    url.pathname = url.pathname
      .replace(/\/$/, "")
      .split("/")
      .slice(0, -1)
      .join("/");
  }
  const id = z
    .number()
    .int()
    .positive()
    .parse(Number(fd.get("id")));
  await scheduler.deleteRun(id);
  return redirect(url.toString());
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
        subTitle: `Ran ${run.jobSchedule.title} which completed ${
          formatDate(run.finishedAt).label
        } and took ${differenceInMilliseconds(
          new Date(run.finishedAt),
          new Date(run.startedAt)
        )} ms to run`,
        actions: <Actions id={run.id} />,
      }}
    >
      <RunPage run={run} schedule={run.jobSchedule} />
    </RootLayout>
  );
}
