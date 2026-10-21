import assert from "node:assert/strict";
import test from "node:test";
import { readMomentum, sma, withoutForming } from "./momentum.js";
import type { Kline } from "./types.js";
import { evaluateRisk } from "./risk.js";

function ramp(start: number, step: number, count: number): Kline[] {
  const bars: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    const close = start + step * i;
    bars.push({
      openTime: i * 60_000,
      open: close - step / 2,
      high: close + Math.abs(step),
      low: close - Math.abs(step),
      close,
      volume: 1
    });
  }
  return bars;
}

test("sma of a flat series is the price", () => {
  assert.equal(sma([2, 2, 2, 2], 4), 2);
});

test("withoutForming drops the live candle", () => {
  const bars = ramp(1, 0.01, 5);
  const closed = withoutForming(bars);
  assert.equal(closed.length, 4);
  assert.equal(closed[closed.length - 1]?.openTime, bars[3]?.openTime);
});

test("aligned uptrend + impulse is LONG", () => {
  const read = readMomentum(ramp(1, 0.01, 60), ramp(1.4, 0.01, 20));
  assert.equal(read.bias, "LONG");
});

test("aligned downtrend + impulse is SHORT", () => {
  const read = readMomentum(ramp(2, -0.01, 60), ramp(1.6, -0.01, 20));
  assert.equal(read.bias, "SHORT");
});

test("mixed trend vs impulse stays FLAT", () => {
  const read = readMomentum(ramp(1, 0.01, 60), ramp(2, -0.02, 20));
  assert.equal(read.bias, "FLAT");
});

test("risk blocks a second ticket on the same pair", () => {
  const decision = evaluateRisk({
    symbol: "RLCUSDT",
    maxOpen: 3,
    positions: [
      {
        symbol: "RLCUSDT",
        positionAmt: 8.1,
        notional: 10,
        leverage: 10,
        isolated: true
      }
    ],
    openOrders: []
  });
  assert.equal(decision.ok, false);
});

test("risk blocks when the open-position berth is full", () => {
  const decision = evaluateRisk({
    symbol: "BTCUSDT",
    maxOpen: 1,
    positions: [
      {
        symbol: "ETHUSDT",
        positionAmt: 0.01,
        notional: 10,
        leverage: 10,
        isolated: true
      }
    ],
    openOrders: []
  });
  assert.equal(decision.ok, false);
});

test("risk allows a fresh pair under the cap", () => {
  const decision = evaluateRisk({
    symbol: "RLCUSDT",
    maxOpen: 3,
    positions: [
      {
        symbol: "ETHUSDT",
        positionAmt: 0.01,
        notional: 10,
        leverage: 10,
        isolated: true
      }
    ],
    openOrders: []
  });
  assert.equal(decision.ok, true);
});
