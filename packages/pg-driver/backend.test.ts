/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */

import { RunDefinition } from "@enschedule/types";
import stream from "stream";
import { z } from "zod";
import {
  TestBackend,
  createJobDefinition,
  StreamHandle,
  Schedule,
} from "./backend";

const backend = new TestBackend({
  pgUser: process.env.PGUSER!,
  pgHost: process.env.PGHOST!,
  pgPassword: process.env.PGPASSWORD!,
  pgDatabase: process.env.PGDATABASE!,
  pgPort: process.env.PGPORT!,
});
const Console = console.Console;

backend.fork = async function (
  runMessage: RunDefinition,
  streamHandle: StreamHandle
) {
  const definition = backend.getJobDef(runMessage.definitionId);
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
});
afterEach(async () => {
  jest.useRealTimers();
});

const httpJobDeclaration = (
  cb: (data: { url: string }) => void = (data) => {}
) =>
  createJobDefinition({
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
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "desc",
      jobData,
      {
        runAt: new Date(0),
      }
    );
    const jobs = await backend.getDbSchedules();
    expect(jobs.length).toBe(1);
  });
  it("should not update jobs in the future", async () => {
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      jobData,
      {
        runAt: new Date(10),
      }
    );
    jest.useFakeTimers().setSystemTime(0);

    expect((await backend.claimUnclaimedOverdueJobs()).overdueJobs[0]).toBe(0);
  });
  it("should be able to get a job by climing a job that is overdue", async () => {
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      jobData,
      {
        runAt: new Date(10),
      }
    );
    jest.useFakeTimers().setSystemTime(10);
    expect((await backend.claimUnclaimedOverdueJobs()).overdueJobs[0]).toBe(1);
  });
  it("should be able to claim in parallel", async () => {
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration(jobFn));

    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration(spy));

    const createSchedule = async (id: string) => {
      const [schedule] = await backend.createJobSchedule(
        "http_request",
        "title",
        "description",
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
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration(spy));
    const [job] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      jobData,
      { runAt: new Date(0) }
    );
    expect((await backend.getDbSchedules()).length).toBe(1);
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      jobData,
      { runAt: new Date(0) }
    );
    expect((await backend.getDbSchedules()).length).toBe(1);
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    backend.clearRegisteredJobs();
    backend.registerJob(job);
    const schedule = await backend.scheduleJob(
      job,
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
    jest.useFakeTimers().setSystemTime(0);
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      jobData,
      {
        runAt: new Date(0),
      }
    );
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      jobData,
      {
        runAt: new Date(1000),
      }
    );
    expect((await backend.getDbSchedules()).length).toBe(2);
  });
  it("should not create duplicated events if an eventId is provided", async () => {
    jest.useFakeTimers().setSystemTime(0);
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    backend.clearRegisteredJobs();
    backend.registerJob(httpJobDeclaration());
    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    config: { maxRetries?: number; notify?: boolean } = {}
  ): Promise<
    [Schedule, Schedule, jest.Mock<void, [data: { url: string }], any>]
  > => {
    backend.clearRegisteredJobs();
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

    const [notifySchedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
      {
        url: "http://localhost:4444",
      }
    );

    const [schedule] = await backend.createJobSchedule(
      "http_request",
      "title",
      "description",
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
    }
    await schedule.reload();
    expect(schedule.retries).toBe(config.maxRetries ? config.maxRetries : 10);
    return [schedule, notifySchedule, spy];
  };
  it("should work when retryFailedJobs is true", async () => {
    const [, , spy] = await retryTest();
    expect(spy).toHaveBeenCalledTimes(11);
  });
  it("should work with a maxRetries ", async () => {
    const [schedule, , spy] = await retryTest({ maxRetries: 5 });
    expect(spy).toHaveBeenCalledTimes(6);
    let runs = await backend.getDbRuns();
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
    expect(spy).toHaveBeenCalledTimes(7);
    let runs = await backend.getDbRuns();
    expect(runs).toHaveLength(7);
    expect(runs[5].exitSignal).toBe("1");
    await notifyJob.reload();
    expect(notifyJob.numRuns).toBe(1);
    await schedule.reload();
    expect(schedule.numRuns).toBe(6);
  });
});
