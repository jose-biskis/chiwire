import { createHmac, randomUUID } from "node:crypto";
import { fetch } from "undici";

export type GateHttpMethod = "GET" | "POST" | "DELETE";

export type GateJob = {
  id: string;
  signed: boolean;
  method: GateHttpMethod;
  path: string;
  params: Record<string, string>;
  baseUrl: string;
};

export type GateResult = {
  id: string;
  ok: boolean;
  status: number;
  body: string;
};

export type GateCredentials = {
  apiKey: string;
  apiSecret: string;
};

let timeOffsetMs = 0;
let timeSynced = false;

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function newGateJobId(): string {
  return randomUUID();
}

export function signQuery(secret: string, query: string): string {
  return createHmac("sha256", secret).update(query).digest("hex");
}

async function syncTime(baseUrl: string): Promise<void> {
  if (timeSynced) {
    return;
  }
  const started = Date.now();
  const response = await fetch(new URL("/fapi/v1/time", baseUrl));
  const finished = Date.now();
  const payload = asRecord(await response.json());
  const serverTime = asNumber(payload.serverTime, Date.now());
  timeOffsetMs = serverTime - Math.floor((started + finished) / 2);
  timeSynced = true;
}

function timestamp(): number {
  return Date.now() + timeOffsetMs;
}

export async function executeGateJob(
  job: GateJob,
  credentials: GateCredentials
): Promise<GateResult> {
  await syncTime(job.baseUrl);
  const url = new URL(job.path, job.baseUrl);
  const headers: Record<string, string> = { accept: "application/json" };
  const init: {
    method: GateHttpMethod;
    headers: Record<string, string>;
    body?: string;
  } = {
    method: job.method,
    headers
  };

  if (job.signed) {
    if (!credentials.apiKey.trim() || !credentials.apiSecret.trim()) {
      return {
        id: job.id,
        ok: false,
        status: 401,
        body: JSON.stringify({
          code: -2015,
          msg: "Harbor has no API key/secret yet."
        })
      };
    }
    headers["X-MBX-APIKEY"] = credentials.apiKey;
    const search = new URLSearchParams(job.params);
    search.set("timestamp", String(timestamp()));
    search.set("recvWindow", "10000");
    const query = search.toString();
    const signed = `${query}&signature=${signQuery(credentials.apiSecret, query)}`;
    if (job.method === "POST") {
      headers["content-type"] = "application/x-www-form-urlencoded";
      init.body = signed;
    } else {
      url.search = signed;
    }
  } else {
    for (const [key, value] of Object.entries(job.params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, init);
  const body = await response.text();
  return {
    id: job.id,
    ok: response.ok,
    status: response.status,
    body
  };
}

export function resetGateTimeSync(): void {
  timeSynced = false;
  timeOffsetMs = 0;
}
