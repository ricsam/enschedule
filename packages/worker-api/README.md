# `worker-api`
Used in e.g. the apps/dashboard to communicate with the endpoint worker


# Usage of docker image

Use the image as is:

```
docker container run -p 8080:8080 -e API_ENDPOINT=true -v ${PWD}/jobs enschedule:latest

```

```bash
cat <<EOC > index.js
const { z } = require('zod');

module.exports = (worker) => {
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

