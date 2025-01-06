/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */

import { PublicJobRun, WorkerStatus } from "@enschedule/types";
import { z } from "zod";
import { Schedule, TestBackend, createJobDefinition } from "./backend";
import { envSequalizeOptions } from "./env-sequalize-options";
jest.setTimeout(60000);

let sequalizeInstances: TestBackend[] = [];

const pgBackend = () => {
  const backend = new TestBackend(
    {
      name: "test worker",
      workerId: "test-worker",
      database: {
        ...envSequalizeOptions(),
        logging: false,
        pool: {
          max: 200,
          min: 0,
          acquire: 60000,
          idle: 10000,
        },
      },
      inlineWorker: true,
      accessTokenSecret: "secret",
      refreshTokenSecret: "secret",
      nafsUri: `file://${__dirname}/test-data/nafs`,
      apiKey: "secret",
    },
    "Api-Key secret"
  );
  sequalizeInstances.push(backend);
  return backend;
};
const sqliteBackend = () => {
  const backend = new TestBackend(
    {
      name: "test worker",
      workerId: "test-worker",
      database: { dialect: "sqlite", storage: ":memory:", logging: false },
      inlineWorker: true,
      accessTokenSecret: "secret",
      refreshTokenSecret: "secret",
      nafsUri: `file://${__dirname}/test-data/nafs`,
      apiKey: "secret",
    },
    "Api-Key secret"
  );
  sequalizeInstances.push(backend);
  return backend;
};
const Console = console.Console;
// jest.setTimeout(6000000);

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
    access: {
      view: {
        users: [1],
      },
    },
  });

const startInstance = async (backend: TestBackend) => {
  try {
    await backend.getSequelize().drop({});
    await backend.getSequelize().sync({ force: true });
  } catch (err) {}
};
const closeInstance = async (backend: TestBackend) => {
  try {
    await backend.getSequelize().drop({});
  } catch (err) {}
  try {
    await backend.getSequelize().connectionManager.close();
  } catch (err) {}
  try {
    await backend.getSequelize().close();
  } catch (err) {}
};
afterAll(async () => {
  await Promise.all(
    sequalizeInstances.map((backend) => closeInstance(backend))
  );
  sequalizeInstances = [];
});

const jobData = {
  url: "http://localhost:1234",
};

const registerTests = (cb: (getBackend: () => TestBackend) => void) => {
  describe("can have two instances", () => {
    for (const [dialectLabel, instanciateDialect] of [
      ["sqlite", sqliteBackend] as const,
      ["pg", pgBackend] as const,
    ]) {
      if (process.env.TEST_DIALECT !== dialectLabel) {
        continue;
      }
      describe(dialectLabel, () => {
        let backend: TestBackend;
        beforeEach(async () => {
          jest.useFakeTimers().setSystemTime(0);
          backend = instanciateDialect();
          await startInstance(backend);
        });
        afterEach(async () => {
          await closeInstance(backend);
        });
        cb(() => backend);
      });
    }
  });
};

/**
 * runs backend.runOverdueJobs but will advance all timers that ticks to collect stdout / stderr
 * as the timers are mocked and never progressed when using jest.useFakeTimers
 */
const awaitOverdueJobs = async (
  backend: TestBackend
): Promise<Schedule[] | undefined> => {
  const p1 = backend.runOverdueJobs();
  let done = false;
  const result = await Promise.race([
    p1,
    new Promise(() => {
      const u = async () => {
        while (!done) {
          if (!jest.isEnvironmentTornDown()) {
            await jest.runOnlyPendingTimersAsync();
          } else {
            done = true;
          }
        }
      };
      u();
    }),
  ]);
  done = true;
  return result as Schedule[] | undefined;
};

/**
 * same principle as awaitOverdueJobs but for backend.tick
 */
const awaitTick = async (backend: TestBackend) => {
  await backend.registerWorker();
  await awaitOverdueJobs(backend);
};

