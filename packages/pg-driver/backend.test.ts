/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */

import { RunHandlerInCp } from "@enschedule/types";
import { z } from "zod";
import {
  createJobDefinition,
  Schedule,
  StreamHandle,
  TestBackend,
} from "./backend";
import { envSequalizeOptions } from "./env-sequalize-options";

const backend = new TestBackend({
  name: "test worker",
  workerId: "test-worker",
  database: { ...envSequalizeOptions(), logging: false },
});
const Console = console.Console;

backend.fork = async function (
  runMessage: RunHandlerInCp,
  streamHandle: StreamHandle
) {
  const definition = backend.getJobDef(
    runMessage.definitionId,
    runMessage.version
  );
  const origConsole = console;
  global.console = backend.createConsole(
    streamHandle.stdout,
    streamHandle.stderr
  );
  global.console.Console = Console;
  let exitSignal = "0";
  streamHandle.toggleBuffering(true);
  try {
    await definition.job(runMessage.data);
  } catch (err) {
    console.error(err);
    exitSignal = "1";
  }
  streamHandle.toggleBuffering(false);
  global.console = origConsole;
  return exitSignal;
}.bind(backend);

afterAll(async () => {
  await backend.sequelize.drop({});
  await backend.sequelize.connectionManager.close();
});
beforeEach(async () => {
  await backend.sequelize.drop({});
  await backend.sequelize.sync({ force: true });
  jest.useFakeTimers().setSystemTime(0);
});
afterEach(async () => {
  jest.useRealTimers();
});

const httpJobDeclaration = (
  cb: (data: { url: string }) => void = (data) => {}
) =>
  createJobDefinition({
    version: 1,
    id: "http_request",
    dataSchema: z.object({ url: z.string() }),
    description: "send a http request",
    job: cb,
    title: "HTTP request",
    example: {
      url: "wef",
    },
  });

const jobData = {
  url: "http://localhost:1234",
};

