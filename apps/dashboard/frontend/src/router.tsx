import { createRouter } from "@richie-router/react";
import { routeTree } from "../route-tree.gen";

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadDelay: 50,
  scrollRestoration: true,
});
