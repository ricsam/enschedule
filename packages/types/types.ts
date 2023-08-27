import type { z, ZodType } from "zod";

export interface JobDefinition<T extends ZodType = ZodType> {
  dataSchema: T;
  id: string;
  title: string;
  description: string;
  job: (data: z.infer<T>, console: Console) => Promise<void> | void;
  example: z.infer<T>;
}

export interface PublicJobDefinition {
  id: string;
  description: string;
  title: string;
  dataSchema: ZodType;
  example: unknown;
}
export interface PublicJobSchedule {
  id: number;
  description: string;
  title: string;
  runAt: Date | undefined;
  cronExpression: string | undefined;
  lastRun: SerializedRun | undefined;
  createdAt: Date;
  /** job definition target */
  target: string;
  jobDefinition: PublicJobDefinition;
  numRuns: number;
  data: string;
}
export interface SerializedRun {
  id: number;
  stdout: string;
  stderr: string;
  createdAt: Date;
  finishedAt: Date;
  startedAt: Date;
  scheduledToRunAt: Date;
  data: string;
}
export type PublicJobRun = SerializedRun & {
  jobSchedule: PublicJobSchedule;
};

export interface ScheduleJobOptions {
  cronExpression?: string;
  runAt?: Date;
  eventId?: string;
  title: string;
  description: string;
}

export interface Task {
  runAt: number;
}

export abstract class Backend {
  tasks: Task[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  addTask(task: Task) {}
  getTasksToRun() {
    return this.tasks.map((task) => {
      return task.runAt > Date.now();
    });
  }
}
