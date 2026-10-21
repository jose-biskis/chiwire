import { atr, closedCandleBias, lastClosedBar, withoutForming } from "./momentum.js";
import { roundToTick } from "./precision.js";
import type { Kline, Side } from "./types.js";

const ATR_PERIOD = 14;
const ATR_1M_MULT = 2;
const ATR_5M_MULT = 1.5;
const ATR_15M_MULT = 1.2;
const STRUCTURE_PAD_ATR = 0.25;
const STRUCTURE_CAP_ATR = 2.5;
const SWING_15M = 12;
const SWING_5M = 10;
const FAVOR_5M = 8;
const FAVOR_15M = 6;
const TP_ATR_5M_MULT = 1;
const TP_ATR_1M_MULT = 2;
const TP_VS_STOP = 0.75;
const WIN_RATE_TP_CAP = 0.03;
export const DEFAULT_SMART_CAP = 0.05;
const HARD_SMART_CAP = 0.5;
const FEE_MIN_SL = 0.0025;
const MIN_STOP_OVER_ROUND_TRIP = 2;
const FEE_CLEAR_MULT = 1.5;

export type SmartProfitResult =
  | {
      ok: true;
      slPercent: number;
      tpPercent: number;
      note: string;
    }
  | { ok: false; reason: string };

export type TendPlan =
  | { action: "keep"; reason: string }
  | { action: "pull-tp"; triggerPrice: number; reason: string }
  | { action: "close"; reason: string };

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

