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
  assert.equal(command.pollSeconds, 15);
  assert.equal(command.cooldownSeconds, 120);
  assert.equal(command.dryRun, true);
  assert.equal(command.live, false);
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
