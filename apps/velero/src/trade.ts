import { BinanceFutures } from "./binance.js";
import type { QuoteCommand, TradeCommand, WatchCommand } from "./cli.js";
import {
  baseUrlFor,
  DEFAULT_TAKER_FEE_RATE,
  maskKey,
  readEnv,
  venueLabel,
  type VeleroEnv
} from "./config.js";
import { suggestPercents, type FeeSuggestion } from "./fees.js";
import { printFeeCard, printPositions, printQuote } from "./format.js";
import { opposite, orderSide, readMomentum, withoutForming } from "./momentum.js";
import { protectivePrices, quantityFromNotional } from "./precision.js";
import { evaluateRisk } from "./risk.js";
import type { Side } from "./types.js";

function requireKeys(env: VeleroEnv): { apiKey: string; apiSecret: string } {
  if (!env.apiKey || !env.apiSecret) {
    throw new Error(
      "BINANCE_API_KEY and BINANCE_API_SECRET are required for this command. Copy apps/velero/.env.example to apps/velero/.env — never paste keys in chat."
    );
  }
  return { apiKey: env.apiKey, apiSecret: env.apiSecret };
}

function capLeverage(requested: number, env: VeleroEnv, exchangeMax: number): number {
  const capped = Math.min(
    Math.floor(requested),
    Math.floor(env.maxLeverage),
    Math.floor(exchangeMax),
    10
  );
  if (capped < 1) {
    throw new Error("Leverage collapsed to 0. Check caps.");
  }
  return capped;
}

function enforceNotional(notional: number, env: VeleroEnv): void {
  if (notional > env.maxNotional + Number.EPSILON) {
    throw new Error(
      `Notional ${notional} USDT is above VELERO_MAX_NOTIONAL=${env.maxNotional}.`
    );
  }
}

function clientFor(env: VeleroEnv, live: boolean): BinanceFutures {
  return new BinanceFutures({
    baseUrl: baseUrlFor(live),
    apiKey: env.apiKey,
    apiSecret: env.apiSecret,
    proxyUrl: env.proxyUrl
  });
}

async function resolveTakerFee(
  client: BinanceFutures,
  symbol: string,
  env: VeleroEnv,
  override: number | null
): Promise<{ rate: number; source: string }> {
  if (override !== null) {
    return { rate: override, source: "flag" };
  }
  if (env.takerFeeRate !== null) {
    return { rate: env.takerFeeRate, source: "VELERO_TAKER_FEE" };
  }
  if (env.apiKey && env.apiSecret) {
    const fromExchange = await client.takerFeeRate(symbol);
    if (fromExchange !== null) {
      return { rate: fromExchange, source: "binance commissionRate" };
    }
  }
  return { rate: DEFAULT_TAKER_FEE_RATE, source: "default 0.10% (your 0.01 on 10 USDT)" };
}

export function runFees(notional: number, takerFeeRate: number | null): void {
  const env = readEnv();
  enforceNotional(notional, env);
  const rate = takerFeeRate ?? env.takerFeeRate ?? DEFAULT_TAKER_FEE_RATE;
  const suggestion = suggestPercents({ notional, takerFeeRate: rate });
  printFeeCard(suggestion, "velero  fee desk");
}

type Prepared = {
  env: VeleroEnv;
  client: BinanceFutures;
  live: boolean;
  symbol: string;
  suggestion: FeeSuggestion;
  quantity: number;
  actualNotional: number;
  leverage: number;
  mark: number;
  last: number;
  momentum: ReturnType<typeof readMomentum>;
  openPositions: number;
  pairOrders: number;
  pairPosition: boolean;
  tickSize: number;
  hedge: boolean;
};

function isArmed(
  command: QuoteCommand | TradeCommand | WatchCommand
): boolean {
  return (
    (command.command === "trade" || command.command === "watch") &&
    !command.dryRun
  );
}

