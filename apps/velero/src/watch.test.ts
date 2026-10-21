import assert from "node:assert/strict";
import test from "node:test";
import { mergeFleet } from "./digger.js";
import { cooldownRemainingMs, sleep } from "./watch.js";

test("cooldown remaining is never negative", () => {
  assert.equal(cooldownRemainingMs(100, 80), 0);
  assert.equal(cooldownRemainingMs(100, 150), 50);
});

test("sleep resolves immediately when already aborted", async () => {
  const abort = new AbortController();
  abort.abort();
  const started = Date.now();
  await sleep(5_000, abort.signal);
  assert.ok(Date.now() - started < 200);
});

test("mergeFleet joins new EYE pairs and respects the cap", () => {
  const merged = mergeFleet({
    fleet: ["RLCUSDT"],
    additions: ["RLCUSDT", "ETHUSDT", "BTCUSDT"],
    cap: 2
  });
  assert.deepEqual(merged.fleet, ["RLCUSDT", "ETHUSDT"]);
  assert.deepEqual(merged.joined, ["ETHUSDT"]);
  assert.deepEqual(merged.skipped, ["BTCUSDT"]);
});

test("sleep wakes when aborted mid-wait", async () => {
  const abort = new AbortController();
  const started = Date.now();
  const waiting = sleep(5_000, abort.signal);
  abort.abort();
  await waiting;
  assert.ok(Date.now() - started < 200);
});
