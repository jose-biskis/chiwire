import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteProfile,
  fetchLogs,
  fetchProfiles,
  fetchStatus,
  saveProfile,
  startWatch,
  stopWatch
} from "./api";
import type { LogLine, ProfileDraft, WatchProfile, WatchStatus } from "./types";

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
  if (/\b(starting|stopped|stopping)\b/.test(text)) {
    return "brass";
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

  return (
    <div className="desk">
      <aside className="drawers">
        <h2>Charts in the drawer</h2>
        <p className="hint">
          Named watches. Same flags as the CLI. The tape on the right is stdout.
        </p>
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className={`profile${profile.id === selectedId ? " selected" : ""}`}
            onClick={() => {
              setSelectedId(profile.id);
            }}
          >
            <b>{profile.name}</b>
            <small>
              {profile.symbols.join(" ") || "(gold-digger)"} · {profile.notional} USDT
              {profile.live ? " · LIVE" : " · testnet"}
            </small>
          </button>
        ))}
        <div className="form">
          <label>Profile name</label>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => {
              patch("name", event.target.value);
            }}
          />
          <label>Pairs</label>
          <textarea
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
          <div className="row">
            <div>
              <label>Notional</label>
              <input
                type="number"
                value={draft.notional}
                onChange={(event) => {
                  patch("notional", Number(event.target.value));
                }}
              />
            </div>
            <div>
              <label>Max open</label>
              <input
                type="number"
                value={draft.maxOpen}
                onChange={(event) => {
                  patch("maxOpen", Number(event.target.value));
                }}
              />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Poll s</label>
              <input
                type="number"
                value={draft.pollSeconds}
                onChange={(event) => {
                  patch("pollSeconds", Number(event.target.value));
                }}
              />
            </div>
            <div>
              <label>Cooldown s</label>
              <input
                type="number"
                value={draft.cooldownSeconds}
                onChange={(event) => {
                  patch("cooldownSeconds", Number(event.target.value));
                }}
              />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Leverage</label>
              <input
                type="number"
                value={draft.leverage}
                onChange={(event) => {
                  patch("leverage", Number(event.target.value));
                }}
              />
            </div>
            <div>
              <label>Smart cap %</label>
              <input
                type="number"
                value={draft.smartCap ?? 5}
                onChange={(event) => {
                  patch("smartCap", Number(event.target.value));
                }}
              />
            </div>
          </div>
          <div className="checks">
            <label>
              <input
                type="checkbox"
                checked={draft.live}
                onChange={(event) => {
                  patch("live", event.target.checked);
                }}
              />{" "}
              live
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.smartProfit}
                onChange={(event) => {
                  patch("smartProfit", event.target.checked);
                }}
              />{" "}
              smart-profit
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.goldDigger}
                onChange={(event) => {
                  patch("goldDigger", event.target.checked);
                }}
              />{" "}
              gold-digger
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.dryRun}
                onChange={(event) => {
                  patch("dryRun", event.target.checked);
                }}
              />{" "}
              dry-run
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.isolated}
                onChange={(event) => {
                  patch("isolated", event.target.checked);
                }}
              />{" "}
              isolated
            </label>
          </div>
          <button type="button" className="lever" disabled={busy} onClick={() => void onSave()}>
            Save profile
          </button>
          <button type="button" className="lever" disabled={busy} onClick={() => void onNew()}>
            New
          </button>
          <button
            type="button"
            className="lever stop"
            disabled={busy || !selected}
            onClick={() => void onDelete()}
          >
            Delete
          </button>
        </div>
      </aside>
      <main>
        <header className="nameplate">
          <h1 className="brand">
            Velero <span>desk</span>
          </h1>
          <div className="tag">{running ? "under way" : "at anchor"}</div>
        </header>
        <div className="telegraph">
          <span className={`running-lamp${running ? " on" : ""}`} />
          {running ? (
            <button
              type="button"
              className="lever stop"
              disabled={busy}
              onClick={() => void onStop()}
            >
              Stop
            </button>
          ) : (
            <button type="button" className="lever" disabled={busy} onClick={() => void onStart()}>
              Full ahead
            </button>
          )}
          <span className="tag">
            {status?.profileName ?? "no watch"}
            {status?.pid ? `  pid ${status.pid}` : ""}
          </span>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <p className="cli-echo">{status?.cli ?? selected?.name ?? "No profile selected."}</p>
        <div
          className="tape-wrap"
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
      </main>
    </div>
  );
}
