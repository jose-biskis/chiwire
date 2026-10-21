import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs } from "@chiwire/velero/cli";
import { favoriteProfileDraft, profileToArgv } from "./profile.js";

test("favorite profile argv is a valid live smart-profit gold-digger watch", () => {
  const draft = favoriteProfileDraft();
  const profile = {
    ...draft,
    id: "test",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const argv = profileToArgv(profile);
  assert.ok(argv.includes("METUSDT"));
  assert.ok(argv.includes("--smart-profit"));
  assert.ok(argv.includes("--gold-digger"));
  assert.ok(argv.includes("--live"));
  assert.ok(argv.includes("--confirm"));
  const parsed = parseArgs(["node", "velero", ...argv]);
  assert.equal(parsed.command, "watch");
  if (parsed.command !== "watch") {
    return;
  }
  assert.equal(parsed.smartProfit, true);
  assert.equal(parsed.smartCap, 0.15);
  assert.equal(parsed.goldDigger, true);
  assert.equal(parsed.live, true);
  assert.equal(parsed.confirm, true);
  assert.equal(parsed.maxOpen, 6);
  assert.equal(parsed.pollSeconds, 1);
  assert.equal(parsed.cooldownSeconds, 5);
  assert.deepEqual(parsed.symbols, [
    "METUSDT",
    "RLCUSDT",
    "DOODUSDT",
    "JCTUSDT",
    "IOSTUSDT"
  ]);
});
