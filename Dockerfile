# BASE
FROM node:18-slim as base
LABEL org.opencontainers.image.source=https://github.com/ricsam/enschedule
LABEL org.opencontainers.image.licenses=MIT
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
RUN corepack enable
RUN pnpm install turbo --global

RUN apt-get update && \
    apt-get install -y jq moreutils && \
    rm -rf /var/lib/apt/lists/*

RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# INSTALL BASE
FROM base as install-base
COPY . .
RUN ./release-package.sh
RUN turbo prune \
  --scope="@enschedule/worker" \
  --scope="@enschedule/dashboard" \
  --scope="@enschedule/log-handler" \
  --scope="@enschedule/fetch-handler" \
  --docker

RUN rm -rf /app/out/**/node_modules

FROM base AS prod-deps
COPY --from=install-base /app/out/json/ .
COPY --from=install-base /app/out/pnpm-lock.yaml /app/out/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM base AS build
COPY --from=install-base /app/out/full/ .
COPY --from=install-base /app/out/pnpm-lock.yaml /app/out/pnpm-workspace.yaml ./
RUN NODE_ENV="development" pnpm install --frozen-lockfile
RUN turbo build

# Worker image
FROM base AS worker
LABEL org.opencontainers.image.description="Worker"
COPY --from=install-base /app/out/full/ .

# Install pg-driver
RUN rm -rf /app/packages/pg-driver/node_modules
COPY --from=prod-deps /app/packages/pg-driver/node_modules/ /app/packages/pg-driver/node_modules
COPY --from=build /app/packages/pg-driver/dist /app/packages/pg-driver/dist
# Install types
RUN rm -rf /app/packages/types/node_modules
COPY --from=prod-deps /app/packages/types/node_modules/ /app/packages/types/node_modules
COPY --from=build /app/packages/types/dist /app/packages/types/dist
# Install worker
RUN rm -rf /app/packages/worker/node_modules
COPY --from=prod-deps /app/packages/worker/node_modules/ /app/packages/worker/node_modules
COPY --from=build /app/packages/worker/dist /app/packages/worker/dist

# Install handlers
## fetch-handler
RUN rm -rf /app/handlers/fetch-handler/node_modules
COPY --from=prod-deps /app/handlers/fetch-handler/node_modules/ /app/handlers/fetch-handler/node_modules
## log-handler
RUN rm -rf /app/handlers/log-handler/node_modules
COPY --from=prod-deps /app/handlers/log-handler/node_modules/ /app/handlers/log-handler/node_modules

# Root node_modules
COPY --from=prod-deps /app/node_modules/ /app/node_modules

# Create the folder where the user can mount job definitions
RUN mkdir /app/packages/worker/definitions

WORKDIR /app/packages/worker

RUN cp -r /app/handlers/* ./node_modules/@enschedule/

RUN echo "API_HOSTNAME=0.0.0.0 node dist/docker-entry.js" > docker-entry.sh && \
    chmod +x docker-entry.sh

CMD ["sh", "docker-entry.sh"]

# Dashboard image
FROM base AS dashboard
LABEL org.opencontainers.image.description="Dashboard"
COPY --from=install-base /app/out/full/ .

# Install worker-api
RUN rm -rf /app/packages/worker-api/node_modules
COPY --from=prod-deps /app/packages/worker-api/node_modules/ /app/packages/worker-api/node_modules
COPY --from=build /app/packages/worker-api/dist /app/packages/worker-api/dist
# Install types
RUN rm -rf /app/packages/types/node_modules
COPY --from=prod-deps /app/packages/types/node_modules/ /app/packages/types/node_modules
COPY --from=build /app/packages/types/dist /app/packages/types/dist
# Install dashboard
RUN rm -rf /app/apps/dashboard/node_modules
COPY --from=prod-deps /app/apps/dashboard/node_modules/ /app/apps/dashboard/node_modules
COPY --from=build /app/apps/dashboard/build /app/apps/dashboard/build
COPY --from=build /app/apps/dashboard/public/build /app/apps/dashboard/public/build

# Install handlers
## fetch-handler
RUN rm -rf /app/handlers/fetch-handler/node_modules
COPY --from=prod-deps /app/handlers/fetch-handler/node_modules/ /app/handlers/fetch-handler/node_modules
## log-handler
RUN rm -rf /app/handlers/log-handler/node_modules
COPY --from=prod-deps /app/handlers/log-handler/node_modules/ /app/handlers/log-handler/node_modules

# Root node_modules
COPY --from=prod-deps /app/node_modules/ /app/node_modules

WORKDIR /app/apps/dashboard

RUN cp -r /app/handlers/* ./node_modules/@enschedule/

RUN echo "HOST=0.0.0.0 npm run docker:start" > docker-entry.sh && \
    chmod +x docker-entry.sh

CMD ["sh", "docker-entry.sh"]
