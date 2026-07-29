import path from "node:path";
import { generateRouteTree } from "@richie-router/tooling";

await generateRouteTree({
  routesDir: path.resolve(import.meta.dir, "../frontend/routes"),
  routerSchema: path.resolve(import.meta.dir, "../shared/router-schema.ts"),
  output: path.resolve(import.meta.dir, "../frontend/route-tree.gen.ts"),
  manifestOutput: path.resolve(import.meta.dir, "../shared/route-manifest.gen.ts"),
  jsonOutput: path.resolve(import.meta.dir, "../shared/spa-routes.gen.json"),
});
