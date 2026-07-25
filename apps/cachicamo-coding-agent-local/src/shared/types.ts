export type OllamaMode = "local" | "cloud";

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

export type AgentSettings = {
  mode: OllamaMode;
  localHost: string;
  cloudHost: string;
  apiKey: string;
  model: string;
  workspacePath: string | null;
  maxToolRounds: number;
  maxSubagentDepth: number;
  rulesEnabled: boolean;
  skillsEnabled: boolean;
  mcpServers: McpServerConfig[];
  /** Local HTTP API for n8n / external callers (bind 127.0.0.1) */
  apiEnabled: boolean;
  apiPort: number;
  apiToken: string;
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
  | { type: "subagent_end"; id: string; summary: string }
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
  rulesEnabled: true,
  skillsEnabled: true,
  mcpServers: [],
  apiEnabled: true,
  apiPort: 3847,
  apiToken: ""
};

export type CachicamoAgentApi = {
  getSettings: () => Promise<AgentSettings>;
  setSettings: (settings: AgentSettings) => Promise<AgentSettings>;
  pickWorkspace: () => Promise<string | null>;
  listModels: () => Promise<ModelInfo[]>;
  listRules: () => Promise<RuleInfo[]>;
  listSkills: () => Promise<SkillInfo[]>;
  getApiStatus: () => Promise<{ enabled: boolean; url: string; tokenSet: boolean }>;
  runAgent: (payload: {
    userMessage: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  }) => Promise<void>;
  cancelAgent: () => Promise<void>;
  onAgentEvent: (handler: (event: AgentStreamEvent) => void) => () => void;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  getPlatform: () => Promise<string>;
};
