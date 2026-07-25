import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SkillInfo } from "../../shared/types.js";

const MAX_SKILL_CHARS = 30_000;

type ParsedSkill = SkillInfo & { body: string };

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) {
    return { meta: {}, body: raw };
  }
  const end = raw.indexOf("\n---", 3);
  if (end < 0) {
    return { meta: {}, body: raw };
  }
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\s*\n/, "");
  const meta: Record<string, string> = {};
  for (const line of fm.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) meta[key] = value;
  }
  return { meta, body };
}

function loadSkillFile(path: string, fallbackName: string): ParsedSkill | null {
  try {
    if (!existsSync(path) || !statSync(path).isFile()) return null;
    const raw = readFileSync(path, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const name = meta.name?.trim() || fallbackName;
    const description =
      meta.description?.trim() || body.split("\n").find((l) => l.trim())?.trim() || name;
    return { name, description, path, body };
  } catch {
    return null;
  }
}

function skillDirs(workspacePath: string | null): string[] {
  const dirs: string[] = [];
  if (workspacePath) {
    dirs.push(join(workspacePath, ".cachicamo", "skills"));
  }
  return dirs;
}

export function listSkills(workspacePath: string | null): SkillInfo[] {
  const skills: ParsedSkill[] = [];
  const seen = new Set<string>();

  for (const root of skillDirs(workspacePath)) {
    if (!existsSync(root)) continue;
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(root, entry.name, "SKILL.md");
      const skill = loadSkillFile(skillPath, entry.name);
      if (!skill || seen.has(skill.name)) continue;
      seen.add(skill.name);
      skills.push(skill);
    }
  }

  return skills.map(({ name, description, path }) => ({ name, description, path }));
}

export function loadSkill(workspacePath: string | null, name: string): string {
  const skills = listSkills(workspacePath);
  const match = skills.find((s) => s.name === name || s.name.toLowerCase() === name.toLowerCase());
  if (!match) {
    const available = skills.map((s) => s.name).join(", ") || "(none)";
    throw new Error(`Skill not found: ${name}. Available: ${available}`);
  }
  const parsed = loadSkillFile(match.path, match.name);
  if (!parsed) throw new Error(`Failed to read skill: ${name}`);
  const text = `# Skill: ${parsed.name}\n\n${parsed.description}\n\n${parsed.body}`.trim();
  if (text.length > MAX_SKILL_CHARS) {
    return `${text.slice(0, MAX_SKILL_CHARS)}\n\n(truncated)`;
  }
  return text;
}

export function skillsCatalogText(workspacePath: string | null): string {
  const skills = listSkills(workspacePath);
  if (skills.length === 0) {
    return "No skills installed. Add `.cachicamo/skills/<name>/SKILL.md` in the workspace.";
  }
  return skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
}
