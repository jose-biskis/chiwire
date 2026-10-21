import assert from "node:assert/strict";
import test from "node:test";
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

test("sleep wakes when aborted mid-wait", async () => {
  const abort = new AbortController();
  const started = Date.now();
  const waiting = sleep(5_000, abort.signal);
  abort.abort();
  await waiting;
  assert.ok(Date.now() - started < 200);
});
