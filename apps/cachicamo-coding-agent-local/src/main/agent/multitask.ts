import { randomUUID } from "node:crypto";
import type {
  AgentStreamEvent,
  SubagentRunMode,
  SubagentType,
  SubagentWorkerSnapshot,
  WorkerStatus
} from "../../shared/types.js";
import { asSubagentRunMode } from "../../shared/types.js";

export const MAX_CONCURRENT_WORKERS = 8;

export type WorkerRunFn = (ctx: {
  id: string;
  type: SubagentType;
  task: string;
  signal: AbortSignal;
  onEvent: (event: AgentStreamEvent) => void;
}) => Promise<string>;

export type SpawnResult = {
  id: string;
  status: WorkerStatus;
  message: string;
  summary?: string;
};

type InternalWorker = {
  snapshot: SubagentWorkerSnapshot;
  abort: AbortController;
  run: WorkerRunFn;
  started: boolean;
  done: Promise<SubagentWorkerSnapshot>;
  resolveDone: (snapshot: SubagentWorkerSnapshot) => void;
};

function cloneSnapshot(snapshot: SubagentWorkerSnapshot): SubagentWorkerSnapshot {
  return { ...snapshot };
}

export class WorkerCoordinator {
  private readonly workers = new Map<string, InternalWorker>();
  private readonly queue: string[] = [];
  private readonly emit: (event: AgentStreamEvent) => void;
  private runMode: SubagentRunMode;

  constructor(params: { emit: (event: AgentStreamEvent) => void; runMode?: SubagentRunMode }) {
    this.emit = params.emit;
    this.runMode = params.runMode ?? "parallel";
  }

  setRunMode(mode: SubagentRunMode): void {
    const next = asSubagentRunMode(mode);
    if (this.runMode === next) return;
    this.runMode = next;
    this.pumpQueue();
  }

  getRunMode(): SubagentRunMode {
    return this.runMode;
  }

