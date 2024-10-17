import type { AppLoadContext } from "@remix-run/node";
import jwt from "jsonwebtoken";
import { getWorker } from "~/createWorker.server";
import { getCookies } from "~/sessions";
import type { User } from "~/types";
import { UserSchema } from "~/types";

const getTokenEnvs = () => {
  const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

  if (!ACCESS_TOKEN_SECRET) {
    throw new Error(
      "Missing required environment variable ACCESS_TOKEN_SECRET. Please check your .env file."
    );
  }
  return { ACCESS_TOKEN_SECRET };
};

const { ACCESS_TOKEN_SECRET } = getTokenEnvs();

export async function authenticate(
  request: Request
): Promise<User | undefined> {
  const cookies = await getCookies(request);

  if (!cookies.access.session.has("token")) {
    return;
  }

  const token = cookies.access.session.get("token");

  if (!token) {
    return;
  }

  const user = await new Promise<User>((resolve, reject) => {
    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        reject(err);
      } else {
        const parsedUser = UserSchema.parse(user);
        resolve(parsedUser);
      }
    });
  });

  return user;
}

export const getCurrentUser = async (
  request: Request,
  context: AppLoadContext
) => {
  try {
    const userSession = await authenticate(request);
    if (!userSession) {
      return;
    }
    const user = await (
      await getWorker(context.worker)
    ).getUser(userSession.userId);
    return user;
  } catch (err) {
    // maybe session expired or something
  }
  return undefined;
};
