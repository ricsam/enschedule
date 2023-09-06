/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // serverBuildPath: "build/index.js",
  // publicPath: "/build/",

  serverDependenciesToBundle: [
    /^@schedule\/.*/,
    /^@enschedule\/.*/,
    "zod-to-ts",
  ],
  watchPaths: ["../../packages/worker-api/*.ts", "../../packages/types/*.ts"],
};
