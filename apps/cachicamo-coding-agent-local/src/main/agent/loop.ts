import { randomUUID } from "node:crypto";
import type { Message, Ollama, Tool, ToolCall } from "ollama";
import type {
  AgentSettings,
  AgentStreamEvent,
  SubagentType,
  ToolCallEvent
} from "../../shared/types.js";
import { asSubagentRunMode } from "../../shared/types.js";
import { callMcpTool, openMcpSession, type McpSession } from "./mcp.js";
import {
  workerDigestText,
  type WorkerCoordinator,
  type WorkerRunFn
} from "./multitask.js";
import { createOllamaClient } from "./ollamaClient.js";
import { loadRulesText } from "./rules.js";
import { loadSkill, skillsCatalogText } from "./skills.js";
import {
  AGENT_TOOLS,
  COORDINATOR_TOOL_NAMES,
  executeTool,
  localToolNames,
  toolsForSubagent
} from "./tools.js";

const BASE_SYSTEM_PROMPT = `You are Cachicamo Coding Agent Local, a careful coding assistant running inside a desktop app.

Core rules:
- The user's workspace folder is your sandbox. Prefer relative paths.
- Use tools to inspect and change code. Do not invent file contents.
- Make focused edits. Prefer edit_file over rewriting whole files when possible.
- After tools succeed, briefly summarize what you did and what remains.
- If a command fails, diagnose from the output before retrying.
- Never exfiltrate secrets. Do not commit unless asked.
- When a listed skill matches the task, call load_skill before improvising.
- Use spawn_subagent for specialized subtasks (explore/shell/general). It starts a background worker and returns immediately unless wait=true.
- Workers run in parallel by default (several at once). Pass mode="series" or honor the user's series setting to queue them one after another.
- After spawning one or more workers, keep coordinating or call await_subagents to collect their summaries.
- The user can keep chatting while workers run. Finished worker results may appear at the start of a later turn.
- MCP tools are prefixed mcp__<server>__<tool>.`;

export type RunAgentInput = {
  settings: AgentSettings;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  onEvent: (event: AgentStreamEvent) => void;
  signal?: AbortSignal;
  depth?: number;
  toolsOverride?: Tool[];
  allowSubagents?: boolean;
  parentId?: string;
  systemSuffix?: string;
  mcpSession?: McpSession | null;
  coordinator?: WorkerCoordinator;
};

function parseArgs(raw: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}

function asSubagentType(value: unknown): SubagentType {
  if (value === "explore" || value === "shell" || value === "general") {
    return value;
  }
  throw new Error(`Invalid subagent type: ${String(value)}. Use explore | shell | general.`);
}

function emitText(
  onEvent: (event: AgentStreamEvent) => void,
  text: string,
  parentId: string | undefined
): void {
  if (parentId === undefined) {
    onEvent({ type: "text", text });
    return;
  }
  onEvent({ type: "text", text, parentId });
}

function emitError(
  onEvent: (event: AgentStreamEvent) => void,
  message: string,
  parentId: string | undefined
): void {
  if (parentId === undefined) {
    onEvent({ type: "error", message });
    return;
  }
  onEvent({ type: "error", message, parentId });
}

function toolCallEvent(
  base: Omit<ToolCallEvent, "parentId">,
  parentId: string | undefined
): ToolCallEvent {
  if (parentId === undefined) {
    return base;
  }
  return { ...base, parentId };
}

function buildSystemPrompt(settings: AgentSettings, suffix?: string): string {
  const parts = [BASE_SYSTEM_PROMPT];

  if (settings.rulesEnabled) {
    const rules = loadRulesText(settings.workspacePath);
    if (rules) {
      parts.push(`# Workspace rules\n${rules}`);
    }
  }

  if (settings.skillsEnabled) {
    parts.push(`# Available skills\n${skillsCatalogText(settings.workspacePath)}`);
  }

  if (settings.maxSubagentDepth > 0) {
    parts.push(
      settings.subagentRunMode === "series"
        ? "# Multitask\nWorkers run in series: only one at a time. Later spawn_subagent calls wait in queue."
        : "# Multitask\nWorkers run in parallel: several can run at once. Pass mode=series when a later worker depends on an earlier result."
    );
  }

  if (suffix?.trim()) {
    parts.push(suffix.trim());
  }

  return parts.join("\n\n");
}

