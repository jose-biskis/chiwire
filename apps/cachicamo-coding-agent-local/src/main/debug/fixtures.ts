import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentStreamEvent, DebugFixtureInfo, DebugRunResult } from "../../shared/types.js";
import { WorkerCoordinator, type WorkerRunFn } from "../agent/multitask.js";
import { executeTool, toolNamesForSubagent } from "../agent/tools.js";
import { loadRulesText, listRules } from "../agent/rules.js";
import { loadSkill, skillsCatalogText } from "../agent/skills.js";
import {
  applyWorkspaceWslHints,
  decodeWslText,
  inferDistroFromWindowsPath,
  parseWslDistroList,
  resolveWslExecTarget,
  windowsPathToWslPath,
  wslCommandArgs
} from "../agent/wsl.js";
import { DEFAULT_SETTINGS } from "../../shared/types.js";

export type DebugFixture = DebugFixtureInfo & {
  expected: string;
  run: () => Promise<string>;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Cancelled."));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Cancelled."));
      },
      { once: true }
    );
  });
}

function delayedResult(ms: number, text: string): WorkerRunFn {
  return async ({ signal, onEvent }) => {
    onEvent({ type: "text", text: `${text}-start`, parentId: "x" });
    await sleep(ms, signal);
    onEvent({ type: "text", text: ` ${text}-end`, parentId: "x" });
    return `${text}-result`;
  };
}

function hangUntilCancel(): WorkerRunFn {
  return async ({ signal }) => {
    await sleep(8_000, signal);
    return "should-not-finish";
  };
}

function withTempWorkspace(setup: (root: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), "cachicamo-debug-"));
  setup(root);
  return root;
}

