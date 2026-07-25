import {
  QUEUE_NAMES,
  createQueue,
  createWorker,
  upsertJobSchedulerSafe
} from "@chiwire/core/bullmq";
import type { Queue, Worker } from "bullmq";
import type { ShareStore } from "./store.js";

export const CONTIMITI_PURGE_EXPIRED_JOB_NAME = "purge-expired";
export const CONTIMITI_PURGE_EVERY_MS = 5 * 60 * 1000;

export type ContimitiPurgeExpiredJobData = {
  triggeredBy: "scheduler" | "manual";
};

let queue: Queue<ContimitiPurgeExpiredJobData> | undefined;
let worker: Worker<ContimitiPurgeExpiredJobData> | undefined;

export function getContimitiPurgeExpiredQueue(): Queue<ContimitiPurgeExpiredJobData> {
  if (!queue) {
    queue = createQueue<ContimitiPurgeExpiredJobData>(QUEUE_NAMES.contimitiPurgeExpired);
    queue.on("error", (error) => {
      console.error("contimiti.purge_queue_error", error);
    });
  }

  return queue;
}

export async function startContimitiPurgeWorker(store: ShareStore): Promise<void> {
  if (worker) {
    return;
  }

  const purgeQueue = getContimitiPurgeExpiredQueue();

  worker = createWorker<ContimitiPurgeExpiredJobData>(
    QUEUE_NAMES.contimitiPurgeExpired,
    async () => {
      const result = await store.purgeExpired();
      if (result.texts > 0 || result.files > 0) {
        console.log(
          `purged expired shares: texts=${result.texts} files=${result.files}`
        );
      }
      return result;
    },
    { concurrency: 1 }
  );

  worker.on("failed", (job, error) => {
    console.error("contimiti.purge_job_failed", {
      jobId: job?.id,
      error
    });
  });

  await upsertJobSchedulerSafe(purgeQueue, "contimiti-purge-expired", {
    every: CONTIMITI_PURGE_EVERY_MS
  }, {
    name: CONTIMITI_PURGE_EXPIRED_JOB_NAME,
    data: { triggeredBy: "scheduler" }
  });

  console.log(
    `contimiti purge scheduler registered (every ${CONTIMITI_PURGE_EVERY_MS / 1000}s)`
  );
}

export async function stopContimitiPurgeJobs(): Promise<void> {
  const closing: Promise<void>[] = [];

  if (worker) {
    closing.push(worker.close());
    worker = undefined;
  }

  if (queue) {
    closing.push(queue.close());
    queue = undefined;
  }

  await Promise.all(closing);
}
