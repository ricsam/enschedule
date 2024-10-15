const scheduleJobMock = jest.fn(() => {
  return { status: "created" };
});
jest.mock("../get-worker", () => ({
  getWorker: () => ({ scheduleJob: scheduleJobMock }),
}));

import { z } from "zod";
import { ScheduleYamlSchema, apply } from "./apply";

describe("apply", () => {
  it("should apply a schedule from a file", async () => {
    const schedule: z.infer<typeof ScheduleYamlSchema> = {
      apiVersion: "v1",
      kind: "schedule",
      metadata: {
        name: "test-schedule",
      },
      spec: {
        options: {
          title: "Test Schedule",
          description: "This is a test schedule",
          cronExpression: "0 0 * * *", // Run every day at midnight
        },
        handlerId: "log-job",
        handlerVersion: 1,
        data: { message: "foo bar" },
      },
    };

    await apply(schedule);
    expect(scheduleJobMock).toBeCalledTimes(1);
    expect(scheduleJobMock.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "log-job",
          1,
          {
            "message": "foo bar",
          },
          {
            "cronExpression": "0 0 * * *",
            "description": "This is a test schedule",
            "eventId": "test-schedule",
            "title": "Test Schedule",
          },
        ],
      ]
    `);
  });
});
