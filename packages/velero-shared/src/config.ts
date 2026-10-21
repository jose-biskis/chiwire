import process from "node:process";

export const TESTNET_BASE_URL = "https://testnet.binancefuture.com";
export const LIVE_BASE_URL = "https://fapi.binance.com";

export const DEFAULT_NOTIONAL = 10;
export const DEFAULT_LEVERAGE = 10;
export const DEFAULT_MAX_OPEN = 3;
export const DEFAULT_MAX_NOTIONAL = 25;
export const DEFAULT_MAX_LEVERAGE = 10;
export const DEFAULT_TAKER_FEE_RATE = 0.001;
export const DEFAULT_POLL_SECONDS = 30;
export const DEFAULT_COOLDOWN_SECONDS = 300;

export type VeleroEnv = {
  apiKey: string | null;
  apiSecret: string | null;
  liveAllowed: boolean;
  maxNotional: number;
  maxLeverage: number;
  maxOpen: number;
  takerFeeRate: number | null;
  proxyUrl: string | null;
  gateFetchUrl: string | null;
};

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${raw}`);
  }

  return value;
}

function readSecret(name: string): string | null {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }

  const cleaned = raw.replace(/^\uFEFF/, "").replace(/\s+/g, "");
  return cleaned || null;
}

function readOptionalNumber(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }

  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${name}: ${raw}`);
  }

  return value;
}

function truthy(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function readEnv(): VeleroEnv {
  const apiKey = readSecret("BINANCE_API_KEY");
  const apiSecret = readSecret("BINANCE_API_SECRET");

  const proxyUrl =
    process.env.VELERO_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.https_proxy?.trim() ||
    null;

  return {
    apiKey,
    apiSecret,
    liveAllowed: truthy(process.env.VELERO_LIVE),
    maxNotional: readNumber("VELERO_MAX_NOTIONAL", DEFAULT_MAX_NOTIONAL),
    maxLeverage: readNumber("VELERO_MAX_LEVERAGE", DEFAULT_MAX_LEVERAGE),
    maxOpen: readNumber("VELERO_MAX_OPEN", DEFAULT_MAX_OPEN),
    takerFeeRate: readOptionalNumber("VELERO_TAKER_FEE"),
    proxyUrl,
    gateFetchUrl: process.env.VELERO_GATE_FETCH?.trim() || null
  };
}

export function baseUrlFor(live: boolean): string {
  return live ? LIVE_BASE_URL : TESTNET_BASE_URL;
}

export function venueLabel(live: boolean): string {
  return live ? "LIVE" : "testnet";
}

export function maskKey(key: string): string {
  if (key.length <= 8) {
    return "****";
  }

  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
