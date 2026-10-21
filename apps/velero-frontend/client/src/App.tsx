import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Switch,
  Textarea
} from "@chiwire/ui/internal";
import {
  deleteProfile,
  fetchHarborManifest,
  fetchLogs,
  fetchProfiles,
  fetchStatus,
  saveProfile,
  startWatch,
  stopWatch
} from "./api";
import type {
  HarborArtifact,
  LogLine,
  ProfileDraft,
  WatchProfile,
  WatchStatus
} from "./types";

const emptyDraft = (): ProfileDraft => ({
  name: "",
  symbols: [],
  notional: 10,
  leverage: 10,
  maxOpen: 3,
  pollSeconds: 30,
  cooldownSeconds: 300,
  live: false,
  isolated: false,
  dryRun: false,
  smartProfit: false,
  smartCap: 5,
  goldDigger: false,
  goldTop: 8,
  goldScan: 36,
  goldEverySeconds: 180
});

function tone(line: LogLine): string {
  const text = line.text;
  if (line.stream === "stderr" || /\berror\b/i.test(text)) {
    return "bad";
  }
  if (/\b(sail|bank|join|pull)\b/.test(text)) {
    return "good";
  }
  if (/\b(hold|flat|wait|tend)\b/.test(text)) {
    return "dim";
  }
  if (/\bwould\b/.test(text)) {
    return "warn";
  }
  return "";
}

function draftFromProfile(profile: WatchProfile): ProfileDraft {
  return {
    name: profile.name,
    symbols: profile.symbols,
    notional: profile.notional,
    leverage: profile.leverage,
    maxOpen: profile.maxOpen,
    pollSeconds: profile.pollSeconds,
    cooldownSeconds: profile.cooldownSeconds,
    live: profile.live,
    isolated: profile.isolated,
    dryRun: profile.dryRun,
    smartProfit: profile.smartProfit,
    smartCap: profile.smartCap,
    goldDigger: profile.goldDigger,
    goldTop: profile.goldTop,
    goldScan: profile.goldScan,
    goldEverySeconds: profile.goldEverySeconds
  };
}

