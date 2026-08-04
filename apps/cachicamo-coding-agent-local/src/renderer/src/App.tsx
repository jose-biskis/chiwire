import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Blocks,
  Bot,
  FolderOpen,
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
  ToolCallEvent,
  UiArchetype,
  UiColorMode
} from "../../shared/types";
import { TitleBar } from "@/components/TitleBar";
import { Markdown } from "@/components/Markdown";
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
      status: "running" | "done";
    };

type SidebarTab = "chat" | "agent" | "mcp" | "api";

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
  const [mcpDraft, setMcpDraft] = useState({ name: "trello", url: "http://localhost:3000/trello" });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void window.cachicamoAgent.getSettings().then((loaded: AgentSettings) => {
      applyUiAppearance(loaded.uiArchetype, loaded.uiColorMode);
      setSettings(loaded);
    });
  }, []);

  useEffect(() => {
    if (!settings) return;
    applyUiAppearance(settings.uiArchetype, settings.uiColorMode);
  }, [settings?.uiArchetype, settings?.uiColorMode]);

  useEffect(() => {
    const unsubscribe = window.cachicamoAgent.onAgentEvent((event: AgentStreamEvent) => {
      if (event.type === "text" && !event.parentId) {
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
              ? { ...msg, status: "done", summary: event.summary }
              : msg
          )
        );
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

  async function persist(next: AgentSettings): Promise<void> {
    const saved = await window.cachicamoAgent.setSettings(next);
    setSettings(saved);
    setApiStatus(await window.cachicamoAgent.getApiStatus());
  }

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
    if (!path || !settings) return;
    setSettings({ ...settings, workspacePath: path });
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
    await persist({ ...settings, mcpServers: [...settings.mcpServers, server] });
  }

  async function onSend(): Promise<void> {
    const text = draft.trim();
    if (!text || running || !settings) return;
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

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center bg-card text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin text-primary" />
        Loading…
      </div>
    );
  }

  const cloud = settings.mode === "cloud";
  const activityItems: Array<{ id: SidebarTab; icon: typeof Bot; label: string }> = [
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "agent", icon: Bot, label: "Agent" },
    { id: "mcp", icon: Blocks, label: "MCP" },
    { id: "api", icon: Plug, label: "API" }
  ];

  return (
    <div className="flex h-full flex-col bg-card text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]">
      <TitleBar
        onOpenFolder={() => void onPickWorkspace()}
        onToggleSidebar={() => setSidebarVisible((value) => !value)}
        uiArchetype={settings.uiArchetype}
        uiColorMode={settings.uiColorMode}
        onUiArchetype={(uiArchetype) => void persist({ ...settings, uiArchetype })}
        onUiColorMode={(uiColorMode) => void persist({ ...settings, uiColorMode })}
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
                onClick={() => setSidebarTab(item.id)}
                className={cn(
                  "relative flex size-12 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground"
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-foreground" />
                ) : null}
                <Icon className="size-6 stroke-[1.5]" />
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
                : sidebarTab === "mcp"
                  ? "MCP"
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
                    onChange={(e) => void persist({ ...settings, model: e.target.value })}
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
                      onCheckedChange={(checked) =>
                        void persist({ ...settings, mode: checked ? "cloud" : "local" })
                      }
                    />
                  </div>
                  <FieldLabel>Host</FieldLabel>
                  <Input
                    value={cloud ? settings.cloudHost : settings.localHost}
                    onChange={(e) =>
                      void persist(
                        cloud
                          ? { ...settings, cloudHost: e.target.value }
                          : { ...settings, localHost: e.target.value }
                      )
                    }
                  />
                  {cloud ? (
                    <>
                      <FieldLabel>API key</FieldLabel>
                      <Input
                        type="password"
                        value={settings.apiKey}
                        onChange={(e) => void persist({ ...settings, apiKey: e.target.value })}
                      />
                    </>
                  ) : null}
                </section>

                <section className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]">Rules</span>
                    <Switch
                      checked={settings.rulesEnabled}
                      onCheckedChange={(checked) =>
                        void persist({ ...settings, rulesEnabled: checked })
                      }
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{rules.length} loaded</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]">Skills</span>
                    <Switch
                      checked={settings.skillsEnabled}
                      onCheckedChange={(checked) =>
                        void persist({ ...settings, skillsEnabled: checked })
                      }
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
                            void persist({
                              ...settings,
                              mcpServers: settings.mcpServers.map((s) =>
                                s.id === server.id ? { ...s, enabled: checked } : s
                              )
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() =>
                            void persist({
                              ...settings,
                              mcpServers: settings.mcpServers.filter((s) => s.id !== server.id)
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
                    onCheckedChange={(checked) => void persist({ ...settings, apiEnabled: checked })}
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
                    void persist({
                      ...settings,
                      apiPort: Number.parseInt(e.target.value, 10) || 3847
                    })
                  }
                />
                <FieldLabel>Bearer token</FieldLabel>
                <Input
                  type="password"
                  value={settings.apiToken}
                  onChange={(e) => void persist({ ...settings, apiToken: e.target.value })}
                />
              </div>
            ) : null}
          </ScrollArea>
        </aside>
        ) : null}

        {/* Editor / chat */}
        <main className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="flex h-9 items-stretch border-b border-border bg-card">
            <div className="flex items-center gap-2 border-r border-border bg-background px-3 text-[13px] text-foreground">
              <MessageSquare className="size-3.5 text-muted-foreground" />
              Chat
              {running ? <span className="text-[11px] text-primary">●</span> : null}
            </div>
            <div className="flex flex-1 items-center justify-end gap-2 px-3">
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
                      </div>
                      <p className="mt-1 text-muted-foreground">{msg.task}</p>
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
            <div className="mx-auto flex max-w-[860px] gap-2">
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
                disabled={running}
              />
              <Button
                className="self-end"
                onClick={() => void onSend()}
                disabled={running || !draft.trim()}
              >
                {running ? <LoaderCircle className="animate-spin" /> : "Send"}
              </Button>
            </div>
          </div>
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
          <span>{running ? "Agent: running" : "Agent: ready"}</span>
          {apiStatus?.enabled ? <span>API :{settings.apiPort}</span> : null}
        </div>
      </footer>
    </div>
  );
}
