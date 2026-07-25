import { Ollama } from "ollama";
import type { AgentSettings, ModelInfo } from "../../shared/types.js";

export function createOllamaClient(settings: AgentSettings): Ollama {
  if (settings.mode === "cloud") {
    const headers: Record<string, string> = {};
    if (settings.apiKey.trim()) {
      headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
    }
    return new Ollama({
      host: settings.cloudHost.replace(/\/$/, ""),
      headers
    });
  }

  return new Ollama({
    host: settings.localHost.replace(/\/$/, "")
  });
}

export async function listModels(settings: AgentSettings): Promise<ModelInfo[]> {
  const client = createOllamaClient(settings);
  const response = await client.list();
  return response.models.map((model) => ({
    name: model.name,
    size: model.size,
    modifiedAt:
      model.modified_at instanceof Date
        ? model.modified_at.toISOString()
        : String(model.modified_at ?? "")
  }));
}
