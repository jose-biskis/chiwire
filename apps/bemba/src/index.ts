#!/usr/bin/env node
import process from "node:process";
import { parseArgs, printHelp } from "./cli.js";
import { runHttpTunnel } from "./tunnel.js";

async function main(): Promise<void> {
  const command = parseArgs(process.argv);

  if (command.command === "help") {
    printHelp();
    return;
  }

  await runHttpTunnel(command);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  process.exitCode = 1;
});
