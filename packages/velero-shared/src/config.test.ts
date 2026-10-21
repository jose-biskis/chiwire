import assert from "node:assert/strict";
import test from "node:test";
import { canSign, type VeleroEnv } from "./config.js";

const empty: VeleroEnv = {
  apiKey: null,
  apiSecret: null,
  liveAllowed: false,
  maxNotional: 25,
  maxLeverage: 10,
  maxOpen: 3,
  takerFeeRate: null,
  proxyUrl: null,
  gateFetchUrl: null
};

test("canSign is true with Harbor even when the VPS has no keys", () => {
  assert.equal(canSign(empty), false);
  assert.equal(
    canSign({ ...empty, gateFetchUrl: "http://127.0.0.1:3001/internal/binance" }),
    true
  );
  assert.equal(canSign({ ...empty, apiKey: "k", apiSecret: "s" }), true);
  assert.equal(canSign({ ...empty, apiKey: "k" }), false);
});