const awaitRunSchedule = async (
  backend: TestBackend,
  scheduleId: number
): Promise<PublicJobRun> => {
  const p1 = backend.runSchedule(backend.authHeader, scheduleId);
  let done = false;
  const result = await Promise.race([
    p1,
    new Promise(() => {
      const u = async () => {
        while (!done) {
          if (!jest.isEnvironmentTornDown()) {
            await jest.runOnlyPendingTimersAsync();
          } else {
            done = true;
          }
        }
      };
      u();
    }),
  ]);
  done = true;
  return result as PublicJobRun;
};

registerTests((getBackend: () => TestBackend) => {
  let backend: TestBackend;
  beforeEach(() => {
    backend = getBackend();
  });
  it("can instanciate", async () => {
    backend.registerJob(httpJobDeclaration());
    await backend.registerWorker();

    const [job] = await backend.createJobSchedule({
      functionId: "http_request",
      title: "title",
      description: "desc",
      functionVersion: 1,
      data: jobData,
      options: {
        runAt: new Date(0),
      },
    });
    const jobs = await backend.getDbSchedules();
    expect(jobs.length).toBe(1);
  });

  describe("backends", () => {
    it("should be able to connect to the database and select tasks", async () => {
      const jobs = await backend.getDbSchedules();
      expect(jobs.length).toBe(0);
    });
    it("should be able to create a schedule", async () => {
      try {
        backend.registerJob(httpJobDeclaration());

        await backend.registerWorker();
        const [job] = await backend.createJobSchedule({
          functionId: "http_request",
          title: "title",
          description: "desc",
          functionVersion: 1,
          data: jobData,
          options: {
            runAt: new Date(0),
          },
        });
        const jobs = await backend.getDbSchedules();
        expect(jobs.length).toBe(1);
      } catch (err) {
        throw err;
        console.log(err);
      }
    });
    it("should not update jobs in the future", async () => {
      backend.registerJob(httpJobDeclaration());
      await backend.registerWorker();
      const [job] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(10),
        },
      });
      jest.useFakeTimers().setSystemTime(0);

      expect(await backend.claimUnclaimedOverdueJobs()).toHaveLength(0);
    });
    it("should be able to get a job by climing a job that is overdue", async () => {
      backend.registerJob(httpJobDeclaration());
      await backend.registerWorker();
      const [job] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(10),
        },
      });
      jest.useFakeTimers().setSystemTime(10);
      expect(await backend.claimUnclaimedOverdueJobs()).toHaveLength(1);
    });
    it("should be able to claim in parallel", async () => {
      backend.registerJob(httpJobDeclaration());
      await backend.registerWorker();
      const [job] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(10),
        },
      });
      jest.useFakeTimers().setSystemTime(10);
      expect(
        (
          await Promise.all(
            [1, 2].map(async () => {
              return (await backend.claimUnclaimedOverdueJobs()).length;
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

      const [job] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(10),
        },
      });
      jest.useFakeTimers().setSystemTime(10);

      await awaitOverdueJobs(backend);

      let runs = await job.getRuns();
      expect(jobFn).toHaveBeenCalledTimes(1);
      expect(jobFn).toHaveBeenLastCalledWith(jobData);
      expect(runs).toHaveLength(1);
      const run = runs[0];
      expect(await backend.getLogs(backend.authHeader, run.id)).toBe(
        "1970-01-01T00:00:00.000000Z comment\n"
      );

      await awaitOverdueJobs(backend);

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
        const [schedule] = await backend.createJobSchedule({
          functionId: "http_request",
          title: "title",
          description: "description",
          functionVersion: 1,
          data: jobData,
          options: {
            eventId: id,
          },
        });
        return schedule;
      };
      const schedule = await createSchedule("pre");
      await awaitOverdueJobs(backend);
      expect(spy).toHaveBeenCalledTimes(0);

      await backend.runScheduleNow(schedule.id);
      await awaitOverdueJobs(backend);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenLastCalledWith(jobData);

      await backend.runScheduleNow(schedule.id);
      await awaitOverdueJobs(backend);

      expect(spy).toHaveBeenCalledTimes(2);

      const a = await createSchedule("a");
      const b = await createSchedule("b");
      await backend.runSchedulesNow([a.id, b.id]);
      await a.reload();
      await b.reload();
      expect(a.runNow).toBe(true);
      expect(b.runNow).toBe(true);
      const result = await awaitOverdueJobs(backend);
      expect(result).toHaveLength(2);
      expect(spy).toHaveBeenCalledTimes(4);
    });
    it("should log errors", async () => {
      const spy = jest.fn((data: { url: string }) => {
        throw new Error("Error");
      });
      backend.registerJob(httpJobDeclaration(spy));
      await backend.registerWorker();
      const [job] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(10),
        },
      });
      jest.useFakeTimers().setSystemTime(10);
      await awaitOverdueJobs(backend);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenLastCalledWith(jobData);

      await awaitOverdueJobs(backend);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenLastCalledWith(jobData);
      await job.reload();
      const runs = await job.getRuns();
      expect(runs).toHaveLength(1);
      const run = runs[0];
      const stdout = (await backend.getLogs(backend.authHeader, run.id))!;
      expect(
        stdout
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
        "1970-01-01T00:00:00.000000Z Error: Error
        1970-01-01T00:00:00.000000Z     at Object.<anonymous> (backend.test.ts)
        1970-01-01T00:00:00.000000Z     at awaitOverdueJobs (backend.test.ts)"
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
      await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: { runAt: new Date(0) },
      });
      expect((await backend.getDbSchedules()).length).toBe(1);
      await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: { runAt: new Date(0) },
      });
      expect((await backend.getDbSchedules()).length).toBe(1);
      await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(900),
        },
      });
      expect((await backend.getDbSchedules()).length).toBe(1);
      await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(15000 - 1),
        },
      });
      expect((await backend.getDbSchedules()).length).toBe(2);
      await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(15000),
        },
      });
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
      const result = await backend.scheduleJob(
        backend.authHeader,
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

      expect(result.schedule.runAt!.getTime()).toBe(1000);

      jest.useFakeTimers().setSystemTime(backend.pollInterval * 1000);

      await awaitTick(backend);

      let schedules = await backend.getDbSchedules();
      let runs = await backend.getDbRuns();
      expect(schedules).toHaveLength(1);
      expect(runs).toHaveLength(1);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(schedules[0].runAt!.getTime()).toBe(
        backend.pollInterval * 1000 + 1000
      );

      jest.useFakeTimers().setSystemTime(backend.pollInterval * 1000 * 2);

      await awaitTick(backend);

      schedules = await backend.getDbSchedules();
      runs = await backend.getDbRuns();
      expect(runs).toHaveLength(2);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(schedules.filter((schedule) => !schedule.claimed)).toHaveLength(1);
      expect(schedules[0].runAt!.getTime()).toBe(
        backend.pollInterval * 1000 * 2 + 1000
      );
      const lastRun = await schedules[0].getLastRun();
      expect(lastRun).toBeTruthy();
      expect(schedules[0].lastRun?.startedAt.getTime()).toBe(
        backend.pollInterval * 1000 * 2
      );

      expect(await backend.claimUnclaimedOverdueJobs()).toHaveLength(0);
    });
  });

  describe("event uniqueness", () => {
    it("should create duplicated events if an eventId is not provided", async () => {
      backend.registerJob(httpJobDeclaration());
      await backend.registerWorker();
      await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(0),
        },
      });
      await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(1000),
        },
      });
      expect((await backend.getDbSchedules()).length).toBe(2);
    });
    it("should not create duplicated events if an eventId is provided", async () => {
      jest.useFakeTimers().setSystemTime(0);
      backend.registerJob(httpJobDeclaration());
      await backend.registerWorker();
      const [, status1] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(0),
          eventId: "superevent",
        },
      });
      expect(status1).toBe("created");
      const [s2, status2] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          eventId: "superevent",
          runAt: new Date(1000),
        },
      });
      expect(status2).toBe("updated");
      expect(s2.runAt).toEqual(new Date(1000));
      expect((await backend.getDbSchedules()).length).toBe(1);
    });
  });

  describe("multiple runs", () => {
    it("should be able to run now and count", async () => {
      backend.registerJob(httpJobDeclaration());
      await backend.registerWorker();
      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(0),
        },
      });
      const schedules = await backend.getDbSchedules();
      expect(schedules.length).toBe(1);
      expect(await schedule.getRuns()).toHaveLength(0);
      expect(schedule.id).toBe(1);
      expect(schedule.numRuns).toBe(0);
      // // RUN
      const run = await awaitRunSchedule(backend, schedule.id);
      expect(await schedule.getRuns()).toHaveLength(1);
      await schedule.reload({
        include: {
          model: backend.getRunModel(),
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
      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(0),
        },
      });
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
      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(0),
        },
      });
      expect(schedule.title).toBe("title");
      await backend.updateSchedule(backend.authHeader, {
        id: schedule.id,
        title: "hello",
      });
      await schedule.reload();
      expect(schedule.title).toBe("hello");
    });
    it("should be able to unset the run now", async () => {
      backend.registerJob(httpJobDeclaration());
      await backend.registerWorker();
      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(0),
        },
      });
      expect(schedule.runAt?.getTime()).toBe(0);
      await backend.updateSchedule(backend.authHeader, {
        id: schedule.id,
        runAt: new Date(1000),
      });
      await schedule.reload();
      expect(schedule.runAt?.getTime()).toBe(1000);
      await backend.updateSchedule(backend.authHeader, {
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
      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: jobData,
        options: {
          runAt: new Date(0),
        },
      });
      const run = await awaitRunSchedule(backend, schedule.id);
      const receivedSingleRun = await backend.getRun(
        backend.authHeader,
        run.id
      );
      // last reached and status might diff, but that is okay
      const now = new Date();
      if (typeof run.worker !== "string") {
        run.worker.lastReached = now;
        run.worker.status = WorkerStatus.UP;
      }
      if (typeof receivedSingleRun.worker !== "string") {
        receivedSingleRun.worker.lastReached = now;
        receivedSingleRun.worker.status = WorkerStatus.UP;
      }
      expect(run).toEqual(receivedSingleRun);
    });
  });

  describe("can retry", () => {
    let orig: any;
    beforeEach(() => {
      orig = backend.retryStrategy;
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

      const [notifySchedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: {
          url: "http://localhost:4444",
        },
      });

      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: {
          url: "http://localhost:1234",
        },
        options: {
          runAt: new Date(0),
          retryFailedJobs: true,
          maxRetries: config.maxRetries,
          failureTrigger: config.notify ? notifySchedule.id : undefined,
        },
      });

      expect(schedule.runAt!.getTime()).toBe(0);

      jest.useFakeTimers().setSystemTime(backend.pollInterval * 1000);

      await awaitTick(backend);

      let runs = await backend.getDbRuns();
      expect(runs).toHaveLength(1);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(runs[0].exitSignal).toBe("1");
      await schedule.reload();
      expect(schedule.runAt!.getTime()).toBe(
        backend.pollInterval * 1000 + 5000
      );

      const tick = async (n: number) => {
        jest
          .useFakeTimers()
          .setSystemTime((backend.pollInterval * 1000 + 5000) * (n + 1));
        await awaitTick(backend);
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
      expect(noMaxRetries || schedule.retries < schedule.maxRetries).toBe(
        false
      );
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
      backend.registerJob(httpJobDeclaration());
      const worker = await backend.registerWorker();
      await backend.tick();
      expect(worker.title).toBe("test worker");
      expect(worker.id).toBe(1);
      expect(worker.workerId).toBe("test-worker");
      expect(worker.definitions).toMatchInlineSnapshot(`
        [
          {
            "access": {
              "view": {
                "users": [
                  1,
                ],
              },
            },
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
      backend.registerJob(httpJobDeclaration());
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
      backend.setRegisteredWorker(undefined);
      backend.getWorkerInstance().instanceId = "new-instance-id";
      backend.getDefinedJobs()[handler.id] = { "2": handler } as any;

      expect(
        backend.getDefinedJobs()[handler.id]?.[handler.version]?.version
      ).toBe(2);

      const newWorker = await backend.registerWorker();
      const workers = await backend.getWorkerModel().findAll();
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

      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: {
          url: "http://localhost:1234",
        },
        options: {
          runAt: new Date(0),
        },
      });
      const run = await awaitRunSchedule(backend, schedule.id);
      expect(typeof run.worker !== "string" && run.worker.id).toBe(worker.id);
      expect((await backend.getWorkers("Api-Key secret"))[0].id).toBe(
        worker.id
      );
      expect((await backend.getWorkers("Api-Key secret"))[0].lastRun?.id).toBe(
        run.id
      );
    });
    it("should be able to handle multiple versions of a handler", async () => {
      const spyA = jest.fn((data: { url: string }) => {});

      const handler = httpJobDeclaration(spyA);
      backend.registerJob(handler);
      const worker = await backend.registerWorker();

      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: {
          url: "http://localhost:1234",
        },
        options: {
          runAt: new Date(0),
          eventId: "default-1",
        }
      });
      expect(schedule.id).toBe(1);
      const runA = await awaitRunSchedule(backend, schedule.id);
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

      await backend.registerWorker();
      const handlers = await backend.getLatestHandlers();
      expect(handlers).toHaveLength(1);

      // create a schedule using the old version
      const [oldSchedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: {
          url: "http://other_url:1234",
        },
        options: {
          runAt: new Date(0),
          eventId: "other-1",
        },
      });
      spyA.mockReset();
      expect(oldSchedule.id).toBe(2);
      expect(oldSchedule.data).toBe('{"url":"http://other_url:1234"}');
      expect(oldSchedule.functionVersion).toBe(1);
      const runC = await awaitRunSchedule(backend, oldSchedule.id);
      expect(spyA).toHaveBeenCalledWith({ url: "http://other_url:1234" });
    });
    it("should be able to migrate a definition", async () => {
      const spyA = jest.fn((data: { url: string }) => {});

      const handler = httpJobDeclaration(spyA);
      backend.registerJob(handler);
      const worker = await backend.registerWorker();

      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: {
          url: "http://localhost:1234",
        },
        options: {
          runAt: new Date(0),
          eventId: "default-1",
        }
      });
      expect(schedule.id).toBe(1);
      const runA = await awaitRunSchedule(backend, schedule.id);
      expect(spyA).toHaveBeenCalledWith({ url: "http://localhost:1234" });
      expect(runA.data).toBe('{"url":"http://localhost:1234"}');

      const spyB = jest.fn((url: string) => {});

      await backend.migrateHandler(
        handler.id,
        {
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

      const runB = await awaitRunSchedule(backend, schedule.id);
      expect(spyB).toHaveBeenCalledWith("http://localhost:1234");
      expect(runB.data).toBe('"http://localhost:1234"');

      const handlers = await backend.getLatestHandlers();
      expect(handlers).toHaveLength(1);

      // create a schedule using the old version
      const [oldSchedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: {
          url: "http://other_url:1234",
        },
        options: {
          runAt: new Date(0),
          eventId: "other-1",
        },
      });
      spyA.mockReset();
      spyB.mockReset();
      expect(oldSchedule.id).toBe(2);
      expect(oldSchedule.functionVersion).toBe(2);
      expect(oldSchedule.data).toBe('"http://other_url:1234"');
      const runC = await awaitRunSchedule(backend, oldSchedule.id);
      expect(spyA).not.toHaveBeenCalled();
      expect(spyB).toBeCalledWith("http://other_url:1234");
    });
    it("should fail to run a job if the version is incremented without a migration", async () => {
      const spyA = jest.fn((data: { url: string }) => {});

      const handler = httpJobDeclaration(spyA);
      backend.registerJob(handler);
      const worker = await backend.registerWorker();

      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: {
          url: "http://localhost:1234",
        },
        options: {
          runAt: new Date(0),
          eventId: "default-1",
        },
      });
      expect(schedule.id).toBe(1);

      const runA = await awaitRunSchedule(backend, schedule.id);
      expect(spyA).toHaveBeenCalledWith({ url: "http://localhost:1234" });
      expect(runA.data).toBe('{"url":"http://localhost:1234"}');

      // bump version
      handler.version = 2;
      backend.getDefinedJobs()[handler.id]!["2"] = handler as any;
      delete backend.getDefinedJobs()[handler.id]!["1"];
      expect(async () => {
        await awaitRunSchedule(backend, schedule.id);
      }).rejects.toThrow();

      let claimed = await backend.claimUnclaimedOverdueJobs();

      expect(claimed).toHaveLength(0);

      // we change the version to 2 and the job should now be claimed
      schedule.functionVersion = 2;
      await schedule.save();
      claimed = await backend.claimUnclaimedOverdueJobs();
      expect(claimed).toHaveLength(1);
    });
  });

  describe("get runs with auth", () => {
    it("should be able to get runs with auth", async () => {
      const handler = httpJobDeclaration();
      backend.registerJob(handler);
      await backend.registerWorker();
      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: {
          url: "http://localhost:1234",
        },
        options: {}
      });
      const registration = await backend.register({
        admin: false,
        name: "test-user",
        password: "hello",
        username: "test-user",
      });
      if (!registration.access) {
        throw new Error("user not created");
      }
      await backend.runScheduleNow(schedule.id);
      await awaitOverdueJobs(backend);
      expect(
        (
          await backend.getRuns({
            authHeader: "Api-Key secret",
          })
        ).count
      ).toBe(1);
      expect(
        (
          await backend.getRuns({
            authHeader: `Jwt ${registration.access.accessToken}`,
          })
        ).count
      ).toBe(0);

      const [scheduleTwo] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "hello",
        description: "some description",
        functionVersion: 1,
        data: {
          url: "http://other_url:1234",
        },
        options: {
          defaultRunAccess: {
        view: {
          users: [registration.user.id],
        },
          },
        },
      });

      await backend.runScheduleNow(scheduleTwo.id);
      await awaitOverdueJobs(backend);

      expect(
        (
          await backend.getRuns({
            authHeader: "Api-Key secret",
          })
        ).count
      ).toBe(2);

      expect(
        (
          await backend.getRuns({
            authHeader: `Jwt ${registration.access.accessToken}`,
          })
        ).count
      ).toBe(1);

      const registrationTwo = await backend.register({
        admin: false,
        name: "test-user-two",
        password: "hello",
        username: "test-user-two",
      });
      if (!registrationTwo.access) {
        throw new Error("user not created");
      }

      expect(
        (
          await backend.getRuns({
            authHeader: `Jwt ${registrationTwo.access.accessToken}`,
          })
        ).count
      ).toBe(0);
    });

    it("should work with pagination", async () => {
      const handler = httpJobDeclaration();
      backend.registerJob(handler);
      await backend.registerWorker();
      const [schedule] = await backend.createJobSchedule({
        functionId: "http_request",
        title: "title",
        description: "description",
        functionVersion: 1,
        data: {
          url: "http://localhost:1234",
        },
        options: {
          runAt: new Date(0),
        },
      });
      const registration = await backend.register({
        admin: false,
        name: "test-user",
        password: "hello",
        username: "test-user",
      });
      if (!registration.access) {
        throw new Error("user not created");
      }
      for (let i = 0; i < 60; i += 1) {
        await backend.runScheduleNow(schedule.id);
        await awaitOverdueJobs(backend);
      }
      const runs = await backend.getRuns({
        authHeader: "Api-Key secret",
      });
      expect(runs.count).toBe(60);
      expect(runs.rows).toHaveLength(25);

      const runsWithOffset = await backend.getRuns({
        authHeader: "Api-Key secret",
        offset: 50,
        limit: 25,
      });
      expect(runsWithOffset.count).toBe(60);
      expect(runsWithOffset.rows).toHaveLength(10);

      const runsWithProblem = await backend.getRuns({
        authHeader: "Api-Key secret",
        offset: 25,
        limit: 25,
      });
      expect(runsWithProblem.count).toBe(60);
      expect(runsWithProblem.rows).toHaveLength(25);
      const runsWithDurationSorting = await backend.getRuns({
        authHeader: "Api-Key secret",
        offset: 25,
        limit: 25,
        order: [["duration", "DESC"]],
      });
      expect(
        new Date(runsWithDurationSorting.rows[0].finishedAt!).getTime() -
          new Date(runsWithDurationSorting.rows[0].startedAt!).getTime()
      ).toBeGreaterThanOrEqual(
        new Date(runsWithDurationSorting.rows[24].finishedAt!).getTime() -
          new Date(runsWithDurationSorting.rows[24].startedAt!).getTime()
      );
    });
  });
});
