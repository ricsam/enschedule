import type { LoaderFunction } from "@remix-run/node";
import { createReadableStreamFromReadable, json } from "@remix-run/node";
import { getWorker } from "~/createWorker.server";
import { getAuthHeader } from "~/sessions";

export const loader: LoaderFunction = async ({ params, context, request }) => {
  const worker = await getWorker(context.worker);
  const authHeader = await getAuthHeader(request);
  const runId = Number(params.runId);
  if (Number.isNaN(runId)) {
    return json({ error: "Invalid runId" }, { status: 400 });
  }
  const readable = await worker.streamLogs(authHeader, runId);
  if (!readable) {
    return json({ error: "Run not found" }, { status: 404 });
  }
  // let s = stream.Readable.toWeb(readable);

  return new Response(createReadableStreamFromReadable(readable), {
    headers: {
      "Content-Type": "text/plain",
    },
  });
};
