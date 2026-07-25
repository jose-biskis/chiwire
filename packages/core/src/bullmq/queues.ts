/**
 * Canonical BullMQ queue names for Chiwire apps.
 * Bull Board and producers/workers should import from here.
 */
export const QUEUE_NAMES = {
  contimitiPurgeExpired: "q-contimiti-purge-expired"
} as const;

export type ChiwireQueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export function listQueueNames(): ChiwireQueueName[] {
  return Object.values(QUEUE_NAMES);
}

/**
 * Scheduler-driven queues should not use Bull Board "Retry"
 * (deterministic scheduler job ids can collide). Prefer Duplicate.
 */
export const SCHEDULER_DRIVEN_QUEUE_NAMES: ReadonlySet<string> = new Set([
  QUEUE_NAMES.contimitiPurgeExpired
]);
