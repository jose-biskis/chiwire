import { Clock, LoaderCircle, Play, Square } from "lucide-react";
import type { AgentSettings, SubagentRunMode, SubagentWorkerSnapshot } from "../../../shared/types";
import { Button, Input } from "@chiwire/ui/internal";
import { cn } from "@/lib/utils";

function FieldLabel({ children }: { children: string }) {
  return <div className="mb-1 text-[11px] text-muted-foreground">{children}</div>;
}

function statusTone(status: SubagentWorkerSnapshot["status"]): string {
  if (status === "running") return "text-primary";
  if (status === "queued") return "text-muted-foreground";
  if (status === "error") return "text-destructive";
  if (status === "cancelled") return "text-muted-foreground";
  return "text-foreground";
}

function isActive(status: SubagentWorkerSnapshot["status"]): boolean {
  return status === "running" || status === "queued";
}

type MultitaskPanelProps = {
  settings: AgentSettings;
  workers: SubagentWorkerSnapshot[];
  onMaxDepth: (value: number) => void;
  onRunMode: (value: SubagentRunMode) => void;
  onCancel: (id: string) => void;
  onCancelAll: () => void;
  onResume: (id: string) => void;
  onSynthesize: () => void;
};

export function MultitaskPanel({
  settings,
  workers,
  onMaxDepth,
  onRunMode,
  onCancel,
  onCancelAll,
  onResume,
  onSynthesize
}: MultitaskPanelProps) {
  const active = workers.filter((worker) => isActive(worker.status));
  const finished = workers.filter((worker) => !isActive(worker.status));
  const runMode = settings.subagentRunMode;

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-4 text-muted-foreground">
        The main chat stays the coordinator. Heavy explore/shell/edit work runs as background
        workers so you can keep talking.
      </p>

      <section className="space-y-2">
        <FieldLabel>Run workers</FieldLabel>
        <div className="grid grid-cols-2 gap-1">
          <Button
            type="button"
            size="sm"
            variant={runMode === "parallel" ? "default" : "outline"}
            onClick={() => onRunMode("parallel")}
          >
            Parallel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={runMode === "series" ? "default" : "outline"}
            onClick={() => onRunMode("series")}
          >
            Series
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Parallel starts workers together (default). Series queues the next one until the current
          worker finishes.
        </p>
      </section>

      <section className="space-y-2">
        <FieldLabel>Max sub-agent depth</FieldLabel>
        <Input
          type="number"
          min={0}
          max={3}
          value={settings.maxSubagentDepth}
          onChange={(event) => onMaxDepth(Number.parseInt(event.target.value, 10) || 0)}
        />
        <p className="text-[11px] text-muted-foreground">
          0 disables spawn. 1 lets the coordinator start workers (no nesting).
        </p>
      </section>

      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={active.length === 0}
          onClick={onCancelAll}
        >
          <Square className="size-3" />
          Stop workers
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={finished.length === 0}
          onClick={onSynthesize}
        >
          Synthesize
        </Button>
      </div>

      {workers.length === 0 ? (
        <p className="rounded-[2px] border border-dashed border-border px-2 py-3 text-[11px] text-muted-foreground">
          No workers yet. Ask the coordinator to explore, test, or edit
          {runMode === "series" ? " in series" : " in parallel"}.
        </p>
      ) : (
        <ul className="space-y-2">
          {workers.map((worker) => (
            <li key={worker.id} className="rounded-[2px] border border-border bg-secondary/40 px-2 py-2">
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                {worker.status === "running" ? (
                  <LoaderCircle className="size-3 animate-spin text-primary" />
                ) : null}
                {worker.status === "queued" ? (
                  <Clock className="size-3 text-muted-foreground" />
                ) : null}
                <span className="text-primary">{worker.name}</span>
                <span className={cn("ml-auto", statusTone(worker.status))}>{worker.status}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">{worker.task}</p>
              {worker.progressText && worker.status === "running" ? (
                <pre className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap font-mono text-[10px] opacity-70">
                  {worker.progressText}
                </pre>
              ) : null}
              {worker.summary && worker.status !== "running" ? (
                <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap border-t border-border pt-1 font-mono text-[10px]">
                  {worker.summary}
                </pre>
              ) : null}
              <div className="mt-2 flex justify-end gap-1">
                {isActive(worker.status) ? (
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => onCancel(worker.id)}>
                    <Square className="size-3" />
                    Stop
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => onResume(worker.id)}>
                    <Play className="size-3" />
                    Resume
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
