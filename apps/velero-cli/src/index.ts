#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  loadVeleroEnv,
  parseArgs,
  printHelp,
  runFees,
  runQuote,
  runStatus,
  runTrade,
  runWatch
} from "@chiwire/velero-shared";

async function main(): Promise<void> {
  const cliRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  loadVeleroEnv([path.join(cliRoot, ".env")]);
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
