import type { JobsOptions, Queue } from "bullmq";

export type RepeatEvery = {
  every: number;
};

export type RepeatCron = {
  pattern: string;
  tz?: string;
};

export type JobSchedulerRepeat = RepeatEvery | RepeatCron;

/**
 * Upsert a BullMQ job scheduler. On collision with an existing scheduler id,
 * remove and retry once (same self-heal pattern as the Atlas API).
 */
export async function upsertJobSchedulerSafe(
  queue: Queue,
  schedulerId: string,
  repeat: JobSchedulerRepeat,
  jobTemplate: {
    name: string;
    data?: unknown;
    opts?: Omit<JobsOptions, "repeat" | "jobId">;
  }
): Promise<void> {
  try {
    await queue.upsertJobScheduler(schedulerId, repeat, jobTemplate);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists|duplicat|conflict/i.test(message)) {
      throw error;
    }

    await queue.removeJobScheduler(schedulerId);
    await queue.upsertJobScheduler(schedulerId, repeat, jobTemplate);
  }
}
