# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.14-debian AS install
WORKDIR /app
COPY package.json bun.lock turbo.json tsconfig.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/pg-driver/package.json packages/pg-driver/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/worker/package.json packages/worker/package.json
COPY packages/worker-api/package.json packages/worker-api/package.json
COPY packages/worker-cli/package.json packages/worker-cli/package.json
COPY functions/fetch/package.json functions/fetch/package.json
COPY functions/log/package.json functions/log/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/hub/package.json packages/hub/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/eslint-config-custom/package.json packages/eslint-config-custom/package.json
COPY tests/hub-test/package.json tests/hub-test/package.json
COPY tests/playwright/package.json tests/playwright/package.json
COPY tests/test-worker/package.json tests/test-worker/package.json
COPY website/package.json website/package.json
# Mintlify depends on Puppeteer for local docs tooling; runtime images do not need its browser download.
RUN PUPPETEER_SKIP_DOWNLOAD=true bun install --frozen-lockfile

FROM install AS build
COPY apps/dashboard apps/dashboard
COPY packages/pg-driver packages/pg-driver
COPY packages/types packages/types
COPY packages/tsconfig packages/tsconfig
COPY packages/worker packages/worker
COPY packages/worker-api packages/worker-api
COPY packages/worker-cli packages/worker-cli
COPY functions functions
RUN bun run --cwd packages/types build
RUN bun run --cwd packages/pg-driver build
RUN bun run --cwd packages/worker-api build
RUN bun run --cwd packages/worker build
RUN bun run --cwd apps/dashboard build
RUN bun run --cwd packages/worker-cli build

FROM oven/bun:1.3.14-debian AS runtime
LABEL org.opencontainers.image.source="https://github.com/ricsam/enschedule"
LABEL org.opencontainers.image.licenses="MIT"
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/dashboard ./apps/dashboard
COPY --from=build /app/packages/pg-driver ./packages/pg-driver
COPY --from=build /app/packages/types ./packages/types
COPY --from=build /app/packages/worker ./packages/worker
COPY --from=build /app/packages/worker-api ./packages/worker-api
COPY --from=build /app/packages/worker-cli ./packages/worker-cli
COPY --from=build /app/functions ./functions
RUN mkdir -p /root/.bun/install/cache/@enschedule/types@1.1.6@@@1/dist \
  && cp /app/packages/types/dist/index.js /root/.bun/install/cache/@enschedule/types@1.1.6@@@1/dist/index.js \
  && cp /app/packages/types/dist/contract.js /root/.bun/install/cache/@enschedule/types@1.1.6@@@1/dist/contract.js

FROM runtime AS dashboard
LABEL org.opencontainers.image.description="Enschedule Bun backend and Vite SPA"
WORKDIR /app/apps/dashboard
EXPOSE 3000
CMD ["bun", "./server/main.ts"]

FROM runtime AS worker
LABEL org.opencontainers.image.description="Enschedule Bun worker"
WORKDIR /app
RUN ln -s /app/node_modules/zod /app/packages/worker-cli/node_modules/zod || true
WORKDIR /enschedule-functions
EXPOSE 8000
ENTRYPOINT ["bun", "/app/packages/worker-cli/src/cli.ts", "start"]
CMD []
