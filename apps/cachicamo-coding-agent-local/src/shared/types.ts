export type OllamaMode = "local" | "cloud";

/** Mirrors `@chiwire/ui/base` — kept local so main-process tsc stays extension-free. */
export type UiArchetype = "internal" | "valenstonic";
export type UiColorMode = "light" | "dark";

export type McpServerConfig = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  /** Optional bearer token sent as Authorization header */
  bearerToken?: string;
  /** Extra headers (e.g. x-trello-api-key) */
  headers?: Record<string, string>;
};

export type SubagentType = "explore" | "shell" | "general";

/** How Multitask starts workers. Parallel is the default. */
export type SubagentRunMode = "parallel" | "series";

export type WorkerStatus = "queued" | "running" | "done" | "error" | "cancelled";

export function asSubagentRunMode(value: unknown): SubagentRunMode {
  return value === "series" ? "series" : "parallel";
}

export type SubagentWorkerSnapshot = {
  id: string;
  name: string;
  agentType: SubagentType;
  task: string;
  status: WorkerStatus;
  summary?: string;
  error?: string;
  progressText?: string;
  startedAt: number;
  endedAt?: number;
  consumed?: boolean;
};

export type DebugFixtureInfo = {
  id: string;
  title: string;
  description: string;
  feature: string;
};

export type DebugRunResult = {
  id: string;
  title: string;
  feature: string;
  passed: boolean;
  expected: string;
  actual: string;
  durationMs: number;
  error?: string;
};

export type AgentSettings = {
  mode: OllamaMode;
  localHost: string;
  cloudHost: string;
  apiKey: string;
  model: string;
  workspacePath: string | null;
  maxToolRounds: number;
  maxSubagentDepth: number;
  /** parallel = start together (default); series = one worker at a time */
  subagentRunMode: SubagentRunMode;
  rulesEnabled: boolean;
  skillsEnabled: boolean;
  mcpServers: McpServerConfig[];
  /** Local HTTP API for n8n / external callers (bind 127.0.0.1) */
  apiEnabled: boolean;
  apiPort: number;
  apiToken: string;
  /** UI appearance — View menu; persisted across launches */
  uiArchetype: UiArchetype;
  uiColorMode: UiColorMode;
  /** Windows only: run_command goes through wsl.exe */
  wslEnabled: boolean;
  /** Empty = default WSL distro (or inferred from \\\\wsl$\\Distro\\...) */
  wslDistro: string;
};

export type WslStatus = {
  platform: string;
  supported: boolean;
  available: boolean;
  insideWsl: boolean;
  distros: string[];
  defaultDistro: string | null;
  linuxWorkspace: string | null;
  error?: string;
};

export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  toolName?: string;
  toolCallId?: string;
  createdAt: number;
};

export type ToolCallEvent = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  status: "running" | "done" | "error";
  parentId?: string;
};

export type AgentStreamEvent =
  | { type: "text"; text: string; parentId?: string }
  | { type: "tool_start"; call: ToolCallEvent }
  | { type: "tool_end"; call: ToolCallEvent }
  | { type: "subagent_start"; id: string; name: string; agentType: SubagentType; task: string }
  | { type: "subagent_end"; id: string; summary: string; status: WorkerStatus }
  | { type: "workers_changed"; workers: SubagentWorkerSnapshot[] }
  | { type: "error"; message: string; parentId?: string }
  | { type: "done" };

export type ModelInfo = {
  name: string;
  size?: number;
  modifiedAt?: string;
};

export type SkillInfo = {
  name: string;
  description: string;
  path: string;
};

export type RuleInfo = {
  name: string;
  path: string;
};

export const DEFAULT_SETTINGS: AgentSettings = {
  mode: "local",
  localHost: "http://localhost:11434",
  cloudHost: "https://ollama.com",
  apiKey: "",
  model: "qwen2.5-coder:7b",
  workspacePath: null,
  maxToolRounds: 12,
  maxSubagentDepth: 1,
  subagentRunMode: "parallel",
  rulesEnabled: true,
  skillsEnabled: true,
  mcpServers: [],
  apiEnabled: true,
  apiPort: 3847,
  apiToken: "",
  uiArchetype: "internal",
  uiColorMode: "dark",
  wslEnabled: false,
  wslDistro: ""
};

export type CachicamoAgentApi = {
  getSettings: () => Promise<AgentSettings>;
  setSettings: (settings: AgentSettings) => Promise<AgentSettings>;
  pickWorkspace: () => Promise<string | null>;
  pickWslWorkspace: () => Promise<string | null>;
  getWslStatus: () => Promise<WslStatus>;
  listModels: () => Promise<ModelInfo[]>;
  listRules: () => Promise<RuleInfo[]>;
  listSkills: () => Promise<SkillInfo[]>;
  getApiStatus: () => Promise<{ enabled: boolean; url: string; tokenSet: boolean }>;
  runAgent: (payload: {
    userMessage: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  }) => Promise<void>;
  cancelAgent: () => Promise<void>;
  listWorkers: () => Promise<SubagentWorkerSnapshot[]>;
  cancelWorker: (id: string) => Promise<boolean>;
  cancelAllWorkers: () => Promise<void>;
  resumeWorker: (id: string, task: string) => Promise<{ id: string; message: string }>;
  listDebugFixtures: () => Promise<DebugFixtureInfo[]>;
  runDebugFixture: (id: string) => Promise<DebugRunResult>;
  runAllDebugFixtures: () => Promise<DebugRunResult[]>;
  onAgentEvent: (handler: (event: AgentStreamEvent) => void) => () => void;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  getPlatform: () => Promise<string>;
};
