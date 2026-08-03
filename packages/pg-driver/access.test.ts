import { describe, expect, test } from "bun:test";
import {
  can,
  functionCapabilities,
  inheritFunctionAccess,
  inheritScheduleAccess,
  runCapabilities,
} from "./access";

const member = { admin: false, system: false, userId: 1, groups: ["finance"] };
const outsider = { admin: false, system: false, userId: 2, groups: ["other"] };
const admin = { admin: true, system: false, userId: 3, groups: [] };

describe("RBAC policy evaluator", () => {
  test("denies omitted and explicit-empty grants by default", () => {
    expect(can(member)).toBe(false);
    expect(can(member, { groups: [] })).toBe(false);
  });

  test("allows matching group keys and superusers", () => {
    expect(can(member, { groups: ["finance"] })).toBe(true);
    expect(can(outsider, { groups: ["finance"] })).toBe(false);
    expect(can(admin)).toBe(true);
  });

  test("inherits omitted actions and replaces declared actions", () => {
    expect(inheritFunctionAccess(
      { view: { groups: [] } },
      { view: { groups: ["all"] }, createSchedule: { groups: ["operators"] } },
    )).toEqual({
      view: { groups: [] },
      createSchedule: { groups: ["operators"] },
    });
    expect(inheritScheduleAccess(
      { edit: { groups: ["editors"] } },
      { view: { groups: ["viewers"] }, edit: { groups: ["all"] }, run: { groups: ["operators"] } },
    )).toEqual({
      view: { groups: ["viewers"] },
      edit: { groups: ["editors"] },
      run: { groups: ["operators"] },
      delete: undefined,
    });
  });

  test("computes action-level capabilities", () => {
    expect(functionCapabilities(member, {
      view: { groups: ["finance"] },
      createSchedule: { groups: ["operators"] },
    })).toEqual({ view: true, createSchedule: false });
    expect(functionCapabilities(member, {
      view: { groups: ["other"] },
      createSchedule: { groups: ["finance"] },
    })).toEqual({ view: false, createSchedule: false });
    expect(runCapabilities(member, {
      view: { groups: ["finance"] },
      viewLogs: { groups: ["finance"] },
      delete: { groups: [] },
    })).toEqual({ view: true, viewLogs: true, delete: false });
  });
});
