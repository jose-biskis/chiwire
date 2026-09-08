import { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, shell, nativeImage } from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startApiServer, type ApiServerHandle } from "./api/server.js";
import { createSubagentRunner, runAgent } from "./agent/loop.js";
import { WorkerCoordinator } from "./agent/multitask.js";
import { listModels } from "./agent/ollamaClient.js";
import { listRules } from "./agent/rules.js";
import { listSkills } from "./agent/skills.js";
import { listDebugFixtures, runAllDebugFixtures, runDebugFixture } from "./debug/fixtures.js";
import {
  apiListenChanged,
  ensureAppIdentity,
  loadSettings,
  saveSettings,
  settingsPath
} from "./settings.js";
import type { AgentSettings, AgentStreamEvent } from "../shared/types.js";
import {
  applyWorkspaceWslHints,
  firstExistingWslUnc,
  probeWsl
} from "./agent/wsl.js";

ensureAppIdentity();

let mainWindow: BrowserWindow | null = null;
let activeAbort: AbortController | null = null;
let agentRunId = 0;
let apiHandle: ApiServerHandle | null = null;

const coordinator = new WorkerCoordinator({
  emit: (event) => {
    mainWindow?.webContents.send("agent:event", event);
  }
});

const isDev = !app.isPackaged;

function applyNativeTheme(settings: AgentSettings): void {
  nativeTheme.themeSource = settings.uiColorMode === "light" ? "light" : "dark";
}

function resolveAppIcon(): string | undefined {
  const candidates = [
    join(app.getAppPath(), "resources", "icon.png"),
    join(process.cwd(), "apps/cachicamo-coding-agent-local/resources/icon.png"),
    join(process.cwd(), "resources", "icon.png"),
    join(dirname(fileURLToPath(import.meta.url)), "../../resources/icon.png")
  ];
  return candidates.find((path) => existsSync(path));
}

function createWindow(): void {
  const iconPath = resolveAppIcon();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;
  const isWin = process.platform === "win32";

  // Always use a real OS frame so WSLg/Linux does not draw a white edge around
  // frameless windows. Windows still hides the title bar and uses a dark overlay
  // for caption buttons; Linux/macOS keep the native title bar.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: "Cachicamo Coding Agent Local",
    backgroundColor: "#181818",
    frame: true,
    ...(icon && !icon.isEmpty() ? { icon } : {}),
    ...(isWin
      ? {
          titleBarStyle: "hidden" as const,
          titleBarOverlay: {
            color: "#181818",
            symbolColor: "#cccccc",
            height: 35
          }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setBackgroundColor("#181818");
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  mainWindow.on("ready-to-show", () => {
    mainWindow?.setBackgroundColor("#181818");
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function emitAgentEvent(event: AgentStreamEvent): void {
  mainWindow?.webContents.send("agent:event", event);
}

async function restartApiServer(): Promise<void> {
  if (apiHandle) {
    try {
      await apiHandle.close();
    } catch {
      // ignore
    }
    apiHandle = null;
  }
  apiHandle = await startApiServer(loadSettings, { onEvent: emitAgentEvent, coordinator });
}

let settingsLock: Promise<void> = Promise.resolve();

function withSettingsLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = settingsLock.then(fn, fn);
  settingsLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function registerIpc(): void {
  ipcMain.handle("settings:get", () => loadSettings());

  ipcMain.handle("settings:set", (_event, next: AgentSettings) =>
    withSettingsLock(async () => {
      const previous = loadSettings();
      const saved = saveSettings(next);
      coordinator.setRunMode(saved.subagentRunMode);
      applyNativeTheme(saved);
      if (apiListenChanged(previous, saved)) {
        try {
          await restartApiServer();
        } catch (error) {
          console.warn("[cachicamo] API restart after settings save failed:", error);
        }
      }
      return saved;
    })
  );

  ipcMain.handle("workspace:pick", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) {
      return null;
    }
    const saved = saveSettings(applyWorkspaceWslHints(loadSettings(), result.filePaths[0]));
    return saved.workspacePath;
  });

  ipcMain.handle("workspace:pickWsl", async () => {
    const settings = loadSettings();
    const status = await probeWsl(settings);
    const distro = settings.wslDistro.trim() || status.defaultDistro;
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      defaultPath: firstExistingWslUnc(distro)
    });
    if (result.canceled || !result.filePaths[0]) {
      return null;
    }
    const saved = saveSettings(applyWorkspaceWslHints(loadSettings(), result.filePaths[0]));
    return saved.workspacePath;
  });

  ipcMain.handle("wsl:status", () => probeWsl(loadSettings()));

  ipcMain.handle("models:list", async () => {
    const settings = loadSettings();
    return listModels(settings);
  });

  ipcMain.handle("rules:list", () => {
    const settings = loadSettings();
    return listRules(settings.workspacePath);
  });

  ipcMain.handle("skills:list", () => {
    const settings = loadSettings();
    return listSkills(settings.workspacePath);
  });

  ipcMain.handle("api:status", () => {
    const settings = loadSettings();
    return {
      enabled: Boolean(apiHandle) && settings.apiEnabled,
      url: apiHandle?.url ?? `http://127.0.0.1:${settings.apiPort}`,
      tokenSet: Boolean(settings.apiToken.trim())
    };
  });

  ipcMain.handle(
    "agent:run",
    async (
      _event,
      payload: {
        userMessage: string;
        history: Array<{ role: "user" | "assistant"; content: string }>;
      }
    ) => {
      if (activeAbort) {
        activeAbort.abort();
      }
      const runId = ++agentRunId;
      activeAbort = new AbortController();
      const settings = loadSettings();
      await runAgent({
        settings,
        history: payload.history,
        userMessage: payload.userMessage,
        signal: activeAbort.signal,
        onEvent: (event) => {
          if (runId !== agentRunId && (event.type === "done" || event.type === "error")) {
            return;
          }
          emitAgentEvent(event);
        },
        coordinator
      });
      if (runId === agentRunId) {
        activeAbort = null;
      }
    }
  );

  ipcMain.handle("agent:cancel", () => {
    activeAbort?.abort();
    activeAbort = null;
  });

  ipcMain.handle("workers:list", () => coordinator.list());

  ipcMain.handle("workers:cancel", (_event, id: string) => coordinator.cancel(id));

  ipcMain.handle("workers:cancelAll", () => {
    coordinator.cancelAll();
  });

  ipcMain.handle("workers:resume", async (_event, id: string, task: string) => {
    const settings = loadSettings();
    const result = await coordinator.resume({
      id,
      task,
      run: createSubagentRunner({ settings, depth: 0 })
    });
    return { id: result.id, message: result.message };
  });

  ipcMain.handle("debug:listFixtures", () => listDebugFixtures());

  ipcMain.handle("debug:runFixture", (_event, id: string) => runDebugFixture(id));

  ipcMain.handle("debug:runAll", () => runAllDebugFixtures());

  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("window:maximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle("window:close", () => {
    mainWindow?.close();
  });

  ipcMain.handle("window:platform", () => process.platform);
}

app.whenReady().then(async () => {
  ensureAppIdentity();
  const startup = loadSettings();
  coordinator.setRunMode(startup.subagentRunMode);
  applyNativeTheme(startup);
  console.log(`[cachicamo] Settings file: ${settingsPath()}`);
  // Kill native File/Edit/View/Help — replaced by the in-app title bar.
  Menu.setApplicationMenu(null);
  registerIpc();
  await restartApiServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void apiHandle?.close();
});