/** Stream one Ollama chat turn, emitting text deltas as they arrive. */
async function streamChatTurn(params: {
  client: Ollama;
  model: string;
  messages: Message[];
  tools: Tool[];
  onEvent: (event: AgentStreamEvent) => void;
  parentId: string | undefined;
  signal?: AbortSignal;
}): Promise<Message> {
  const { client, model, messages, tools, onEvent, parentId, signal } = params;
  const stream = await client.chat({
    model,
    messages,
    tools,
    stream: true
  });

  let content = "";
  let thinking = "";
  let toolCalls: ToolCall[] | undefined;
  let role = "assistant";

  try {
    for await (const chunk of stream) {
      if (signal?.aborted) {
        stream.abort();
        throw new Error("Cancelled.");
      }

      const part = chunk.message;
      if (part.role) role = part.role;

      if (part.content) {
        content += part.content;
        emitText(onEvent, part.content, parentId);
      }

      if (part.thinking) {
        thinking += part.thinking;
      }

      if (part.tool_calls?.length) {
        toolCalls = part.tool_calls;
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      throw new Error("Cancelled.");
    }
    throw error;
  }

  const message: Message = { role, content };
  if (thinking) message.thinking = thinking;
  if (toolCalls?.length) message.tool_calls = toolCalls;
  return message;
}

function asBool(value: unknown): boolean {
  return value === true || value === "true";
}

function asStringArray(value: unknown): string[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return value.trim() ? [value.trim()] : undefined;
    }
  }
  return undefined;
}