export function App() {
  const [profiles, setProfiles] = useState<WatchProfile[]>([]);
  const [status, setStatus] = useState<WatchStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [harborDownloads, setHarborDownloads] = useState<HarborArtifact[]>([]);
  const tapeRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  const selected = useMemo(
    () => profiles.find((row) => row.id === selectedId) ?? null,
    [profiles, selectedId]
  );

  async function refresh(): Promise<void> {
    const [nextProfiles, nextStatus] = await Promise.all([
      fetchProfiles(),
      fetchStatus()
    ]);
    setProfiles(nextProfiles);
    setStatus(nextStatus);
    if (!selectedId && nextProfiles[0]) {
      setSelectedId(nextProfiles[0].id);
      setDraft(draftFromProfile(nextProfiles[0]));
    }
  }

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
    void fetchLogs().then(setLines).catch(() => undefined);
    void fetchHarborManifest()
      .then((manifest) => setHarborDownloads(manifest.artifacts ?? []))
      .catch(() => undefined);

    const source = new EventSource("/api/logs/stream");
    source.onmessage = (event) => {
      const line = JSON.parse(event.data) as LogLine;
      setLines((current) => {
        if (current.some((row) => row.seq === line.seq)) {
          return current;
        }
        return [...current, line].slice(-2000);
      });
    };
    const poll = setInterval(() => {
      void fetchStatus().then(setStatus).catch(() => undefined);
    }, 4000);
    return () => {
      source.close();
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setDraft(draftFromProfile(selected));
  }, [selected]);

  useEffect(() => {
    const node = tapeRef.current;
    if (!node || !stickRef.current) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [lines]);

  function patch<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onSave(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const saved = await saveProfile(
        {
          ...draft,
          symbols: draft.symbols
        },
        selected?.id
      );
      await refresh();
      setSelectedId(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onNew(): Promise<void> {
    setSelectedId(null);
    setDraft(emptyDraft());
  }

  async function onDelete(): Promise<void> {
    if (!selected) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteProfile(selected.id);
      setSelectedId(null);
      setDraft(emptyDraft());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onStart(): Promise<void> {
    if (!selected) {
      setError("Pick a profile first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await startWatch(selected.id);
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onStop(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const next = await stopWatch();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const running = Boolean(status?.running);
  const gate = status?.gate;
  const harborReady = Boolean(gate?.connected) || gate?.requireGate === false;

  return (
    <div className="desk">
      <aside className="drawers">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Profiles</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Named watches. Same flags as the CLI. The tape is stdout.
          </p>
        </div>
        {profiles.map((profile) => (
          <Button
            key={profile.id}
            type="button"
            variant={profile.id === selectedId ? "default" : "outline"}
            className="h-auto w-full flex-col items-start gap-0.5 py-2 text-left"
            onClick={() => {
              setSelectedId(profile.id);
            }}
          >
            <span>{profile.name}</span>
            <span className="text-xs font-normal opacity-80">
              {profile.symbols.join(" ") || "(gold-digger)"} · {profile.notional}{" "}
              USDT
              {profile.live ? " · LIVE" : " · testnet"}
            </span>
          </Button>
        ))}
        <Separator />
        <div className="field">
          <Label htmlFor="profile-name">Profile name</Label>
          <Input
            id="profile-name"
            value={draft.name}
            onChange={(event) => {
              patch("name", event.target.value);
            }}
          />
        </div>
        <div className="field">
          <Label htmlFor="pairs">Pairs</Label>
          <Textarea
            id="pairs"
            rows={3}
            value={draft.symbols.join(" ")}
            onChange={(event) => {
              patch(
                "symbols",
                event.target.value
                  .split(/[\s,]+/)
                  .map((part) => part.trim().toUpperCase())
                  .filter(Boolean)
              );
            }}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <Label htmlFor="notional">Notional</Label>
            <Input
              id="notional"
              type="number"
              value={draft.notional}
              onChange={(event) => {
                patch("notional", Number(event.target.value));
              }}
            />
          </div>
          <div className="field">
            <Label htmlFor="max-open">Max open</Label>
            <Input
              id="max-open"
              type="number"
              value={draft.maxOpen}
              onChange={(event) => {
                patch("maxOpen", Number(event.target.value));
              }}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <Label htmlFor="poll">Poll s</Label>
            <Input
              id="poll"
              type="number"
              value={draft.pollSeconds}
              onChange={(event) => {
                patch("pollSeconds", Number(event.target.value));
              }}
            />
          </div>
          <div className="field">
            <Label htmlFor="cooldown">Cooldown s</Label>
            <Input
              id="cooldown"
              type="number"
              value={draft.cooldownSeconds}
              onChange={(event) => {
                patch("cooldownSeconds", Number(event.target.value));
              }}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <Label htmlFor="leverage">Leverage</Label>
            <Input
              id="leverage"
              type="number"
              value={draft.leverage}
              onChange={(event) => {
                patch("leverage", Number(event.target.value));
              }}
            />
          </div>
          <div className="field">
            <Label htmlFor="smart-cap">Smart cap %</Label>
            <Input
              id="smart-cap"
              type="number"
              value={draft.smartCap ?? 5}
              onChange={(event) => {
                patch("smartCap", Number(event.target.value));
              }}
            />
          </div>
        </div>
        <div className="switch-row">
          {(
            [
              ["live", "live"],
              ["smartProfit", "smart-profit"],
              ["goldDigger", "gold-digger"],
              ["dryRun", "dry-run"],
              ["isolated", "isolated"]
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="switch-item">
              <Switch
                checked={draft[key]}
                onCheckedChange={(value) => {
                  patch(key, value);
                }}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void onSave()}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void onNew()}
          >
            New
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy || !selected}
            onClick={() => void onDelete()}
          >
            Delete
          </Button>
        </div>
      </aside>
      <main className="desk-main">
        <header className="flex items-end justify-between gap-4 border-b px-6 py-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Velero desk</h1>
            <p className="text-sm text-muted-foreground">
              Internal watch UI. Harbor signs Binance on the laptop.
            </p>
          </div>
          <Badge variant={running ? "default" : "secondary"}>
            {running ? "under way" : "at anchor"}
          </Badge>
        </header>
        <div className="flex flex-col gap-4 p-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {gate?.connected ? "Harbor connected" : "Harbor disconnected"}
              </CardTitle>
              <CardDescription>
                Install Harbor on the laptop that talks to Binance. Paste{" "}
                <code>VELERO_GATE_TOKEN</code> and the API key there — not on this
                page.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {harborDownloads.length > 0 ? (
                harborDownloads.map((artifact) => (
                  <Button key={artifact.filename} variant="outline" size="sm" asChild>
                    <a href={artifact.url}>{artifact.label}</a>
                  </Button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No installer uploaded yet. From the repo:{" "}
                  <code>npm run publish:velero-gate</code> then redeploy the desk.
                </p>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap items-center gap-3">
            {running ? (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void onStop()}
              >
                Stop
              </Button>
            ) : (
              <Button
                type="button"
                disabled={busy || !harborReady}
                onClick={() => void onStart()}
              >
                Start
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              {status?.profileName ?? "no watch"}
              {status?.pid ? ` · pid ${status.pid}` : ""}
            </span>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <p className="cli-echo">
            {status?.cli ?? selected?.name ?? "No profile selected."}
          </p>
          <Card className="min-h-[52vh] flex-1">
            <CardContent className="p-0">
              <div
                className="h-[min(70vh,40rem)] overflow-auto px-4 py-3"
                ref={tapeRef}
                onScroll={(event) => {
                  const node = event.currentTarget;
                  stickRef.current =
                    node.scrollHeight - node.scrollTop - node.clientHeight < 48;
                }}
              >
                <pre className="tape">
                  {lines.length === 0
                    ? "waiting for tape…"
                    : lines.map((line) => (
                        <div key={line.seq} className={`tape-line ${tone(line)}`}>
                          {line.text}
                        </div>
                      ))}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
