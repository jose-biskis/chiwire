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

export type HarborStatus = {
  connected: boolean;
  since: string | null;
  requireGate: boolean;
};

export type WatchStatus = {
  running: boolean;
  profileId: string | null;
  profileName: string | null;
  pid: number | null;
  startedAt: string | null;
  cli: string | null;
  gate: HarborStatus;
};

export type LogLine = {
  seq: number;
  at: string;
  stream: "stdout" | "stderr" | "desk";
  text: string;
};

export type ProfileDraft = Omit<WatchProfile, "id" | "createdAt" | "updatedAt">;

export type HarborArtifact = {
  filename: string;
  label: string;
  platform: string;
  kind: string;
  version: string;
  size: number;
  sha256: string;
  url: string;
};

export type HarborManifest = {
  productName: string;
  version: string;
  publishedAt: string | null;
  artifacts: HarborArtifact[];
};
