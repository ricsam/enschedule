import { json } from "@remix-run/node";

export const loader = () => {
  return json({ message: "Endpoint is healthy" });
};