async function preparePair(
  command: QuoteCommand | TradeCommand | WatchCommand
): Promise<Prepared> {
  const env = readEnv();
  enforceNotional(command.notional, env);

  if (command.live && isArmed(command) && !env.liveAllowed) {
    throw new Error(
      "Refusing LIVE. Set VELERO_LIVE=true in apps/velero/.env if you really mean the real book."
    );
  }

  const signed = Boolean(env.apiKey && env.apiSecret);
  const client = clientFor(env, command.live);
  await client.syncTime();

  const filters = await client.symbolFilters(command.symbol);
  if (filters.status !== "TRADING") {
    throw new Error(`${command.symbol} status is ${filters.status}, not TRADING.`);
  }

  const mark = await client.markPrice(command.symbol);
  const last = await client.lastPrice(command.symbol);
  const [raw15m, raw5m] = await Promise.all([
    client.klines(command.symbol, "15m", 80),
    client.klines(command.symbol, "5m", 40)
  ]);
  const klines15m =
    command.command === "watch" ? withoutForming(raw15m) : raw15m;
  const klines5m = command.command === "watch" ? withoutForming(raw5m) : raw5m;
  const momentum = readMomentum(klines15m, klines5m);
  const taker = await resolveTakerFee(
    client,
    command.symbol,
    env,
    command.takerFeeRate
  );
  const suggestionInput: {
    notional: number;
    takerFeeRate: number;
    tpPercent?: number;
    slPercent?: number;
  } = {
    notional: command.notional,
    takerFeeRate: taker.rate
  };
  if (command.tpPercent !== null) {
    suggestionInput.tpPercent = command.tpPercent;
  }
  if (command.slPercent !== null) {
    suggestionInput.slPercent = command.slPercent;
  }
  const suggestion = suggestPercents(suggestionInput);
  suggestion.note = `${suggestion.note} Fee source: ${taker.source}.`;

  const size = quantityFromNotional({
    notional: command.notional,
    price: mark,
    stepSize: filters.stepSize,
    minQty: filters.minQty,
    minNotional: filters.minNotional
  });
  const leverage = capLeverage(command.leverage, env, filters.maxLeverage);
  const maxOpen = Math.min(Math.floor(command.maxOpen), Math.floor(env.maxOpen));

  let openPositions = 0;
  let pairOrders = 0;
  let pairPosition = false;
  let hedge = false;

  if (signed) {
    const [positions, orders, dual] = await Promise.all([
      client.positions(),
      client.openOrders(command.symbol),
      client.dualSidePosition()
    ]);
    openPositions = positions.length;
    pairOrders = orders.length;
    pairPosition = positions.some((row) => row.symbol === command.symbol);
    hedge = dual;
  }

  return {
    env,
    client,
    live: command.live,
    symbol: command.symbol,
    suggestion,
    quantity: size.quantity,
    actualNotional: size.actualNotional,
    leverage,
    mark,
    last,
    momentum,
    openPositions,
    pairOrders,
    pairPosition,
    tickSize: filters.tickSize,
    hedge
  };
}

export async function runQuote(command: QuoteCommand): Promise<void> {
  const prepared = await preparePair(command);
  printQuote({
    venue: venueLabel(prepared.live),
    symbol: prepared.symbol,
    mark: prepared.mark,
    last: prepared.last,
    momentum: prepared.momentum,
    suggestion: prepared.suggestion,
    quantity: prepared.quantity,
    actualNotional: prepared.actualNotional,
    leverage: prepared.leverage,
    maxOpen: Math.min(Math.floor(command.maxOpen), Math.floor(prepared.env.maxOpen)),
    openPositions: prepared.openPositions,
    pairOrders: prepared.pairOrders,
    pairPosition: prepared.pairPosition
  });
  console.log("");
  if (prepared.momentum.bias === "FLAT") {
    console.log("Would not sail: no aligned momentum.");
    return;
  }
  console.log(`Would sail ${prepared.momentum.bias} if you run trade.`);
}

export type SailResult =
  | { status: "skipped"; reason: string; bias: string }
  | { status: "dry-run"; side: Side; reason: string }
  | { status: "filled"; side: Side; reason: string };

