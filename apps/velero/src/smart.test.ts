import assert from "node:assert/strict";
import test from "node:test";
import type { Kline } from "./types.js";
import { planTend, suggestSmartPercents } from "./smart.js";

function rangeBars(count: number, close: number, range: number): Kline[] {
  const bars: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    bars.push({
      openTime: i * 60_000,
      open: close,
      high: close + range / 2,
      low: close - range / 2,
      close,
      volume: 1
    });
  }
  return bars;
}

function withSwing(
  bars: Kline[],
  side: "LONG" | "SHORT",
  level: number,
  lookback: number
): Kline[] {
  const out = bars.map((bar) => ({ ...bar }));
  const lastClosed = out.length - 2;
  const start = Math.max(0, lastClosed - lookback + 1);
  for (let i = start; i <= lastClosed; i += 1) {
    const bar = out[i];
    if (!bar) {
      continue;
    }
    if (side === "LONG") {
      bar.low = Math.min(bar.low, level);
    } else {
      bar.high = Math.max(bar.high, level);
    }
  }
  return out;
}

test("smart-profit stop sits beyond 15m ATR noise, wider than the desk floor", () => {
  const plan = suggestSmartPercents({
    side: "LONG",
    mark: 100,
    takerFeeRate: 0.001,
    klines15m: rangeBars(40, 100, 2),
    klines5m: rangeBars(40, 100, 1),
    klines1m: rangeBars(40, 100, 0.4)
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) {
    return;
  }
  assert.ok(plan.slPercent > 0.01, `SL ${plan.slPercent} should beat desk ~0.4%`);
  assert.ok(
    plan.tpPercent < plan.slPercent,
    `TP ${plan.tpPercent} should be reachable, not 2R of SL ${plan.slPercent}`
  );
  assert.ok(plan.tpPercent > 0.002);
  assert.match(plan.note, /smart-profit/);
});

test("smart-profit sits when the ATR stop would exceed 5%", () => {
  const plan = suggestSmartPercents({
    side: "LONG",
    mark: 100,
    takerFeeRate: 0.001,
    klines15m: rangeBars(40, 100, 8),
    klines5m: rangeBars(40, 100, 8),
    klines1m: rangeBars(40, 100, 8)
  });
  assert.equal(plan.ok, false);
  if (plan.ok) {
    return;
  }
  assert.match(plan.reason, /too heavy/);
});

test("smart-profit sails the same weather when --smart-cap is raised", () => {
  const doodish = {
    side: "LONG" as const,
    mark: 100,
    takerFeeRate: 0.001,
    klines15m: rangeBars(40, 100, 8),
    klines5m: rangeBars(40, 100, 1),
    klines1m: rangeBars(40, 100, 0.4)
  };
  const blocked = suggestSmartPercents(doodish);
  const allowed = suggestSmartPercents({ ...doodish, maxSlPercent: 0.12 });
  assert.equal(blocked.ok, false);
  assert.equal(allowed.ok, true);
});

test("smart-profit uses the 15m swing when it is farther than ATR noise", () => {
  const quiet = rangeBars(40, 100, 0.4);
  const plan = suggestSmartPercents({
    side: "LONG",
    mark: 100,
    takerFeeRate: 0.001,
    klines15m: withSwing(quiet, "LONG", 97, 12),
    klines5m: rangeBars(40, 100, 0.3),
    klines1m: rangeBars(40, 100, 0.2)
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) {
    return;
  }
  assert.ok(plan.slPercent >= 0.025, `swing at 97 should need ~3% SL, got ${plan.slPercent}`);
});

test("smart-profit SHORT uses swing highs", () => {
  const quiet = rangeBars(40, 100, 0.4);
  const plan = suggestSmartPercents({
    side: "SHORT",
    mark: 100,
    takerFeeRate: 0.001,
    klines15m: withSwing(quiet, "SHORT", 103, 12),
    klines5m: rangeBars(40, 100, 0.3),
    klines1m: rangeBars(40, 100, 0.2)
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) {
    return;
  }
  assert.ok(plan.slPercent >= 0.025);
});

test("smart-profit sits without enough closed candles", () => {
  const plan = suggestSmartPercents({
    side: "LONG",
    mark: 100,
    takerFeeRate: 0.001,
    klines15m: rangeBars(3, 100, 1),
    klines5m: rangeBars(3, 100, 1),
    klines1m: rangeBars(3, 100, 1)
  });
  assert.equal(plan.ok, false);
});

function paintClosed(bars: Kline[], open: number, close: number): Kline[] {
  const out = bars.map((bar) => ({ ...bar }));
  const index = out.length - 2;
  const bar = out[index];
  if (!bar) {
    return out;
  }
  out[index] = {
    ...bar,
    open,
    close,
    high: Math.max(open, close, bar.high),
    low: Math.min(open, close, bar.low)
  };
  return out;
}

test("planTend banks when the closed 1m flips against a green long", () => {
  const plan = planTend({
    side: "LONG",
    entry: 100,
    mark: 101.5,
    last: 101.4,
    currentTp: 110,
    tickSize: 0.01,
    takerFeeRate: 0.001,
    klines15m: rangeBars(40, 101.5, 1),
    klines5m: rangeBars(40, 101.5, 0.6),
    klines1m: paintClosed(rangeBars(40, 101.5, 0.3), 101.8, 101.4),
    stopDist: 8
  });
  assert.equal(plan.action, "close");
});

test("planTend pulls an impossible TP down to nearby 5m structure", () => {
  const plan = planTend({
    side: "LONG",
    entry: 100,
    mark: 100,
    last: 100,
    currentTp: 120,
    tickSize: 0.01,
    takerFeeRate: 0.001,
    klines15m: rangeBars(40, 100, 2),
    klines5m: rangeBars(40, 100, 1),
    klines1m: paintClosed(rangeBars(40, 100, 0.4), 99.8, 100.1),
    stopDist: 8
  });
  assert.equal(plan.action, "pull-tp");
  if (plan.action !== "pull-tp") {
    return;
  }
  assert.ok(plan.triggerPrice < 120);
  assert.ok(plan.triggerPrice > 100);
});

test("planTend will not pull a long TP below entry while underwater", () => {
  const plan = planTend({
    side: "LONG",
    entry: 100,
    mark: 95,
    last: 95,
    currentTp: 120,
    tickSize: 0.01,
    takerFeeRate: 0.001,
    klines15m: rangeBars(40, 95, 1),
    klines5m: rangeBars(40, 95, 0.6),
    klines1m: paintClosed(rangeBars(40, 95, 0.3), 94.8, 95.1),
    stopDist: 8
  });
  assert.equal(plan.action, "pull-tp");
  if (plan.action !== "pull-tp") {
    return;
  }
  assert.ok(
    plan.triggerPrice > 100,
    `TP ${plan.triggerPrice} must stay green of entry 100`
  );
});

test("planTend repairs a long TP that was parked at a loss", () => {
  const plan = planTend({
    side: "LONG",
    entry: 100,
    mark: 95,
    last: 95,
    currentTp: 94.5,
    tickSize: 0.01,
    takerFeeRate: 0.001,
    klines15m: rangeBars(40, 95, 1),
    klines5m: rangeBars(40, 95, 0.6),
    klines1m: paintClosed(rangeBars(40, 95, 0.3), 94.8, 95.1),
    stopDist: 8
  });
  assert.equal(plan.action, "pull-tp");
  if (plan.action !== "pull-tp") {
    return;
  }
  assert.ok(plan.triggerPrice > 100);
  assert.match(plan.reason, /loss side/);
});