/** Run a child agent loop. Lifecycle events are owned by WorkerCoordinator. */
export async function executeSubagentWork(params: {
  id: string;
  settings: AgentSettings;
  type: SubagentType;
  task: string;
  depth: number;
  onEvent: (event: AgentStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { id, settings, type, task, depth, onEvent } = params;

  let summary = "";
  let mcpSession: McpSession | null = null;
  let ownsMcpSession = false;

  if (type === "general" && settings.mcpServers.some((server) => server.enabled)) {
    mcpSession = await openMcpSession(settings.mcpServers);
    ownsMcpSession = true;
  }

  const childTools = toolsForSubagent(type);
  const tools =
    type === "general" && mcpSession ? [...childTools, ...mcpSession.ollamaTools] : childTools;

  const childInput: RunAgentInput = {
    settings: {
      ...settings,
      maxToolRounds: Math.min(settings.maxToolRounds, 8)
    },
    history: [],
    userMessage: task,
    depth: depth + 1,
    allowSubagents: false,
    toolsOverride: tools,
    parentId: id,
    mcpSession,
    systemSuffix: `You are a ${type} subagent. Complete the task, then reply with a concise summary of findings/actions. Do not spawn further subagents.`,
    onEvent: (event) => {
      if (event.type === "text") {
        summary += event.text;
        onEvent({ type: "text", text: event.text, parentId: id });
        return;
      }
      if (event.type === "tool_start" || event.type === "tool_end") {
        onEvent({
          ...event,
          call: { ...event.call, parentId: id }
        });
        return;
      }
      if (event.type === "error") {
        onEvent({ type: "error", message: event.message, parentId: id });
      }
    }
  };
  if (params.signal) {
    childInput.signal = params.signal;
  }

  try {
    await runAgent(childInput);
    return summary.trim() || "(subagent finished with no text)";
  } finally {
    if (ownsMcpSession && mcpSession) {
      await mcpSession.close();
    }
  }
}

export function createSubagentRunner(params: {
  settings: AgentSettings;
  depth: number;
}): WorkerRunFn {
  return ({ id, type, task, signal, onEvent }) =>
    executeSubagentWork({
      id,
      settings: params.settings,
      type,
      task,
      depth: params.depth,
      onEvent,
      signal
    });
}

export async function runAgent(input: RunAgentInput): Promise<void> {
  const {
    settings,
    history,
    userMessage,
    onEvent,
    signal,
    depth = 0,
    toolsOverride,
    allowSubagents = depth === 0 && settings.maxSubagentDepth > 0,
    parentId,
    systemSuffix,
    mcpSession: mcpSessionInput,
    coordinator
  } = input;

  if (!settings.workspacePath) {
    emitError(onEvent, "Open a workspace folder before chatting.", parentId);
    if (depth === 0) onEvent({ type: "done" });
    return;
  }

  if (!settings.model.trim()) {
    emitError(onEvent, "Choose a model in settings.", parentId);
    if (depth === 0) onEvent({ type: "done" });
    return;
  }

  const client = createOllamaClient(settings);
  let mcpSession: McpSession | null = mcpSessionInput ?? null;
  let ownsMcpSession = false;

  if (depth === 0 && !mcpSession && settings.mcpServers.some((s) => s.enabled)) {
    mcpSession = await openMcpSession(settings.mcpServers);
    ownsMcpSession = true;
  }

  const builtinTools = (toolsOverride ?? AGENT_TOOLS).filter((tool) => {
    const name = tool.function.name;
    if (!name) return false;
    if (allowSubagents) return true;
    return !COORDINATOR_TOOL_NAMES.has(name);
  });

  const tools: Tool[] =
    depth === 0 && mcpSession
      ? [...builtinTools, ...mcpSession.ollamaTools]
      : builtinTools;

  const knownLocal = localToolNames();
  const messages: Message[] = [
    { role: "system", content: buildSystemPrompt(settings, systemSuffix) },
    ...history.map((m) => ({ role: m.role, content: m.content }))
  ];

  if (depth === 0 && coordinator) {
    const finished = coordinator.unconsumedFinished();
    if (finished.length > 0) {
      messages.push({
        role: "system",
        content: `Finished background workers since your last turn:\n\n${workerDigestText(finished)}\n\nSynthesize these results for the user when relevant. Do not repeat the same work.`
      });
      coordinator.markConsumed(finished.map((worker) => worker.id));
    }
  }

  messages.push({ role: "user", content: userMessage });

  const skillHelpers = {
    listSkillsText: () => skillsCatalogText(settings.workspacePath),
    loadSkillText: (name: string) => loadSkill(settings.workspacePath, name)
  };

  try {
    for (let round = 0; round < settings.maxToolRounds; round++) {
      if (signal?.aborted) {
        emitError(onEvent, "Cancelled.", parentId);
        if (depth === 0) onEvent({ type: "done" });
        return;
      }

      const chatParams: Parameters<typeof streamChatTurn>[0] = {
        client,
        model: settings.model,
        messages,
        tools,
        onEvent,
        parentId
      };
      if (signal) chatParams.signal = signal;
      const message = await streamChatTurn(chatParams);
      messages.push(message);

      const toolCalls = message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        if (depth === 0) onEvent({ type: "done" });
        return;
      }

      for (const call of toolCalls) {
        if (signal?.aborted) {
          emitError(onEvent, "Cancelled.", parentId);
          if (depth === 0) onEvent({ type: "done" });
          return;
        }

        const name = call.function.name;
        const args = parseArgs(call.function.arguments as string | Record<string, unknown>);
        const id = randomUUID();
        const start = toolCallEvent(
          {
            id,
            name,
            args,
            status: "running"
          },
          parentId
        );
        onEvent({ type: "tool_start", call: start });

        try {
          let result: string;

          if (name === "spawn_subagent") {
            if (!allowSubagents || depth >= settings.maxSubagentDepth) {
              throw new Error("Subagents are not allowed at this depth.");
            }
            if (!coordinator) {
              throw new Error("Multitask coordinator is not available.");
            }
            const type = asSubagentType(args.type);
            const task = typeof args.task === "string" ? args.task : "";
            if (!task.trim()) throw new Error("spawn_subagent requires task");
            const spawned = await coordinator.spawn({
              type,
              task,
              wait: asBool(args.wait),
              mode: args.mode == null ? settings.subagentRunMode : asSubagentRunMode(args.mode),
              run: createSubagentRunner({ settings, depth })
            });
            result = spawned.message;
          } else if (name === "await_subagents") {
            if (!allowSubagents || !coordinator) {
              throw new Error("await_subagents is only available on the coordinator turn.");
            }
            result = await coordinator.awaitWorkers(asStringArray(args.ids));
          } else if (name.startsWith("mcp__")) {
            if (!mcpSession) throw new Error("No MCP session available");
            result = await callMcpTool(mcpSession, name, args);
          } else if (knownLocal.has(name)) {
            if (!settings.skillsEnabled && (name === "list_skills" || name === "load_skill")) {
              throw new Error("Skills are disabled in settings.");
            }
            result = await executeTool(settings.workspacePath, name, args, skillHelpers);
          } else {
            throw new Error(`Unknown tool: ${name}`);
          }

          onEvent({
            type: "tool_end",
            call: { ...start, status: "done", result }
          });
          messages.push({
            role: "tool",
            content: result,
            tool_name: name
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          onEvent({
            type: "tool_end",
            call: { ...start, status: "error", error: errMsg }
          });
          messages.push({
            role: "tool",
            content: `Error: ${errMsg}`,
            tool_name: name
          });
        }
      }
    }

    emitError(
      onEvent,
      `Stopped after ${settings.maxToolRounds} tool rounds. Ask me to continue if needed.`,
      parentId
    );
    if (depth === 0) onEvent({ type: "done" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitError(onEvent, message, parentId);
    if (depth === 0) onEvent({ type: "done" });
  } finally {
    if (ownsMcpSession && mcpSession) {
      await mcpSession.close();
    }
  }
}
