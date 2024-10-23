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
      authHeader: "Jwt authHeader",
    },
    {
      limit: 2,
      offset: 2,
      order: [["wef", "ASC"]],
      scheduleId: 2,
      authHeader: "Jwt authHeader",
    }
  );
  createTest(
    {
      scheduleId: "2",
      order: "wef-ASC,abc-DESC",
      limit: "2",
      offset: "2",
      authHeader: "Jwt authHeader",
    },
    {
      limit: 2,
      offset: 2,
      order: [
        ["wef", "ASC"],
        ["abc", "DESC"],
      ],
      scheduleId: 2,
      authHeader: "Jwt authHeader",
    }
  );
  createTest(
    {
      scheduleId: "2",
      order: "",
      limit: "2",
      offset: "2",
      authHeader: "Jwt authHeader",
    },
    {
      limit: 2,
      offset: 2,
      order: [],
      scheduleId: 2,
      authHeader: "Jwt authHeader",
    }
  );
  it("should work", () => {
    expect(
      ListRunsOptionsSerializedSchema.parse({
        scheduleId: "2",
        order: "wef-ASC,abc-DESC,",
        limit: "2",
        offset: "2",
        authHeader: "Jwt authHeader",
      })
    ).toEqual({
      limit: 2,
      offset: 2,
      order: [
        ["wef", "ASC"],
        ["abc", "DESC"],
      ],
      scheduleId: 2,
      authHeader: "Jwt authHeader",
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
        authHeader: "Jwt authHeader",
      })
    ).toEqual({
      scheduleId: "2",
      order: "wef-ASC,abc-DESC",
      limit: "2",
      offset: "2",
      authHeader: "Jwt authHeader",
    });
  });
});