describe("backends", () => {
  it("should be able to connect to the database and select tasks", async () => {
    const jobs = await backend.getDbSchedules();
    expect(jobs.length).toBe(0);
  });
  it("should be able to create a schedule", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "desc",
      1,
      jobData,
      {
        runAt: new Date(0),
      }
    );
    const jobs = await backend.getDbSchedules();
    expect(jobs.length).toBe(1);
  });
  it("should not update jobs in the future", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(10),
      }
    );
    jest.useFakeTimers().setSystemTime(0);

    expect((await backend.claimUnclaimedOverdueJobs()).overdueJobs[0]).toBe(0);
  });
  it("should be able to get a job by climing a job that is overdue", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(10),
      }
    );
    jest.useFakeTimers().setSystemTime(10);
    expect((await backend.claimUnclaimedOverdueJobs()).overdueJobs[0]).toBe(1);
  });
  it("should be able to claim in parallel", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(10),
      }
    );
    jest.useFakeTimers().setSystemTime(10);
    expect(
      (
        await Promise.all(
          [1, 2].map(async () => {
            return (await backend.claimUnclaimedOverdueJobs()).overdueJobs[0];
          })
        )
      ).sort()
    ).toEqual([0, 1]);
  });
  it("should be able to run overdue jobs", async () => {
    const jobFn = jest.fn((data: { url: string }) => {
      console.log("comment");
    });
    backend.registerJob(httpJobDeclaration(jobFn));
    await backend.registerWorker();

    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(10),
      }
    );
    jest.useFakeTimers().setSystemTime(10);
    await backend.runOverdueJobs();
    let runs = await job.getRuns();
    expect(jobFn).toHaveBeenCalledTimes(1);
    expect(jobFn).toHaveBeenLastCalledWith(jobData);
    expect(runs).toHaveLength(1);
    const run = runs[0];
    expect(run.stderr).toBe("");
    expect(run.stdout).toBe("comment\n");

    await backend.runOverdueJobs();
    runs = await job.getRuns();
    expect(jobFn).toHaveBeenCalledTimes(1);
    expect(jobFn).toHaveBeenLastCalledWith(jobData);
    expect(runs).toHaveLength(1);
  });
  it("should be able to run jobs that have runNow: true", async () => {
    const spy = jest.fn((data: { url: string }) => {
      console.log("comment");
    });
    backend.registerJob(httpJobDeclaration(spy));
    await backend.registerWorker();

    const createSchedule = async (id: string) => {
      const [schedule] = await backend.createJobSchedule(
        "http_request",
        "title",
        "description",
        1,
        jobData,
        {
          eventId: id,
        }
      );
      return schedule;
    };
    const schedule = await createSchedule("pre");
    await backend.runOverdueJobs();
    expect(spy).toHaveBeenCalledTimes(0);

    await backend.runScheduleNow(schedule.id);
    await backend.runOverdueJobs();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(jobData);

    await backend.runScheduleNow(schedule.id);
    await backend.runOverdueJobs();

    expect(spy).toHaveBeenCalledTimes(2);

    const a = await createSchedule("a");
    const b = await createSchedule("b");
    await backend.runSchedulesNow([a.id, b.id]);
    await a.reload();
    await b.reload();
    expect(a.runNow).toBe(true);
    expect(b.runNow).toBe(true);
    const result = await backend.runOverdueJobs();
    expect(result.overdueJobs[0]).toBe(2);
    expect(spy).toHaveBeenCalledTimes(4);
  });
  it("should log errors", async () => {
    const spy = jest.fn((data: { url: string }) => {
      throw new Error("Error");
    });
    backend.registerJob(httpJobDeclaration(spy));
    await backend.registerWorker();
    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(10),
      }
    );
    jest.useFakeTimers().setSystemTime(10);
    await backend.runOverdueJobs();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(jobData);

    await backend.runOverdueJobs();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(jobData);
    await job.reload();
    const runs = await job.getRuns();
    expect(runs).toHaveLength(1);
    const run = runs[0];
    expect(run.stdout).toBe("");
    expect(
      run.stderr
        .split("\n")
        .filter(
          (line) =>
            line.includes("backend.test.ts") || !line.includes("    at ")
        )
        .join("\n")
        .replace(/\(\/[^)]*\)/g, "(backend.test.ts)")
        .split("\n")
        .slice(0, 3)
        .join("\n")
    ).toMatchInlineSnapshot(`
      "Error: Error
          at Object.<anonymous> (backend.test.ts)
          at TestBackend.<anonymous> (backend.test.ts)"
    `);
  });

  it("should create a signature", () => {
    const sig = backend.createSignature(
      "http_request",
      new Date(0),
      { url: "http://localhost:8080" },
      "0 * * * *"
    );
    expect(sig).toMatchInlineSnapshot(
      `"http_request-0-{"url":"http://localhost:8080"}-0 0 * * * *"`
    );
  });
  it("should not create duplicated jobs", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      { runAt: new Date(0) }
    );
    expect((await backend.getDbSchedules()).length).toBe(1);
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      { runAt: new Date(0) }
    );
    expect((await backend.getDbSchedules()).length).toBe(1);
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(900),
      }
    );
    expect((await backend.getDbSchedules()).length).toBe(1);
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(15000 - 1),
      }
    );
    expect((await backend.getDbSchedules()).length).toBe(2);
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(15000),
      }
    );
    expect((await backend.getDbSchedules()).length).toBe(3);
  });
});

