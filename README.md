# Enschedule

**Schedule any task**

Enschedule is an open-source project that combines a UI dashboard with a database to manage and automate task scheduling and execution.

## Quick start

```bash
docker container run -it --rm \
  --name enschedule-dashboard \
  -e SQLITE=":memory:" \ # Use in-memory sqlite
  -e IMPORT_HANDLERS="@enschedule/fetch-handler,@enschedule/log-handler" \ # Load included handlers
  -p 3000:3000 \
  ghcr.io/ricsam/enschedule-dashboard:alpha
```

Test [here](https://enschedule-demo.onrender.com/) (the server has a cold startup time of about 1-2 minutes)

## Overview

Enschedule is structured for straightforward task automation and scheduling. It integrates a UI dashboard with a backend database, facilitating task management and scheduling. The architecture is centered around three core elements: workers, handlers, and scheduling mechanisms. Workers connect the system logic with the database, while handlers, defined within workers, execute specific javascript functions. Schedules can be created via the UI or programmatically, triggering handler functions based on cron jobs or scheduled jobs. This structure is designed to offer a flexible and direct way to handle task automation.

### Key Components:

1. **Workers and Handlers:**

   - **Workers:** These components connect the operational logic of the system with the database. Each worker is registered in the database to facilitate organized functioning.
   - **Handlers:** Defined within workers, handlers are essentially functions that execute specific pieces of code. Every handler is registered in the database for tracking and execution purposes.

2. **Scheduling Mechanism:**

   - **User-Defined Scheduling:** Schedules can be created either programmatically or through the UI dashboard. These schedules trigger handlers at predetermined times, using either cron jobs or scheduled jobs.
   - **Database Integration:** Schedules are stored in the database, which helps in managing and tracking the execution timeline and task details.

3. **Execution Tracking and Output Management:**
   - **Run Records:** When a handler executes, a 'run' is created. This run acts as a log for the execution, capturing outputs such as stdout and stderr.
   - **Output Storage:** The outputs from job executions are stored in the database. This allows for efficient tracking and retrieval of execution logs for analysis and debugging.

## Running Enschedule

In the quick start we are running the `ghcr.io/ricsam/enschedule-dashboard` image as a container. This container runs the `@enschedule/dashboard` npm package. This package is just a packaged Remix app and runs using `remix-serve` in the container.

If you are familiar with remix you can run the `@enschedule/dashboard` in environments that support remix.

Configuration of the `@enschedule/dashboard` is primarily handled through environment variables.

#### Inline Worker:

- By default, if no worker URL is specified as an environment variable, the `@enschedule/dashboard` package runs an "inline" worker. This means the worker operates within the same Node.js process as the dashboard.

#### @enschedule/dashboard environment variables

Only a `WORKER_URL` or database connection variables are required to run `@enschedule/dashboard`

| Variable          | Description                                                                                                                                                 | Accepted Values          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `WORKER_URL`      | The URL to a worker service. If provided, the application will use this worker for database operations instead of establishing its own database connection. | URL                      |
| `API_KEY`         | The API key for authenticating with the worker service.                                                                                                     | `string`                 |
| `DB_USER`         | The username for the database. Not used if `WORKER_URL` is provided.                                                                                        | `string`                 |
| `DB_HOST`         | The host address of the database. Not used if `WORKER_URL` is provided.                                                                                     | `string`                 |
| `DB_PASSWORD`     | The password for the database. Not used if `WORKER_URL` is provided.                                                                                        | `string`                 |
| `DB_DATABASE`     | The name of the database to connect to. Not used if `WORKER_URL` is provided.                                                                               | `string`                 |
| `DB_PORT`         | The port number on which the database server is running. Not used if `WORKER_URL` is provided.                                                              | `integer`                |
| `ORM_LOGGING`     | Enables or disables ORM logging. Not used if `WORKER_URL` is provided.                                                                                      | `bool` default `"false"` |
| `IMPORT_HANDLERS` | Comma separated list of node modules that are imported to define handlers or schedules                                                                      | `string`                 |

##### Database dialect options

You have to provide a valid database connection for enschedule to run OR a `WORKER_URL` that the dashboard connects to instead.

Enschedule uses sequalize as the ORM. The dialects supported by sequalize v6 are supported by enschedule.

One of these environment variables must be provided to run enschedule:

- `POSTGRES`
- `MYSQL`
- `SQLITE`
- `MSSQL`
- `MARIADB`

You can connect to the database using a database URI or by providing the database options as `DB_` variables.

###### Using \_DB variables

Note that the dialect is specified by setting `POSTGRES=true`

```bash
POSTGRES=true
DB_USER=postgres
DB_HOST=127.0.0.1
DB_PASSWORD=postgres
DB_DATABASE=dev
DB_PORT=6543
```

###### Using database URI

The format is `postgres://user:password@host:port/database`, see [the Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database)
e.g.

```bash
POSTGRES=postgres://postgres:postgres@127.0.0.1:6543/dev
```

##### Import handlers

A handler module is just a javascript file that looks like this:

```js
const { z } = require("zod");

module.exports = async (worker) => {
  worker.registerJob({
    id: "send-http-request",
    version: 1,
    title: "Send HTTP request",
    dataSchema: z.object({
      url: z.string(),
    }),
    job: async (data) => {
      await fetch(data.url)
    },
    description: "Provide HTTP parameters as data to send a request",
    example: {
      url: "http://localhost:3000",
    },
  });
  // optionally if you want to schedule a job, you can do it like this
  await worker.scheduleJob(
    "send-http-request",
    1,
    { url: "http://localhost:3000" },
    {
      eventId: "first_event",
      runAt: add(new Date(), {
        days: 5,
      }),
      title: "Programatically Created",
      description:
        "This is an automatically created job which will run in 5 days",
    }
  );
});

```

The exported function is async and takes one argument, a worker instance.

In this context there are two methods on the worker instance:

- `registerJob`
- `scheduleJob`

### Javascript API through `@enschedule/hub`:

Instead of configuring Enschedule using environment variables and the `@enschedule/dashboard`, you can use the `@enschedule/hub` npm package. This provides a JavaScript API to start and configure the Enschedule services.

```typescript
import { createHandler, enschedule } from "@enschedule/hub";
import { z } from "zod";

const app = await enschedule({
  api: true, // enable the worker REST API, see http://localhost:3000/api/v1/healthz
  dashboard: true, // enable the enschedule dashboard
  logJobs: true, // log the output from the handlers to stdout / stderr
  retryStrategy: () => 5000, // if a job should retry, it will retry after 5 seconds
  worker: {
    // the worker will run in the same process as the dashboard, see worker types
    type: "inline",
  },
  handlers: [
    // define handler functions
    createHandler({
      id: "log-job",
      version: 1,
      title: "Log message",
      dataSchema: z.object({
        message: z.string(),
      }),
      job: (data) => {
        console.log(data.message);
      },
      description: "Will print the message on the server",
      example: {
        message: "some message",
      },
    }),
  ],
});
// The returned app is an express app.
// When the worker claims a job and will execute a handler it must execute this file again
// to get the handler. In that scenario you don't want to run the http server from this file and app will be undefined.
if (app) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`Dashboard: http://localhost:${PORT}`);
    console.log(`Worker REST API: http://localhost:${PORT}/api/v1`);
  });
}
```

#### Worker types

- **Inline Worker:** You can configure the worker to run inline, executing on the same thread as the dashboard Node.js process. While this is straightforward, it captures stdout/stderr by overriding the global `console.log` and `console.error` functions, which may be less optimal.
- **File-based Worker:** Alternatively, setting the worker type to 'file' runs the specified file in a child process. This method offers improved stdout/stderr capture, as it's the child process that runs the worker.
- **External Worker:** For an external worker, set the worker type to 'external' and provide a URL pointing to a worker running the worker REST API.

```ts
type WorkerConfig =
  | {
      type: "inline";
    }
  | {
      type: "file";
      filename: string;
    }
  | {
      type: "external";
      url: string;
      apiKey: string;
    };
