import type { ConnectionOptions } from "bullmq";
import process from "node:process";

export type BullMQRedisConfig = {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  tls?: boolean;
  db?: number;
};

/**
 * Redis connection options for BullMQ.
 * Sets `maxRetriesPerRequest: null` and `enableReadyCheck: false` as required by BullMQ.
 */
export function getBullMQConnectionOptions(
  config: BullMQRedisConfig = {}
): ConnectionOptions {
  const host = config.host ?? process.env.REDIS_HOST ?? "127.0.0.1";
  const port = config.port ?? Number(process.env.REDIS_PORT ?? 6379);
  const username = config.username ?? process.env.REDIS_USERNAME;
  const password = config.password ?? process.env.REDIS_PASSWORD;
  const tlsEnabled =
    config.tls ??
    (process.env.REDIS_TLS_ENABLE === "1" || process.env.REDIS_TLS_ENABLE === "true");
  const db = config.db ?? Number(process.env.REDIS_DB ?? 0);

  const options: ConnectionOptions = {
    host,
    port,
    db: Number.isFinite(db) ? db : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };

  if (username) {
    options.username = username;
  }

  if (password) {
    options.password = password;
  }

  if (tlsEnabled) {
    options.tls = {};
  }

  return options;
}

/** Shared Redis key prefix for Chiwire BullMQ queues. */
export const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX?.trim() || "chiwire";
