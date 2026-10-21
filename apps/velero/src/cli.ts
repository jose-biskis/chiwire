import {
  DEFAULT_COOLDOWN_SECONDS,
  DEFAULT_LEVERAGE,
  DEFAULT_MAX_OPEN,
  DEFAULT_NOTIONAL,
  DEFAULT_POLL_SECONDS
} from "./config.js";
import {
  DEFAULT_GOLD_EVERY_SECONDS,
  DEFAULT_GOLD_SCAN,
  DEFAULT_GOLD_TOP
} from "./digger.js";
import { percentToRate } from "./fees.js";

export type HelpCommand = {
  command: "help";
};

export type FeesCommand = {
  command: "fees";
  notional: number;
  takerFeeRate: number | null;
};

export type StatusCommand = {
  command: "status";
  live: boolean;
};

type PairFlags = {
  symbol: string;
  notional: number;
  leverage: number;
  maxOpen: number;
  tpPercent: number | null;
  slPercent: number | null;
  takerFeeRate: number | null;
  live: boolean;
};

export type QuoteCommand = PairFlags & {
  command: "quote";
};

export type TradeCommand = PairFlags & {
  command: "trade";
  dryRun: boolean;
  confirm: boolean;
  isolated: boolean;
};

export type WatchCommand = PairFlags & {
  command: "watch";
  dryRun: boolean;
  confirm: boolean;
  isolated: boolean;
  pollSeconds: number;
  cooldownSeconds: number;
  symbols: string[];
  goldDigger: boolean;
  goldTop: number;
  goldScan: number;
  goldEverySeconds: number;
};

export type CliCommand =
  | HelpCommand
  | FeesCommand
  | StatusCommand
  | QuoteCommand
  | TradeCommand
  | WatchCommand;

