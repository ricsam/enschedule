FROM node:16.20-slim as base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm install turbo --global
RUN turbo build

FROM base AS pg-driver
COPY --from=prod-deps /app/packages/pg-driver/node_modules/ /app/packages/pg-driver/node_modules
COPY --from=build /app/packages/pg-driver/dist /app/packages/pg-driver/dist

FROM pg-driver AS worker
COPY --from=prod-deps /app/packages/worker/node_modules/ /app/packages/worker/node_modules

RUN mkdir -p /enschedule/jobs

COPY --from=prod-deps /app/packages/worker/node_modules/ /enschedule/node_modules

COPY --from=build /app/packages/worker/dist /app/packages/worker/dist

WORKDIR /app/packages/worker

CMD node dist/docker-entry.ts
