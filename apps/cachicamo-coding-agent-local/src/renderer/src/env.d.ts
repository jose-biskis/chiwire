import type { CachicamoAgentApi } from "../../../shared/types";

declare global {
  interface Window {
    cachicamoAgent: CachicamoAgentApi;
  }
}

export {};