describe("cron", () => {
  it("should register cron job", async () => {
    const spy = jest.fn((data: { url: string }) => {
      console.log("Hello!");
    });
    jest.useFakeTimers().setSystemTime(0);

    const job = httpJobDeclaration(spy);
    backend.registerJob(job);
    await backend.registerWorker();
    const schedule = await backend.scheduleJob(
      job,
      1,
      {
        url: "http://localhost:8080",
      },
      {
        cronExpression: "* * * * * *",
        title: "title",
        description: "description",
      }
    );

    expect(schedule.runAt!.getTime()).toBe(1000);

    jest.useFakeTimers().setSystemTime(backend.tickDuration);

    await backend.tick();

    let schedules = await backend.getDbSchedules();
    let runs = await backend.getDbRuns();
    expect(schedules).toHaveLength(1);
    expect(runs).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(schedules[0].runAt!.getTime()).toBe(backend.tickDuration + 1000);

    jest.useFakeTimers().setSystemTime(backend.tickDuration * 2);

    await backend.tick();

    schedules = await backend.getDbSchedules();
    runs = await backend.getDbRuns();
    expect(runs).toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(schedules.filter((schedule) => !schedule.claimed)).toHaveLength(1);
    expect(schedules[0].runAt!.getTime()).toBe(backend.tickDuration * 2 + 1000);
    const lastRun = await schedules[0].getLastRun();
    expect(lastRun).toBeTruthy();
    expect(schedules[0].lastRun?.startedAt.getTime()).toBe(
      backend.tickDuration * 2
    );

    expect((await backend.claimUnclaimedOverdueJobs()).overdueJobs[0]).toBe(0);
  });
});

describe("event uniqueness", () => {
  it("should create duplicated events if an eventId is not provided", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(0),
      }
    );
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(1000),
      }
    );
    expect((await backend.getDbSchedules()).length).toBe(2);
  });
  it("should not create duplicated events if an eventId is provided", async () => {
    jest.useFakeTimers().setSystemTime(0);
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(0),
        eventId: "superevent",
      }
    );
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        eventId: "superevent",
        runAt: new Date(1000),
      }
    );
    expect((await backend.getDbSchedules()).length).toBe(1);
  });
});

describe("multiple runs", () => {
  it("should be able to run now and count", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(0),
      }
    );
    const schedules = await backend.getDbSchedules();
    expect(schedules.length).toBe(1);
    expect(await schedule.getRuns()).toHaveLength(0);
    expect(schedule.id).toBe(1);
    expect(schedule.numRuns).toBe(0);
    // RUN
    const run = await backend.runSchedule(schedule.id);
    expect(await schedule.getRuns()).toHaveLength(1);
    await schedule.reload({
      include: {
        model: backend.Run,
        as: "lastRun",
      },
    });
    expect(schedule.lastRun).toBeTruthy();
    expect(schedule.numRuns).toBe(1);
  });
});
describe("delete schedules", () => {
  it("should be able to delete schedules", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(0),
      }
    );
    const schedules = await backend.getDbSchedules();
    expect(schedules.length).toBe(1);
    await backend.deleteSchedules(schedules.map((s) => Number(s.id)));
    expect((await backend.getDbSchedules()).length).toBe(0);
  });
});

describe("update schedule", () => {
  it("should be able to update a schedule", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(0),
      }
    );
    expect(schedule.title).toBe("title");
    await backend.updateSchedule({
      id: schedule.id,
      title: "hello",
    });
    await schedule.reload();
    expect(schedule.title).toBe("hello");
  });
  it("should be able to unset the run now", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(0),
      }
    );
    expect(schedule.runAt?.getTime()).toBe(0);
    await backend.updateSchedule({
      id: schedule.id,
      runAt: new Date(1000),
    });
    await schedule.reload();
    expect(schedule.runAt?.getTime()).toBe(1000);
    await backend.updateSchedule({
      id: schedule.id,
      runAt: null,
    });
    await schedule.reload();
    expect(schedule.runAt).toBe(null);
  });
});

