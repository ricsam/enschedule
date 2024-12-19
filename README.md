# Enschedule

**Schedule any task**

Enschedule is an open-source project that combines a UI dashboard with a database to manage and automate task scheduling and execution.

## Quick start

```sh
docker container run -it --rm \
  --name enschedule-dashboard \
  -e SQLITE=":memory:" \ # Use in-memory sqlite
  -e IMPORT_FUNCTIONS="@enschedule-fns/fetch,@enschedule-fns/log" \ # Load included handlers
  -e ADMIN_ACCOUNT=adm1n:s3cret_pw \
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

| Variable           | Description                                                                                                                                                 | Accepted Values          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `WORKER_URL`       | The URL to a worker service. If provided, the application will use this worker for database operations instead of establishing its own database connection. | URL                      |
| `API_KEY`          | The API key for authenticating with the worker service.                                                                                                     | `string`                 |
| `DB_USER`          | The username for the database. Not used if `WORKER_URL` is provided.                                                                                        | `string`                 |
| `DB_HOST`          | The host address of the database. Not used if `WORKER_URL` is provided.                                                                                     | `string`                 |
| `DB_PASSWORD`      | The password for the database. Not used if `WORKER_URL` is provided.                                                                                        | `string`                 |
| `DB_DATABASE`      | The name of the database to connect to. Not used if `WORKER_URL` is provided.                                                                               | `string`                 |
| `DB_PORT`          | The port number on which the database server is running. Not used if `WORKER_URL` is provided.                                                              | `integer`                |
| `ORM_LOGGING`      | Enables or disables ORM logging. Not used if `WORKER_URL` is provided.                                                                                      | `bool` default `"false"` |
| `IMPORT_FUNCTIONS` | Comma separated list of node modules that are imported to define handlers or schedules                                                                      | `string`                 |

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

ENSCHEDULE_API_KEY="Api-Key some_secret" \
ENSCHEDULE_API_ENDPOINT="https://enschedule-api.your-endpoint.com" \
ENSCHEDULE_API_VERSION="1" \
enschedule apply -f ping-schedule.yml
```

- `apiVersion` - not used
- `ENSCHEDULE_API_VERSION` - not used
- `api/v1` - is the default endpint

**NOTE** it has not yet been decided how the versioning will work

# Workers

Fields

- `id` - a unique integer field, used by the database
- `workerId (in the UI exposed as ID)` - the user defined id. The code on a worker can be deployed across e.g. 3 different workes. Each of those workers will have the same workerId because they run the same code
- `version` - an autogenerated version that is tracked. When the worker for some reason is updated (title, description,pollInterval,definitions,access) the version will increase. Simultaneously workers of different versions can run, e.g. you deploy 3 workers with the same code. You then update the code and re-deploy 2 of the workers. 2 of the workers will get a new version and the last one will remain with the same code and have the previous version.
- `hostname` - os.hostname()
- `instance ID` - a unique ID that is generated for each instance that runs.
- `version hash` - if the hash changes the version is bumped

# Definitions / Functions / Handlers

Have a version constructed of

- id
- version

If anything else on a function updates, such as title, job, example, access then you must bumb the version key for it to be updated. This is your responsibility as a developer to make sure versions is bumped as Enschedule CAN NOT serialize the code in e.g. the job and thus detect newer versions.

# User Access

# Access System Documentation

## Overview

The access system is designed to provide granular control over user permissions within a hierarchical structure of Workers, Functions, Schedules, and Runs. It allows for both explicit permission settings and inheritance of default permissions from higher levels in the hierarchy.

## Components

### 1. Users and Groups

- Individual users can be granted specific permissions.
- Groups of users can be created and granted permissions collectively.

### 2. Worker

The top-level component in the hierarchy.

#### Permissions:

- View: Determines who can see the worker.
- Delete: Determines who can delete the worker.

#### Default Settings:

- Default Function Access
- Default Schedule Access
- Default Run Access

These default settings are inherited by lower levels if not explicitly overridden.

### 3. Function

Functions are defined within a Worker.

#### Permissions:

- View: Determines who can see the function.
- Create Schedule: Determines who can create schedules for the function.

### 4. Schedule

