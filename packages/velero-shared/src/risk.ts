import type { OpenOrderRow, PositionRow } from "./types.js";

export type RiskDecision =
  | { ok: true }
  | { ok: false; reason: string };

export function evaluateRisk(input: {
  symbol: string;
  maxOpen: number;
  positions: PositionRow[];
  openOrders: OpenOrderRow[];
}): RiskDecision {
  const { symbol, maxOpen, positions, openOrders } = input;
  const onPair = positions.filter((row) => row.symbol === symbol);
  if (onPair.length > 0) {
    const amt = onPair[0]?.positionAmt ?? 0;
    return {
      ok: false,
      reason: `${symbol} already has an open position (${amt}). One boat per pair.`
    };
  }

  const pairOrders = openOrders.filter((row) => row.symbol === symbol);
  if (pairOrders.length > 0) {
    return {
      ok: false,
      reason: `${symbol} already has ${pairOrders.length} open order(s). Not stacking.`
    };
  }

  if (positions.length >= maxOpen) {
    return {
      ok: false,
      reason: `Open positions ${positions.length}/${maxOpen}. Wait for a berth.`
    };
  }

  return { ok: true };
}
