# `worker`
## Docker
### Environment variables
PGUSER
PGHOST
PGPASSWORD
PGDATABASE
PGPORT
ENSCHEDULE_API
REGISTER_JOBS_SCRIPT
API_PORT or default is 8080
API_HOSTNAME or undefined


### Usage
Use the image as is:

```bash
cat <<EOC > index.js
const { z } = require('zod');

module.exports = async (worker) => {
  worker.registerJob({
      id: 'log-job',
      title: 'Log message',
      dataSchema: z.object({
          message: z.string(),
      }),
      job: async (data, console) => {
          console.log(data.message);
      },
      description: 'Will print the message on the server',
      example: {
          message: 'some message',
      },
  });
}

EOC

```

```
docker container run -p 8080:8080 -e API_ENDPOINT=true -v ${PWD}:/enschedule/jobs enschedule:latest

```

## API
### Usage
```tsx
import { Worker } from '@enschedule/worker';
const worker = new Worker({
  pgUser: process.env.PGUSER,
  pgHost: process.env.PGHOST,
  pgPassword: process.env.PGPASSWORD,
  pgDatabase: process.env.PGDATABASE,
  pgPort: process.env.PGPORT,
});
void (async () => {
  worker.registerJob({
    id: 'log-job',
    title: 'Log message',
    dataSchema: z.object({
        message: z.string(),
    }),
    job: async (data, console) => {
        console.log(data.message);
    },
    description: 'Will print the message on the server',
    example: {
        message: 'some message',
    },
  });
  await worker.startPolling();
  if (process.env.ENSCHEDULE_API) {
      worker.serve({ port: 8080 });
  }
})();

```