```

### Standalone Worker Deployment:

Workers can also run independently, either by using the `@enschedule/hub` or the `@enschedule/worker` package. Additionally, workers can be deployed using the Docker image `ghcr.io/ricsam/enschedule-worker`.

### Helm chart

See the helm chart: https://ricsam.github.io/enschedule/

```bash
helm repo add enschedule https://ricsam.github.io/enschedule
helm upgrade -n enschedule --install enschedule enschedule/enschedule
```

## docker compose

```bash
# Fetch docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/ricsam/enschedule/main/infrastructure/docker-compose.yml

# Create charts/enschedule/files folder
mkdir -p charts/enschedule/files

# Fetch index.js and move it to charts/enschedule/files folder
curl -o index.js https://github.com/ricsam/enschedule/blob/main/infrastructure/charts/enschedule/files/index.js
mv index.js charts/enschedule/files/

docker compose up

```

# Creating schedules

A schedule defines when a handler runs. The easiest way to create a new schedule is to use the UI.

## Deploy schedules using schedule files

You can create schedule handler files:

```yml
apiVersion: v1
kind: schedule
spec:
  name: ping
  handler: fetch
  data:
    url: https://www.google.com
    method: get
  description: ping our website
  schedule: "every day at 2 am"
  id: ping
```

```bash
npm install -g @enschedule/cli
enschedule apply -f ping-schedule.yml
```

# Workers
Fields
 * `id` - a unique integer field, used by the database
 * `workerId (in the UI exposed as ID)` - the user defined id. The code on a worker can be deployed across e.g. 3 different workes. Each of those workers will have the same workerId because they run the same code
 * `version` - an autogenerated version that is tracked. When the worker for some reason is updated (title, description,pollInterval,definitions) the version will increase. Simultaneously workers of different versions can run, e.g. you deploy 3 workers with the same code. You then update the code and re-deploy 2 of the workers. 2 of the workers will get a new version and the last one will remain with the same code and have the previous version.
 * `hostname` - os.hostname()
 * `instance ID` - a unique ID that is generated for each instance that runs.
 * `version hash` - if the hash changes the version is bumped
