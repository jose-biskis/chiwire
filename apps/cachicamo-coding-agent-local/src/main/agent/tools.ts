import { execFile } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  existsSync
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import type { Tool } from "ollama";

const execFileAsync = promisify(execFile);

const MAX_READ_BYTES = 200_000;
const MAX_CMD_OUTPUT = 80_000;

export const AGENT_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List files and directories under a path relative to the workspace.",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "Relative directory path. Use '.' for workspace root."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file from the workspace.",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "Relative file path."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a UTF-8 text file in the workspace.",
      parameters: {
        type: "object",
        required: ["path", "content"],
        properties: {
          path: { type: "string", description: "Relative file path." },
          content: { type: "string", description: "Full file contents." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description:
        "Replace an exact string occurrence in a file. Fails if old_string is not found uniquely.",
      parameters: {
        type: "object",
        required: ["path", "old_string", "new_string"],
        properties: {
          path: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "Search for a regex pattern in workspace text files.",
      parameters: {
        type: "object",
        required: ["pattern"],
        properties: {
          pattern: { type: "string", description: "JavaScript regex source." },
          path: {
            type: "string",
            description: "Optional relative directory or file to search. Defaults to '.'."
          },
          max_matches: {
            type: "number",
            description: "Maximum matches to return (default 50)."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Run a shell command in the workspace. Prefer non-interactive commands. Do not use for long-running servers.",
      parameters: {
        type: "object",
        required: ["command"],
        properties: {
          command: {
            type: "string",
            description: "Command string executed via `bash -lc`."
          },
          timeout_ms: {
            type: "number",
            description: "Timeout in milliseconds (default 60000)."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_skills",
      description: "List available Cachicamo skills in the workspace.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "load_skill",
      description:
        "Load a skill's full instructions into context. Use when a skill matches the user's task.",
      parameters: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Skill name from list_skills." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "spawn_subagent",
      description:
        "Delegate a focused subtask to a subagent. explore=read-only, shell=commands+read, general=full edit tools (no nested subagents).",
      parameters: {
        type: "object",
        required: ["type", "task"],
        properties: {
          type: {
            type: "string",
            description: "explore | shell | general"
          },
          task: {
            type: "string",
            description: "Clear instructions for the subagent."
          }
        }
      }
    }
  }
];

const READ_TOOL_NAMES = new Set([
  "list_dir",
  "read_file",
  "grep",
  "list_skills",
  "load_skill"
]);

const SHELL_TOOL_NAMES = new Set([...READ_TOOL_NAMES, "run_command"]);

function toolName(tool: Tool): string {
  const name = tool.function.name;
  if (!name) {
    throw new Error("Tool is missing function.name");
  }
  return name;
}

export function toolsForSubagent(type: "explore" | "shell" | "general"): Tool[] {
  if (type === "explore") {
    return AGENT_TOOLS.filter((t) => READ_TOOL_NAMES.has(toolName(t)));
  }
  if (type === "shell") {
    return AGENT_TOOLS.filter((t) => SHELL_TOOL_NAMES.has(toolName(t)));
  }
  return AGENT_TOOLS.filter((t) => toolName(t) !== "spawn_subagent");
}

export function localToolNames(): Set<string> {
  return new Set(AGENT_TOOLS.map((t) => toolName(t)));
}

function assertInsideWorkspace(workspace: string, target: string): string {
  const root = resolve(workspace);
  const abs = resolve(root, target);
  const rel = relative(root, abs);
  if (rel.startsWith("..") || rel.startsWith(`..${sep}`) || resolve(abs) === resolve(join(root, ".."))) {
    throw new Error(`Path escapes workspace: ${target}`);
  }
  if (!abs.startsWith(root + sep) && abs !== root) {
    throw new Error(`Path escapes workspace: ${target}`);
  }
  return abs;
}

function asString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`Missing or invalid string argument: ${name}`);
  }
  return value;
}

function walkFiles(dir: string, root: string, out: string[], depth = 0): void {
  if (depth > 8 || out.length > 500) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "out") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, root, out, depth + 1);
    } else if (entry.isFile()) {
      out.push(relative(root, full));
    }
  }
}

export async function executeTool(
  workspace: string,
  name: string,
  args: Record<string, unknown>,
  helpers?: {
    listSkillsText?: () => string;
    loadSkillText?: (skillName: string) => string;
  }
): Promise<string> {
  switch (name) {
    case "list_skills": {
      return helpers?.listSkillsText?.() ?? "Skills unavailable in this context.";
    }
    case "load_skill": {
      const skillName = asString(args.name, "name");
      if (!helpers?.loadSkillText) {
        throw new Error("Skills unavailable in this context.");
      }
      return helpers.loadSkillText(skillName);
    }
    case "list_dir": {
      const rel = asString(args.path ?? ".", "path");
      const abs = assertInsideWorkspace(workspace, rel);
      if (!existsSync(abs)) {
        throw new Error(`Directory not found: ${rel}`);
      }
      const entries = readdirSync(abs, { withFileTypes: true }).map((entry) => {
        const kind = entry.isDirectory() ? "dir" : "file";
        return `${kind}\t${entry.name}`;
      });
      return entries.join("\n") || "(empty)";
    }
    case "read_file": {
      const rel = asString(args.path, "path");
      const abs = assertInsideWorkspace(workspace, rel);
      const stat = statSync(abs);
      if (!stat.isFile()) {
        throw new Error(`Not a file: ${rel}`);
      }
      if (stat.size > MAX_READ_BYTES) {
        throw new Error(`File too large (${stat.size} bytes). Max ${MAX_READ_BYTES}.`);
      }
      return readFileSync(abs, "utf8");
    }
    case "write_file": {
      const rel = asString(args.path, "path");
      const content = asString(args.content, "content");
      const abs = assertInsideWorkspace(workspace, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
      return `Wrote ${content.length} characters to ${rel}`;
    }
    case "edit_file": {
      const rel = asString(args.path, "path");
      const oldString = asString(args.old_string, "old_string");
      const newString = asString(args.new_string, "new_string");
      const abs = assertInsideWorkspace(workspace, rel);
      const current = readFileSync(abs, "utf8");
      const count = current.split(oldString).length - 1;
      if (count === 0) {
        throw new Error("old_string not found in file");
      }
      if (count > 1) {
        throw new Error(`old_string matched ${count} times; make it unique`);
      }
      writeFileSync(abs, current.replace(oldString, newString), "utf8");
      return `Edited ${rel}`;
    }
    case "grep": {
      const pattern = asString(args.pattern, "pattern");
      const rel = typeof args.path === "string" ? args.path : ".";
      const maxMatches = typeof args.max_matches === "number" ? args.max_matches : 50;
      const abs = assertInsideWorkspace(workspace, rel);
      const regex = new RegExp(pattern, "m");
      const files: string[] = [];
      const st = statSync(abs);
      if (st.isFile()) {
        files.push(relative(workspace, abs));
      } else {
        walkFiles(abs, workspace, files);
      }
      const hits: string[] = [];
      for (const file of files) {
        if (hits.length >= maxMatches) break;
        let text: string;
        try {
          const full = join(workspace, file);
          if (statSync(full).size > MAX_READ_BYTES) continue;
          text = readFileSync(full, "utf8");
        } catch {
          continue;
        }
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? "";
          if (regex.test(line)) {
            hits.push(`${file}:${i + 1}:${line}`);
            if (hits.length >= maxMatches) break;
          }
        }
      }
      return hits.length ? hits.join("\n") : "No matches";
    }
    case "run_command": {
      const command = asString(args.command, "command");
      const timeout =
        typeof args.timeout_ms === "number" && args.timeout_ms > 0 ? args.timeout_ms : 60_000;
      try {
        const { stdout, stderr } = await execFileAsync("bash", ["-lc", command], {
          cwd: workspace,
          timeout,
          maxBuffer: MAX_CMD_OUTPUT,
          env: process.env
        });
        const out = [stdout, stderr].filter(Boolean).join("\n").trim();
        return out || "(no output)";
      } catch (error) {
        const err = error as {
          stdout?: string;
          stderr?: string;
          message?: string;
          code?: number | string;
        };
        const out = [err.stdout, err.stderr, err.message].filter(Boolean).join("\n").trim();
        return `Command failed (code ${String(err.code ?? "?")}):\n${out}`;
      }
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