Schedules are created for specific Functions.

#### Permissions:

- View: Determines who can see the schedule.
- Edit: Determines who can modify the schedule.
- Delete: Determines who can remove the schedule.

### 5. Run

Runs are created when a scheduled function executes.

#### Permissions:

- View: Determines who can see the run data (stdout, stderr, runtime, etc.).

## Inheritance Rules

1. If a Function doesn't specify its own access rights, it inherits from the Worker's Default Function Access.
2. If a Schedule doesn't specify its own access rights, it inherits from the Function's Default Schedule Access (or the Worker's if not defined at the Function level).
3. If Run access isn't specified for a Schedule, it inherits from the Function's Default Run Access (or the Worker's if not defined at the Function level).

## Access Configuration

Access is configured using a JSON structure. Here's a basic template:

```js
const worker = new Worker({
  access: {
    view: {
      users: ["user1", "user2"],
      groups: ["group1"],
    },
    delete: {
      users: ["admin"],
    },
  },
  defaultFunctionAccess: {
    /*...*/
  },
  defaultScheduleAccess: {
    /*...*/
  },
  defaultRunAccess: {
    /*...*/
  },
});
```

## Best Practices

1. **Least Privilege**: Start with minimal access and add permissions as needed.
2. **Use Groups**: Whenever possible, assign permissions to groups rather than individual users for easier management.
3. **Leverage Defaults**: Use default settings at the Worker and Function levels to simplify configuration.
4. **Regular Audits**: Periodically review and update access configurations to ensure they remain appropriate.

## Implementation Notes

- The backend system must validate all access configurations to ensure they follow the inheritance rules.
- When checking access rights, the system should cascade through the levels (Worker -> Function -> Schedule -> Run) to determine the effective access rights for a user or group.
- UI and API endpoints for creating and modifying Schedules should include options for setting these access rights.

## Examples

### Granting a user view access to a Worker

```js
const worker = new Worker({
  access: {
    view: {
      users: ["user1"],
      groups: [],
    },
  },
});
```

### Setting default Function access for a Worker

```js
const worker = new Worker({
  defaultFunctionAccess: {
    view: {
      users: [],
      groups: ["developers"],
    },
    createSchedule: {
      users: ["admin1"],
      groups: ["schedulers"],
    },
  },
});
```

### Setting function access

```js
worker.registerJob({
  access: {
    view: {
      users: ["user1", "user2"],
      groups: ["group1"],
    },
    createSchedule: {
      users: ["user2"],
      groups: [],
    },
  },
  defaultScheduleAccess: {
    access: {
      view: {
        users: ["user1", "user2"],
        groups: ["group1"],
      },
      edit: {
        users: ["user2"],
        groups: [],
      },
      delete: {
        users: ["user2"],
        groups: [],
      },
    },
  },
  defaultRunAccess: {
    view: {
      users: ["user1", "user2"],
      groups: ["group1"],
    },
  },
});
```

### Configuring Schedule access

```js
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
    access: {
      view: {
        users: ["user1", "user2"],
        groups: ["viewers"],
      },
      edit: {
        users: ["admin1"],
        groups: ["editors"],
      },
      delete: {
        users: ["admin1"],
        groups: [],
      },
    },
    runAccess: {
      view: {
        users: ["user1", "user2"],
        groups: ["viewers"],
      },
      delete: {
        users: ["admin1"],
        groups: [],
      },
    },
  }
);
```

# Migrations

If you update the data schema you must update the version. If the new data schema is not compatible with the old one you must create a function migration:

```ts
await worker.migrateHandler(
  "log-number",
  {
    dataSchema: z.number(),
    version: 1,
  },
  {
    title: "Number logger",
    dataSchema: z.object({ value: z.number() }),
    version: 1,
    job: async ({ value }) => {
      console.log(value);
    },
    description: "this will log a number",
    example: {
      value: 100,
    },
  },
  // this is the migration where we convert data from `z.number()` to `z.object({ value: z.number() })`
  (value) => ({
    value,
  })
);
```

# FAQ
* How can I make a scheduled job run on a specific worker?\
  *You can add a workerId to the schedule and the job will run on the specified worker*
