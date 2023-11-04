const {
  createRoutesFromFolders,
} = require("@remix-run/v1-route-convention");

/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "./build/index.js",
  publicPath: "/build/",
  
  serverMainFields: ["main", "module"], // default value, can be removed
  serverMinify: false, // default value, can be removed
  serverModuleFormat: "cjs", // default value in 1.x, add before upgrading
  serverPlatform: "node", // default value, can be removed

  serverDependenciesToBundle: [
    /^@schedule\/.*/,
    /^@enschedule\/.*/,
    "zod-to-ts",
  ],
  watchPaths: ["../../packages/worker-api/*.ts", "../../packages/types/*.ts", "./.env"],
  routes(defineRoutes) {
    // uses the v1 convention, works in v1.15+ and v2
    return createRoutesFromFolders(defineRoutes);
  },
};
