#!/usr/bin/env node
import process from "node:process";
import { parseArgs, printHelp } from "./cli.js";
import { loadVeleroEnv } from "./env.js";
import { runFees, runQuote, runStatus, runTrade } from "./trade.js";
import { runWatch } from "./watch.js";

async function main(): Promise<void> {
  loadVeleroEnv();
  const command = parseArgs(process.argv);

  if (command.command === "help") {
    printHelp();
    return;
  }

  if (command.command === "fees") {
    runFees(command.notional, command.takerFeeRate);
    return;
  }

  if (command.command === "status") {
    await runStatus(command.live);
    return;
  }

  if (command.command === "quote") {
    await runQuote(command);
    return;
  }

  if (command.command === "watch") {
    await runWatch(command);
    return;
  }

  await runTrade(command);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  process.exitCode = 1;
});
