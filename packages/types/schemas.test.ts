import { describe, expect, test } from "bun:test";
import {
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
