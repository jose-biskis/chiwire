import { Worker, type Processor, type WorkerOptions } from "bullmq";
import process from "node:process";
import { BULLMQ_PREFIX, getBullMQConnectionOptions } from "./connection.js";

export type CreateWorkerOptions = Omit<WorkerOptions, "connection" | "concurrency"> & {
  connection?: WorkerOptions["connection"];
  concurrency?: number;
};

function readConcurrency(override?: number): number {
  if (override !== undefined) {
    return override;
  }

  const fromEnv = Number(process.env.BULLMQ_WORKER_CONCURRENCY ?? 2);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 2;
}

export function createWorker<DataType, ResultType = unknown>(
  name: string,
  processor: Processor<DataType, ResultType>,
  options: CreateWorkerOptions = {}
): Worker<DataType, ResultType> {
  const { connection, concurrency, prefix, ...rest } = options;

  return new Worker<DataType, ResultType>(name, processor, {
    ...rest,
    connection: connection ?? getBullMQConnectionOptions(),
    prefix: prefix ?? BULLMQ_PREFIX,
    concurrency: readConcurrency(concurrency)
  });
}
