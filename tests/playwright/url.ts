export const baseURL =
  process.env.DASHBOARD_URL ||
  `http://${process.env.DASHBOARD_HOST || "localhost"}:${
    process.env.DASHBOARD_PORT
  }`;
