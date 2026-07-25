import { contextBridge, ipcRenderer } from "electron";
import type { AgentSettings, AgentStreamEvent, CachicamoAgentApi } from "../shared/types.js";

const api: CachicamoAgentApi = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings: AgentSettings) => ipcRenderer.invoke("settings:set", settings),
  pickWorkspace: () => ipcRenderer.invoke("workspace:pick"),
  listModels: () => ipcRenderer.invoke("models:list"),
  listRules: () => ipcRenderer.invoke("rules:list"),
  listSkills: () => ipcRenderer.invoke("skills:list"),
  getApiStatus: () => ipcRenderer.invoke("api:status"),
  runAgent: (payload) => ipcRenderer.invoke("agent:run", payload),
  cancelAgent: () => ipcRenderer.invoke("agent:cancel"),
  onAgentEvent: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, data: AgentStreamEvent) => {
      handler(data);
    };
    ipcRenderer.on("agent:event", listener);
    return () => {
      ipcRenderer.removeListener("agent:event", listener);
    };
  },
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("window:maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  getPlatform: () => ipcRenderer.invoke("window:platform")
};

contextBridge.exposeInMainWorld("cachicamoAgent", api);
