import type {
  FunctionAccess,
  FunctionCapabilities,
  RunAccess,
  RunCapabilities,
  ScheduleAccess,
  ScheduleCapabilities,
  WorkerAccess,
  WorkerCapabilities,
} from "@enschedule/types";

export interface RbacActor {
  admin: boolean;
  system: boolean;
  groups: string[];
  userId?: number;
}

export class AuthorizationError extends Error {
  readonly status: 401 | 403 | 404 | 409;
  readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";

  constructor(status: 401 | 403 | 404 | 409, code: AuthorizationError["code"], message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
    this.code = code;
  }
}

export const unauthorized = () => new AuthorizationError(401, "UNAUTHORIZED", "Authentication required");
export const forbidden = (message = "You do not have permission to perform this action") =>
  new AuthorizationError(403, "FORBIDDEN", message);
export const notFound = (resource: string) => new AuthorizationError(404, "NOT_FOUND", `${resource} not found`);
export const conflict = (message: string) => new AuthorizationError(409, "CONFLICT", message);

export function isSuperuser(actor: RbacActor) {
  return actor.admin || actor.system;
}

export function can(actor: RbacActor, grant?: { groups: string[] }) {
  if (isSuperuser(actor)) return true;
  if (!grant) return false;
  return grant.groups.some((group) => actor.groups.includes(group));
}

function effectiveGrant(
  child: { groups: string[] } | undefined,
  parent: { groups: string[] } | undefined,
) {
  return child === undefined ? parent : child;
}

export function inheritFunctionAccess(
  child?: FunctionAccess,
  parent?: FunctionAccess,
): FunctionAccess | undefined {
  if (!child && !parent) return undefined;
  return {
    view: effectiveGrant(child?.view, parent?.view),
    createSchedule: effectiveGrant(child?.createSchedule, parent?.createSchedule),
  };
}

export function inheritScheduleAccess(
  child?: ScheduleAccess,
  parent?: ScheduleAccess,
): ScheduleAccess | undefined {
  if (!child && !parent) return undefined;
  return {
    view: effectiveGrant(child?.view, parent?.view),
    edit: effectiveGrant(child?.edit, parent?.edit),
    run: effectiveGrant(child?.run, parent?.run),
    delete: effectiveGrant(child?.delete, parent?.delete),
  };
}

export function inheritRunAccess(child?: RunAccess, parent?: RunAccess): RunAccess | undefined {
  if (!child && !parent) return undefined;
  return {
    view: effectiveGrant(child?.view, parent?.view),
    viewLogs: effectiveGrant(child?.viewLogs, parent?.viewLogs),
    delete: effectiveGrant(child?.delete, parent?.delete),
  };
}

export function workerCapabilities(actor: RbacActor, access?: WorkerAccess): WorkerCapabilities {
  const view = can(actor, access?.view);
  return { view, delete: view && can(actor, access?.delete) };
}

export function functionCapabilities(actor: RbacActor, access?: FunctionAccess): FunctionCapabilities {
  const view = can(actor, access?.view);
  return { view, createSchedule: view && can(actor, access?.createSchedule) };
}

export function scheduleCapabilities(actor: RbacActor, access?: ScheduleAccess): ScheduleCapabilities {
  const view = can(actor, access?.view);
  return {
    view,
    edit: view && can(actor, access?.edit),
    run: view && can(actor, access?.run),
    delete: view && can(actor, access?.delete),
  };
}

export function runCapabilities(actor: RbacActor, access?: RunAccess): RunCapabilities {
  const view = can(actor, access?.view);
  return {
    view,
    viewLogs: view && can(actor, access?.viewLogs),
    delete: view && can(actor, access?.delete),
  };
}

export function requireCapability(value: boolean, message?: string): asserts value {
  if (!value) throw forbidden(message);
}

export function policyGroupKeys(policy: unknown): string[] {
  if (!policy || typeof policy !== "object") return [];
  const keys: string[] = [];
  for (const grant of Object.values(policy)) {
    if (!grant || typeof grant !== "object" || !("groups" in grant) || !Array.isArray(grant.groups)) continue;
    for (const group of grant.groups) if (typeof group === "string") keys.push(group);
  }
  return [...new Set(keys)];
}
