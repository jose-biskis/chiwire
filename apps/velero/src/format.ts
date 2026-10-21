import type { FeeSuggestion } from "./fees.js";
import { rateToPercent } from "./fees.js";
import type { EyeSuggestion } from "./indicators.js";
import type { MomentumRead } from "./momentum.js";
import type { OpenOrderRow, PositionRow } from "./types.js";

function money(value: number, digits = 4): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

function pct(rate: number, digits = 3): string {
  return `${rateToPercent(rate).toFixed(digits)}%`;
}

export function printFeeCard(suggestion: FeeSuggestion, heading: string): void {
  console.log(heading);
  console.log(`  notional     ${money(suggestion.notional, 2)} USDT`);
  console.log(
    `  taker        ${pct(suggestion.takerFeeRate)}   ${money(suggestion.oneWayFeeUsdt)} USDT one way`
  );
  console.log(
    `  round-trip   ${pct(suggestion.roundTripPercent)}   ${money(suggestion.roundTripFeeUsdt)} USDT`
  );
  console.log(
    `  example      TP ${pct(suggestion.exampleTpPercent, 2)} (${money(suggestion.exampleTpUsdt)})   SL ${pct(suggestion.exampleSlPercent, 2)} (${money(suggestion.exampleSlUsdt)})`
  );
  console.log(
    `  desk         TP ${pct(suggestion.tpPercent, 2)} (${money(suggestion.tpUsdt)})   SL ${pct(suggestion.slPercent, 2)} (${money(suggestion.slUsdt)})`
  );
  console.log(
    `  after fees   +${money(suggestion.netTpUsdt)} / -${money(suggestion.netSlUsdt)} USDT   net R:R ${suggestion.netRewardRatio.toFixed(2)}`
  );
  console.log(`  ${suggestion.note}`);
}

export function printQuote(input: {
  venue: string;
  symbol: string;
  mark: number;
  last: number;
  momentum: MomentumRead;
  suggestion: FeeSuggestion;
  quantity: number;
  actualNotional: number;
  leverage: number;
  maxOpen: number;
  openPositions: number;
  pairOrders: number;
  pairPosition: boolean;
}): void {
  const margin = input.actualNotional / input.leverage;
  console.log(`velero  ${input.venue}  ${input.symbol}`);
  console.log("");
  console.log(
    `  mark ${input.mark}   last ${input.last}   ATR ${input.momentum.atrPercent === null ? "n/a" : pct(input.momentum.atrPercent, 2)}`
  );
  console.log(`  bias ${input.momentum.bias.padEnd(5)}  ${input.momentum.reason}`);
  if (input.momentum.smaFast !== null && input.momentum.smaSlow !== null) {
    console.log(
      `  sma  20 ${input.momentum.smaFast.toFixed(6)}   50 ${input.momentum.smaSlow.toFixed(6)}   5m ROC ${input.momentum.roc === null ? "n/a" : pct(input.momentum.roc, 2)}`
    );
  }
  console.log("");
  printFeeCard(input.suggestion, "  fees");
  console.log("");
  console.log(
    `  size ${input.quantity}   notional ${money(input.actualNotional, 2)} USDT   lev ${input.leverage}x   margin ~${money(margin, 2)} USDT`
  );
  console.log(
    `  book ${input.openPositions}/${input.maxOpen} positions   pair orders ${input.pairOrders}${input.pairPosition ? "   PAIR ALREADY OPEN" : ""}`
  );
}

export function printPositions(
  positions: PositionRow[],
  orders: OpenOrderRow[]
): void {
  if (positions.length === 0) {
    console.log("  no open positions");
  } else {
    for (const row of positions) {
      const side = row.positionAmt > 0 ? "LONG" : "SHORT";
      console.log(
        `  ${row.symbol.padEnd(12)} ${side.padEnd(5)} amt ${row.positionAmt}   notional ${money(row.notional, 2)}   lev ${row.leverage}x   ${row.isolated ? "isolated" : "cross"}`
      );
    }
  }

  console.log("");
  if (orders.length === 0) {
    console.log("  no open orders");
    return;
  }

  for (const row of orders) {
    console.log(
      `  ${row.symbol.padEnd(12)} ${row.type.padEnd(20)} ${row.side.padEnd(4)} stop ${row.stopPrice}`
    );
  }
}

export function watchStamp(at: Date = new Date()): string {
  return at.toISOString().replace("T", " ").slice(0, 19);
}

export function printWatchLine(input: {
  symbol: string;
  status: string;
  detail: string;
  at?: Date;
}): void {
  console.log(
    `${watchStamp(input.at)}  ${input.symbol.padEnd(12)} ${input.status.padEnd(6)} ${input.detail}`
  );
}

export function printGoldReport(
  suggestions: EyeSuggestion[],
  scanned: number
): void {
  console.log("");
  console.log(
    `${watchStamp()}  gold-digger  scanned top ${scanned} by 24h volume on LIVE USDT-M`
  );
  if (suggestions.length === 0) {
    console.log(
      "  No confluence worth an eye. The beach is crowded or the tape is mush."
    );
    console.log("");
    return;
  }

  for (const row of suggestions) {
    console.log(
      `  EYE  ${row.symbol.padEnd(12)} ${row.bias.padEnd(5)}  ${row.setup}  score ${row.score}`
    );
    for (const reason of row.reasons) {
      console.log(`       — ${reason}`);
    }
  }
  console.log(
    "  These are not orders. Add a pair to watch if you want the boat to sail it."
  );
  console.log("");
}
