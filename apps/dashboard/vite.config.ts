import path from "node:path";
import react from "@vitejs/plugin-react";
import { richieRouter } from "@richie-router/tooling/vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "frontend"),
  plugins: [
    richieRouter({
      routesDir: path.resolve(import.meta.dirname, "frontend/routes"),
      routerSchema: path.resolve(import.meta.dirname, "shared/router-schema.ts"),
      output: path.resolve(import.meta.dirname, "frontend/route-tree.gen.ts"),
      manifestOutput: path.resolve(import.meta.dirname, "shared/route-manifest.gen.ts"),
      jsonOutput: path.resolve(import.meta.dirname, "shared/spa-routes.gen.json"),
    }),
    react(),
  ],
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "frontend/src"),
      "@enschedule/types/contract": path.resolve(import.meta.dirname, "../../packages/types/contract.ts"),
      "@enschedule/types": path.resolve(import.meta.dirname, "../../packages/types/index.ts"),
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/client"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/healthz": "http://localhost:3000",
      "/openapi.json": "http://localhost:3000",
      "/docs": "http://localhost:3000",
    },
  },
});
