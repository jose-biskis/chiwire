import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  newGateJobId,
  type GateJob,
  type GateResult
} from "@chiwire/velero-shared";

export type HarborStatus = {
  connected: boolean;
  since: string | null;
  requireGate: boolean;
};

type Pending = {
  job: GateJob;
  resolve: (result: GateResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

const JOB_TIMEOUT_MS = 20_000;

function tokenOk(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function requireGate(): boolean {
  const raw = process.env.VELERO_REQUIRE_GATE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export class Harbor {
  private readonly listeners = new Set<ServerResponse>();
  private readonly pending = new Map<string, Pending>();
  private connectedAt: string | null = null;
  onDisconnect: (() => void) | null = null;

  expectedToken(): string {
    return process.env.VELERO_GATE_TOKEN?.trim() ?? "";
  }

  authorize(request: IncomingMessage, url: URL): boolean {
    const expected = this.expectedToken();
    if (!expected) {
      return false;
    }
    const header = request.headers.authorization ?? "";
    const bearer = header.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : "";
    const query = url.searchParams.get("token") ?? "";
    return tokenOk(bearer || query, expected);
  }

  status(): HarborStatus {
    return {
      connected: this.listeners.size > 0,
      since: this.connectedAt,
      requireGate: requireGate()
    };
  }

  attach(request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });
    response.write(":\n\n");
    this.listeners.add(response);
    this.connectedAt = new Date().toISOString();
    const heartbeat = setInterval(() => {
      response.write(":\n\n");
    }, 15000);
    request.on("close", () => {
      clearInterval(heartbeat);
      this.listeners.delete(response);
      if (this.listeners.size === 0) {
        this.connectedAt = null;
        this.failAll("Harbor disconnected.");
        this.onDisconnect?.();
      }
    });
  }

  submit(job: Omit<GateJob, "id"> & { id?: string }): Promise<GateResult> {
    if (this.listeners.size === 0) {
      return Promise.reject(new Error("Harbor is not connected on the laptop."));
    }
    const id = job.id?.trim() || newGateJobId();
    const full: GateJob = { ...job, id };
    return new Promise<GateResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Harbor timed out waiting for the laptop."));
      }, JOB_TIMEOUT_MS);
      this.pending.set(id, { job: full, resolve, timer });
      const payload = `event: job\ndata: ${JSON.stringify(full)}\n\n`;
      for (const listener of this.listeners) {
        listener.write(payload);
      }
    });
  }

  complete(result: GateResult): boolean {
    const pending = this.pending.get(result.id);
    if (!pending) {
      return false;
    }
    clearTimeout(pending.timer);
    this.pending.delete(result.id);
    pending.resolve(result);
    return true;
  }

  private failAll(message: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve({
        id,
        ok: false,
        status: 503,
        body: JSON.stringify({ code: 503, msg: message })
      });
    }
    this.pending.clear();
  }
}

export function loopbackOnly(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress ?? "";
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}
