import process from "node:process";
import type { WatchCommand } from "./cli.js";
import { baseUrlFor, maskKey, readEnv, venueLabel } from "./config.js";
import { mergeFleet, runGoldDigger } from "./digger.js";
import { printWatchLine } from "./format.js";
import { sail } from "./trade.js";

export function cooldownRemainingMs(now: number, until: number): number {
  return Math.max(0, until - now);
}

export function sleep(
  ms: number,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || ms <= 0) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runWatch(command: WatchCommand): Promise<void> {
  const env = readEnv();
  const armed = !command.dryRun && Boolean(env.apiKey && env.apiSecret);
  const watching: WatchCommand = armed
    ? command
    : {
        ...command,
        dryRun: true
      };

  if (command.live && !command.dryRun && armed && !command.confirm) {
    throw new Error(
      "LIVE watch that can send orders needs --confirm (once, at launch)."
    );
  }

  const abort = new AbortController();
  const onStop = (): void => {
    abort.abort();
  };
  process.on("SIGINT", onStop);
  process.on("SIGTERM", onStop);

  const mode = watching.dryRun ? "eyes only" : "armed";
  const fleet = [...watching.symbols];
  const fleetLabel = (): string =>
    fleet.length > 0 ? fleet.join(" ") : "(no fleet)";
  console.log(
    `velero  watch  ${venueLabel(watching.live)}  ${baseUrlFor(watching.live)}  ${fleetLabel()}  poll ${watching.pollSeconds}s  cooldown ${watching.cooldownSeconds}s  ${mode}  ${watching.isolated ? "isolated" : "cross"}`
  );
  if (watching.goldDigger) {
    console.log(
      `gold-digger on  LIVE tape  scan ${watching.goldScan}  top ${watching.goldTop}  every ${watching.goldEverySeconds}s  (EYE pairs join the fleet; 15m/5m gates still decide the sail)`
    );
  }
  if (!env.apiKey || !env.apiSecret) {
    console.log(
      "No API keys loaded; risk gates are off and no order will be sent."
    );
  } else {
    console.log(`API key ${maskKey(env.apiKey)} will be signed against that host.`);
    if (!watching.live) {
      console.log(
        "Testnet only accepts futures TESTNET keys. A live Binance key → -2015. Real book: VELERO_LIVE=true and --live --confirm."
      );
    }
    if (env.liveAllowed && !watching.live) {
      console.log(
        "VELERO_LIVE is true, but this process is still testnet until you pass --live."
      );
    }
    if (watching.dryRun) {
      console.log("Dry-run: will not send. Drop --dry-run to let the boat leave.");
    }
  }
  console.log(
    `Closed 5m/15m candles only. Cooldown is per pair. Max open is shared. Ctrl-C drops anchor.`
  );
  console.log("");

  const cooldownUntil = new Map<string, number>();
  let lastGoldAt = 0;

  try {
    while (!abort.signal.aborted) {
      if (
        watching.goldDigger &&
        Date.now() - lastGoldAt >= watching.goldEverySeconds * 1000
      ) {
        try {
          const suggestions = await runGoldDigger({
            env,
            scan: watching.goldScan,
            top: watching.goldTop,
            signal: abort.signal
          });
          const merged = mergeFleet({
            fleet,
            additions: suggestions.map((row) => row.symbol),
            cap: 20
          });
          fleet.length = 0;
          fleet.push(...merged.fleet);
          for (const symbol of merged.joined) {
            const eye = suggestions.find((row) => row.symbol === symbol);
            printWatchLine({
              symbol,
              status: "join",
              detail: eye
                ? `${eye.bias} ${eye.setup} score ${eye.score}`
                : "gold-digger"
            });
          }
          if (merged.skipped.length > 0) {
            printWatchLine({
              symbol: "gold",
              status: "full",
              detail: `fleet at 20, not joining ${merged.skipped.join(" ")}`
            });
          }
          lastGoldAt = Date.now();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          printWatchLine({
            symbol: "gold",
            status: "error",
            detail: message
          });
          lastGoldAt = Date.now();
        }
      }

      for (const symbol of [...fleet]) {
        if (abort.signal.aborted) {
          break;
        }

        const remaining = cooldownRemainingMs(
          Date.now(),
          cooldownUntil.get(symbol) ?? 0
        );
        if (remaining > 0) {
          printWatchLine({
            symbol,
            status: "wait",
            detail: `cooldown ${Math.ceil(remaining / 1000)}s`
          });
          continue;
        }

        const tick: WatchCommand = {
          ...watching,
          symbol
        };

        try {
          const result = await sail(tick, { verbose: false });
          if (abort.signal.aborted) {
            break;
          }

          if (result.status === "skipped") {
            printWatchLine({
              symbol,
              status: result.bias === "FLAT" ? "flat" : "hold",
              detail: result.reason
            });
          } else if (result.status === "dry-run") {
            printWatchLine({
              symbol,
              status: "would",
              detail: `${result.side} — ${result.reason}`
            });
            cooldownUntil.set(
              symbol,
              Date.now() + watching.cooldownSeconds * 1000
            );
          } else {
            printWatchLine({
              symbol,
              status: "sail",
              detail: `${result.side} — ${result.reason}`
            });
            cooldownUntil.set(
              symbol,
              Date.now() + watching.cooldownSeconds * 1000
            );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          printWatchLine({
            symbol,
            status: "error",
            detail: message
          });
        }
      }

      const waitSeconds =
        fleet.length > 0 ? watching.pollSeconds : watching.goldEverySeconds;
      await sleep(waitSeconds * 1000, abort.signal);
    }
  } finally {
    process.off("SIGINT", onStop);
    process.off("SIGTERM", onStop);
    printWatchLine({
      symbol: "watch",
      status: "stop",
      detail: `anchor down  ${fleetLabel()}`
    });
  }
}
