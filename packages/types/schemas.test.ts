import { describe, expect, test } from "bun:test";
import {
  GroupKeySchema,
  JobDefinitionSchema,
  ListRunsOptionsSerialize,
  ListRunsOptionsSerializedSchema,
} from "./types";

describe("JobDefinitionSchema", () => {
  test("accepts jobs that do not need input data", () => {
    expect(JobDefinitionSchema.parse({
      id: "simple-job",
      title: "Simple job",
      job: () => undefined,
      version: 1,
    })).toMatchObject({
      id: "simple-job",
      title: "Simple job",
      version: 1,
    });
  });
});

describe("RBAC schemas", () => {
  test("uses stable group keys and rejects database IDs", () => {
    expect(GroupKeySchema.parse("finance-operators")).toBe("finance-operators");
    expect(() => GroupKeySchema.parse("Finance Operators")).toThrow();
    expect(() => JobDefinitionSchema.parse({
      id: "restricted-job",
      title: "Restricted job",
      version: 1,
      job: () => undefined,
      access: { view: { groups: [1] } },
    })).toThrow();
  });

  test("accepts group-key policies including schedule run access", () => {
    expect(JobDefinitionSchema.parse({
      id: "restricted-job",
      title: "Restricted job",
      version: 1,
      job: () => undefined,
      access: { view: { groups: ["finance"] } },
      defaultScheduleAccess: { run: { groups: ["operators"] } },
    }).defaultScheduleAccess).toEqual({ run: { groups: ["operators"] } });
  });
});

describe("ListRunsOptionsSerializedSchema", () => {
  test("parses serialized query values", () => {
    const input = {
      scheduleId: "2",
      order: "startedAt-ASC,id-DESC",
      limit: "25",
      offset: "50",
      authHeader: "Jwt authHeader" as const,
    };
    const parsed = ListRunsOptionsSerializedSchema.parse(input);
    expect(parsed).toEqual({
      scheduleId: 2,
      order: [["startedAt", "ASC"], ["id", "DESC"]],
      limit: 25,
      offset: 50,
      authHeader: "Jwt authHeader",
    });
    expect(ListRunsOptionsSerialize(parsed)).toEqual(input);
  });

  test("accepts typed Richie RPC query values", () => {
    expect(ListRunsOptionsSerializedSchema.parse({
      scheduleId: 2,
      order: [["id", "DESC"]],
      limit: 10,
      offset: 0,
    })).toEqual({
      scheduleId: 2,
      order: [["id", "DESC"]],
      limit: 10,
      offset: 0,
    });
  });
});
