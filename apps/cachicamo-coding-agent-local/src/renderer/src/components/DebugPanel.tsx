import { useEffect, useMemo, useState } from "react";
import { Bug, LoaderCircle, Play } from "lucide-react";
import type { DebugFixtureInfo, DebugRunResult } from "../../../shared/types";
import { Button, ScrollArea } from "@chiwire/ui/internal";
import { cn } from "@/lib/utils";

type DebugPanelProps = {
  onClose: () => void;
};

export function DebugPanel({ onClose }: DebugPanelProps) {
  const [fixtures, setFixtures] = useState<DebugFixtureInfo[]>([]);
  const [results, setResults] = useState<Record<string, DebugRunResult>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void window.cachicamoAgent.listDebugFixtures().then(setFixtures).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, DebugFixtureInfo[]>();
    for (const fixture of fixtures) {
      const list = map.get(fixture.feature) ?? [];
      list.push(fixture);
      map.set(fixture.feature, list);
    }
    return [...map.entries()];
  }, [fixtures]);

  const summary = useMemo(() => {
    const values = Object.values(results);
    return {
      ran: values.length,
      passed: values.filter((item) => item.passed).length,
      failed: values.filter((item) => !item.passed).length
    };
  }, [results]);

  async function runOne(id: string): Promise<void> {
    setError(null);
    setRunningId(id);
    try {
      const result = await window.cachicamoAgent.runDebugFixture(id);
      setResults((prev) => ({ ...prev, [id]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningId(null);
    }
  }

  async function runAll(): Promise<void> {
    setError(null);
    setRunningId("*");
    try {
      const next = await window.cachicamoAgent.runAllDebugFixtures();
      const mapped: Record<string, DebugRunResult> = {};
      for (const result of next) mapped[result.id] = result;
      setResults(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2">
        <div className="flex items-center gap-2 text-[12px] text-destructive">
          <Bug className="size-3.5" />
          <span className="font-semibold tracking-wide uppercase">Debug mode</span>
          <span className="text-destructive/80">Dev fixtures — not a production flow</span>
          <button
            type="button"
            className="ml-auto text-[11px] underline-offset-2 hover:underline"
            onClick={onClose}
          >
            Hide
          </button>
        </div>
      </div>

      <div className="flex h-9 items-center justify-between border-b border-border bg-card px-4">
        <p className="text-[12px] text-muted-foreground">
          {summary.ran === 0
            ? `${fixtures.length} premade examples`
            : `${summary.passed} passed · ${summary.failed} failed · ${summary.ran} ran`}
        </p>
        <Button size="sm" variant="outline" disabled={runningId !== null} onClick={() => void runAll()}>
          {runningId === "*" ? <LoaderCircle className="size-3 animate-spin" /> : <Play className="size-3" />}
          Run all
        </Button>
      </div>

      {error ? (
        <div className="mx-4 mt-3 rounded-[2px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {error}
        </div>
      ) : null}

      <ScrollArea className="flex-1">
        <div className="mx-auto flex max-w-[920px] flex-col gap-5 px-6 py-5">
          {groups.map(([feature, items]) => (
            <section key={feature}>
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {feature}
              </h2>
              <div className="space-y-2">
                {items.map((fixture) => {
                  const result = results[fixture.id];
                  const busy = runningId === fixture.id || runningId === "*";
                  return (
                    <article
                      key={fixture.id}
                      className="rounded-[2px] border border-border bg-card px-3 py-2"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[13px] text-foreground">{fixture.title}</h3>
                            {result ? (
                              <span
                                className={cn(
                                  "font-mono text-[10px] uppercase",
                                  result.passed ? "text-primary" : "text-destructive"
                                )}
                              >
                                {result.passed ? "pass" : "fail"}
                                <span className="ml-1 text-muted-foreground">
                                  {result.durationMs}ms
                                </span>
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[12px] text-muted-foreground">{fixture.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          disabled={busy}
                          onClick={() => void runOne(fixture.id)}
                        >
                          {runningId === fixture.id ? (
                            <LoaderCircle className="size-3 animate-spin" />
                          ) : (
                            <Play className="size-3" />
                          )}
                          Run
                        </Button>
                      </div>
                      {result ? (
                        <div className="mt-2 grid gap-2 border-t border-border pt-2 md:grid-cols-2">
                          <div>
                            <div className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                              Expected
                            </div>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
                              {result.expected || "(empty)"}
                            </pre>
                          </div>
                          <div>
                            <div className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                              Actual
                            </div>
                            <pre
                              className={cn(
                                "max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px]",
                                result.passed ? "text-foreground" : "text-destructive"
                              )}
                            >
                              {result.error ? `ERROR: ${result.error}` : result.actual || "(empty)"}
                            </pre>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
