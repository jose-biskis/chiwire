import assert from "node:assert/strict";
import test from "node:test";
import { signQuery } from "./gate.js";

test("signQuery is hex HMAC of the query string", () => {
  const digest = signQuery("secret", "symbol=RLCUSDT&timestamp=1");
  assert.equal(digest.length, 64);
  assert.match(digest, /^[a-f0-9]+$/);
  assert.equal(digest, signQuery("secret", "symbol=RLCUSDT&timestamp=1"));
  assert.notEqual(digest, signQuery("other", "symbol=RLCUSDT&timestamp=1"));
});
