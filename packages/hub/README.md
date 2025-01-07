# `worker`
## Docker
### Environment variables
DB_USER
DB_HOST
DB_PASSWORD
DB_DATABASE
DB_PORT
ENSCHEDULE_API
REGISTER_JOBS_SCRIPT
ENSCHEDULE_API_PORT or default is 8080
ENSCHEDULE_API_HOSTNAME or undefined


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
const worker = new Worker({});
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
      worker.serve({ port: 8080 }).listern();
  }
})();

```

