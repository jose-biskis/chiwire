import { BinanceFutures } from "./binance.js";
import { LIVE_BASE_URL, type VeleroEnv } from "./config.js";
import { printGoldReport } from "./format.js";
import {
  adx,
  bollinger,
  ema,
  macd,
  marketStructure,
  relativeVolume,
  rsi,
  scoreTape,
  stochastic,
  type EyeSuggestion,
  type TapeSnapshot
} from "./indicators.js";
import { atrPercent, withoutForming } from "./momentum.js";

export const DEFAULT_GOLD_TOP = 8;
export const DEFAULT_GOLD_SCAN = 36;
export const DEFAULT_GOLD_EVERY_SECONDS = 180;
const MIN_QUOTE_VOLUME = 8_000_000;

function scanClient(env: VeleroEnv): BinanceFutures {
  return new BinanceFutures({
    baseUrl: LIVE_BASE_URL,
    apiKey: null,
    apiSecret: null,
    proxyUrl: env.gateFetchUrl ? null : env.proxyUrl,
    gateFetchUrl: env.gateFetchUrl
  });
}

async function mapPool<T, R>(
  items: T[],
  size: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const part = await Promise.all(chunk.map(mapper));
    out.push(...part);
  }
  return out;
}

export async function digGold(input: {
  env: VeleroEnv;
  scan: number;
  top: number;
  signal: AbortSignal;
}): Promise<EyeSuggestion[]> {
  const client = scanClient(input.env);
  await client.syncTime();
  if (input.signal.aborted) {
    return [];
  }

  const [listed, tickers, premiums] = await Promise.all([
    client.perpetualUsdtSymbols(),
    client.tickers24h(),
    client.premiumIndexAll()
  ]);
  const listedSet = new Set(listed);
  const fundingBySymbol = new Map(
    premiums.map((row) => [row.symbol, row.lastFundingRate])
  );

  const ranked = tickers
    .filter(
      (row) =>
        listedSet.has(row.symbol) && row.quoteVolume >= MIN_QUOTE_VOLUME
    )
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, Math.max(5, input.scan));

  const snapshots = await mapPool(ranked, 5, async (ticker) => {
    if (input.signal.aborted) {
      return null;
    }

    try {
      const raw = await client.klines(ticker.symbol, "1h", 220);
      const bars = withoutForming(raw);
      const closes = bars.map((bar) => bar.close);
      const highs = bars.map((bar) => bar.high);
      const lows = bars.map((bar) => bar.low);
      const volumes = bars.map((bar) => bar.volume);
      const [oi, oiChange] = await Promise.all([
        client.openInterest(ticker.symbol),
        client.openInterestChange(ticker.symbol)
      ]);

      const snapshot: TapeSnapshot = {
        symbol: ticker.symbol,
        close: ticker.lastPrice || closes[closes.length - 1] || 0,
        change24h: ticker.priceChangePercent / 100,
        quoteVolume: ticker.quoteVolume,
        high24h: ticker.highPrice,
        low24h: ticker.lowPrice,
        fundingRate: fundingBySymbol.get(ticker.symbol) ?? null,
        volumeRatio: relativeVolume(volumes),
        ema20: ema(closes, 20),
        ema50: ema(closes, 50),
        ema200: ema(closes, 200),
        rsi: rsi(closes, 14),
        macd: macd(closes),
        stoch: stochastic(highs, lows, closes),
        bollinger: bollinger(closes),
        atrPercent: atrPercent(bars, 14),
        adx: adx(highs, lows, closes),
        oi,
        oiChange,
        structure: marketStructure(highs, lows)
      };
      return snapshot;
    } catch {
      return null;
    }
  });

  const eyes = snapshots
    .filter((row): row is TapeSnapshot => row !== null)
    .map((row) => scoreTape(row))
    .filter((row): row is EyeSuggestion => row !== null)
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol));

  const unique: EyeSuggestion[] = [];
  const seen = new Set<string>();
  for (const row of eyes) {
    if (seen.has(row.symbol)) {
      continue;
    }
    seen.add(row.symbol);
    unique.push(row);
    if (unique.length >= input.top) {
      break;
    }
  }

  return unique;
}

export async function runGoldDigger(input: {
  env: VeleroEnv;
  scan: number;
  top: number;
  signal: AbortSignal;
}): Promise<EyeSuggestion[]> {
  const suggestions = await digGold(input);
  printGoldReport(suggestions, input.scan);
  return suggestions;
}

export function mergeFleet(input: {
  fleet: string[];
  additions: string[];
  cap: number;
}): { fleet: string[]; joined: string[]; skipped: string[] } {
  const fleet = [...input.fleet];
  const present = new Set(fleet);
  const joined: string[] = [];
  const skipped: string[] = [];

  for (const symbol of input.additions) {
    if (present.has(symbol)) {
      continue;
    }
    if (fleet.length >= input.cap) {
      skipped.push(symbol);
      continue;
    }
    fleet.push(symbol);
    present.add(symbol);
    joined.push(symbol);
  }

  return { fleet, joined, skipped };
}