  list(): SubagentWorkerSnapshot[] {
    return [...this.workers.values()]
      .map((worker) => cloneSnapshot(worker.snapshot))
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  get(id: string): SubagentWorkerSnapshot | undefined {
    const worker = this.workers.get(id);
    return worker ? cloneSnapshot(worker.snapshot) : undefined;
  }

  runningCount(): number {
    let count = 0;
    for (const worker of this.workers.values()) {
      if (worker.snapshot.status === "running") count += 1;
    }
    return count;
  }

  queuedCount(): number {
    let count = 0;
    for (const worker of this.workers.values()) {
      if (worker.snapshot.status === "queued") count += 1;
    }
    return count;
  }

  occupiedCount(): number {
    return this.runningCount() + this.queuedCount();
  }

  unconsumedFinished(): SubagentWorkerSnapshot[] {
    return this.list().filter(
      (worker) =>
        !worker.consumed &&
        (worker.status === "done" || worker.status === "error" || worker.status === "cancelled")
    );
  }

  markConsumed(ids: string[]): void {
    let changed = false;
    for (const id of ids) {
      const worker = this.workers.get(id);
      if (worker && !worker.snapshot.consumed) {
        worker.snapshot.consumed = true;
        changed = true;
      }
    }
    if (changed) this.emitChanged();
  }

  async spawn(params: {
    type: SubagentType;
    task: string;
    wait?: boolean;
    run: WorkerRunFn;
    mode?: SubagentRunMode;
  }): Promise<SpawnResult> {
    if (this.occupiedCount() >= MAX_CONCURRENT_WORKERS) {
      throw new Error(
        `Too many workers (${MAX_CONCURRENT_WORKERS} running or queued). Await or cancel some first.`
      );
    }

    const mode = params.mode ?? this.runMode;
    const canStartNow =
      mode === "series" ? this.runningCount() === 0 : this.runningCount() < MAX_CONCURRENT_WORKERS;

    const id = randomUUID();
    const abort = new AbortController();
    let resolveDone!: (snapshot: SubagentWorkerSnapshot) => void;
    const done = new Promise<SubagentWorkerSnapshot>((resolve) => {
      resolveDone = resolve;
    });

    const snapshot: SubagentWorkerSnapshot = {
      id,
      name: `${params.type}-agent`,
      agentType: params.type,
      task: params.task,
      status: canStartNow ? "running" : "queued",
      startedAt: Date.now(),
      consumed: false
    };

    const worker: InternalWorker = {
      snapshot,
      abort,
      run: params.run,
      started: false,
      done,
      resolveDone
    };
    this.workers.set(id, worker);

    if (canStartNow) {
      this.beginWorker(worker);
    } else {
      this.queue.push(id);
      this.emitChanged();
    }

    if (params.wait) {
      const finished = await done;
      return {
        id,
        status: finished.status,
        message: finished.summary ?? finished.error ?? "(no summary)",
        ...(finished.summary ? { summary: finished.summary } : {})
      };
    }

    if (snapshot.status === "queued") {
      return {
        id,
        status: "queued",
        message: [
          `Queued worker ${id} (${snapshot.name}) in series.`,
          `Task: ${params.task}`,
          "It will start after the current worker finishes. Call await_subagents when you need the result."
        ].join("\n")
      };
    }

    return {
      id,
      status: "running",
      message: [
        `Started background worker ${id} (${snapshot.name}).`,
        `Task: ${params.task}`,
        "Call await_subagents with this id (or omit ids to wait for all running or queued workers) when you need the result.",
        "The user can keep chatting while this worker runs."
      ].join("\n")
    };
  }

  async awaitWorkers(ids?: string[]): Promise<string> {
    const targets: InternalWorker[] = [];
    if (ids?.length) {
      for (const id of ids) {
        const worker = this.workers.get(id);
        if (!worker) {
          throw new Error(`Unknown worker: ${id}`);
        }
        targets.push(worker);
      }
    } else {
      for (const worker of this.workers.values()) {
        if (worker.snapshot.status === "running" || worker.snapshot.status === "queued") {
          targets.push(worker);
        }
      }
    }

    if (targets.length === 0) {
      return "No matching workers to await.";
    }

    const finished = await Promise.all(targets.map((worker) => worker.done));
    return finished
      .map((snapshot) => {
        const body = snapshot.summary ?? snapshot.error ?? "(no summary)";
        return `### ${snapshot.name} ${snapshot.id}\nstatus: ${snapshot.status}\ntask: ${snapshot.task}\n${body}`;
      })
      .join("\n\n");
  }

  cancel(id: string): boolean {
    const worker = this.workers.get(id);
    if (!worker) return false;
    if (worker.snapshot.status === "queued") {
      const index = this.queue.indexOf(id);
      if (index >= 0) this.queue.splice(index, 1);
      worker.abort.abort();
      this.finalizeCancelled(worker);
      return true;
    }
    if (worker.snapshot.status !== "running") {
      return false;
    }
    worker.abort.abort();
    return true;
  }

  cancelAll(): void {
    for (const worker of [...this.workers.values()]) {
      if (worker.snapshot.status === "queued" || worker.snapshot.status === "running") {
        this.cancel(worker.snapshot.id);
      }
    }
  }

  async resume(params: {
    id: string;
    task: string;
    run: WorkerRunFn;
  }): Promise<SpawnResult> {
    const previous = this.workers.get(params.id);
    if (!previous) {
      throw new Error(`Unknown worker: ${params.id}`);
    }
    if (previous.snapshot.status === "running" || previous.snapshot.status === "queued") {
      throw new Error("Worker is still active. Await or cancel it before resuming.");
    }

    const prior = previous.snapshot.summary?.trim();
    const task = prior
      ? `Previous ${previous.snapshot.name} result:\n${prior}\n\nFollow-up:\n${params.task}`
      : params.task;

    return this.spawn({
      type: previous.snapshot.agentType,
      task,
      wait: false,
      run: params.run
    });
  }

  private beginWorker(worker: InternalWorker): void {
    if (worker.started) return;
    worker.started = true;
    worker.snapshot.status = "running";

    this.emit({
      type: "subagent_start",
      id: worker.snapshot.id,
      name: worker.snapshot.name,
      agentType: worker.snapshot.agentType,
      task: worker.snapshot.task
    });
    this.emitChanged();

    void this.runWorker(worker.snapshot, worker.abort, worker.run).then((finished) => {
      worker.resolveDone(finished);
      this.pumpQueue();
    });
  }

  private pumpQueue(): void {
    while (this.queue.length > 0) {
      if (this.runMode === "series" && this.runningCount() > 0) break;
      if (this.runningCount() >= MAX_CONCURRENT_WORKERS) break;
      const id = this.queue.shift();
      if (!id) break;
      const worker = this.workers.get(id);
      if (!worker || worker.snapshot.status !== "queued") continue;
      if (worker.abort.signal.aborted) {
        this.finalizeCancelled(worker);
        continue;
      }
      this.beginWorker(worker);
    }
  }

  private finalizeCancelled(worker: InternalWorker): void {
    worker.snapshot.status = "cancelled";
    worker.snapshot.summary = "Cancelled.";
    worker.snapshot.endedAt = Date.now();
    this.emit({
      type: "subagent_end",
      id: worker.snapshot.id,
      summary: worker.snapshot.summary,
      status: "cancelled"
    });
    this.emitChanged();
    worker.resolveDone(cloneSnapshot(worker.snapshot));
  }

  private async runWorker(
    snapshot: SubagentWorkerSnapshot,
    abort: AbortController,
    run: WorkerRunFn
  ): Promise<SubagentWorkerSnapshot> {
    try {
      const summary = await run({
        id: snapshot.id,
        type: snapshot.agentType,
        task: snapshot.task,
        signal: abort.signal,
        onEvent: (event) => {
          if (event.type === "text") {
            snapshot.progressText = `${snapshot.progressText ?? ""}${event.text}`;
            if (snapshot.progressText.length > 800) {
              snapshot.progressText = snapshot.progressText.slice(-800);
            }
          }
          this.emit(event);
        }
      });
      snapshot.status = abort.signal.aborted ? "cancelled" : "done";
      snapshot.summary = abort.signal.aborted ? "Cancelled." : summary.trim() || "(no summary)";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      snapshot.status = abort.signal.aborted || /cancelled/i.test(message) ? "cancelled" : "error";
      snapshot.error = message;
      snapshot.summary = message;
    } finally {
      snapshot.endedAt = Date.now();
      if (snapshot.status === "running") {
        snapshot.status = abort.signal.aborted ? "cancelled" : "done";
      }
    }

    this.emit({
      type: "subagent_end",
      id: snapshot.id,
      summary: snapshot.summary ?? "(no summary)",
      status: snapshot.status
    });
    this.emitChanged();
    return cloneSnapshot(snapshot);
  }

  private emitChanged(): void {
    this.emit({ type: "workers_changed", workers: this.list() });
  }
}

export function workerDigestText(workers: SubagentWorkerSnapshot[]): string {
  if (workers.length === 0) return "";
  return workers
    .map((worker) => {
      const body = worker.summary ?? worker.error ?? "(no summary)";
      return `### ${worker.name} (${worker.status})\nid: ${worker.id}\ntask: ${worker.task}\n${body}`;
    })
    .join("\n\n");
}