describe("get single run", () => {
  it("should be able to get a single run", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();
    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      jobData,
      {
        runAt: new Date(0),
      }
    );
    const run = await backend.runSchedule(schedule.id);
    expect(run).toEqual(await backend.getRun(run.id));
  });
});
describe("can retry", () => {
  const orig = backend.retryStrategy;
  beforeEach(() => {
    backend.retryStrategy = function (schedule) {
      return 5000;
    };
  });
  afterEach(() => {
    backend.retryStrategy = orig;
  });
  const retryTest = async (
    config: {
      maxRetries?: number;
      notify?: boolean;
      succeedAfter?: number;
    } = {}
  ): Promise<
    [Schedule, Schedule, jest.Mock<void, [data: { url: string }], any>]
  > => {
    const spy = jest.fn((data: { url: string }) => {
      if (data.url === "http://localhost:1234") {
        throw new Error("failed job");
      } else {
        // the second schedule
        console.log("notify about failed job");
      }
    });
    jest.useFakeTimers().setSystemTime(0);
    backend.registerJob(httpJobDeclaration(spy));
    await backend.registerWorker();

    const [notifySchedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      {
        url: "http://localhost:4444",
      }
    );

    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      {
        url: "http://localhost:1234",
      },
      {
        runAt: new Date(0),
        retryFailedJobs: true,
        maxRetries: config.maxRetries,
        failureTrigger: config.notify ? notifySchedule.id : undefined,
      }
    );

    expect(schedule.runAt!.getTime()).toBe(0);

    jest.useFakeTimers().setSystemTime(backend.tickDuration);

    await backend.tick();

    let runs = await backend.getDbRuns();
    expect(runs).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(runs[0].exitSignal).toBe("1");
    await schedule.reload();
    expect(schedule.runAt!.getTime()).toBe(backend.tickDuration + 5000);

    const tick = async (n: number) => {
      jest
        .useFakeTimers()
        .setSystemTime((backend.tickDuration + 5000) * (n + 1));
      await backend.tick();
      runs = await backend.getDbRuns();
    };
    for (let n = 0; n < 10; n += 1) {
      await tick(n);
      if (config.succeedAfter && config.succeedAfter >= n) {
        spy.mockImplementation((data: { url: string }) => {
          console.log("no crash");
        });
      }
    }
    await schedule.reload();
    expect(schedule.retries).toBe(
      config.succeedAfter ? -1 : config.maxRetries ? config.maxRetries : 10
    );
    return [schedule, notifySchedule, spy];
  };
  it("should work when retryFailedJobs is true", async () => {
    const [, , spy] = await retryTest();
    // run + 10 retries
    expect(spy).toHaveBeenCalledTimes(11);
  });
  it("should work with a maxRetries ", async () => {
    const [schedule, , spy] = await retryTest({ maxRetries: 5 });
    expect(spy).toHaveBeenCalledTimes(6);
    let runs = await backend.getDbRuns();
    // run + 5 retries
    expect(runs).toHaveLength(6);
    expect(runs[5].exitSignal).toBe("1");
    await schedule.reload();
    const noMaxRetries = schedule.maxRetries === -1;
    expect(noMaxRetries || schedule.retries < schedule.maxRetries).toBe(false);
    expect(schedule.runAt?.getTime()).toBeLessThan(Date.now());
    expect(schedule.claimed).toBe(true);
  });
  it("should work with a trigger job ", async () => {
    const [schedule, notifyJob, spy] = await retryTest({
      maxRetries: 5,
      notify: true,
    });
    // run + 5 retries + triggerd job
    expect(spy).toHaveBeenCalledTimes(7);
    let runs = await backend.getDbRuns();
    expect(runs).toHaveLength(7);
    expect(runs[5].exitSignal).toBe("1");
    await notifyJob.reload();
    expect(notifyJob.numRuns).toBe(1);
    await schedule.reload();
    expect(schedule.numRuns).toBe(6);
  });
  it("should not continue to retry if succeeds", async () => {
    const [schedule, , spy] = await retryTest({
      maxRetries: 5,
      notify: true,
      succeedAfter: 2,
    });
    // run + 2 retries
    expect(spy).toHaveBeenCalledTimes(3);
    let runs = await backend.getDbRuns();
    expect(runs).toHaveLength(3);
    expect(runs[0].exitSignal).toBe("0");
    expect(runs[1].exitSignal).toBe("1");
    expect(runs[2].exitSignal).toBe("1");
    expect(schedule.numRuns).toBe(3);
  });
});

