# Enschedule
Allows you to schedule any tasks, test [here](https://enschedule-demo.onrender.com/) (cold startup time might be about 1 minute)

# Get started
There are a few ways to deploy enschedule.

The code that should be executed when a job runs is defined by the handlers. In these examples we are installing some example handlers: `@enschedule/fetch-handler` and `@enschedule/log-handler` that allows you to schedule [fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch) and [log](https://developer.mozilla.org/en-US/docs/Web/API/console/log).

Here are the easiest options to get started:
## Docker
```bash
docker run \
  -e WORKER=true \ # enable the worker
  -e API=true \ # enable API
  -e SQLITE=true \ # use an ondisk sqlite database
  -e IMPORT_HANDLERS="@enschedule/fetch-handler,@enschedule/log-handler" \
  -p 3000:3000 \ # Dashboard: http://localhost:3000
  -p 8080:8080 \ # Rest API: http://localhost:8080
  hub.docker.io/enschedule-dashboard:latest
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
## hub
| Environment Variable | Description | Accepted Values | Default |
|----------------------|-------------|-----------------|---------|
| `WORKER_URL` | The URL to a worker service. If provided, the application will use this worker for database operations instead of establishing its own database connection. | URL |  |
| `API_KEY` | The API key for authenticating with the worker service. | string |  |
| `POSTGRES` | Determines if a PostgreSQL database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
| `MYSQL` | Determines if a MySQL database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
| `SQLITE` | Determines if a SQLite database is used and its connection URI. Providing a `WORKER_URL` supersedes this setting. | `true` or a [Sequelize connection URI](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database) |  |
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
