import { generateOpenAPISpec } from "@richie-rpc/openapi";
import { enscheduleContract } from "@enschedule/types/contract";

type EnscheduleOpenAPISpec = ReturnType<typeof generateOpenAPISpec> & {
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
};

const spec: EnscheduleOpenAPISpec = generateOpenAPISpec(enscheduleContract, {
  basePath: "/api",
  info: {
    title: "Enschedule API",
    version: "2.0.0",
    description: "Typed scheduling API served by Bun and Richie RPC",
    contact: {
      name: "Enschedule",
      url: "https://github.com/ricsam/enschedule",
    },
    license: {
      name: "MIT",
      url: "https://github.com/ricsam/enschedule",
    },
  },
  servers: [
    {
      url: "https://enschedule-irqfaf85i4ig.r5d.app",
      description: "Public demo",
    },
  ],
});

const publicOperationIds = new Set(["health", "login", "refresh", "logout"]);

spec.components ??= {};
spec.components.securitySchemes = {
  apiKey: {
    type: "apiKey",
    in: "header",
    name: "X-API-Key",
    description: "Service API key configured with ENSCHEDULE_API_KEY.",
  },
  jwt: {
    type: "apiKey",
    in: "header",
    name: "Authorization",
    description: "User access token using the form `Jwt <access-token>`.",
  },
};

for (const pathItem of Object.values(spec.paths)) {
  for (const [method, operation] of Object.entries(pathItem as Record<string, any>)) {
    if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
    operation.summary ??= operation.operationId
      ?.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/^./, (value: string) => value.toUpperCase());
    if (!publicOperationIds.has(operation.operationId)) {
      operation.security = [{ apiKey: [] }, { jwt: [] }];
    }
  }
}

await Bun.write(new URL("../openapi.json", import.meta.url), `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Generated OpenAPI 3.1 specification with ${Object.keys(spec.paths).length} paths`);