export async function sail(
  command: TradeCommand | WatchCommand,
  options: { verbose: boolean }
): Promise<SailResult> {
  const env = readEnv();
  if (!command.dryRun) {
    requireKeys(env);
  }

  const prepared = await preparePair(command);
  const maxOpen = Math.min(
    Math.floor(command.maxOpen),
    Math.floor(prepared.env.maxOpen)
  );
  const bias = prepared.momentum.bias;

  const printCard = (): void => {
    printQuote({
      venue: venueLabel(prepared.live),
      symbol: prepared.symbol,
      mark: prepared.mark,
      last: prepared.last,
      momentum: prepared.momentum,
      suggestion: prepared.suggestion,
      quantity: prepared.quantity,
      actualNotional: prepared.actualNotional,
      leverage: prepared.leverage,
      maxOpen,
      openPositions: prepared.openPositions,
      pairOrders: prepared.pairOrders,
      pairPosition: prepared.pairPosition
    });
    console.log("");
    if (env.apiKey) {
      console.log(`  key  ${maskKey(env.apiKey)}`);
    }
  };

  if (options.verbose) {
    printCard();
  }

  if (bias === "FLAT") {
    return {
      status: "skipped",
      reason: prepared.momentum.reason,
      bias
    };
  }

  if (env.apiKey && env.apiSecret) {
    const positions = await prepared.client.positions();
    const openOrders = await prepared.client.openOrders(prepared.symbol);
    const risk = evaluateRisk({
      symbol: prepared.symbol,
      maxOpen,
      positions,
      openOrders
    });
    if (!risk.ok) {
      return { status: "skipped", reason: risk.reason, bias };
    }
  } else if (!command.dryRun) {
    requireKeys(env);
  }

  const side: Side = bias;
  const prices = protectivePrices({
    side,
    mark: prepared.mark,
    last: prepared.last,
    tpPercent: prepared.suggestion.tpPercent,
    slPercent: prepared.suggestion.slPercent,
    tickSize: prepared.tickSize
  });
  if (!prices.ok) {
    return { status: "skipped", reason: prices.reason, bias };
  }

  const exitSide = orderSide(opposite(side));
  const positionSide = prepared.hedge ? side : undefined;

  if (!options.verbose) {
    printCard();
  }
  console.log(
    `  plan ${side} qty ${prepared.quantity}  TP ${prices.takeProfit}  SL ${prices.stopLoss}`
  );
  if (prices.widened) {
    console.log(`  ${prices.note}`);
  }

  if (command.dryRun) {
    console.log("");
    console.log("Dry-run. No order sent. Drop --dry-run when the water looks right.");
    return {
      status: "dry-run",
      side,
      reason: prepared.momentum.reason
    };
  }

  if (prepared.live && !command.confirm) {
    throw new Error("LIVE trade needs --confirm. The boat does not leave without you.");
  }

  const wantedMargin = command.isolated ? "ISOLATED" : "CROSSED";
  const margin = await prepared.client.setMarginType(
    prepared.symbol,
    wantedMargin
  );
  if (margin === "multi-assets") {
    console.log(
      `  Multi-Assets mode: cannot switch to ${wantedMargin}. Sailing on the account's current margin.`
    );
  } else {
    console.log(`  margin ${wantedMargin.toLowerCase()}`);
  }
  await prepared.client.setLeverage(prepared.symbol, prepared.leverage);

  const marketInput: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    positionSide?: "LONG" | "SHORT";
  } = {
    symbol: prepared.symbol,
    side: orderSide(side),
    quantity: prepared.quantity
  };
  if (positionSide) {
    marketInput.positionSide = positionSide;
  }
  const entry = await prepared.client.marketOrder(marketInput);
  console.log("  entry sent");

  const stopInput: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "STOP_MARKET" | "TAKE_PROFIT_MARKET";
    stopPrice: number;
    positionSide?: "LONG" | "SHORT";
  } = {
    symbol: prepared.symbol,
    side: exitSide,
    type: "STOP_MARKET",
    stopPrice: prices.stopLoss
  };
  const tpInput = {
    ...stopInput,
    type: "TAKE_PROFIT_MARKET" as const,
    stopPrice: prices.takeProfit
  };
  if (positionSide) {
    stopInput.positionSide = positionSide;
    tpInput.positionSide = positionSide;
  }

  try {
    await prepared.client.closePositionStop(stopInput);
    await prepared.client.closePositionStop(tpInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `  protective orders failed after entry: ${message}. Check the position by hand.`
    );
    throw error;
  }

  console.log("  SL and TP resting (closePosition, mark price)");
  if (typeof entry === "object" && entry !== null) {
    const record = entry as Record<string, unknown>;
    if (typeof record.orderId === "number" || typeof record.orderId === "string") {
      console.log(`  orderId ${record.orderId}`);
    }
  }

  return {
    status: "filled",
    side,
    reason: prepared.momentum.reason
  };
}

export async function runTrade(command: TradeCommand): Promise<void> {
  const result = await sail(command, { verbose: true });
  if (result.status === "skipped") {
    throw new Error(
      result.bias === "FLAT"
        ? "No aligned momentum. Quote printed; order not sent."
        : result.reason
    );
  }
}

export async function runStatus(live: boolean): Promise<void> {
  const env = readEnv();
  if (live && !env.liveAllowed) {
    throw new Error(
      "Refusing LIVE status. Set VELERO_LIVE=true if you want the real book."
    );
  }

  const keys = requireKeys(env);
  const client = clientFor(env, live);
  await client.syncTime();
  const [positions, orders] = await Promise.all([
    client.positions(),
    client.openOrders()
  ]);

  console.log(`velero  ${venueLabel(live)}  ${maskKey(keys.apiKey)}`);
  console.log("");
  printPositions(positions, orders);
}
