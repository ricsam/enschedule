FROM node:16.20-slim as base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

RUN apt-get update && \
    apt-get install -y jq moreutils && \
    rm -rf /var/lib/apt/lists/*

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm install turbo --global
RUN turbo build

# Worker image
FROM base AS worker

# Install pg-driver
COPY --from=prod-deps /app/packages/pg-driver/node_modules/ /app/packages/pg-driver/node_modules
COPY --from=build /app/packages/pg-driver/dist /app/packages/pg-driver/dist
# Install types
COPY --from=prod-deps /app/packages/types/node_modules/ /app/packages/types/node_modules
COPY --from=build /app/packages/types/dist /app/packages/types/dist
# Install worker
COPY --from=prod-deps /app/packages/worker/node_modules/ /app/packages/worker/node_modules
COPY --from=build /app/packages/worker/dist /app/packages/worker/dist

# Root node_modules
COPY --from=prod-deps /app/node_modules/ /app/node_modules

# Modify the JSON files in a loop
RUN for pkg in pg-driver types worker; do \
        jq '.main = "./dist/index.js" | .types = "./dist/index.d.ts"' /app/packages/$pkg/package.json | sponge /app/packages/$pkg/package.json; \
    done

# Create the folder where the user can mount job definitions
RUN mkdir /app/packages/worker/definitions

WORKDIR /app/packages/worker
CMD node dist/docker-entry.js

# Dashboard image
FROM base AS dashboard
# Install worker-api
COPY --from=prod-deps /app/packages/worker-api/node_modules/ /app/packages/worker-api/node_modules
COPY --from=build /app/packages/worker-api/dist /app/packages/worker-api/dist
# Install types
COPY --from=prod-deps /app/packages/types/node_modules/ /app/packages/types/node_modules
COPY --from=build /app/packages/types/dist /app/packages/types/dist
# Install dashboard
COPY --from=prod-deps /app/apps/dashboard/node_modules/ /app/apps/dashboard/node_modules
COPY --from=build /app/apps/dashboard/build /app/apps/dashboard/build

# Root node_modules
COPY --from=prod-deps /app/node_modules/ /app/node_modules

RUN for pkg in worker-api types; do \
        jq '.main = "./dist/index.js" | .types = "./dist/index.d.ts"' /app/packages/$pkg/package.json | sponge /app/packages/$pkg/package.json; \
    done

WORKDIR /app/apps/dashboard

CMD npm run "docker:start"