function nearestFavor(
  klines: Kline[],
  side: Side,
  mark: number,
  lookback: number
): number | null {
  const window = klines.slice(-lookback);
  if (side === "LONG") {
    const highs = window.map((bar) => bar.high).filter((high) => high > mark);
    return highs.length > 0 ? Math.min(...highs) : null;
  }

  const lows = window.map((bar) => bar.low).filter((low) => low < mark);
  return lows.length > 0 ? Math.max(...lows) : null;
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

function minPositive(values: number[]): number | null {
  const ok = values.filter((value) => value > 0);
  if (ok.length === 0) {
    return null;
  }
  return Math.min(...ok);
}

export function reachableTpDistance(input: {
  side: Side;
  mark: number;
  takerFeeRate: number;
  klines15m: Kline[];
  klines5m: Kline[];
  klines1m: Kline[];
  stopDist: number;
}): number {
  const { side, mark, takerFeeRate, stopDist } = input;
  const closed15 = withoutForming(input.klines15m);
  const closed5 = withoutForming(input.klines5m);
  const closed1 = withoutForming(input.klines1m);
  const atr1m = atr(closed1, ATR_PERIOD);
  const atr5m = atr(closed5, ATR_PERIOD);
  const pad = (atr5m ?? atr1m ?? 0) * 0.15;
  const roundTripPercent = takerFeeRate * 2;
  const feeClear = mark * Math.max(roundTripPercent * FEE_CLEAR_MULT, FEE_MIN_SL);

  const swingPad = (level: number | null): number => {
    if (level === null) {
      return 0;
    }
    const raw = Math.abs(level - mark) - pad;
    return raw > 0 ? raw : 0;
  };

  const swing = minPositive([
    swingPad(nearestFavor(closed5, side, mark, FAVOR_5M)),
    swingPad(nearestFavor(closed15, side, mark, FAVOR_15M))
  ]);
  const atrReach = minPositive([
    atr5m === null ? 0 : atr5m * TP_ATR_5M_MULT,
    atr1m === null ? 0 : atr1m * TP_ATR_1M_MULT
  ]);
  const reachable = minPositive([
    swing ?? 0,
    atrReach ?? 0,
    stopDist > 0 ? stopDist * TP_VS_STOP : 0,
    mark * WIN_RATE_TP_CAP
  ]);

  return Math.max(feeClear, reachable ?? feeClear);
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

  const tpDist = reachableTpDistance({
    side,
    mark,
    takerFeeRate,
    klines15m: input.klines15m,
    klines5m: input.klines5m,
    klines1m: input.klines1m,
    stopDist
  });
  const tpPercent = tpDist / mark;

  if (tpPercent <= roundTripPercent + Number.EPSILON) {
    return {
      ok: false,
      reason: "No reachable take-profit that clears round-trip fees. Sitting."
    };
  }

  const bits = [
    atr1m !== null ? `1m ATR×${ATR_1M_MULT} ${pct(noise1m / mark)}` : null,
    atr5m !== null ? `5m ATR×${ATR_5M_MULT} ${pct(noise5m / mark)}` : null,
    atr15m !== null ? `15m ATR×${ATR_15M_MULT} ${pct(noise15m / mark)}` : null,
    structure > 0 ? `swing ${pct(structure / mark)}` : null
  ].filter((bit): bit is string => bit !== null);

  const note = `smart-profit: SL ${pct(slPercent)} (${bits.join(", ")})  TP ${pct(tpPercent)} (nearby 5m/1m structure, not 2R of the storm). Watch will pull TP or bank if the closed 1m flips while green.`;

  return {
    ok: true,
    slPercent,
    tpPercent,
    note
  };
}

function inProfitAfterFees(
  side: Side,
  entry: number,
  mark: number,
  takerFeeRate: number
): boolean {
  if (!(entry > 0)) {
    return false;
  }

  const move = side === "LONG" ? (mark - entry) / entry : (entry - mark) / entry;
  return move > takerFeeRate * 2 * 1.2;
}

function closerTp(
  side: Side,
  proposed: number,
  current: number | null
): boolean {
  if (current === null) {
    return true;
  }
  return side === "LONG" ? proposed < current : proposed > current;
}

export function planTend(input: {
  side: Side;
  entry: number;
  mark: number;
  last: number;
  currentTp: number | null;
  tickSize: number;
  takerFeeRate: number;
  klines15m: Kline[];
  klines5m: Kline[];
  klines1m: Kline[];
  stopDist: number;
}): TendPlan {
  const { side, entry, mark, last, currentTp, tickSize, takerFeeRate } = input;
  const high = Math.max(mark, last);
  const low = Math.min(mark, last);
  const candle = closedCandleBias(lastClosedBar(input.klines1m));
  const faded = candle !== "FLAT" && candle !== side;
  const green = inProfitAfterFees(side, entry, mark, takerFeeRate);

  if (faded && green) {
    return {
      action: "close",
      reason: `closed 1m ${candle} against ${side} while green after fees. Banking.`
    };
  }

  const tpDist = reachableTpDistance({
    side,
    mark,
    takerFeeRate,
    klines15m: input.klines15m,
    klines5m: input.klines5m,
    klines1m: input.klines1m,
    stopDist: input.stopDist
  });

  const raw =
    side === "LONG"
      ? roundToTick(mark + tpDist, tickSize, "ceil")
      : roundToTick(mark - tpDist, tickSize, "floor");
  const minTp =
    side === "LONG"
      ? roundToTick(high + 2 * tickSize, tickSize, "ceil")
      : roundToTick(low - 2 * tickSize, tickSize, "floor");
  const proposed =
    side === "LONG" ? Math.max(raw, minTp) : Math.min(raw, minTp);

  if (
    side === "LONG"
      ? !(proposed > high)
      : !(proposed < low && proposed > 0)
  ) {
    return { action: "keep", reason: "No valid closer TP from this tape." };
  }

  if (!closerTp(side, proposed, currentTp)) {
    return {
      action: "keep",
      reason: currentTp === null
        ? "No TP on the book to pull."
        : `TP ${currentTp} is already as close as behaviour allows.`
    };
  }

  const why = faded
    ? `1m faded to ${candle}; pulling TP closer`
    : "nearby 5m/1m target is closer than the resting TP";
  return {
    action: "pull-tp",
    triggerPrice: proposed,
    reason: why
  };
}
