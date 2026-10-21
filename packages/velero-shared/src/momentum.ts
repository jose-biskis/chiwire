import type { Bias, Kline, Side } from "./types.js";

export type MomentumRead = {
  bias: Bias;
  reason: string;
  close: number;
  smaFast: number | null;
  smaSlow: number | null;
  roc: number | null;
  atrPercent: number | null;
  candle1m: Bias | null;
};

export function sma(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) {
    return null;
  }

  let sum = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    sum += values[i] ?? 0;
  }

  return sum / period;
}

export function roc(values: number[], period: number): number | null {
  if (values.length <= period || period <= 0) {
    return null;
  }

  const last = values[values.length - 1];
  const prev = values[values.length - 1 - period];
  if (last === undefined || prev === undefined || prev === 0) {
    return null;
  }

  return (last - prev) / prev;
}

export function atr(klines: Kline[], period: number): number | null {
  if (klines.length < period + 1 || period <= 0) {
    return null;
  }

  let sum = 0;
  let count = 0;
  for (let i = klines.length - period; i < klines.length; i += 1) {
    const current = klines[i];
    const previous = klines[i - 1];
    if (!current || !previous) {
      continue;
    }

    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    sum += trueRange;
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  return sum / count;
}

export function atrPercent(klines: Kline[], period: number): number | null {
  const value = atr(klines, period);
  const last = klines[klines.length - 1];
  if (value === null || !last || last.close === 0) {
    return null;
  }

  return value / last.close;
}

const FAST = 20;
const SLOW = 50;
const ROC_BARS = 6;
const ROC_MIN = 0.002;
const ATR_PERIOD = 14;

function stackBias(close: number, fast: number, slow: number): Bias {
  if (close > fast && fast > slow) {
    return "LONG";
  }
  if (close < fast && fast < slow) {
    return "SHORT";
  }
  return "FLAT";
}

function impulseBias(rateOfChange: number): Bias {
  if (rateOfChange > ROC_MIN) {
    return "LONG";
  }
  if (rateOfChange < -ROC_MIN) {
    return "SHORT";
  }
  return "FLAT";
}

function emptyRead(reason: string): MomentumRead {
  return {
    bias: "FLAT",
    reason,
    close: 0,
    smaFast: null,
    smaSlow: null,
    roc: null,
    atrPercent: null,
    candle1m: null
  };
}

export function readMomentum(
  klines15m: Kline[],
  klines5m: Kline[],
  klines1m: Kline[] = []
): MomentumRead {
  const closes15 = klines15m.map((bar) => bar.close);
  const closes5 = klines5m.map((bar) => bar.close);
  const close = closes15[closes15.length - 1] ?? closes5[closes5.length - 1];

  if (close === undefined) {
    return emptyRead("No candles. Can't sail without water.");
  }

  const smaFast = sma(closes15, FAST);
  const smaSlow = sma(closes15, SLOW);
  const rateOfChange = roc(closes5, ROC_BARS);
  const atr = atrPercent(klines15m, ATR_PERIOD);
  const closed1m = klines1m.length > 0 ? lastClosedBar(klines1m) : undefined;
  const candle1m =
    klines1m.length === 0 ? null : closedCandleBias(closed1m);

  const trend: Bias =
    smaFast !== null && smaSlow !== null
      ? stackBias(close, smaFast, smaSlow)
      : "FLAT";
  const impulse: Bias =
    rateOfChange !== null ? impulseBias(rateOfChange) : "FLAT";

  const rocText =
    rateOfChange === null ? "n/a" : `${(rateOfChange * 100).toFixed(2)}%`;

  const base = {
    close,
    smaFast,
    smaSlow,
    roc: rateOfChange,
    atrPercent: atr,
    candle1m
  };

  if (trend !== "FLAT" && trend === impulse) {
    if (klines1m.length > 0 && !closed1m) {
      return {
        ...base,
        bias: "FLAT",
        reason: `15m/5m want ${trend} (ROC ${rocText}) but no closed 1m yet. Sitting.`
      };
    }
    if (klines1m.length > 0 && candle1m !== trend) {
      const oneMin =
        candle1m === "FLAT" ? "has no body" : `closed ${candle1m}`;
      return {
        ...base,
        bias: "FLAT",
        reason: `15m/5m want ${trend} (ROC ${rocText}) but 1m ${oneMin}. Sitting.`
      };
    }

    const oneMinNote =
      candle1m === null ? "" : ` Closed 1m ${candle1m} agrees.`;
    return {
      ...base,
      bias: trend,
      reason: `15m SMA stack ${trend} and 5m ROC ${rocText} agree.${oneMinNote}`
    };
  }

  if (trend === "FLAT" && impulse !== "FLAT") {
    return {
      ...base,
      bias: "FLAT",
      reason: `5m wants ${impulse} (ROC ${rocText}) but 15m trend is mixed. Sitting on hands.`
    };
  }

  if (impulse === "FLAT" && trend !== "FLAT") {
    return {
      ...base,
      bias: "FLAT",
      reason: `15m trend ${trend} but 5m has no impulse (ROC ${rocText}). Waiting.`
    };
  }

  if (trend !== impulse) {
    return {
      ...base,
      bias: "FLAT",
      reason: `15m ${trend} vs 5m ${impulse}. Conflict — no order.`
    };
  }

  return {
    ...base,
    bias: "FLAT",
    reason: "No trend, no impulse. Anchored."
  };
}

export function withoutForming(klines: Kline[]): Kline[] {
  return klines.length > 1 ? klines.slice(0, -1) : klines;
}

export function lastClosedBar(klines: Kline[]): Kline | undefined {
  return klines.length > 1 ? klines[klines.length - 2] : undefined;
}

export function priorClosedBar(klines: Kline[]): Kline | undefined {
  return klines.length > 2 ? klines[klines.length - 3] : undefined;
}

function barRange(bar: Kline): number {
  return Math.max(0, bar.high - bar.low);
}

function upperWick(bar: Kline): number {
  return Math.max(0, bar.high - Math.max(bar.open, bar.close));
}

function lowerWick(bar: Kline): number {
  return Math.max(0, Math.min(bar.open, bar.close) - bar.low);
}

function bodySize(bar: Kline): number {
  return Math.abs(bar.close - bar.open);
}

function rejectionWick(bar: Kline, side: Side): boolean {
  const body = bodySize(bar);
  if (body === 0) {
    return false;
  }
  if (side === "LONG") {
    const wick = upperWick(bar);
    return wick > body * 1.5 && wick >= lowerWick(bar);
  }
  const wick = lowerWick(bar);
  return wick > body * 1.5 && wick >= upperWick(bar);
}

export type ReversalGuard =
  | { ok: true }
  | { ok: false; reason: string };

export function reversalGuard(input: {
  side: Side;
  mark: number;
  last: number;
  klines1m: Kline[];
  klines5m: Kline[];
}): ReversalGuard {
  const { side, mark, last } = input;
  const closed1m = lastClosedBar(input.klines1m);
  const prior1m = priorClosedBar(input.klines1m);
  const closed5m = lastClosedBar(input.klines5m);

  if (!closed1m || !prior1m) {
    return {
      ok: false,
      reason: "Need two closed 1m candles before sailing. Sitting."
    };
  }

  const priorBias = closedCandleBias(prior1m);
  if (priorBias !== side) {
    return {
      ok: false,
      reason: `Only one closed 1m ${side}; prior 1m is ${priorBias}. Waiting so we don't buy the reversal close.`
    };
  }

  if (closed5m && closedCandleBias(closed5m) !== side) {
    return {
      ok: false,
      reason: `5m closed ${closedCandleBias(closed5m)} against ${side}. Reversal risk.`
    };
  }

  if (rejectionWick(closed1m, side)) {
    return {
      ok: false,
      reason: `Closed 1m is a rejection wick against ${side}. Sitting.`
    };
  }
  if (closed5m && rejectionWick(closed5m, side)) {
    return {
      ok: false,
      reason: `Closed 5m is a rejection wick against ${side}. Sitting.`
    };
  }

  const closed1mSeries = withoutForming(input.klines1m);
  const closed5mSeries = withoutForming(input.klines5m);
  const atr1m = atr(closed1mSeries, ATR_PERIOD);
  const atr5m = atr(closed5mSeries, ATR_PERIOD);
  const range1 = barRange(closed1m);
  if (atr1m !== null && range1 > atr1m * 1.8) {
    return {
      ok: false,
      reason: `Closed 1m is exhausted (${range1.toFixed(6)} vs ATR ${atr1m.toFixed(6)}). Not buying the climax close.`
    };
  }
  if (closed5m && atr5m !== null && barRange(closed5m) > atr5m * 1.6) {
    return {
      ok: false,
      reason: "Closed 5m is exhausted vs ATR. Not buying the climax close."
    };
  }

  const priceHigh = Math.max(mark, last);
  const priceLow = Math.min(mark, last);
  if (side === "LONG" && priceHigh > closed1m.high) {
    return {
      ok: false,
      reason: "Chasing through the closed 1m high. Sitting."
    };
  }
  if (side === "SHORT" && priceLow < closed1m.low) {
    return {
      ok: false,
      reason: "Chasing through the closed 1m low. Sitting."
    };
  }

  return { ok: true };
}

export function closedCandleBias(bar: Kline | undefined): Bias {
  if (!bar) {
    return "FLAT";
  }
  if (bar.close > bar.open) {
    return "LONG";
  }
  if (bar.close < bar.open) {
    return "SHORT";
  }
  return "FLAT";
}

export function opposite(side: Side): Side {
  return side === "LONG" ? "SHORT" : "LONG";
}

export function orderSide(side: Side): "BUY" | "SELL" {
  return side === "LONG" ? "BUY" : "SELL";
}
