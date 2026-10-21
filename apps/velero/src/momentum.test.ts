import assert from "node:assert/strict";
import test from "node:test";
import {
  closedCandleBias,
  lastClosedBar,
  readMomentum,
  reversalGuard,
  sma,
  withoutForming
} from "./momentum.js";
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

function body(open: number, close: number, openTime: number): Kline {
  return {
    openTime,
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    volume: 1
  };
}

function closedThenForming(open: number, close: number): Kline[] {
  return [body(open, close, 0), body(close, close, 60_000)];
}

test("lastClosedBar skips the forming candle", () => {
  const bars = closedThenForming(1, 1.01);
  assert.equal(lastClosedBar(bars)?.close, 1.01);
  assert.equal(lastClosedBar([body(1, 1.01, 0)]), undefined);
});

test("closedCandleBias reads the body, not the wick", () => {
  assert.equal(closedCandleBias(body(1, 1.02, 0)), "LONG");
  assert.equal(closedCandleBias(body(1.02, 1, 0)), "SHORT");
  assert.equal(closedCandleBias(body(1, 1, 0)), "FLAT");
});

test("aligned uptrend + impulse is LONG", () => {
  const read = readMomentum(ramp(1, 0.01, 60), ramp(1.4, 0.01, 20));
  assert.equal(read.bias, "LONG");
});

test("aligned 15m/5m LONG waits if the closed 1m is red", () => {
  const read = readMomentum(
    ramp(1, 0.01, 60),
    ramp(1.4, 0.01, 20),
    closedThenForming(1.5, 1.49)
  );
  assert.equal(read.bias, "FLAT");
  assert.equal(read.candle1m, "SHORT");
});

test("aligned 15m/5m LONG waits on a closed 1m doji", () => {
  const read = readMomentum(
    ramp(1, 0.01, 60),
    ramp(1.4, 0.01, 20),
    closedThenForming(1.5, 1.5)
  );
  assert.equal(read.bias, "FLAT");
  assert.equal(read.candle1m, "FLAT");
});

function twoGreenThenForming(): Kline[] {
  return [
    body(1.48, 1.49, 0),
    body(1.49, 1.5, 60_000),
    body(1.5, 1.5, 120_000)
  ];
}

function bodyTape(start: number, step: number, count: number): Kline[] {
  const bars: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    const close = start + step * i;
    const open = close - step / 2;
    bars.push(body(open, close, i * 60_000));
  }
  return bars;
}

test("reversalGuard wants two closed 1m in the trade direction", () => {
  const one = reversalGuard({
    side: "LONG",
    mark: 1.5,
    last: 1.5,
    klines1m: closedThenForming(1.49, 1.5),
    klines5m: bodyTape(1.4, 0.01, 20)
  });
  assert.equal(one.ok, false);

  const two = reversalGuard({
    side: "LONG",
    mark: 1.5,
    last: 1.5,
    klines1m: twoGreenThenForming(),
    klines5m: bodyTape(1.4, 0.01, 20)
  });
  assert.equal(two.ok, true);
});

test("reversalGuard sits when chasing through the 1m high", () => {
  const guard = reversalGuard({
    side: "LONG",
    mark: 1.52,
    last: 1.52,
    klines1m: twoGreenThenForming(),
    klines5m: bodyTape(1.4, 0.01, 20)
  });
  assert.equal(guard.ok, false);
  if (guard.ok) {
    return;
  }
  assert.match(guard.reason, /Chasing/);
});

test("reversalGuard sits on a 1m rejection wick", () => {
  const star: Kline = {
    openTime: 60_000,
    open: 1.49,
    close: 1.5,
    high: 1.56,
    low: 1.49,
    volume: 1
  };
  const guard = reversalGuard({
    side: "LONG",
    mark: 1.5,
    last: 1.5,
    klines1m: [body(1.48, 1.49, 0), star, body(1.5, 1.5, 120_000)],
    klines5m: bodyTape(1.4, 0.01, 20)
  });
  assert.equal(guard.ok, false);
  if (guard.ok) {
    return;
  }
  assert.match(guard.reason, /rejection wick/);
});

test("aligned 15m/5m LONG sails when the closed 1m is green", () => {
  const read = readMomentum(
    ramp(1, 0.01, 60),
    ramp(1.4, 0.01, 20),
    closedThenForming(1.49, 1.5)
  );
  assert.equal(read.bias, "LONG");
  assert.equal(read.candle1m, "LONG");
});

test("aligned 15m/5m SHORT waits if the closed 1m is green", () => {
  const read = readMomentum(
    ramp(2, -0.01, 60),
    ramp(1.6, -0.01, 20),
    closedThenForming(1.49, 1.5)
  );
  assert.equal(read.bias, "FLAT");
  assert.equal(read.candle1m, "LONG");
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
        isolated: true,
        entryPrice: 1.23,
        markPrice: 1.23
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
        isolated: true,
        entryPrice: 2000,
        markPrice: 2000
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
        isolated: true,
        entryPrice: 2000,
        markPrice: 2000
      }
    ],
    openOrders: []
  });
  assert.equal(decision.ok, true);
});