function cleanupWorkspace(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

export const DEBUG_FIXTURES: DebugFixture[] = [
  {
    id: "multitask-background-spawn",
    title: "Background spawn returns immediately",
    description:
      "spawn_subagent(wait=false) must return a running worker id before the worker finishes.",
    feature: "Multitask / sub-agents",
    expected: "immediate=true status=running hasId=true",
    run: async () => {
      const coordinator = new WorkerCoordinator({ emit: () => undefined });
      const spawned = await coordinator.spawn({
        type: "explore",
        task: "scan files",
        wait: false,
        run: delayedResult(120, "alpha")
      });
      const immediate = spawned.status === "running";
      await coordinator.awaitWorkers([spawned.id]);
      return `immediate=${String(immediate)} status=${spawned.status} hasId=${Boolean(spawned.id)}`;
    }
  },
  {
    id: "multitask-parallel-await",
    title: "Parallel workers then await",
    description: "Two independent workers start together; await_subagents collects both summaries.",
    feature: "Multitask / sub-agents",
    expected: ["alpha-result", "beta-result", "count=2"].join("\n"),
    run: async () => {
      const coordinator = new WorkerCoordinator({
        emit: () => undefined,
        runMode: "parallel"
      });
      const a = await coordinator.spawn({
        type: "explore",
        task: "A",
        wait: false,
        mode: "parallel",
        run: delayedResult(70, "alpha")
      });
      const b = await coordinator.spawn({
        type: "shell",
        task: "B",
        wait: false,
        mode: "parallel",
        run: delayedResult(70, "beta")
      });
      const running = coordinator.runningCount();
      const combined = await coordinator.awaitWorkers([a.id, b.id]);
      const lines = [
        combined.includes("alpha-result") ? "alpha-result" : "missing-alpha",
        combined.includes("beta-result") ? "beta-result" : "missing-beta",
        `count=${running}`
      ];
      return lines.join("\n");
    }
  },
  {
    id: "multitask-series-queue",
    title: "Series workers run one at a time",
    description:
      "With mode=series, the second worker is queued until the first finishes. Peak concurrency stays 1.",
    feature: "Multitask / sub-agents",
    expected: "second=queued peak=1 alpha-result beta-result",
    run: async () => {
      let concurrent = 0;
      let peak = 0;
      const tracked = (ms: number, text: string): WorkerRunFn => {
        return async ({ signal }) => {
          concurrent += 1;
          peak = Math.max(peak, concurrent);
          await sleep(ms, signal);
          concurrent -= 1;
          return `${text}-result`;
        };
      };
      const coordinator = new WorkerCoordinator({
        emit: () => undefined,
        runMode: "series"
      });
      const a = await coordinator.spawn({
        type: "explore",
        task: "A",
        wait: false,
        mode: "series",
        run: tracked(80, "alpha")
      });
      const b = await coordinator.spawn({
        type: "shell",
        task: "B",
        wait: false,
        mode: "series",
        run: tracked(80, "beta")
      });
      const second = coordinator.get(b.id)?.status ?? "missing";
      const combined = await coordinator.awaitWorkers([a.id, b.id]);
      const alpha = combined.includes("alpha-result") ? "alpha-result" : "missing-alpha";
      const beta = combined.includes("beta-result") ? "beta-result" : "missing-beta";
      return `second=${second} peak=${peak} ${alpha} ${beta}`;
    }
  },
  {
    id: "multitask-cancel",
    title: "Cancel a running worker",
    description: "cancel(id) aborts a hanging worker and marks it cancelled.",
    feature: "Multitask / sub-agents",
    expected: "status=cancelled",
    run: async () => {
      const coordinator = new WorkerCoordinator({ emit: () => undefined });
      const spawned = await coordinator.spawn({
        type: "general",
        task: "hang",
        wait: false,
        run: hangUntilCancel()
      });
      coordinator.cancel(spawned.id);
      await coordinator.awaitWorkers([spawned.id]);
      return `status=${coordinator.get(spawned.id)?.status ?? "missing"}`;
    }
  },
  {
    id: "multitask-events",
    title: "Coordinator emits start/end/snapshot",
    description: "Worker lifecycle publishes subagent_start, subagent_end, and workers_changed.",
    feature: "Multitask / sub-agents",
    expected: "start=1 end=1 changed>=2 status=done",
    run: async () => {
      const events: AgentStreamEvent[] = [];
      const coordinator = new WorkerCoordinator({ emit: (event) => events.push(event) });
      const spawned = await coordinator.spawn({
        type: "explore",
        task: "emit",
        wait: true,
        run: delayedResult(20, "gamma")
      });
      const start = events.filter((event) => event.type === "subagent_start").length;
      const end = events.filter((event) => event.type === "subagent_end").length;
      const changed = events.filter((event) => event.type === "workers_changed").length;
      return `start=${start} end=${end} changed>=${changed >= 2 ? 2 : changed} status=${spawned.status}`;
    }
  },
  {
    id: "subagent-explore-tools",
    title: "Explore worker is read-only",
    description: "explore sub-agents get list/read/grep/skills only — no writes, shell, or spawn.",
    feature: "Sub-agent tool masks",
    expected: "grep,list_dir,list_skills,load_skill,read_file",
    run: async () => toolNamesForSubagent("explore").join(",")
  },
  {
    id: "subagent-shell-tools",
    title: "Shell worker can run commands",
    description: "shell sub-agents add run_command but still cannot edit files or spawn workers.",
    feature: "Sub-agent tool masks",
    expected: "grep,list_dir,list_skills,load_skill,read_file,run_command",
    run: async () => toolNamesForSubagent("shell").join(",")
  },
  {
    id: "subagent-general-no-nest",
    title: "General worker cannot nest",
    description: "general sub-agents get edit tools but not spawn_subagent / await_subagents.",
    feature: "Sub-agent tool masks",
    expected: "edit_file,grep,list_dir,list_skills,load_skill,read_file,run_command,write_file",
    run: async () => toolNamesForSubagent("general").join(",")
  },
  {
    id: "sandbox-path-escape",
    title: "Workspace sandbox rejects escapes",
    description: "read_file must refuse paths that walk above the workspace root.",
    feature: "Workspace tools",
    expected: "escaped=true",
    run: async () => {
      const root = withTempWorkspace((dir) => {
        writeFileSync(join(dir, "inside.txt"), "ok\n", "utf8");
      });
      try {
        await executeTool(root, "read_file", { path: "../outside.txt" });
        return "escaped=false";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `escaped=${message.includes("escapes workspace") ? "true" : "false"}`;
      } finally {
        cleanupWorkspace(root);
      }
    }
  },
  {
    id: "edit-file-unique",
    title: "edit_file requires a unique match",
    description: "A unique old_string is replaced; a duplicated string fails.",
    feature: "Workspace tools",
    expected: "edited=true unique-fail=true",
    run: async () => {
      const root = withTempWorkspace((dir) => {
        writeFileSync(join(dir, "note.txt"), "aaa xxx aaa\n", "utf8");
      });
      try {
        await executeTool(root, "edit_file", {
          path: "note.txt",
          old_string: "xxx",
          new_string: "yyy"
        });
        let uniqueFail = false;
        try {
          await executeTool(root, "edit_file", {
            path: "note.txt",
            old_string: "aaa",
            new_string: "bbb"
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          uniqueFail = message.includes("matched 2 times");
        }
        const after = await executeTool(root, "read_file", { path: "note.txt" });
        return `edited=${after.includes("yyy") ? "true" : "false"} unique-fail=${String(uniqueFail)}`;
      } finally {
        cleanupWorkspace(root);
      }
    }
  },
  {
    id: "skills-catalog",
    title: "Skills catalog + load_skill",
    description: "A workspace skill is listed and loaded from .cachicamo/skills.",
    feature: "Skills",
    expected: "listed=true loaded=true",
    run: async () => {
      const root = withTempWorkspace((dir) => {
        const skillDir = join(dir, ".cachicamo", "skills", "commit");
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(
          join(skillDir, "SKILL.md"),
          "---\nname: commit\ndescription: Make a focused git commit\n---\n\nOnly commit when asked.\n",
          "utf8"
        );
      });
      try {
        const catalog = skillsCatalogText(root);
        const loaded = loadSkill(root, "commit");
        return `listed=${catalog.includes("commit") ? "true" : "false"} loaded=${loaded.includes("Only commit when asked") ? "true" : "false"}`;
      } finally {
        cleanupWorkspace(root);
      }
    }
  },
  {
    id: "rules-load",
    title: "Rules load AGENTS.md",
    description: "Workspace AGENTS.md is picked up as an always-on rule.",
    feature: "Rules",
    expected: "count=1 has-body=true",
    run: async () => {
      const root = withTempWorkspace((dir) => {
        writeFileSync(join(dir, "AGENTS.md"), "Prefer small diffs.\n", "utf8");
      });
      try {
        const listed = listRules(root);
        const text = loadRulesText(root);
        return `count=${listed.length} has-body=${text.includes("Prefer small diffs.") ? "true" : "false"}`;
      } finally {
        cleanupWorkspace(root);
      }
    }
  },
  {
    id: "wsl-path-map",
    title: "WSL path mapping",
    description: "Windows drive and \\\\wsl$ UNC paths convert to Linux paths; distro is inferred.",
    feature: "WSL",
    expected:
      "unc=/home/jose/proj localhost=/tmp drive=/mnt/c/Users/jose distro=Ubuntu none=true",
    run: async () => {
      const unc = windowsPathToWslPath("\\\\wsl$\\Ubuntu\\home\\jose\\proj");
      const localhost = windowsPathToWslPath("\\\\wsl.localhost\\Ubuntu-24.04\\tmp");
      const drive = windowsPathToWslPath("C:\\Users\\jose");
      const distro = inferDistroFromWindowsPath("\\\\wsl$\\Ubuntu\\home\\jose\\proj");
      const none = inferDistroFromWindowsPath("C:\\Users\\jose") === null;
      return `unc=${unc} localhost=${localhost} drive=${drive} distro=${distro} none=${String(none)}`;
    }
  },
  {
    id: "wsl-command-args",
    title: "WSL command argv",
    description: "Enabled WSL settings produce wsl.exe args with distro and quoted cwd.",
    feature: "WSL",
    expected: `["-d","Ubuntu","--","bash","-lc","cd '/home/jose/proj' && git status"]`,
    run: async () => {
      const target = resolveWslExecTarget(
        {
          wslEnabled: true,
          wslDistro: "Ubuntu",
          workspacePath: "\\\\wsl$\\Ubuntu\\home\\jose\\proj"
        },
        "win32"
      );
      if (!target) return "target=null";
      return JSON.stringify(wslCommandArgs(target, "git status"));
    }
  },
  {
    id: "wsl-distro-list",
    title: "WSL distro list decode",
    description: "UTF-16 LE wsl.exe output is decoded and docker-desktop entries are dropped.",
    feature: "WSL",
    expected: "Ubuntu,Debian",
    run: async () => {
      const encoded = Buffer.from("\uFEFFUbuntu\r\nDebian\r\ndocker-desktop\r\n", "utf16le");
      return parseWslDistroList(decodeWslText(encoded)).join(",");
    }
  },
  {
    id: "wsl-open-hints",
    title: "WSL folder pick enables bridging",
    description: "Opening a \\\\wsl$ path turns WSL on and sets the folder's distro.",
    feature: "WSL",
    expected: "enabled=true distro=Ubuntu-24.04",
    run: async () => {
      const next = applyWorkspaceWslHints(
        { ...DEFAULT_SETTINGS, wslEnabled: false, wslDistro: "" },
        "\\\\wsl.localhost\\Ubuntu-24.04\\home\\jose"
      );
      return `enabled=${String(next.wslEnabled)} distro=${next.wslDistro}`;
    }
  }
];

export function listDebugFixtures(): DebugFixtureInfo[] {
  return DEBUG_FIXTURES.map(({ id, title, description, feature }) => ({
    id,
    title,
    description,
    feature
  }));
}

export async function runDebugFixture(id: string): Promise<DebugRunResult> {
  const fixture = DEBUG_FIXTURES.find((item) => item.id === id);
  if (!fixture) {
    return {
      id,
      title: id,
      feature: "unknown",
      passed: false,
      expected: "",
      actual: "",
      durationMs: 0,
      error: `Unknown fixture: ${id}`
    };
  }

  const started = Date.now();
  try {
    const actual = await fixture.run();
    return {
      id: fixture.id,
      title: fixture.title,
      feature: fixture.feature,
      passed: actual === fixture.expected,
      expected: fixture.expected,
      actual,
      durationMs: Date.now() - started
    };
  } catch (error) {
    return {
      id: fixture.id,
      title: fixture.title,
      feature: fixture.feature,
      passed: false,
      expected: fixture.expected,
      actual: "",
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function runAllDebugFixtures(): Promise<DebugRunResult[]> {
  const results: DebugRunResult[] = [];
  for (const fixture of DEBUG_FIXTURES) {
    results.push(await runDebugFixture(fixture.id));
  }
  return results;
}
