import assert from "node:assert/strict";
import test from "node:test";
import { suggestPercents } from "./fees.js";

test("10 USDT at 0.10% taker keeps the 0.05/0.025 sketch as the example row", () => {
  const suggestion = suggestPercents({ notional: 10, takerFeeRate: 0.001 });
  assert.ok(Math.abs(suggestion.oneWayFeeUsdt - 0.01) < 1e-12);
  assert.ok(Math.abs(suggestion.roundTripFeeUsdt - 0.02) < 1e-12);
  assert.ok(Math.abs(suggestion.exampleTpUsdt - 0.05) < 1e-12);
  assert.ok(Math.abs(suggestion.exampleSlUsdt - 0.025) < 1e-12);
});

test("desk default lifts TP/SL so net reward is about 2:1 after fees", () => {
  const suggestion = suggestPercents({ notional: 10, takerFeeRate: 0.001 });
  assert.ok(suggestion.tpUsdt > suggestion.exampleTpUsdt);
  assert.ok(suggestion.netTpUsdt > 0);
  assert.ok(Math.abs(suggestion.netRewardRatio - 2) < 0.05);
});

test("custom 0.5% / 0.25% matches the user sketch and warns about fees", () => {
  const suggestion = suggestPercents({
    notional: 10,
    takerFeeRate: 0.001,
    tpPercent: 0.005,
    slPercent: 0.0025
  });
  assert.ok(Math.abs(suggestion.tpUsdt - 0.05) < 1e-12);
  assert.ok(Math.abs(suggestion.slUsdt - 0.025) < 1e-12);
  assert.ok(Math.abs(suggestion.netTpUsdt - 0.03) < 1e-12);
  assert.ok(Math.abs(suggestion.netSlUsdt - 0.045) < 1e-12);
  assert.ok(suggestion.netRewardRatio < 1);
  assert.match(suggestion.note, /weaker than 2:1/i);
});

test("scales the example with notional", () => {
  const suggestion = suggestPercents({ notional: 20, takerFeeRate: 0.001 });
  assert.equal(suggestion.exampleTpUsdt, 0.1);
  assert.equal(suggestion.exampleSlUsdt, 0.05);
});
