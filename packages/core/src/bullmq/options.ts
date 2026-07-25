const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
const ONE_WEEK_IN_SECONDS = ONE_DAY_IN_SECONDS * 7;

/** Sensible defaults for retryable background jobs. */
export const DEFAULT_RETRYABLE_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 1000
  },
  removeOnComplete: {
    age: ONE_DAY_IN_SECONDS,
    count: 1000
  },
  removeOnFail: {
    age: ONE_WEEK_IN_SECONDS
  }
} as const;
