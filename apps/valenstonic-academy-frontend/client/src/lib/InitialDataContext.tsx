import { createContext, useContext, type ReactNode } from "react";
import type { SsrData } from "@/lib/ssr-data";

const InitialDataContext = createContext<SsrData>({});

export function InitialDataProvider(props: { value: SsrData; children: ReactNode }) {
  return (
    <InitialDataContext.Provider value={props.value}>{props.children}</InitialDataContext.Provider>
  );
}

export function useInitialData(): SsrData {
  return useContext(InitialDataContext);
}