describe("multiple workers", () => {
  it("should register workers", async () => {
    jest.useFakeTimers().setSystemTime(0);
    // the initial worker is created in the beforeEach
    const worker = await backend.registerWorker();
    await backend.tick();
    expect(worker.title).toBe("test worker");
    expect(worker.id).toBe(1);
    expect(worker.workerId).toBe("test-worker");
    expect(worker.definitions).toMatchInlineSnapshot(`
      [
        {
          "codeBlock": "type HttpRequest = {
        url: string;
      };",
          "description": "send a http request",
          "example": {
            "url": "wef",
          },
          "id": "http_request",
          "jsonSchema": {
            "$ref": "#/definitions/HttpRequest",
            "$schema": "http://json-schema.org/draft-07/schema#",
            "definitions": {
              "HttpRequest": {
                "additionalProperties": false,
                "properties": {
                  "url": {
                    "type": "string",
                  },
                },
                "required": [
                  "url",
                ],
                "type": "object",
              },
            },
          },
          "title": "HTTP request",
          "version": 1,
        },
      ]
    `);
    expect(worker.lastReached.getTime()).toBe(0);
  });
  it("should register workers", async () => {
    // the initial worker is created in the beforeEach
    const worker = await backend.registerWorker();
    await backend.tick();
    expect(worker.title).toBe("test worker");
    expect(worker.id).toBe(1);
    expect(worker.version).toBe(1);
    expect(worker.workerId).toBe("test-worker");
    expect(worker.lastReached.getTime()).toBe(0);
  });
  it("should update worker version", async () => {
    const handler = httpJobDeclaration();
    backend.registerJob(handler);
    const worker = await backend.registerWorker();

    expect(worker.title).toBe("test worker");
    expect(worker.id).toBe(1);
    expect(worker.version).toBe(1);
    expect(worker.workerId).toBe("test-worker");
    expect(worker.lastReached.getTime()).toBe(0);

    await backend.registerWorker();

    expect(worker.title).toBe("test worker");
    expect(worker.id).toBe(1);
    expect(worker.version).toBe(1);
    expect(worker.workerId).toBe("test-worker");
    expect(worker.lastReached.getTime()).toBe(0);

    // pretend we are updating the handler code and restarting the server
    handler.version = 2;
    backend.workerInstance.instanceId = "new-instance-id";
    backend.definedJobs[handler.id] = { "2": handler } as any;

    expect(backend.definedJobs[handler.id]?.[handler.version]?.version).toBe(
      2
    );

    const newWorker = await backend.registerWorker();
    const workers = await backend.Worker.findAll();
    expect(workers).toHaveLength(2);
    expect(newWorker.version).toBe(2);
  });
  it("should attach worker instance to the runs", async () => {
    const handler = httpJobDeclaration();
    backend.registerJob(handler);
    const worker = await backend.registerWorker();

    expect(worker.title).toBe("test worker");
    expect(worker.id).toBe(1);
    expect(worker.version).toBe(1);
    expect(worker.workerId).toBe("test-worker");
    expect(worker.lastReached.getTime()).toBe(0);

    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      {
        url: "http://localhost:1234",
      },
      {
        runAt: new Date(0),
      }
    );
    const run = await backend.runSchedule(schedule.id);
    expect(run.worker.id).toBe(worker.id);
    expect((await backend.getWorkers())[0].id).toBe(worker.id);
    expect((await backend.getWorkers())[0].lastRun?.id).toBe(run.id);
  });
  it("should be able to handle multiple versions of a handler", async () => {
    const spyA = jest.fn((data: { url: string }) => {});

    const handler = httpJobDeclaration(spyA);
    backend.registerJob(handler);
    const worker = await backend.registerWorker();

    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      {
        url: "http://localhost:1234",
      },
      {
        runAt: new Date(0),
        eventId: "default-1",
      }
    );
    expect(schedule.id).toBe(1);
    const runA = await backend.runSchedule(schedule.id);
    expect(spyA).toHaveBeenCalledWith({ url: "http://localhost:1234" });
    expect(runA.data).toBe('{"url":"http://localhost:1234"}');

    const spyB = jest.fn((url: string) => {});
    backend.registerJob({
      version: 2,
      dataSchema: z.string(),
      description: "new description",
      title: "new title",
      job: spyB,
      id: "http_request",
      example: "http://localhost:1234",
    });

    const handlers = await backend.getLatestHandlers();
    expect(handlers).toHaveLength(1);

    // create a schedule using the old version
    const [oldSchedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      {
        url: "http://other_url:1234",
      },
      {
        runAt: new Date(0),
        eventId: "other-1",
      }
    );
    spyA.mockReset();
    expect(oldSchedule.id).toBe(2);
    expect(oldSchedule.data).toBe('{"url":"http://other_url:1234"}');
    expect(oldSchedule.handlerVersion).toBe(1);
    const runC = await backend.runSchedule(oldSchedule.id);
    expect(spyA).toHaveBeenCalledWith({ url: "http://other_url:1234" });
  });
  it("should be able to migrate a definition", async () => {
    const spyA = jest.fn((data: { url: string }) => {});

    const handler = httpJobDeclaration(spyA);
    backend.registerJob(handler);
    const worker = await backend.registerWorker();

    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      {
        url: "http://localhost:1234",
      },
      {
        runAt: new Date(0),
        eventId: "default-1",
      }
    );
    expect(schedule.id).toBe(1);
    const runA = await backend.runSchedule(schedule.id);
    expect(spyA).toHaveBeenCalledWith({ url: "http://localhost:1234" });
    expect(runA.data).toBe('{"url":"http://localhost:1234"}');

    const spyB = jest.fn((url: string) => {});

    await backend.migrateHandler(
      {
        id: handler.id,
        dataSchema: handler.dataSchema,
        version: handler.version,
      },
      createJobDefinition({
        version: 2,
        dataSchema: z.string(),
        description: "new description",
        title: "new title",
        job: spyB,
        id: "http_request",
        example: "http://localhost:1234",
      }),
      ({ url }) => url
    );

    const runB = await backend.runSchedule(schedule.id);
    expect(spyB).toHaveBeenCalledWith("http://localhost:1234");
    expect(runB.data).toBe('"http://localhost:1234"');

    const handlers = await backend.getLatestHandlers();
    expect(handlers).toHaveLength(1);

    // create a schedule using the old version
    const [oldSchedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      1,
      {
        url: "http://other_url:1234",
      },
      {
        runAt: new Date(0),
        eventId: "other-1",
      }
    );
    spyA.mockReset();
    spyB.mockReset();
    expect(oldSchedule.id).toBe(2);
    expect(oldSchedule.handlerVersion).toBe(2);
    expect(oldSchedule.data).toBe('"http://other_url:1234"');
    const runC = await backend.runSchedule(oldSchedule.id);
    expect(spyA).not.toHaveBeenCalled();
    expect(spyB).toBeCalledWith("http://other_url:1234");

    // backend.clearRegisteredJobs();
    // const newHandler = httpJobDeclaration();
    // newHandler.version = 2;
    // backend.registerJob(newHandler);
    // await backend.migrateDatabase();
    // expect(backend.getJobDefinition(newHandler.id).version).toBe(2);
    // expect((await backend.getWorkers())[0].version).toBe(2);
  });
});
