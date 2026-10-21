import { adx } from "./indicators.js";
import { atr, withoutForming } from "./momentum.js";
import type { Kline, Side } from "./types.js";

const ATR_PERIOD = 14;
const ATR_1M_MULT = 2;
const ATR_5M_MULT = 1.5;
const ATR_15M_MULT = 1.2;
const STRUCTURE_PAD_ATR = 0.25;
const STRUCTURE_CAP_ATR = 2.5;
const SWING_15M = 12;
const SWING_5M = 10;
export const DEFAULT_SMART_CAP = 0.05;
const HARD_SMART_CAP = 0.5;
const FEE_MIN_SL = 0.0025;
const MIN_STOP_OVER_ROUND_TRIP = 2;

export type SmartProfitResult =
  | {
      ok: true;
      slPercent: number;
      tpPercent: number;
      note: string;
    }
  | { ok: false; reason: string };

function pct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function swingAgainst(
  klines: Kline[],
  side: Side,
  lookback: number
): number | null {
  const window = klines.slice(-lookback);
  if (window.length === 0) {
    return null;
  }

  if (side === "LONG") {
    return Math.min(...window.map((bar) => bar.low));
  }

  return Math.max(...window.map((bar) => bar.high));
}

function structureDistance(
  side: Side,
  mark: number,
  level: number | null
): number {
  if (level === null) {
    return 0;
  }

  if (side === "LONG") {
    return level < mark ? mark - level : 0;
  }

  return level > mark ? level - mark : 0;
}

function rewardMultiple(adxValue: number | null): number {
  if (adxValue === null) {
    return 2;
  }
  if (adxValue >= 25) {
    return 2.5;
  }
  if (adxValue < 18) {
    return 1.8;
  }
  return 2;
}

export function suggestSmartPercents(input: {
  side: Side;
  mark: number;
  takerFeeRate: number;
  klines15m: Kline[];
  klines5m: Kline[];
  klines1m: Kline[];
  maxSlPercent?: number;
}): SmartProfitResult {
  const { side, mark, takerFeeRate } = input;
  const maxSlPercent = Math.min(
    input.maxSlPercent ?? DEFAULT_SMART_CAP,
    HARD_SMART_CAP
  );
  if (!(mark > 0)) {
    return { ok: false, reason: "Mark is unusable for smart-profit." };
  }

  const closed15 = withoutForming(input.klines15m);
  const closed5 = withoutForming(input.klines5m);
  const closed1 = withoutForming(input.klines1m);

  const atr1m = atr(closed1, ATR_PERIOD);
  const atr5m = atr(closed5, ATR_PERIOD);
  const atr15m = atr(closed15, ATR_PERIOD);

  if (atr5m === null && atr15m === null) {
    return {
      ok: false,
      reason: "Not enough closed candles for a volatility stop. Sitting."
    };
  }

  const noise1m = atr1m === null ? 0 : atr1m * ATR_1M_MULT;
  const noise5m = atr5m === null ? 0 : atr5m * ATR_5M_MULT;
  const noise15m = atr15m === null ? 0 : atr15m * ATR_15M_MULT;
  const noise = Math.max(noise1m, noise5m, noise15m);

  const pad = (atr15m ?? atr5m ?? 0) * STRUCTURE_PAD_ATR;
  const dist15 = structureDistance(
    side,
    mark,
    swingAgainst(closed15, side, SWING_15M)
  );
  const dist5 = structureDistance(
    side,
    mark,
    swingAgainst(closed5, side, SWING_5M)
  );
  const cap = (atr15m ?? atr5m ?? noise) * STRUCTURE_CAP_ATR;
  const structure = Math.min(Math.max(dist15, dist5) + pad, cap);

  const roundTripPercent = takerFeeRate * 2;
  const feeFloor = mark * Math.max(FEE_MIN_SL, roundTripPercent * MIN_STOP_OVER_ROUND_TRIP);
  const stopDist = Math.max(noise, structure, feeFloor);
  const slPercent = stopDist / mark;

  if (slPercent > maxSlPercent + Number.EPSILON) {
    return {
      ok: false,
      reason: `Weather is too heavy for this ticket (need ${pct(slPercent)} stop, cap ${pct(maxSlPercent)}). Sitting.`
    };
  }

  const highs = closed15.map((bar) => bar.high);
  const lows = closed15.map((bar) => bar.low);
  const closes = closed15.map((bar) => bar.close);
  const adxRead = adx(highs, lows, closes);
  const reward = rewardMultiple(adxRead?.adx ?? null);
  const tpPercent = reward * slPercent + 3 * roundTripPercent;

  const bits = [
    atr1m !== null ? `1m ATR×${ATR_1M_MULT} ${pct(noise1m / mark)}` : null,
    atr5m !== null ? `5m ATR×${ATR_5M_MULT} ${pct(noise5m / mark)}` : null,
    atr15m !== null ? `15m ATR×${ATR_15M_MULT} ${pct(noise15m / mark)}` : null,
    structure > 0 ? `swing ${pct(structure / mark)}` : null
  ].filter((bit): bit is string => bit !== null);

  const adxText =
    adxRead === null ? "ADX n/a" : `ADX ${adxRead.adx.toFixed(0)}`;
  const note = `smart-profit: SL ${pct(slPercent)} (${bits.join(", ")})  TP ${pct(tpPercent)} (${reward.toFixed(1)}R after fees, ${adxText}). Wider than desk so the whip has room.`;

  return {
    ok: true,
    slPercent,
    tpPercent,
    note
  };
}
