import { defineRouterSchema } from "@richie-router/core";
import { z } from "zod";

export const routerSchema = defineRouterSchema(
  {
    "/run": {
      searchSchema: z.object({ def: z.string().optional() }),
    },
    "/runs/": {
      searchSchema: z.object({
        page: z.coerce.number().int().positive().default(1),
        rowsPerPage: z.coerce.number().int().positive().default(25),
        sorting: z.union([z.string(), z.array(z.string())]).optional(),
      }),
    },
    "/login": {
      searchSchema: z.object({ redirect: z.string().optional() }),
    },
  },
  {
    passthrough: ["/api/$", "/healthz", "/openapi.json", "/docs", "/assets/$"],
  },
);

export type RouterSchema = typeof routerSchema;
