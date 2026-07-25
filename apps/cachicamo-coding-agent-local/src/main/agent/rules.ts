import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { RuleInfo } from "../../shared/types.js";

const MAX_RULE_CHARS = 40_000;

function collectMarkdownFiles(dir: string, out: string[], depth = 0): void {
  if (depth > 4 || !existsSync(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(full, out, depth + 1);
    } else if (entry.isFile() && /\.(md|mdc|txt)$/i.test(entry.name)) {
      out.push(full);
    }
  }
}

export function listRules(workspacePath: string | null): RuleInfo[] {
  if (!workspacePath) return [];
  const rules: RuleInfo[] = [];
  const agentsMd = join(workspacePath, "AGENTS.md");
  if (existsSync(agentsMd) && statSync(agentsMd).isFile()) {
    rules.push({ name: "AGENTS.md", path: agentsMd });
  }
  const rulesDir = join(workspacePath, ".cachicamo", "rules");
  const files: string[] = [];
  collectMarkdownFiles(rulesDir, files);
  for (const file of files.sort()) {
    rules.push({ name: basename(file), path: file });
  }
  return rules;
}

export function loadRulesText(workspacePath: string | null): string {
  const rules = listRules(workspacePath);
  if (rules.length === 0) return "";

  const parts: string[] = [];
  let total = 0;
  for (const rule of rules) {
    try {
      const body = readFileSync(rule.path, "utf8").trim();
      if (!body) continue;
      const chunk = `### ${rule.name}\n${body}`;
      if (total + chunk.length > MAX_RULE_CHARS) {
        parts.push(`### ${rule.name}\n(truncated — rule budget reached)`);
        break;
      }
      parts.push(chunk);
      total += chunk.length;
    } catch {
      // skip unreadable
    }
  }
  return parts.join("\n\n");
}
