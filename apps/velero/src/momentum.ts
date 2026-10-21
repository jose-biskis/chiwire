import type { Bias, Kline, Side } from "./types.js";

export type MomentumRead = {
  bias: Bias;
  reason: string;
  close: number;
  smaFast: number | null;
  smaSlow: number | null;
  roc: number | null;
  atrPercent: number | null;
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

export function atrPercent(klines: Kline[], period: number): number | null {
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

  const last = klines[klines.length - 1];
  if (!last || last.close === 0) {
    return null;
  }

  return sum / count / last.close;
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

export function readMomentum(
  klines15m: Kline[],
  klines5m: Kline[]
): MomentumRead {
  const closes15 = klines15m.map((bar) => bar.close);
  const closes5 = klines5m.map((bar) => bar.close);
  const close = closes15[closes15.length - 1] ?? closes5[closes5.length - 1];

  if (close === undefined) {
    return {
      bias: "FLAT",
      reason: "No candles. Can't sail without water.",
      close: 0,
      smaFast: null,
      smaSlow: null,
      roc: null,
      atrPercent: null
    };
  }

  const smaFast = sma(closes15, FAST);
  const smaSlow = sma(closes15, SLOW);
  const rateOfChange = roc(closes5, ROC_BARS);
  const atr = atrPercent(klines15m, ATR_PERIOD);

  const trend: Bias =
    smaFast !== null && smaSlow !== null
      ? stackBias(close, smaFast, smaSlow)
      : "FLAT";
  const impulse: Bias =
    rateOfChange !== null ? impulseBias(rateOfChange) : "FLAT";

  const rocText =
    rateOfChange === null ? "n/a" : `${(rateOfChange * 100).toFixed(2)}%`;

  if (trend !== "FLAT" && trend === impulse) {
    return {
      bias: trend,
      reason: `15m SMA stack ${trend} and 5m ROC ${rocText} agree.`,
      close,
      smaFast,
      smaSlow,
      roc: rateOfChange,
      atrPercent: atr
    };
  }

  if (trend === "FLAT" && impulse !== "FLAT") {
    return {
      bias: "FLAT",
      reason: `5m wants ${impulse} (ROC ${rocText}) but 15m trend is mixed. Sitting on hands.`,
      close,
      smaFast,
      smaSlow,
      roc: rateOfChange,
      atrPercent: atr
    };
  }

  if (impulse === "FLAT" && trend !== "FLAT") {
    return {
      bias: "FLAT",
      reason: `15m trend ${trend} but 5m has no impulse (ROC ${rocText}). Waiting.`,
      close,
      smaFast,
      smaSlow,
      roc: rateOfChange,
      atrPercent: atr
    };
  }

  if (trend !== impulse) {
    return {
      bias: "FLAT",
      reason: `15m ${trend} vs 5m ${impulse}. Conflict — no order.`,
      close,
      smaFast,
      smaSlow,
      roc: rateOfChange,
      atrPercent: atr
    };
  }

  return {
    bias: "FLAT",
    reason: "No trend, no impulse. Anchored.",
    close,
    smaFast,
    smaSlow,
    roc: rateOfChange,
    atrPercent: atr
  };
}

export function withoutForming(klines: Kline[]): Kline[] {
  return klines.length > 1 ? klines.slice(0, -1) : klines;
}

export function opposite(side: Side): Side {
  return side === "LONG" ? "SHORT" : "LONG";
}

export function orderSide(side: Side): "BUY" | "SELL" {
  return side === "LONG" ? "BUY" : "SELL";
}
