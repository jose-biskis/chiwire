import { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, shell, nativeImage } from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startApiServer, type ApiServerHandle } from "./api/server.js";
import { runAgent } from "./agent/loop.js";
import { listModels } from "./agent/ollamaClient.js";
import { listRules } from "./agent/rules.js";
import { listSkills } from "./agent/skills.js";
import { loadSettings, saveSettings } from "./settings.js";
import type { AgentSettings, AgentStreamEvent } from "../shared/types.js";

let mainWindow: BrowserWindow | null = null;
let activeAbort: AbortController | null = null;
let apiHandle: ApiServerHandle | null = null;

const isDev = !app.isPackaged;

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
  apiHandle = await startApiServer(loadSettings, { onEvent: emitAgentEvent });
}

function registerIpc(): void {
  ipcMain.handle("settings:get", () => loadSettings());

  ipcMain.handle("settings:set", async (_event, next: AgentSettings) => {
    saveSettings(next);
    await restartApiServer();
    return loadSettings();
  });

  ipcMain.handle("workspace:pick", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) {
      return null;
    }
    const settings = loadSettings();
    settings.workspacePath = result.filePaths[0];
    saveSettings(settings);
    return settings.workspacePath;
  });

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
      activeAbort = new AbortController();
      const settings = loadSettings();
      await runAgent({
        settings,
        history: payload.history,
        userMessage: payload.userMessage,
        signal: activeAbort.signal,
        onEvent: emitAgentEvent
      });
      activeAbort = null;
    }
  );

  ipcMain.handle("agent:cancel", () => {
    activeAbort?.abort();
    activeAbort = null;
  });

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
  nativeTheme.themeSource = "dark";
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
