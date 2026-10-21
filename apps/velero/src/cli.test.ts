import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSymbol, parseArgs } from "./cli.js";

test("normalizeSymbol accepts RLCUSDT and dotted aliases", () => {
  assert.equal(normalizeSymbol("rlc/usdt"), "RLCUSDT");
  assert.equal(normalizeSymbol("RLC-USDT"), "RLCUSDT");
});

test("quote parses notional leverage and fee percents as rates", () => {
  const command = parseArgs([
    "node",
    "velero",
    "quote",
    "RLCUSDT",
    "--notional",
    "10",
    "--leverage",
    "10",
    "--tp",
    "0.5",
    "--sl",
    "0.25",
    "--taker-fee",
    "0.1"
  ]);
  assert.equal(command.command, "quote");
  if (command.command !== "quote") {
    return;
  }
  assert.equal(command.symbol, "RLCUSDT");
  assert.equal(command.notional, 10);
  assert.equal(command.tpPercent, 0.005);
  assert.equal(command.slPercent, 0.0025);
  assert.equal(command.takerFeeRate, 0.001);
});

test("trade requires the pair and keeps dry-run off the live path", () => {
  const command = parseArgs([
    "node",
    "velero",
    "trade",
    "RLCUSDT",
    "--dry-run",
    "--max-open",
    "3"
  ]);
  assert.equal(command.command, "trade");
  if (command.command !== "trade") {
    return;
  }
  assert.equal(command.dryRun, true);
  assert.equal(command.live, false);
  assert.equal(command.maxOpen, 3);
  assert.equal(command.isolated, false);
});

test("trade --isolated opts into isolated margin", () => {
  const command = parseArgs([
    "node",
    "velero",
    "trade",
    "RLCUSDT",
    "--isolated"
  ]);
  assert.equal(command.command, "trade");
  if (command.command !== "trade") {
    return;
  }
  assert.equal(command.isolated, true);
});

test("watch parses poll and cooldown and stays dry-run until armed", () => {
  const command = parseArgs([
    "node",
    "velero",
    "watch",
    "RLCUSDT",
    "--notional",
    "10",
    "--poll",
    "15",
    "--cooldown",
    "120",
    "--dry-run",
    "--max-open",
    "3"
  ]);
  assert.equal(command.command, "watch");
  if (command.command !== "watch") {
    return;
  }
  assert.equal(command.symbol, "RLCUSDT");
  assert.deepEqual(command.symbols, ["RLCUSDT"]);
  assert.equal(command.pollSeconds, 15);
  assert.equal(command.cooldownSeconds, 120);
  assert.equal(command.dryRun, true);
  assert.equal(command.live, false);
});

test("watch accepts several pairs as args or a comma list", () => {
  const spaced = parseArgs([
    "node",
    "velero",
    "watch",
    "RLCUSDT",
    "ETHUSDT",
    "BTCUSDT",
    "--notional",
    "10"
  ]);
  assert.equal(spaced.command, "watch");
  if (spaced.command !== "watch") {
    return;
  }
  assert.deepEqual(spaced.symbols, ["RLCUSDT", "ETHUSDT", "BTCUSDT"]);

  const commas = parseArgs([
    "node",
    "velero",
    "watch",
    "rlc/usdt,eth-usdt",
    "--dry-run"
  ]);
  assert.equal(commas.command, "watch");
  if (commas.command !== "watch") {
    return;
  }
  assert.deepEqual(commas.symbols, ["RLCUSDT", "ETHUSDT"]);
});

test("watch --gold-digger can run with no pairs", () => {
  const command = parseArgs([
    "node",
    "velero",
    "watch",
    "--gold-digger",
    "--gold-top",
    "5",
    "--gold-scan",
    "20"
  ]);
  assert.equal(command.command, "watch");
  if (command.command !== "watch") {
    return;
  }
  assert.equal(command.goldDigger, true);
  assert.deepEqual(command.symbols, []);
  assert.equal(command.goldTop, 5);
  assert.equal(command.goldScan, 20);
});

test("quote refuses a fleet", () => {
  assert.throws(
    () => parseArgs(["node", "velero", "quote", "RLCUSDT", "ETHUSDT"]),
    /watch RLCUSDT ETHUSDT/
  );
});

test("fees command is pair-less", () => {
  const command = parseArgs([
    "node",
    "velero",
    "fees",
    "--notional",
    "10",
    "--taker-fee",
    "0.1"
  ]);
  assert.equal(command.command, "fees");
  if (command.command !== "fees") {
    return;
  }
  assert.equal(command.notional, 10);
  assert.equal(command.takerFeeRate, 0.001);
});
