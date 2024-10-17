/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */

import { z } from "zod";
import {
  ListRunsOptionsSerialize,
  ListRunsOptionsSerializedSchema,
} from "./types";

describe("ListRunsOptionsSerializedSchema", () => {
  const createTest = (
    input: z.input<typeof ListRunsOptionsSerializedSchema>,
    output: z.output<typeof ListRunsOptionsSerializedSchema>
  ) => {
    it("should work", () => {
      expect(ListRunsOptionsSerializedSchema.parse(input)).toEqual(output);
      expect(ListRunsOptionsSerialize(output)).toEqual(input);
    });
  };
  createTest(
    {
      scheduleId: "2",
      order: "wef-ASC",
      limit: "2",
      offset: "2",
      authHeader: "authHeader",
    },
    {
      limit: 2,
      offset: 2,
      order: [["wef", "ASC"]],
      scheduleId: 2,
      authHeader: "authHeader",
    }
  );
  createTest(
    {
      scheduleId: "2",
      order: "wef-ASC,abc-DESC",
      limit: "2",
      offset: "2",
      authHeader: "authHeader",
    },
    {
      limit: 2,
      offset: 2,
      order: [
        ["wef", "ASC"],
        ["abc", "DESC"],
      ],
      scheduleId: 2,
      authHeader: "authHeader",
    }
  );
  createTest(
    {
      scheduleId: "2",
      order: "",
      limit: "2",
      offset: "2",
      authHeader: "authHeader",
    },
    {
      limit: 2,
      offset: 2,
      order: [],
      scheduleId: 2,
      authHeader: "authHeader",
    }
  );
  it("should work", () => {
    expect(
      ListRunsOptionsSerializedSchema.parse({
        scheduleId: "2",
        order: "wef-ASC,abc-DESC,",
        limit: "2",
        offset: "2",
        authHeader: "authHeader",
      })
    ).toEqual({
      limit: 2,
      offset: 2,
      order: [
        ["wef", "ASC"],
        ["abc", "DESC"],
      ],
      scheduleId: 2,
      authHeader: "authHeader",
    });
    expect(
      ListRunsOptionsSerialize({
        limit: 2,
        offset: 2,
        order: [
          ["wef", "ASC"],
          ["abc", "DESC"],
        ],
        scheduleId: 2,
        authHeader: "authHeader",
      })
    ).toEqual({
      scheduleId: "2",
      order: "wef-ASC,abc-DESC",
      limit: "2",
      offset: "2",
      authHeader: "authHeader",
    });
  });
});
