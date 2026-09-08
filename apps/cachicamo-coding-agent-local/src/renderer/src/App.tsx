import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Blocks,
  Bot,
  Bug,
  FolderOpen,
  Layers,
  LoaderCircle,
  MessageSquare,
  Plug,
  Plus,
  Settings2,
  Square,
  Trash2
} from "lucide-react";
import type {
  AgentSettings,
  AgentStreamEvent,
  McpServerConfig,
  ModelInfo,
  RuleInfo,
  SkillInfo,
  SubagentWorkerSnapshot,
  ToolCallEvent,
  WorkerStatus,
  UiArchetype,
  UiColorMode
} from "../../shared/types";
import { TitleBar } from "@/components/TitleBar";
import { Markdown } from "@/components/Markdown";
import { MultitaskPanel } from "@/components/MultitaskPanel";
import { DebugPanel } from "@/components/DebugPanel";
import { Button, Input, ScrollArea, Switch, Textarea } from "@chiwire/ui/internal";
import { cn } from "@/lib/utils";

function applyUiAppearance(archetype: UiArchetype, colorMode: UiColorMode): void {
  for (const el of [document.documentElement, document.body]) {
    el.dataset.archetype = archetype;
    el.dataset.theme = colorMode;
  }
}

type UiMessage =
  | { id: string; kind: "user"; content: string }
  | { id: string; kind: "assistant"; content: string }
  | { id: string; kind: "error"; content: string }
  | { id: string; kind: "tool"; call: ToolCallEvent }
  | {
      id: string;
      kind: "subagent";
      name: string;
      agentType: string;
      task: string;
      summary?: string;
      liveText?: string;
      status: WorkerStatus;
    };

type SidebarTab = "chat" | "agent" | "mcp" | "api" | "multitask" | "debug";
type EditorTab = "chat" | "debug";

function shortPath(path: string | null): string {
  if (!path) return "No folder opened";
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts.slice(-2).join("/") || path;
}

function newId(): string {
  return crypto.randomUUID();
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-[11px] text-muted-foreground">{children}</div>;
}

