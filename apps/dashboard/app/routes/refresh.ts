import type { LoaderFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { getWorker } from "~/createWorker.server";
import { accessTokenSession, refreshTokenSession } from "~/sessions";

export const loader: LoaderFunction = async ({ request, context }) => {
  const url = new URL(request.url);

  let targetRedirect = url.searchParams.get("referrer") ?? "/login";
  if (targetRedirect.startsWith("/refresh")) {
    targetRedirect = "/login";
  }

  const accessTokenRemixSession = await accessTokenSession.getSession(
    request.headers.get("Cookie")
  );
  const refreshTokenRemixSession = await refreshTokenSession.getSession(
    request.headers.get("Cookie")
  );
  const refreshToken = refreshTokenRemixSession.get("token");

  const errorRedirect = async () => {
    accessTokenRemixSession.flash("error", "Invalid refresh token");
    return redirect(targetRedirect, {
      headers: {
        "Set-Cookie": await accessTokenSession.commitSession(
          accessTokenRemixSession
        ),
      },
    });
  };

  if (!refreshToken) {
    return errorRedirect();
  }

  const worker = await getWorker(context.worker);
  const tokens = await worker.refreshToken(refreshToken);

  if (!tokens) {
    return errorRedirect();
  }

  accessTokenRemixSession.set("token", tokens.accessToken);
  refreshTokenRemixSession.set("token", tokens.refreshToken);

  return redirect(targetRedirect, {
    headers: [
      [
        "Set-Cookie",
        await accessTokenSession.commitSession(accessTokenRemixSession),
      ],
      [
        "Set-Cookie",
        await refreshTokenSession.commitSession(refreshTokenRemixSession),
      ],
    ],
  });
};
