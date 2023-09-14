/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */

import { z } from "zod";
import { TestBackend, createJobDefinition } from "./backend";

const backend = new TestBackend({
  pgUser: process.env.PGUSER!,
  pgHost: process.env.PGHOST!,
  pgPassword: process.env.PGPASSWORD!,
  pgDatabase: process.env.PGDATABASE!,
  pgPort: process.env.PGPORT!,
});

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
  cb: (data: { url: string }, console: Console) => void = (data) => {}
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
    const spy = jest.fn((data: { url: string }, console: Console) => {
      console.log("comment");
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
    expect(spy).toHaveBeenLastCalledWith(jobData, expect.any(console.Console));

    await backend.runOverdueJobs();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(jobData, expect.any(console.Console));
    await job.reload();
    const runs = await job.getRuns({
      limit: 1,
    });
    expect(runs).toHaveLength(1);
    const run = runs[0];
    expect(run.stdout).toBe("comment\n");
  });
  it("should log errors", async () => {
    const spy = jest.fn((data: { url: string }, console: Console) => {
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
    expect(spy).toHaveBeenLastCalledWith(jobData, expect.any(console.Console));

    await backend.runOverdueJobs();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(jobData, expect.any(console.Console));
    await job.reload();
    const runs = await job.getRuns({
      limit: 1,
    });
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
    ).toMatchInlineSnapshot(`
      "Error: Error
          at Object.<anonymous> (backend.test.ts)
      "
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
    const spy = jest.fn((data: { url: string }, console: Console) => {
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
    // console.log("@schedules[0]", await schedules[0].getLastRun());
    const lastRun = schedules[0].lastRun;
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