export default function App() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [apiStatus, setApiStatus] = useState<{ enabled: boolean; url: string; tokenSet: boolean } | null>(
    null
  );
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("agent");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [editorTab, setEditorTab] = useState<EditorTab>("chat");
  const [debugMode, setDebugMode] = useState(false);
  const [workers, setWorkers] = useState<SubagentWorkerSnapshot[]>([]);
  const [mcpDraft, setMcpDraft] = useState({ name: "trello", url: "http://localhost:3000/trello" });
  const bottomRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<AgentSettings | null>(null);
  const persistChain = useRef(Promise.resolve());
  const persistTimer = useRef<number | null>(null);

  useEffect(() => {
    void window.cachicamoAgent.getSettings().then((loaded: AgentSettings) => {
      applyUiAppearance(loaded.uiArchetype, loaded.uiColorMode);
      settingsRef.current = loaded;
      setSettings(loaded);
    });
    void window.cachicamoAgent.listWorkers().then(setWorkers);
  }, []);

  useEffect(() => {
    if (!settings) return;
    applyUiAppearance(settings.uiArchetype, settings.uiColorMode);
  }, [settings?.uiArchetype, settings?.uiColorMode]);

  useEffect(() => {
    const unsubscribe = window.cachicamoAgent.onAgentEvent((event: AgentStreamEvent) => {
      if (event.type === "text" && event.parentId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.kind === "subagent" && msg.id === event.parentId
              ? { ...msg, liveText: `${msg.liveText ?? ""}${event.text}` }
              : msg
          )
        );
        return;
      }

      if (event.type === "text") {
        // Append token deltas to the latest assistant bubble (or start a new one
        // after tool/subagent cards so earlier text is not replayed).
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.kind === "assistant") {
            return [...prev.slice(0, -1), { ...last, content: last.content + event.text }];
          }
          return [...prev, { id: newId(), kind: "assistant", content: event.text }];
        });
        return;
      }

      if (event.type === "tool_start") {
        setMessages((prev) => [...prev, { id: event.call.id, kind: "tool", call: event.call }]);
        return;
      }

      if (event.type === "tool_end") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.kind === "tool" && msg.call.id === event.call.id
              ? { ...msg, call: event.call }
              : msg
          )
        );
        return;
      }

      if (event.type === "subagent_start") {
        setMessages((prev) => [
          ...prev,
          {
            id: event.id,
            kind: "subagent",
            name: event.name,
            agentType: event.agentType,
            task: event.task,
            status: "running"
          }
        ]);
        return;
      }

      if (event.type === "subagent_end") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.kind === "subagent" && msg.id === event.id
              ? { ...msg, status: event.status, summary: event.summary }
              : msg
          )
        );
        return;
      }

      if (event.type === "workers_changed") {
        setWorkers(event.workers);
        return;
      }

      if (event.type === "error" && !event.parentId) {
        setMessages((prev) => [...prev, { id: newId(), kind: "error", content: event.message }]);
        return;
      }

      if (event.type === "done") {
        setRunning(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, running]);

  const history = useMemo(
    () =>
      messages
        .filter((m): m is Extract<UiMessage, { kind: "user" | "assistant" }> =>
          m.kind === "user" || m.kind === "assistant"
        )
        .map((m) => ({ role: m.kind, content: m.content })),
    [messages]
  );

  function applySettingsPatch(patch: Partial<AgentSettings>): AgentSettings | null {
    const current = settingsRef.current;
    if (!current) return null;
    const next = { ...current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    return next;
  }

  async function flushSettings(): Promise<void> {
    if (persistTimer.current != null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    const snapshot = settingsRef.current;
    if (!snapshot) return;
    const run = persistChain.current.then(async () => {
      const saved = await window.cachicamoAgent.setSettings(settingsRef.current ?? snapshot);
      settingsRef.current = saved;
      setSettings(saved);
      setApiStatus(await window.cachicamoAgent.getApiStatus());
    });
    persistChain.current = run.then(
      () => undefined,
      () => undefined
    );
    await run;
  }

  function persist(patch: Partial<AgentSettings>): void {
    if (!applySettingsPatch(patch)) return;
    void flushSettings();
  }

  function persistDebounced(patch: Partial<AgentSettings>): void {
    if (!applySettingsPatch(patch)) return;
    if (persistTimer.current != null) {
      window.clearTimeout(persistTimer.current);
    }
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      void flushSettings();
    }, 400);
  }

  useEffect(() => {
    const flush = () => {
      void flushSettings();
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  async function refreshMeta(): Promise<void> {
    setModelsError(null);
    try {
      const [modelList, ruleList, skillList, status] = await Promise.all([
        window.cachicamoAgent.listModels(),
        window.cachicamoAgent.listRules(),
        window.cachicamoAgent.listSkills(),
        window.cachicamoAgent.getApiStatus()
      ]);
      setModels(modelList);
      setRules(ruleList);
      setSkills(skillList);
      setApiStatus(status);
    } catch (error) {
      setModels([]);
      setModelsError(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    if (!settings) return;
    void refreshMeta();
  }, [
    settings?.mode,
    settings?.localHost,
    settings?.cloudHost,
    settings?.apiKey,
    settings?.workspacePath,
    settings?.apiEnabled,
    settings?.apiPort
  ]);

  async function onPickWorkspace(): Promise<void> {
    const path = await window.cachicamoAgent.pickWorkspace();
    if (!path || !settingsRef.current) return;
    applySettingsPatch({ workspacePath: path });
    void refreshMeta();
  }

  async function addMcpServer(): Promise<void> {
    if (!settings || !mcpDraft.name.trim() || !mcpDraft.url.trim()) return;
    const server: McpServerConfig = {
      id: crypto.randomUUID(),
      name: mcpDraft.name.trim(),
      url: mcpDraft.url.trim(),
      enabled: true
    };
    persist({ mcpServers: [...(settingsRef.current?.mcpServers ?? settings.mcpServers), server] });
  }

  async function onSend(): Promise<void> {
    const text = draft.trim();
    if (!text || !settings) return;
    if (!settings.workspacePath) {
      setMessages((prev) => [
        ...prev,
        { id: newId(), kind: "error", content: "Open a workspace folder first." }
      ]);
      return;
    }

    setDraft("");
    setRunning(true);
    const prior = history;
    setMessages((prev) => [...prev, { id: newId(), kind: "user", content: text }]);

    try {
      await window.cachicamoAgent.runAgent({ userMessage: text, history: prior });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          kind: "error",
          content: error instanceof Error ? error.message : String(error)
        }
      ]);
      setRunning(false);
    }
  }

  async function onCancelWorker(id: string): Promise<void> {
    await window.cachicamoAgent.cancelWorker(id);
  }

  async function onCancelAllWorkers(): Promise<void> {
    await window.cachicamoAgent.cancelAllWorkers();
  }

  async function onResumeWorker(id: string): Promise<void> {
    const task = window.prompt("Follow-up task for this worker?");
    if (!task?.trim()) return;
    try {
      await window.cachicamoAgent.resumeWorker(id, task.trim());
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          kind: "error",
          content: error instanceof Error ? error.message : String(error)
        }
      ]);
    }
  }

  function onSynthesizeWorkers(): void {
    const finished = workers.filter((worker) => worker.status !== "running");
    if (finished.length === 0) return;
    setDraft(
      `Synthesize the finished background workers for me. Do not redo their work.\n${finished
        .map((worker) => `- ${worker.name} (${worker.status}): ${worker.task}`)
        .join("\n")}`
    );
    setEditorTab("chat");
    setSidebarTab("chat");
  }

  function toggleDebugMode(): void {
    setDebugMode((current) => {
      const next = !current;
      if (next) {
        setSidebarTab("debug");
        setEditorTab("debug");
      } else if (sidebarTab === "debug") {
        setSidebarTab("multitask");
        setEditorTab("chat");
      }
      return next;
    });
  }

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center bg-card text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin text-primary" />
        Loading…
      </div>
    );
  }

  const cloud = settings.mode === "cloud";
  const runningWorkers = workers.filter((worker) => worker.status === "running");
  const queuedWorkers = workers.filter((worker) => worker.status === "queued");
  const activityItems: Array<{ id: SidebarTab; icon: typeof Bot; label: string }> = [
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "agent", icon: Bot, label: "Agent" },
    { id: "multitask", icon: Layers, label: "Multitask" },
    { id: "mcp", icon: Blocks, label: "MCP" },
    { id: "api", icon: Plug, label: "API" },
    ...(debugMode ? [{ id: "debug" as const, icon: Bug, label: "Debug" }] : [])
  ];

  return (
    <div className="flex h-full flex-col bg-card text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]">
      <TitleBar
        onOpenFolder={() => void onPickWorkspace()}
        onToggleSidebar={() => setSidebarVisible((value) => !value)}
        uiArchetype={settings.uiArchetype}
        uiColorMode={settings.uiColorMode}
        onUiArchetype={(uiArchetype) => persist({ uiArchetype })}
        onUiColorMode={(uiColorMode) => persist({ uiColorMode })}
        debugMode={debugMode}
        onToggleDebug={toggleDebugMode}
      />
      <div className="flex min-h-0 flex-1">
        {/* Activity bar */}
        <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-activity py-2">
          {activityItems.map((item) => {
            const Icon = item.icon;
            const active = sidebarTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                className={cn(
                  "relative flex size-12 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground"
                )}
                onClick={() => {
                  setSidebarTab(item.id);
                  if (item.id === "debug") setEditorTab("debug");
                  if (item.id === "chat" || item.id === "multitask") setEditorTab("chat");
                }}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-foreground" />
                ) : null}
                <Icon className="size-6 stroke-[1.5]" />
                {item.id === "multitask" && runningWorkers.length > 0 ? (
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
                ) : null}
              </button>
            );
          })}
          <div className="flex-1" />
          <button
            type="button"
            title="Settings"
            onClick={() => setSidebarTab("agent")}
            className="flex size-12 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-6 stroke-[1.5]" />
          </button>
        </nav>

        {/* Side bar */}
        {sidebarVisible ? (
        <aside className="flex w-[278px] shrink-0 flex-col border-r border-border bg-card">
          <div className="flex h-9 items-center px-4 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {sidebarTab === "chat"
              ? "Explorer"
              : sidebarTab === "agent"
                ? "Agent"
                : sidebarTab === "multitask"
                  ? "Multitask"
                  : sidebarTab === "mcp"
                    ? "MCP"
                    : sidebarTab === "debug"
                      ? "Debug"
                      : "External API"}
          </div>

          <ScrollArea className="flex-1 px-3 pb-3">
            {sidebarTab === "chat" || sidebarTab === "agent" ? (
              <div className="space-y-4">
                <section>
                  <FieldLabel>Workspace</FieldLabel>
                  <Button
                    variant="outline"
                    className="h-7 w-full justify-start px-2"
                    onClick={() => void onPickWorkspace()}
                  >
                    <FolderOpen className="size-3.5" />
                    <span className="truncate text-[12px]">{shortPath(settings.workspacePath)}</span>
                  </Button>
                </section>

                <section>
                  <div className="mb-1 flex items-center justify-between">
                    <FieldLabel>Model</FieldLabel>
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline"
                      onClick={() => void refreshMeta()}
                    >
                      Refresh
                    </button>
                  </div>
                  <Input
                    list="cachicamo-models"
                    value={settings.model}
                    onChange={(e) => persistDebounced({ model: e.target.value })}
                    onBlur={() => void flushSettings()}
                  />
                  <datalist id="cachicamo-models">
                    {models.map((m) => (
                      <option key={m.name} value={m.name} />
                    ))}
                  </datalist>
                  {modelsError ? (
                    <p className="mt-1 text-[11px] text-destructive">{modelsError}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {models.length} models available
                    </p>
                  )}
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]">Cloud Ollama</span>
                    <Switch
                      checked={cloud}
                      onCheckedChange={(checked) => persist({ mode: checked ? "cloud" : "local" })}
                    />
                  </div>
                  <FieldLabel>Host</FieldLabel>
                  <Input
                    value={cloud ? settings.cloudHost : settings.localHost}
                    onChange={(e) =>
                      persistDebounced(
                        cloud ? { cloudHost: e.target.value } : { localHost: e.target.value }
                      )
                    }
                    onBlur={() => void flushSettings()}
                  />
                  {cloud ? (
                    <>
                      <FieldLabel>API key</FieldLabel>
                      <Input
                        type="password"
                        value={settings.apiKey}
                        onChange={(e) => persistDebounced({ apiKey: e.target.value })}
                        onBlur={() => void flushSettings()}
                      />
                    </>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    Host, model, and key are saved automatically and kept after you quit.
                  </p>
                </section>

                <section className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]">Rules</span>
                    <Switch
                      checked={settings.rulesEnabled}
                      onCheckedChange={(checked) => persist({ rulesEnabled: checked })}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{rules.length} loaded</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]">Skills</span>
                    <Switch
                      checked={settings.skillsEnabled}
                      onCheckedChange={(checked) => persist({ skillsEnabled: checked })}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{skills.length} loaded</p>
                </section>
              </div>
            ) : null}

            {sidebarTab === "mcp" ? (
              <div className="space-y-3">
                {settings.mcpServers.map((server) => (
                  <div key={server.id} className="rounded-[2px] bg-secondary px-2 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px]">{server.name}</span>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={server.enabled}
                          onCheckedChange={(checked) =>
                            persist({
                              mcpServers: (settingsRef.current?.mcpServers ?? settings.mcpServers).map(
                                (s) => (s.id === server.id ? { ...s, enabled: checked } : s)
                              )
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() =>
                            persist({
                              mcpServers: (settingsRef.current?.mcpServers ?? settings.mcpServers).filter(
                                (s) => s.id !== server.id
                              )
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {server.url}
                    </p>
                  </div>
                ))}
                <FieldLabel>Name</FieldLabel>
                <Input
                  value={mcpDraft.name}
                  onChange={(e) => setMcpDraft((d) => ({ ...d, name: e.target.value }))}
                />
                <FieldLabel>URL</FieldLabel>
                <Input
                  value={mcpDraft.url}
                  onChange={(e) => setMcpDraft((d) => ({ ...d, url: e.target.value }))}
                />
                <Button variant="outline" size="sm" className="w-full" onClick={() => void addMcpServer()}>
                  <Plus className="size-3.5" />
                  Add MCP server
                </Button>
              </div>
            ) : null}

            {sidebarTab === "api" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px]">Enabled</span>
                  <Switch
                    checked={settings.apiEnabled}
                    onCheckedChange={(checked) => persist({ apiEnabled: checked })}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {apiStatus?.enabled
                    ? `Listening on ${apiStatus.url}`
                    : "Local HTTP API for n8n is off."}
                </p>
                <FieldLabel>Port</FieldLabel>
                <Input
                  type="number"
                  value={settings.apiPort}
                  onChange={(e) =>
                    persistDebounced({
                      apiPort: Number.parseInt(e.target.value, 10) || 3847
                    })
                  }
                  onBlur={() => void flushSettings()}
                />
                <FieldLabel>Bearer token</FieldLabel>
                <Input
                  type="password"
                  value={settings.apiToken}
                  onChange={(e) => persistDebounced({ apiToken: e.target.value })}
                  onBlur={() => void flushSettings()}
                />
              </div>
            ) : null}

            {sidebarTab === "multitask" ? (
              <MultitaskPanel
                settings={settings}
                workers={workers}
                onMaxDepth={(maxSubagentDepth) => persist({ maxSubagentDepth })}
                onRunMode={(subagentRunMode) => persist({ subagentRunMode })}
                onCancel={(id) => void onCancelWorker(id)}
                onCancelAll={() => void onCancelAllWorkers()}
                onResume={(id) => void onResumeWorker(id)}
                onSynthesize={onSynthesizeWorkers}
              />
            ) : null}

            {sidebarTab === "debug" ? (
              <div className="space-y-3">
                <p className="rounded-[2px] border border-destructive/40 bg-destructive/10 px-2 py-2 text-[11px] text-destructive">
                  Debug mode is for premade fixtures only. It does not call a live model.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setEditorTab("debug")}
                >
                  <Bug className="size-3.5" />
                  Open debug panel
                </Button>
              </div>
            ) : null}
          </ScrollArea>
        </aside>
        ) : null}

        {/* Editor / chat */}
        <main className="flex min-w-0 flex-1 flex-col bg-background">
          {debugMode && editorTab === "debug" ? (
            <DebugPanel
              onClose={() => {
                setEditorTab("chat");
                setSidebarTab("multitask");
              }}
            />
          ) : (
            <>
          <div className="flex h-9 items-stretch border-b border-border bg-card">
            <button
              type="button"
              className="flex items-center gap-2 border-r border-border bg-background px-3 text-[13px] text-foreground"
              onClick={() => setEditorTab("chat")}
            >
              <MessageSquare className="size-3.5 text-muted-foreground" />
              Chat
              {running ? <span className="text-[11px] text-primary">●</span> : null}
              {runningWorkers.length > 0 ? (
                <span className="text-[11px] text-muted-foreground">{runningWorkers.length} workers</span>
              ) : null}
            </button>
            {debugMode ? (
              <button
                type="button"
                className="flex items-center gap-2 border-r border-border px-3 text-[13px] text-muted-foreground hover:text-foreground"
                onClick={() => setEditorTab("debug")}
              >
                <Bug className="size-3.5" />
                Debug
              </button>
            ) : null}
            <div className="flex flex-1 items-center justify-end gap-2 px-3">
              {runningWorkers.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => void onCancelAllWorkers()}>
                  <Square className="size-3" />
                  Stop workers
                </Button>
              ) : null}
              {running ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void window.cachicamoAgent.cancelAgent()}
                >
                  <Square className="size-3" />
                  Stop
                </Button>
              ) : null}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="mx-auto flex max-w-[860px] flex-col gap-3 px-6 py-5">
              {messages.length === 0 ? (
                <div className="py-16 text-center">
                  <img
                    src="/icon.png"
                    alt="Cachicamo"
                    className="mx-auto size-16 rounded-[14px]"
                  />
                  <p className="mt-4 text-[20px] font-normal text-foreground">Cachicamo</p>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    Open a folder, choose a model, then ask for a coding change.
                  </p>
                </div>
              ) : null}

              {messages.map((msg) => {
                if (msg.kind === "user") {
                  return (
                    <div
                      key={msg.id}
                      className="ml-auto max-w-[80%] rounded-[4px] bg-chat-user px-3 py-2 text-[13px] text-foreground"
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  );
                }
                if (msg.kind === "assistant") {
                  return (
                    <div key={msg.id} className="max-w-[90%] text-[13px] leading-6 text-foreground">
                      <Markdown content={msg.content} />
                    </div>
                  );
                }
                if (msg.kind === "error") {
                  return (
                    <div
                      key={msg.id}
                      className="rounded-[2px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
                    >
                      {msg.content}
                    </div>
                  );
                }
                if (msg.kind === "subagent") {
                  return (
                    <div
                      key={msg.id}
                      className="rounded-[2px] border border-border bg-card px-3 py-2 text-[12px]"
                    >
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        {msg.status === "running" ? (
                          <LoaderCircle className="size-3 animate-spin text-primary" />
                        ) : null}
                        <span className="text-primary">{msg.name}</span>
                        <span className="text-muted-foreground">{msg.status}</span>
                        {msg.status === "running" || msg.status === "queued" ? (
                          <button
                            type="button"
                            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => void onCancelWorker(msg.id)}
                          >
                            Stop
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 text-muted-foreground">{msg.task}</p>
                      {msg.status === "running" && msg.liveText ? (
                        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap border-t border-border pt-2 font-mono text-[11px] opacity-80">
                          {msg.liveText}
                        </pre>
                      ) : null}
                      {msg.summary ? (
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap border-t border-border pt-2 font-mono text-[11px]">
                          {msg.summary}
                        </pre>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "rounded-[2px] border px-3 py-2 font-mono text-[11px]",
                      msg.call.status === "error"
                        ? "border-destructive/40 text-destructive"
                        : "border-border bg-card text-muted-foreground",
                      msg.call.parentId ? "ml-4" : ""
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {msg.call.status === "running" ? (
                        <LoaderCircle className="size-3 animate-spin text-primary" />
                      ) : null}
                      <span className="text-foreground">{msg.call.name}</span>
                      <span>{msg.call.status}</span>
                    </div>
                    <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap opacity-80">
                      {JSON.stringify(msg.call.args, null, 2)}
                    </pre>
                    {msg.call.result ? (
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap border-t border-border pt-2">
                        {msg.call.result}
                      </pre>
                    ) : null}
                    {msg.call.error ? (
                      <p className="mt-2 border-t border-destructive/30 pt-2">{msg.call.error}</p>
                    ) : null}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border bg-background px-4 py-3">
            <div className="mx-auto flex max-w-[860px] flex-col gap-2">
              {running || runningWorkers.length > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {running
                    ? "Coordinator is running. Sending starts a new turn; background workers keep going."
                    : `${runningWorkers.length} background worker${runningWorkers.length === 1 ? "" : "s"} running. You can keep chatting.`}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask Cachicamo to edit code… (Enter to send, Shift+Enter for newline)"
                  className="min-h-[68px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                />
                <Button
                  className="self-end"
                  onClick={() => void onSend()}
                  disabled={!draft.trim()}
                >
                  {running ? <LoaderCircle className="animate-spin" /> : "Send"}
                </Button>
              </div>
            </div>
          </div>
            </>
          )}
        </main>
      </div>

      {/* Status bar */}
      <footer className="flex h-6 shrink-0 items-center justify-between bg-statusbar text-[12px] text-muted-foreground">
        <div className="flex h-full items-center">
          <div className="flex h-full items-center bg-primary px-2.5 text-primary-foreground">
            {cloud ? "Cloud" : "Local"}
          </div>
          <div className="px-2">{settings.model}</div>
          <div className="px-2">{shortPath(settings.workspacePath)}</div>
        </div>
        <div className="flex items-center gap-3 px-2">
          <span>
            Rules {rules.length} · Skills {skills.length} · MCP{" "}
            {settings.mcpServers.filter((s) => s.enabled).length}
          </span>
          <span>
            {running
              ? "Coordinator: running"
              : runningWorkers.length + queuedWorkers.length > 0
                ? `Coordinator: ready · ${runningWorkers.length} running${
                    queuedWorkers.length > 0 ? ` · ${queuedWorkers.length} queued` : ""
                  }`
                : "Coordinator: ready"}
          </span>
          {debugMode ? <span className="text-destructive">Debug</span> : null}
          {apiStatus?.enabled ? <span>API :{settings.apiPort}</span> : null}
        </div>
      </footer>
    </div>
  );
}
