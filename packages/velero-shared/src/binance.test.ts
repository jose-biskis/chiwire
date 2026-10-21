import assert from "node:assert/strict";
import test from "node:test";
import { explainBinanceError, unwrapList } from "./binance.js";

test("-2015 on testnet points at live-key mismatch", () => {
  const text = explainBinanceError(
    -2015,
    "Invalid API-key, IP, or permissions for action",
    "https://testnet.binancefuture.com"
  );
  assert.match(text, /testnet/i);
  assert.match(text, /--live/);
});

test("-4168 names Multi-Assets instead of looking like a crash", () => {
  const text = explainBinanceError(
    -4168,
    "Unable to adjust to isolated-margin mode under the Multi-Assets mode.",
    "https://fapi.binance.com"
  );
  assert.match(text, /Multi-Assets/);
});

test("-4120 points at the algo order endpoint", () => {
  const text = explainBinanceError(
    -4120,
    "Order type not supported for this endpoint. Please use the Algo Order API endpoints instead.",
    "https://fapi.binance.com"
  );
  assert.match(text, /algoOrder/);
});

test("-2015 on live points at futures permission and IP whitelist", () => {
  const text = explainBinanceError(
    -2015,
    "Invalid API-key, IP, or permissions for action",
    "https://fapi.binance.com"
  );
  assert.match(text, /LIVE/);
  assert.match(text, /Enable Futures/);
});

test("unwrapList accepts a bare array or a data/positions wrapper", () => {
  assert.deepEqual(unwrapList([{ symbol: "RLCUSDT" }], "positionRisk payload"), [
    { symbol: "RLCUSDT" }
  ]);
  assert.deepEqual(
    unwrapList({ data: [{ symbol: "DOODUSDT" }] }, "positionRisk payload"),
    [{ symbol: "DOODUSDT" }]
  );
  assert.deepEqual(
    unwrapList({ positions: [{ symbol: "JCTUSDT" }] }, "positionRisk payload"),
    [{ symbol: "JCTUSDT" }]
  );
});

test("unwrapList names the unexpected payload instead of a blank error", () => {
  assert.throws(
    () => unwrapList({ code: 200, msg: "ok" }, "positionRisk payload"),
    /Unexpected positionRisk payload: .*code/
  );
});
