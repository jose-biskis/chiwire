import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "@chiwire/velero/cli";
import { randomUUID } from "node:crypto";

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

export type ProfileDraft = Omit<
  WatchProfile,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

const DEFAULT_GOLD_TOP = 8;
const DEFAULT_GOLD_SCAN = 36;
const DEFAULT_GOLD_EVERY_SECONDS = 180;

export function favoriteProfileDraft(): ProfileDraft {
  return {
    name: "favorite profile",
    symbols: [
      "METUSDT",
      "RLCUSDT",
      "DOODUSDT",
      "JCTUSDT",
      "IOSTUSDT"
    ],
    notional: 10,
    leverage: 10,
    maxOpen: 6,
    pollSeconds: 1,
    cooldownSeconds: 5,
    live: true,
    isolated: false,
    dryRun: false,
    smartProfit: true,
    smartCap: 15,
    goldDigger: true,
    goldTop: DEFAULT_GOLD_TOP,
    goldScan: DEFAULT_GOLD_SCAN,
    goldEverySeconds: DEFAULT_GOLD_EVERY_SECONDS
  };
}

export function profileToArgv(profile: WatchProfile): string[] {
  const args = ["watch", ...profile.symbols];
  args.push("--notional", String(profile.notional));
  args.push("--leverage", String(profile.leverage));
  args.push("--max-open", String(profile.maxOpen));
  args.push("--poll", String(profile.pollSeconds));
  args.push("--cooldown", String(profile.cooldownSeconds));
  if (profile.live) {
    args.push("--live", "--confirm");
  }
  if (profile.isolated) {
    args.push("--isolated");
  }
  if (profile.dryRun) {
    args.push("--dry-run");
  }
  if (profile.smartProfit) {
    args.push("--smart-profit");
    if (profile.smartCap !== null) {
      args.push("--smart-cap", String(profile.smartCap));
    }
  }
  if (profile.goldDigger) {
    args.push("--gold-digger");
    args.push("--gold-top", String(profile.goldTop));
    args.push("--gold-scan", String(profile.goldScan));
    args.push("--gold-every", String(profile.goldEverySeconds));
  }
  return args;
}

export function cliLine(profile: WatchProfile): string {
  return `npm run velero -- ${profileToArgv(profile).join(" ")}`;
}

export function assertWatchProfile(profile: WatchProfile): void {
  if (!profile.name.trim()) {
    throw new Error("Profile needs a name.");
  }
  const parsed = parseArgs(["node", "velero", ...profileToArgv(profile)]);
  if (parsed.command !== "watch") {
    throw new Error("Profile must describe a watch.");
  }
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim().toUpperCase() : ""))
    .filter(Boolean);
}

export function normalizeDraft(input: Record<string, unknown>): ProfileDraft {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const symbols = asStringArray(input.symbols);
  const draft: ProfileDraft = {
    name,
    symbols,
    notional: asNumber(input.notional, 10),
    leverage: asNumber(input.leverage, 10),
    maxOpen: asNumber(input.maxOpen, 3),
    pollSeconds: asNumber(input.pollSeconds, 30),
    cooldownSeconds: asNumber(input.cooldownSeconds, 300),
    live: asBoolean(input.live, false),
    isolated: asBoolean(input.isolated, false),
    dryRun: asBoolean(input.dryRun, false),
    smartProfit: asBoolean(input.smartProfit, false),
    smartCap:
      input.smartCap === null || input.smartCap === undefined
        ? null
        : asNumber(input.smartCap, 5),
    goldDigger: asBoolean(input.goldDigger, false),
    goldTop: asNumber(input.goldTop, DEFAULT_GOLD_TOP),
    goldScan: asNumber(input.goldScan, DEFAULT_GOLD_SCAN),
    goldEverySeconds: asNumber(input.goldEverySeconds, DEFAULT_GOLD_EVERY_SECONDS)
  };
  if (typeof input.id === "string" && input.id) {
    draft.id = input.id;
  }
  return draft;
}

function stamp(draft: ProfileDraft, existing?: WatchProfile): WatchProfile {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? draft.id ?? randomUUID(),
    name: draft.name,
    symbols: draft.symbols,
    notional: draft.notional,
    leverage: draft.leverage,
    maxOpen: draft.maxOpen,
    pollSeconds: draft.pollSeconds,
    cooldownSeconds: draft.cooldownSeconds,
    live: draft.live,
    isolated: draft.isolated,
    dryRun: draft.dryRun,
    smartProfit: draft.smartProfit,
    smartCap: draft.smartCap,
    goldDigger: draft.goldDigger,
    goldTop: draft.goldTop,
    goldScan: draft.goldScan,
    goldEverySeconds: draft.goldEverySeconds,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
}

export class ProfileStore {
  constructor(private readonly filePath: string) {}

  load(): WatchProfile[] {
    if (!existsSync(this.filePath)) {
      const seeded = stamp(favoriteProfileDraft());
      assertWatchProfile(seeded);
      this.save([seeded]);
      return [seeded];
    }

    const raw = JSON.parse(readFileSync(this.filePath, "utf8")) as unknown;
    if (!Array.isArray(raw)) {
      throw new Error("Profiles file is not a list.");
    }
    return raw.map((row) => {
      const record = asRecord(row);
      const draft = normalizeDraft(record);
      const existingId = typeof record.id === "string" ? record.id : "";
      const createdAt =
        typeof record.createdAt === "string"
          ? record.createdAt
          : new Date().toISOString();
      const profile = stamp(draft, {
        ...stamp(draft),
        id: existingId || randomUUID(),
        createdAt,
        updatedAt: createdAt
      });
      return profile;
    });
  }

  save(profiles: WatchProfile[]): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(profiles, null, 2)}\n`);
  }

  upsert(draft: ProfileDraft): WatchProfile {
    const profiles = this.load();
    const existing = draft.id
      ? profiles.find((row) => row.id === draft.id)
      : undefined;
    const profile = stamp(draft, existing);
    assertWatchProfile(profile);
    const next = existing
      ? profiles.map((row) => (row.id === profile.id ? profile : row))
      : [...profiles, profile];
    this.save(next);
    return profile;
  }

  remove(id: string): boolean {
    const profiles = this.load();
    const next = profiles.filter((row) => row.id !== id);
    if (next.length === profiles.length) {
      return false;
    }
    this.save(next);
    return true;
  }

  get(id: string): WatchProfile | undefined {
    return this.load().find((row) => row.id === id);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}