function readFlagValue(
  args: string[],
  index: number,
  flag: string
): { value: string; nextIndex: number } {
  const current = args[index];
  if (!current) {
    throw new Error(`Missing value for ${flag}`);
  }

  if (current.includes("=") && current.startsWith(`${flag}=`)) {
    return { value: current.slice(flag.length + 1), nextIndex: index + 1 };
  }

  const next = args[index + 1];
  if (!next || next.startsWith("-")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return { value: next, nextIndex: index + 2 };
}

function parsePositiveNumber(raw: string, flag: string): number {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${flag}: ${raw}`);
  }
  return value;
}

export function normalizeSymbol(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/[-_/]/g, "");
  if (!/^[A-Z0-9]{6,24}$/.test(compact)) {
    throw new Error(`Bad pair: ${raw}`);
  }
  return compact;
}

export function collectSymbols(tokens: string[]): string[] {
  const symbols: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const parts = token.split(",").map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      const symbol = normalizeSymbol(part);
      if (seen.has(symbol)) {
        continue;
      }
      seen.add(symbol);
      symbols.push(symbol);
    }
  }

  if (tokens.length > 0 && symbols.length === 0) {
    throw new Error("Usage: velero quote|trade|watch <PAIR> [PAIR...]");
  }

  if (symbols.length > 20) {
    throw new Error("Watch cap is 20 pairs. Split the fleet.");
  }

  return symbols;
}

export function printHelp(): void {
  console.log(`velero — Binance USDT-M futures co-trader

The vela is the candle. You are the boat. We do not sail into a pair that
already has a ticket open, and we do not pretend taker fees are free.

Usage:
  velero quote <PAIR> [options]
  velero trade <PAIR> [options]
  velero watch <PAIR> [PAIR...] [options]
  velero watch --gold-digger [options]
  velero fees [--notional 10] [--taker-fee 0.1]
  velero status [--live]
  velero help

Options:
  --notional <usdt>    Nominal (notional) size. Default ${DEFAULT_NOTIONAL}
  --leverage <n>       Leverage, capped at 10. Default ${DEFAULT_LEVERAGE}
  --max-open <n>       Max concurrent positions. Default ${DEFAULT_MAX_OPEN}
  --tp <percent>       Take-profit as % of notional (0.5 = 0.5%)
  --sl <percent>       Stop-loss as % of notional
  --taker-fee <pct>    Taker fee in percent (0.1 = 0.10% = 0.01 USDT on 10)
  --poll <seconds>     Watch loop interval. Default ${DEFAULT_POLL_SECONDS}
  --cooldown <seconds> After a sail (or dry-run), sit that long. Default ${DEFAULT_COOLDOWN_SECONDS}
  --gold-digger        Scan LIVE USDT-M; EYE pairs join the watch fleet
  --gold-top <n>       How many suggestions to print. Default ${DEFAULT_GOLD_TOP}
  --gold-scan <n>      Volume leaders to analyse. Default ${DEFAULT_GOLD_SCAN}
  --gold-every <sec>   Rescan interval. Default ${DEFAULT_GOLD_EVERY_SECONDS}
  --isolated           Isolated margin. Default is cross
  --dry-run            Print the order, do not send it
  --live               Use real futures (needs VELERO_LIVE=true)
  --confirm            Required with --live before an order is sent

Examples:
  velero quote RLCUSDT --notional 10
  velero trade RLCUSDT --notional 10 --leverage 10 --max-open 3 --dry-run
  velero watch RLCUSDT ETHUSDT --notional 10 --max-open 3 --dry-run
  velero watch RLCUSDT,ETHUSDT,BTCUSDT --notional 10
  velero watch --gold-digger
  velero watch RLCUSDT --gold-digger --gold-top 8
  velero fees --notional 10 --taker-fee 0.1

Keys: BINANCE_API_KEY / BINANCE_API_SECRET (apps/velero/.env).
Proxy: VELERO_PROXY if Binance geo-blocks this IP (Reja: http://127.0.0.1:3128).
Default venue is Binance futures *testnet*. Live is opt-in, twice.
`);
}

type PairBuilder = {
  symbol: string;
  symbols: string[];
  notional: number;
  leverage: number;
  maxOpen: number;
  tpPercent: number | null;
  slPercent: number | null;
  takerFeeRate: number | null;
  live: boolean;
  dryRun: boolean;
  confirm: boolean;
  isolated: boolean;
  pollSeconds: number;
  cooldownSeconds: number;
  goldDigger: boolean;
  goldTop: number;
  goldScan: number;
  goldEverySeconds: number;
};

function parsePairFlags(args: string[]): PairBuilder {
  let index = 1;
  const pairTokens: string[] = [];
  while (index < args.length) {
    const token = args[index]!;
    if (token.startsWith("-")) {
      break;
    }
    pairTokens.push(token);
    index += 1;
  }

  const symbols = collectSymbols(pairTokens);
  const first = symbols[0] ?? "";

  const builder: PairBuilder = {
    symbol: first,
    symbols,
    notional: DEFAULT_NOTIONAL,
    leverage: DEFAULT_LEVERAGE,
    maxOpen: DEFAULT_MAX_OPEN,
    tpPercent: null,
    slPercent: null,
    takerFeeRate: null,
    live: false,
    dryRun: false,
    confirm: false,
    isolated: false,
    pollSeconds: DEFAULT_POLL_SECONDS,
    cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
    goldDigger: false,
    goldTop: DEFAULT_GOLD_TOP,
    goldScan: DEFAULT_GOLD_SCAN,
    goldEverySeconds: DEFAULT_GOLD_EVERY_SECONDS
  };
  while (index < args.length) {
    const arg = args[index]!;

    if (arg === "--notional" || arg.startsWith("--notional=")) {
      const parsed = readFlagValue(args, index, "--notional");
      builder.notional = parsePositiveNumber(parsed.value, "--notional");
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--leverage" || arg.startsWith("--leverage=")) {
      const parsed = readFlagValue(args, index, "--leverage");
      builder.leverage = parsePositiveNumber(parsed.value, "--leverage");
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--max-open" || arg.startsWith("--max-open=")) {
      const parsed = readFlagValue(args, index, "--max-open");
      builder.maxOpen = parsePositiveNumber(parsed.value, "--max-open");
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--tp" || arg.startsWith("--tp=")) {
      const parsed = readFlagValue(args, index, "--tp");
      builder.tpPercent = percentToRate(
        parsePositiveNumber(parsed.value, "--tp")
      );
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--sl" || arg.startsWith("--sl=")) {
      const parsed = readFlagValue(args, index, "--sl");
      builder.slPercent = percentToRate(
        parsePositiveNumber(parsed.value, "--sl")
      );
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--taker-fee" || arg.startsWith("--taker-fee=")) {
      const parsed = readFlagValue(args, index, "--taker-fee");
      builder.takerFeeRate = percentToRate(
        parsePositiveNumber(parsed.value, "--taker-fee")
      );
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--live") {
      builder.live = true;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      builder.dryRun = true;
      index += 1;
      continue;
    }

    if (arg === "--confirm") {
      builder.confirm = true;
      index += 1;
      continue;
    }

    if (arg === "--isolated") {
      builder.isolated = true;
      index += 1;
      continue;
    }

    if (arg === "--poll" || arg.startsWith("--poll=")) {
      const parsed = readFlagValue(args, index, "--poll");
      const value = Number.parseInt(parsed.value, 10);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --poll: ${parsed.value}`);
      }
      builder.pollSeconds = value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--cooldown" || arg.startsWith("--cooldown=")) {
      const parsed = readFlagValue(args, index, "--cooldown");
      const value = Number.parseInt(parsed.value, 10);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Invalid --cooldown: ${parsed.value}`);
      }
      builder.cooldownSeconds = value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--gold-digger") {
      builder.goldDigger = true;
      index += 1;
      continue;
    }

    if (arg === "--gold-top" || arg.startsWith("--gold-top=")) {
      const parsed = readFlagValue(args, index, "--gold-top");
      const value = Number.parseInt(parsed.value, 10);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --gold-top: ${parsed.value}`);
      }
      builder.goldTop = value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--gold-scan" || arg.startsWith("--gold-scan=")) {
      const parsed = readFlagValue(args, index, "--gold-scan");
      const value = Number.parseInt(parsed.value, 10);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --gold-scan: ${parsed.value}`);
      }
      builder.goldScan = value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg === "--gold-every" || arg.startsWith("--gold-every=")) {
      const parsed = readFlagValue(args, index, "--gold-every");
      const value = Number.parseInt(parsed.value, 10);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --gold-every: ${parsed.value}`);
      }
      builder.goldEverySeconds = value;
      index = parsed.nextIndex;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return builder;
}

