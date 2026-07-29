import { describe, expect, mock, test } from "bun:test";

const scheduleJobMock = mock(async () => ({ status: "created" as const }));
mock.module("../get-worker", () => ({
  ConfigError: class ConfigError extends Error {},
  getWorker: () => ({ scheduleJob: scheduleJobMock }),
  getAuthHeader: () => "Api-Key secret",
}));

const { apply } = await import("./apply");

describe("apply", () => {
  test("applies a schedule through the Richie RPC worker client", async () => {
    await apply({
      apiVersion: "v1",
      kind: "schedule",
      metadata: { name: "test-schedule" },
      spec: {
        options: {
          title: "Test Schedule",
          description: "This is a test schedule",
          cronExpression: "0 0 * * *",
          runAt: undefined,
          defaultRunAccess: undefined,
          access: undefined,
        },
        functionId: "log-job",
        functionVersion: 1,
        data: { message: "foo bar" },
      },
    });

    expect(scheduleJobMock).toHaveBeenCalledTimes(1);
    expect(scheduleJobMock.mock.calls[0]?.[1]).toBe("log-job");
    expect(scheduleJobMock.mock.calls[0]?.[4]).toMatchObject({
      eventId: "test-schedule",
      title: "Test Schedule",
    });
  });
});
