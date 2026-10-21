import assert from "node:assert/strict";
import test from "node:test";
import {
  decimalPlaces,
  floorToStep,
  protectivePrices,
  quantityFromNotional,
  roundToTick
} from "./precision.js";

test("decimalPlaces reads lot steps", () => {
  assert.equal(decimalPlaces("0.001"), 3);
  assert.equal(decimalPlaces("1"), 0);
  assert.equal(decimalPlaces("0.0000100"), 7);
});

test("floorToStep never exceeds the raw qty", () => {
  assert.equal(floorToStep(8.129, 0.1), 8.1);
  assert.equal(floorToStep(1.999, 0.001), 1.999);
});

test("quantityFromNotional floors to step and keeps min notional", () => {
  const size = quantityFromNotional({
    notional: 10,
    price: 1.2345,
    stepSize: 0.1,
    minQty: 0.1,
    minNotional: 5
  });
  assert.equal(size.quantity, 8.1);
  assert.ok(size.actualNotional <= 10 + 1e-9);
});

test("roundToTick floors and ceils", () => {
  assert.equal(roundToTick(1.23456, 0.001, "floor"), 1.234);
  assert.equal(roundToTick(1.23456, 0.001, "ceil"), 1.235);
});

test("protectivePrices widens a stop that would round into last on a fat tick", () => {
  const prices = protectivePrices({
    side: "LONG",
    mark: 0.053,
    last: 0.052,
    tpPercent: 0.005,
    slPercent: 0.0025,
    tickSize: 0.001
  });
  assert.equal(prices.ok, true);
  if (!prices.ok) {
    return;
  }
  assert.ok(prices.stopLoss < 0.0523);
  assert.ok(prices.takeProfit > 0.0523);
  assert.equal(prices.widened, true);
});

test("protectivePrices sits when the tick is the whole price", () => {
  const prices = protectivePrices({
    side: "LONG",
    mark: 0.001,
    last: 0.001,
    tpPercent: 0.005,
    slPercent: 0.0025,
    tickSize: 0.001
  });
  assert.equal(prices.ok, false);
});
