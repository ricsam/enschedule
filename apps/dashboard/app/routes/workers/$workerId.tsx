import type { PublicWorker } from "@enschedule/types";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import assert from "assert";
import { sentenceCase } from "sentence-case";
import { RootLayout } from "~/components/Layout";
import { getWorker } from "~/createWorker.server";
import { getAuthHeader } from "~/sessions";
import type { Breadcrumb, DashboardWorker } from "~/types";
import { formatDate } from "~/utils/formatDate";

export const useBreadcrumbs = (
  data: SerializeFrom<LoaderData>
): Breadcrumb[] => {
  return [
    {
      title: "Workers",
      href: "/workers",
    },
    {
      title: data.worker.title,
      href: "/workers/" + data.worker.id,
    },
  ];
};

export async function getLoaderData(
  params: Params<string>,
  worker: DashboardWorker,
  request: Request
): Promise<{
  worker: PublicWorker;
}> {
  const workerId = params.workerId;
  assert(workerId, "You must have a workerId");
  const id = Number(workerId);
  if (Number.isNaN(id)) {
    throw new Error("Invalid id");
  }
  const authHeader = await getAuthHeader(request);
  const workerDetails = (await worker.getWorkers(authHeader)).find(
    (worker) => worker.id === id
  );
  if (!workerDetails) {
    throw new Error("404");
  }

  return { worker: workerDetails };
}

export const loader: LoaderFunction = async (args) => {
  const { params, context, request } = args;
  return json(
    await getLoaderData(params, await getWorker(context.worker), request)
  );
};

export type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

function useData() {
  const run = useLoaderData<LoaderData>();
  return run;
}

export default function Worker() {
  const data = useData();
  const worker = data.worker;

  return (
    <RootLayout
      navbar={{
        title: worker.title,
        subTitle: `${worker.description ? `${worker.description} | ` : ""}${
          worker.instanceId
        } | v${worker.version}`,
      }}
      breadcrumbs={useBreadcrumbs(data)}
    >
      <Card
        data-testid="schedule-details"
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
              {sentenceCase(worker.status)}
            </Typography>
            <Typography color="text.secondary">Title</Typography>
            <Typography color="text.primary" data-testid="schedule-title">
              {worker.title}
            </Typography>
            <Typography color="text.secondary">Description</Typography>
            <Typography color="text.primary">{worker.description}</Typography>
            <Typography color="text.secondary">Created</Typography>
            <Typography color="text.primary">
              {formatDate(new Date(worker.createdAt), { verbs: false }).label}
            </Typography>
            <Typography color="text.secondary">Last run</Typography>
            <Typography color="text.primary">
              {worker.lastRun
                ? formatDate(new Date(worker.lastRun.startedAt), {
                    verbs: false,
                  }).label
                : "-"}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </RootLayout>
  );
}
