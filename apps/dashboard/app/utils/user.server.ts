import { type AuthHeader } from "@enschedule/types";
import type { AppLoadContext } from "@remix-run/node";
import jwt from "jsonwebtoken";
import type { z } from "zod";
import { getWorker } from "~/createWorker.server";
import { getCookies } from "~/sessions";
import type { User } from "~/types";
import { UserSchema } from "~/types";

const getTokenEnvs = () => {
  const ENSCHEDULE_ACCESS_TOKEN_SECRET = process.env.ENSCHEDULE_ACCESS_TOKEN_SECRET;

  if (!ENSCHEDULE_ACCESS_TOKEN_SECRET) {
    throw new Error(
      "Missing required environment variable ENSCHEDULE_ACCESS_TOKEN_SECRET. Please check your .env file."
    );
  }
  return { ENSCHEDULE_ACCESS_TOKEN_SECRET };
};

const { ENSCHEDULE_ACCESS_TOKEN_SECRET } = getTokenEnvs();

export async function authenticate(
  request: Request
): Promise<
  { user: User; authHeader: z.output<typeof AuthHeader> } | undefined
> {
  const cookies = await getCookies(request);

  if (!cookies.access.session.has("token")) {
    return;
  }

  const token = cookies.access.session.get("token");

  if (!token) {
    return;
  }

  const user = await new Promise<User>((resolve, reject) => {
    jwt.verify(token, ENSCHEDULE_ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        reject(err);
      } else {
        const parsedUser = UserSchema.parse(user);
        resolve(parsedUser);
      }
    });
  });

  return { user, authHeader: `Jwt ${token}` };
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
    ).getUser(userSession.authHeader, userSession.user.userId);
    return user;
  } catch (err) {
    // maybe session expired or something
  }
  return undefined;
};
