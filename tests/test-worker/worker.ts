import "dotenv/config";
import { Worker } from '@enschedule/worker';
import { z } from 'zod';
import add from 'date-fns/add';

if (!process.env.PGUSER) { throw new Error('The environment variable PGUSER must be defined') }
if (!process.env.PGHOST) { throw new Error('The environment variable PGHOST must be defined') }
if (!process.env.PGPASSWORD) { throw new Error('The environment variable PGPASSWORD must be defined') }
if (!process.env.PGDATABASE) { throw new Error('The environment variable PGDATABASE must be defined') }
if (!process.env.PGPORT) { throw new Error('The environment variable PGPORT must be defined') }

const worker = new Worker({
  pgUser: process.env.PGUSER,
  pgHost: process.env.PGHOST,
  pgPassword: process.env.PGPASSWORD,
  pgDatabase: process.env.PGDATABASE,
  pgPort: process.env.PGPORT,
});
worker.logJobs = true;


const httpRequestJob = worker.registerJob({
    id: 'send-http-request',
    title: 'Send HTTP request',
    dataSchema: z.object({
        url: z.string(),
    }),
    job: (data, console) => {
        console.log('pretending to fetch', data.url);
    },
    description: 'Provide HTTP parameters as data to send a request',
    example: {
        url: 'http://localhost:3000',
    },
});
worker.registerJob({
    id: 'log-job',
    title: 'Log message',
    dataSchema: z.object({
        message: z.string(),
    }),
    job: (data, console) => {
        console.log(data.message);
    },
    description: 'Will print the message on the server',
    example: {
        message: 'some message',
    },
});
worker.registerJob({
    id: 'error-job',
    title: 'Throw message',
    dataSchema: z.object({
        message: z.string(),
    }),
    job: (data) => {
        throw new Error(data.message);
    },
    description: 'Will throw the message as an error',
    example: {
        message: 'some error',
    },
});
worker.registerJob({
    id: 'mix-job',
    title: 'Throw message and log stuff',
    dataSchema: z.object({
        message: z.string(),
    }),
    job: (data, console) => {
        console.log('Will throw an error now');
        throw new Error(data.message);
    },
    description: 'Will throw the message as an error and log stuff',
    example: {
        message: 'some message',
    },
});

void (async () => {
    if (process.env.ENSCHEDULE_API) {
        worker.serve({ port: 8080 });
    }
    await worker.startPolling();
    await worker.scheduleJob(
        httpRequestJob,
        { url: 'http://localhost:3000' },
        {
            eventId: 'first_event',
            runAt: add(new Date(), {
                days: 5,
            }),
            title: 'Programatically Created',
            description: 'This is an automatically created job which will run in 5 days',
        }
    );
})();


