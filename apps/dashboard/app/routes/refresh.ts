import type { ActionFunctionArgs, LoaderFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { getWorker } from "~/createWorker.server";
import { getCookies } from "~/sessions";

export const loader: LoaderFunction = async ({ request, context }) => {
  const url = new URL(request.url);

  let targetRedirect = url.searchParams.get("referrer") ?? "/login";
  if (targetRedirect.startsWith("/refresh")) {
    targetRedirect = "/login";
  }

  const cookies = await getCookies(request);

  const refreshToken = cookies.refresh.session.get("token");

  const errorRedirect = async () => {
    cookies.access.session.unset("token");
    cookies.refresh.session.unset("token");
    cookies.hasRefresh.session.unset("hasRefreshToken");

    return redirect(targetRedirect, {
      headers: [
        ["Set-Cookie", await cookies.access.commit()],
        ["Set-Cookie", await cookies.refresh.commit()],
        ["Set-Cookie", await cookies.hasRefresh.commit()],
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

  cookies.access.session.set("token", tokens.accessToken);
  cookies.refresh.session.set("token", tokens.refreshToken);
  cookies.hasRefresh.session.set("hasRefreshToken", true);

  return redirect(targetRedirect, {
    headers: [
      ["Set-Cookie", await cookies.access.commit()],
      ["Set-Cookie", await cookies.refresh.commit()],
      ["Set-Cookie", await cookies.hasRefresh.commit()],
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

  const cookies = await getCookies(request);

  const token = cookies.refresh.session.get("token");
  if (token) {
    await (
      await getWorker(context.worker)
    ).logout(token, submitType === "logout-all-devices");
  }

  cookies.access.session.unset("token");
  cookies.refresh.session.unset("token");
  cookies.hasRefresh.session.unset("hasRefreshToken");

  // Login succeeded, send them to the home page.
  return redirect("/", {
    headers: [
      ["Set-Cookie", await cookies.access.commit()],
      ["Set-Cookie", await cookies.refresh.commit()],
      ["Set-Cookie", await cookies.hasRefresh.commit()],
    ],
  });
}