export function parseArgs(argv: string[]): CliCommand {
  const args = argv.slice(2);
  if (
    args.length === 0 ||
    args[0] === "help" ||
    args[0] === "--help" ||
    args[0] === "-h"
  ) {
    return { command: "help" };
  }

  const command = args[0];

  if (command === "fees") {
    let notional = DEFAULT_NOTIONAL;
    let takerFeeRate: number | null = null;
    let index = 1;
    while (index < args.length) {
      const arg = args[index]!;
      if (arg === "--notional" || arg.startsWith("--notional=")) {
        const parsed = readFlagValue(args, index, "--notional");
        notional = parsePositiveNumber(parsed.value, "--notional");
        index = parsed.nextIndex;
        continue;
      }
      if (arg === "--taker-fee" || arg.startsWith("--taker-fee=")) {
        const parsed = readFlagValue(args, index, "--taker-fee");
        takerFeeRate = percentToRate(
          parsePositiveNumber(parsed.value, "--taker-fee")
        );
        index = parsed.nextIndex;
        continue;
      }
      throw new Error(`Unknown option: ${arg}`);
    }
    return { command: "fees", notional, takerFeeRate };
  }

  if (command === "status") {
    let live = false;
    let index = 1;
    while (index < args.length) {
      const arg = args[index]!;
      if (arg === "--live") {
        live = true;
        index += 1;
        continue;
      }
      throw new Error(`Unknown option: ${arg}`);
    }
    return { command: "status", live };
  }

  if (command === "quote" || command === "trade" || command === "watch") {
    const parsed = parsePairFlags(args);
    if (command !== "watch" && parsed.goldDigger) {
      throw new Error("--gold-digger only works on watch");
    }

    if (command !== "watch" && parsed.symbols.length === 0) {
      throw new Error(`Usage: velero ${command} <PAIR>`);
    }

    if (command !== "watch" && parsed.symbols.length > 1) {
      throw new Error(
        `${command} takes one pair. Use: velero watch ${parsed.symbols.join(" ")}`
      );
    }

    if (
      command === "watch" &&
      parsed.symbols.length === 0 &&
      !parsed.goldDigger
    ) {
      throw new Error("watch needs a pair or --gold-digger");
    }

    if (command === "quote") {
      return {
        command: "quote",
        symbol: parsed.symbol,
        notional: parsed.notional,
        leverage: parsed.leverage,
        maxOpen: parsed.maxOpen,
        tpPercent: parsed.tpPercent,
        slPercent: parsed.slPercent,
        takerFeeRate: parsed.takerFeeRate,
        live: parsed.live
      };
    }

    if (command === "watch") {
      return {
        command: "watch",
        symbol: parsed.symbol,
        symbols: parsed.symbols,
        notional: parsed.notional,
        leverage: parsed.leverage,
        maxOpen: parsed.maxOpen,
        tpPercent: parsed.tpPercent,
        slPercent: parsed.slPercent,
        takerFeeRate: parsed.takerFeeRate,
        live: parsed.live,
        dryRun: parsed.dryRun,
        confirm: parsed.confirm,
        isolated: parsed.isolated,
        pollSeconds: parsed.pollSeconds,
        cooldownSeconds: parsed.cooldownSeconds,
        goldDigger: parsed.goldDigger,
        goldTop: parsed.goldTop,
        goldScan: parsed.goldScan,
        goldEverySeconds: parsed.goldEverySeconds
      };
    }

    return {
      command: "trade",
      symbol: parsed.symbol,
      notional: parsed.notional,
      leverage: parsed.leverage,
      maxOpen: parsed.maxOpen,
      tpPercent: parsed.tpPercent,
      slPercent: parsed.slPercent,
      takerFeeRate: parsed.takerFeeRate,
      live: parsed.live,
      dryRun: parsed.dryRun,
      confirm: parsed.confirm,
      isolated: parsed.isolated
    };
  }

  throw new Error(`Unknown command: ${command}`);
}
