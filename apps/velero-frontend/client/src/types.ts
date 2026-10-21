export type WatchProfile = {
  id: string;
  name: string;
  symbols: string[];
  notional: number;
  leverage: number;
  maxOpen: number;
  pollSeconds: number;
  cooldownSeconds: number;
  live: boolean;
  isolated: boolean;
  dryRun: boolean;
  smartProfit: boolean;
  smartCap: number | null;
  goldDigger: boolean;
  goldTop: number;
  goldScan: number;
  goldEverySeconds: number;
  createdAt: string;
  updatedAt: string;
};

export type WatchStatus = {
  running: boolean;
  profileId: string | null;
  profileName: string | null;
  pid: number | null;
  startedAt: string | null;
  cli: string | null;
};

export type LogLine = {
  seq: number;
  at: string;
  stream: "stdout" | "stderr" | "desk";
  text: string;
};

export type ProfileDraft = Omit<WatchProfile, "id" | "createdAt" | "updatedAt">;
