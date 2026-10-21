import assert from "node:assert/strict";
import test from "node:test";
import { explainBinanceError } from "./binance.js";

test("-2015 on testnet points at live-key mismatch", () => {
  const text = explainBinanceError(
    -2015,
    "Invalid API-key, IP, or permissions for action",
    "https://testnet.binancefuture.com"
  );
  assert.match(text, /testnet/i);
  assert.match(text, /--live/);
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
