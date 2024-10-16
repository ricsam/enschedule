import type { ActionFunctionArgs, LoaderFunction } from "@remix-run/node";
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
    refreshTokenRemixSession.unset("token");
    accessTokenRemixSession.unset("token");

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

export async function action({ request, context }: ActionFunctionArgs) {
  const fd = await request.formData();
  let submitType: "logout" | "logout-all-devices" | undefined;
  if (fd.has("logout")) {
    submitType = "logout";
  } else if (fd.has("logout-all-devices")) {
    submitType = "logout-all-devices";
  } else {
    return redirect("/profile");
  }
  const accessTokenRemixSession = await accessTokenSession.getSession(
    request.headers.get("Cookie")
  );
  const refreshTokenRemixSession = await refreshTokenSession.getSession(
    request.headers.get("Cookie")
  );

  const token = refreshTokenRemixSession.get("token");
  if (token) {
    await (
      await getWorker(context.worker)
    ).logout(token, submitType === "logout-all-devices");
  }

  accessTokenRemixSession.unset("token");
  refreshTokenRemixSession.unset("token");

  // Login succeeded, send them to the home page.
  return redirect("/", {
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
}
