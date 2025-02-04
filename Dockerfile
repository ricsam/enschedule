# BASE
FROM node:18-slim AS base
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
FROM base AS install-base
COPY . .
RUN ./release-package.sh
RUN turbo prune \
  --scope="@enschedule/worker" \
  --scope="@enschedule/worker-cli" \
  --scope="@enschedule/dashboard" \
  --scope="@enschedule-fns/log" \
  --scope="@enschedule-fns/fetch" \
  --docker

RUN rm -rf /app/out/**/node_modules

FROM base AS prod-deps
COPY --from=install-base /app/out/json/ .
COPY --from=install-base /app/out/pnpm-lock.yaml /app/out/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM base AS build
COPY --from=install-base /app/out/json/ .
COPY --from=install-base /app/out/pnpm-lock.yaml /app/out/pnpm-workspace.yaml ./
RUN NODE_ENV="development" pnpm install --frozen-lockfile
COPY --from=install-base /app/out/full/ .
RUN turbo build

# Worker image
FROM base AS worker
LABEL org.opencontainers.image.description="Worker"
COPY --from=install-base /app/out/full/ .
COPY --from=install-base /app/random-token.sh ./

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
# Install worker-cli
RUN rm -rf /app/packages/worker-cli/node_modules
COPY --from=prod-deps /app/packages/worker-cli/node_modules/ /app/packages/worker-cli/node_modules
COPY --from=build /app/packages/worker-cli/dist /app/packages/worker-cli/dist

# Install functions
## fetch-fn
RUN rm -rf /app/functions/fetch/node_modules
COPY --from=prod-deps /app/functions/fetch/node_modules/ /app/functions/fetch/node_modules
## log-fn
RUN rm -rf /app/functions/log/node_modules
COPY --from=prod-deps /app/functions/log/node_modules/ /app/functions/log/node_modules

# Root node_modules
COPY --from=prod-deps /app/node_modules/ /app/node_modules

# Create the folder where the user can mount job definitions
RUN mkdir /app/packages/worker/definitions

WORKDIR /app/packages/worker

RUN cp -r /app/functions/* ./node_modules/@enschedule/

RUN cd /app/packages/worker-cli && \
    npm link

RUN mkdir -p /enschedule-functions

WORKDIR /enschedule-functions

RUN ln -s /app/packages/worker/node_modules /enschedule-functions/node_modules

RUN echo '#!/bin/bash' > docker-entry.sh && \
    echo 'ENSCHEDULE_API_HOSTNAME=0.0.0.0 \\' >> docker-entry.sh && \
    echo 'ENSCHEDULE_ACCESS_TOKEN_SECRET=${ENSCHEDULE_ACCESS_TOKEN_SECRET:-$(/app/random-token.sh ENSCHEDULE_ACCESS_TOKEN_SECRET)} \\' >> docker-entry.sh && \
    echo 'ENSCHEDULE_REFRESH_TOKEN_SECRET=${ENSCHEDULE_REFRESH_TOKEN_SECRET:-$(/app/random-token.sh ENSCHEDULE_REFRESH_TOKEN_SECRET)} \\' >> docker-entry.sh && \
    echo 'enschedule-worker start "$@"' >> docker-entry.sh && \
    chmod +x docker-entry.sh

ENTRYPOINT ["sh", "docker-entry.sh"]
CMD []

# Dashboard image
FROM base AS dashboard
LABEL org.opencontainers.image.description="Dashboard"
COPY --from=install-base /app/out/full/ .
COPY --from=install-base /app/random-token.sh ./

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

# Install functions
## fetch-fn
RUN rm -rf /app/functions/fetch/node_modules
COPY --from=prod-deps /app/functions/fetch/node_modules/ /app/functions/fetch/node_modules
## log-fn
RUN rm -rf /app/functions/log/node_modules
COPY --from=prod-deps /app/functions/log/node_modules/ /app/functions/log/node_modules

# Root node_modules
COPY --from=prod-deps /app/node_modules/ /app/node_modules

WORKDIR /app/apps/dashboard

RUN cp -r /app/functions/* ./node_modules/@enschedule/

RUN echo "HOST=0.0.0.0 npm run docker:start" > docker-entry.sh && \
    chmod +x docker-entry.sh

RUN echo '#!/bin/bash' > docker-entry.sh && \
    echo 'HOST=0.0.0.0 \\' >> docker-entry.sh && \
    echo 'ENSCHEDULE_ACCESS_TOKEN_SECRET=${ENSCHEDULE_ACCESS_TOKEN_SECRET:-$(/app/random-token.sh ENSCHEDULE_ACCESS_TOKEN_SECRET)} \\' >> docker-entry.sh && \
    echo 'ENSCHEDULE_REFRESH_TOKEN_SECRET=${ENSCHEDULE_REFRESH_TOKEN_SECRET:-$(/app/random-token.sh ENSCHEDULE_REFRESH_TOKEN_SECRET)} \\' >> docker-entry.sh && \
    echo 'ENSCHEDULE_COOKIE_SESSION_SECRET=${ENSCHEDULE_COOKIE_SESSION_SECRET:-$(/app/random-token.sh ENSCHEDULE_COOKIE_SESSION_SECRET)} \\' >> docker-entry.sh && \
    echo 'npm run docker:start' >> docker-entry.sh && \
    chmod +x docker-entry.sh

CMD ["sh", "docker-entry.sh"]
