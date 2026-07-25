import { Queue, type DefaultJobOptions, type QueueOptions } from "bullmq";
import { BULLMQ_PREFIX, getBullMQConnectionOptions } from "./connection.js";
import { DEFAULT_RETRYABLE_JOB_OPTIONS } from "./options.js";

export type CreateQueueOptions = Omit<QueueOptions, "connection"> & {
  connection?: QueueOptions["connection"];
  defaultJobOptions?: DefaultJobOptions;
};

export function createQueue<DataType>(
  name: string,
  options: CreateQueueOptions = {}
): Queue<DataType> {
  const { connection, defaultJobOptions, prefix, ...rest } = options;

  return new Queue<DataType>(name, {
    ...rest,
    connection: connection ?? getBullMQConnectionOptions(),
    prefix: prefix ?? BULLMQ_PREFIX,
    defaultJobOptions: defaultJobOptions ?? { ...DEFAULT_RETRYABLE_JOB_OPTIONS }
  });
}
