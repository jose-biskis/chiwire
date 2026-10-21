import assert from "node:assert/strict";
import test from "node:test";
import {
  ema,
  macd,
  rsi,
  scoreTape,
  type TapeSnapshot
} from "./indicators.js";

function ramp(start: number, step: number, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i += 1) {
    values.push(start + step * i);
  }
  return values;
}

test("ema of a flat series is the price", () => {
  assert.equal(ema([4, 4, 4, 4, 4], 3), 4);
});

test("rsi is high on a steady climb", () => {
  const value = rsi(ramp(1, 0.5, 40), 14);
  assert.ok(value !== null && value > 70);
});

test("macd histogram is positive on an accelerating climb", () => {
  const closes: number[] = [];
  let price = 10;
  for (let i = 0; i < 80; i += 1) {
    price *= 1.02;
    closes.push(price);
  }
  const read = macd(closes);
  assert.ok(read !== null);
  assert.ok(read.macd > 0);
  assert.ok(read.histogram > 0);
});

function bullishTape(overrides: Partial<TapeSnapshot> = {}): TapeSnapshot {
  return {
    symbol: "RLCUSDT",
    close: 2,
    change24h: 0.06,
    quoteVolume: 80_000_000,
    high24h: 2.01,
    low24h: 1.7,
    fundingRate: -0.0001,
    volumeRatio: 1.8,
    ema20: 1.9,
    ema50: 1.8,
    ema200: 1.5,
    rsi: 58,
    macd: {
      macd: 0.04,
      signal: 0.02,
      histogram: 0.02,
      previousHistogram: 0.01
    },
    stoch: { k: 62, d: 55 },
    bollinger: {
      mid: 1.85,
      upper: 2.1,
      lower: 1.6,
      width: 0.27,
      percentB: 0.8
    },
    atrPercent: 0.02,
    adx: { adx: 28, plusDi: 30, minusDi: 12 },
    oi: 1_000_000,
    oiChange: 0.08,
    structure: "up",
    ...overrides
  };
}

test("scoreTape wants an eye on a bullish confluence", () => {
  const eye = scoreTape(bullishTape());
  assert.ok(eye);
  assert.equal(eye.bias, "LONG");
  assert.ok(eye.score >= 6);
  assert.ok(eye.reasons.length >= 3);
});

test("scoreTape stays quiet on mush", () => {
  const eye = scoreTape(
    bullishTape({
      change24h: 0,
      volumeRatio: 0.7,
      ema20: 2,
      ema50: 2,
      ema200: 2,
      rsi: 50,
      macd: {
        macd: 0,
        signal: 0,
        histogram: 0,
        previousHistogram: 0
      },
      stoch: { k: 50, d: 50 },
      bollinger: {
        mid: 2,
        upper: 2.05,
        lower: 1.95,
        width: 0.05,
        percentB: 0.5
      },
      adx: { adx: 12, plusDi: 15, minusDi: 15 },
      oiChange: 0,
      structure: "chop",
      quoteVolume: 9_000_000
    })
  );
  assert.equal(eye, null);
});
