import process from "node:process";

import { Redis } from "ioredis";

let client: Redis | null = null;

export function redisConfigured(): boolean {
  if (process.env.MCPS_REDIS_CACHE === "0" || process.env.MCPS_REDIS_CACHE === "false") {
    return false;
  }

  return Boolean(process.env.REDIS_HOST?.trim() || process.env.REDIS_URL?.trim());
}

function readRedisOptions(): {
  host: string;
  port: number;
  db: number;
  username?: string;
  password?: string;
  tls?: object;
} {
  const host = process.env.REDIS_HOST?.trim() || "127.0.0.1";
  const port = Number(process.env.REDIS_PORT ?? 6379);
  const username = process.env.REDIS_USERNAME?.trim();
  const password = process.env.REDIS_PASSWORD?.trim();
  const tlsEnabled =
    process.env.REDIS_TLS_ENABLE === "1" || process.env.REDIS_TLS_ENABLE === "true";
  const db = Number(process.env.REDIS_DB ?? 0);

  return {
    host,
    port: Number.isFinite(port) ? port : 6379,
    db: Number.isFinite(db) ? db : 0,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(tlsEnabled ? { tls: {} } : {}),
  };
}

export function getRedis(): Redis {
  if (client) {
    return client;
  }

  client = new Redis({
    ...readRedisOptions(),
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  return client;
}

export async function connectRedis(): Promise<Redis | null> {
  if (!redisConfigured()) {
    return null;
  }

  const redis = getRedis();
  if (redis.status === "wait") {
    await redis.connect();
  }

  return redis;
}

export async function closeRedis(): Promise<void> {
  if (!client) {
    return;
  }

  const current = client;
  client = null;
  await current.quit();
}
