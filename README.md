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

If you are familiar with remix you can run the @enschedule/dashboard in environments that support remix.

Configuration of the @enschedule/dashboard is primarily handled through environment variables.

#### Inline Worker:
- By default, if no worker URL is specified as an environment variable, the `@enschedule/dashboard` package runs an "inline" worker. This means the worker operates within the same Node.js process as the dashboard.

#### Env options
| Environment Variable | Description | Accepted Values | Default |
|----------------------|-------------|-----------------|---------|
| `WORKER_URL` | The URL to a worker service. If provided, the application will use this worker for database operations instead of establishing its own database connection. | URL |  |
| `API_KEY` | The API key for authenticating with the worker service. | string |  |
| `POSTGRES` | Determines if a PostgreSQL database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
| `MYSQL` | Determines if a MySQL database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
| `SQLITE` | Determines if a SQLite database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database)  or :memory: to use an in-memory sqlite database |  |
| `MSSQL` | Determines if a Microsoft SQL Server database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
| `MARIADB` | Determines if a MariaDB database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
| `DB_USER` | The username for the database. Not used if `WORKER_URL` is provided. | string |  |
| `DB_HOST` | The host address of the database. Not used if `WORKER_URL` is provided. | string |  |
| `DB_PASSWORD` | The password for the database. Not used if `WORKER_URL` is provided. | string |  |
| `DB_DATABASE` | The name of the database to connect to. Not used if `WORKER_URL` is provided. | string |  |
| `DB_PORT` | The port number on which the database server is running. Not used if `WORKER_URL` is provided. | integer |  |
| `ORM_LOGGING` | Enables or disables ORM logging. Not used if `WORKER_URL` is provided. | `true`, `false` | `false` |
| `SQLITE_STORAGE` | The storage location for the SQLite database. Not used if `WORKER_URL` is provided. | `path/to/database.sqlite` or `:memory:` | `:memory:` |

Database connection URI format:
```
postgres://user:password@host:port/database
```


### Advanced Configuration with `@enschedule/hub`:
For more control and configuration options, you can use the `@enschedule/hub` package. This JavaScript API allows for starting the Enschedule dashboard service with additional settings.

#### Configuring Workers:
- **Inline Worker:** You can configure the worker to run inline, executing on the same thread as the dashboard Node.js process. While this is straightforward, it captures stdout/stderr by overriding the global `console.log` and `console.error` functions, which may be less optimal.
- **File-based Worker:** Alternatively, setting the worker type to 'file' runs the specified file in a child process. This method offers improved stdout/stderr capture, as it's the child process that runs the worker.
- **External Worker:** For an external worker, set the worker type to 'external' and provide a URL pointing to a worker running the worker REST API.

### Standalone Worker Deployment:
Workers can also run independently, either by using the `@enschedule/hub` or the `@enschedule/worker` package. Additionally, workers can be deployed using the Docker image `ghcr.io/ricsam/enschedule-worker`.

# Get started
There are a few ways to deploy enschedule.

The code that should be executed when a job runs is defined by the handlers. In these examples we are installing some example handlers: `@enschedule/fetch-handler` and `@enschedule/log-handler` that allows you to schedule [fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch) and [log](https://developer.mozilla.org/en-US/docs/Web/API/console/log).

Here are the easiest options to get started:
## Docker
```bash
docker container run -it --rm \
  --name enschedule-dashboard \
  -e SQLITE=":memory:" \
  -e IMPORT_HANDLERS="@enschedule/fetch-handler,@enschedule/log-handler" \
  -p 3000:3000 \
  ghcr.io/ricsam/enschedule-dashboard:alpha
```

## node.js

```bash
npm i @enschdule/dashboard @enschedule/fetch-handler @enschedule/log-handler
```

```ts
import { scheduler, server } from '@enschdule/dashboard';
import { fetchHandler } from '@enschdule/fetch-handler';
import { logHandler } from '@enschdule/log-handler';

fetchHandler(scheduler);
logHandler(scheduler);

server.start();
```

## Helm
```bash
helm upgrade --install ...
```

## docker compose
```bash
curl https://raw.github...
docker compose up -d
```

# Creating schedules
A schedule defines when a handler runs. The easiest way to create a new schedule is to use the UI.

## Deploy schedules using schedule files
You can create schedule definitions files:
```yml
apiVersion: v1
spec:
  name: ping
  handler: fetch
  data:
    url: https://www.google.com
    method: get
  description: ping our website
  schedule: 'every day at 2 am'
  id: ping
```

```bash
npm install -g @enschedule/cli
enschedule apply -f ping-schedule.yml
```

## node.js
```tsx
import { worker } from '@enschedule/dashbaord';

worker.registerJob({
  id: 'log-job',
  title: 'Log message',
  dataSchema: z.object({
    message: z.string()
  }),
  job: (data) => {
    console.log(data.message);
  },
  description: 'Will print the message on the server',
  example: {
    message: 'some message'
  }
});
```


## Mouting into dockerfile
```bash
cat <<EOC > index.js
const { z } = require('zod');

module.exports = async (worker) => {
  worker.registerJob({
    id: 'log-job',
    title: 'Log message',
    dataSchema: z.object({
      message: z.string()
    }),
    job: async (data) => {
      console.log(data.message);
    },
    description: 'Will print the message on the server',
    example: {
      message: 'some message'
    }
  });
}
EOC
docker container run -p 8080:8080 -e API_ENDPOINT=true -v ${PWD}:/enschedule/jobs enschedule:latest
```

# Architecture
Enschedule consists of 3 components
 * worker
 * dashboard
 * api

can be deployed separately or together
can be deployed to any platform using a remix adapter

# Env options
| Environment Variable | Description | Accepted Values | Default |
|----------------------|-------------|-----------------|---------|
| `WORKER_URL` | The URL to a worker service. If provided, the application will use this worker for database operations instead of establishing its own database connection. | URL |  |
| `API_KEY` | The API key for authenticating with the worker service. | string |  |
| `POSTGRES` | Determines if a PostgreSQL database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
| `MYSQL` | Determines if a MySQL database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
| `SQLITE` | Determines if a SQLite database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database)  or :memory: to use an in-memory sqlite database |  |
| `MSSQL` | Determines if a Microsoft SQL Server database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
| `MARIADB` | Determines if a MariaDB database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
| `DB_USER` | The username for the database. Not used if `WORKER_URL` is provided. | string |  |
| `DB_HOST` | The host address of the database. Not used if `WORKER_URL` is provided. | string |  |
| `DB_PASSWORD` | The password for the database. Not used if `WORKER_URL` is provided. | string |  |
| `DB_DATABASE` | The name of the database to connect to. Not used if `WORKER_URL` is provided. | string |  |
| `DB_PORT` | The port number on which the database server is running. Not used if `WORKER_URL` is provided. | integer |  |
| `ORM_LOGGING` | Enables or disables ORM logging. Not used if `WORKER_URL` is provided. | `true`, `false` | `false` |
| `SQLITE_STORAGE` | The storage location for the SQLite database. Not used if `WORKER_URL` is provided. | `path/to/database.sqlite` or `:memory:` | `:memory:` |

Database connection URI format:
```
postgres://user:password@host:port/database
```
