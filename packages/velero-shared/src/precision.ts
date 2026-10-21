export function decimalPlaces(step: string | number): number {
  const raw = String(step);
  if (/e-/i.test(raw)) {
    const match = /e-(\d+)/i.exec(raw);
    const exp = match ? Number.parseInt(match[1] ?? "0", 10) : 0;
    const lead = raw.split(/e-/i)[0] ?? "0";
    const leadDecimals = lead.includes(".") ? (lead.split(".")[1] ?? "").length : 0;
    return exp + leadDecimals;
  }

  const index = raw.indexOf(".");
  return index === -1 ? 0 : raw.length - index - 1;
}

export function floorToStep(value: number, step: number): number {
  if (!(step > 0)) {
    throw new Error("Invalid step size");
  }

  const places = decimalPlaces(step);
  const units = Math.floor((value + Number.EPSILON * step) / step);
  return Number((units * step).toFixed(places));
}

const MIN_PROTECTIVE_TICKS = 2;

export type ProtectivePrices =
  | {
      ok: true;
      takeProfit: number;
      stopLoss: number;
      widened: boolean;
      note: string;
    }
  | { ok: false; reason: string };

function ticksBelow(price: number, tick: number, ticks: number): number {
  return roundToTick(price - ticks * tick, tick, "floor");
}

function ticksAbove(price: number, tick: number, ticks: number): number {
  return roundToTick(price + ticks * tick, tick, "ceil");
}

export function protectivePrices(input: {
  side: "LONG" | "SHORT";
  mark: number;
  last: number;
  tpPercent: number;
  slPercent: number;
  tickSize: number;
  enforceTwoR?: boolean;
}): ProtectivePrices {
  const { side, mark, last, tpPercent, slPercent, tickSize } = input;
  const enforceTwoR = input.enforceTwoR !== false;
  if (!(mark > 0) || !(last > 0) || !(tickSize > 0)) {
    return { ok: false, reason: "Mark, last, or tick is unusable." };
  }

  const high = Math.max(mark, last);
  const low = Math.min(mark, last);
  let widened = false;

  if (side === "LONG") {
    let stopLoss = roundToTick(mark * (1 - slPercent), tickSize, "floor");
    let takeProfit = roundToTick(mark * (1 + tpPercent), tickSize, "ceil");
    const minStop = ticksBelow(low, tickSize, MIN_PROTECTIVE_TICKS);
    const minTp = ticksAbove(high, tickSize, MIN_PROTECTIVE_TICKS);

    if (stopLoss >= low) {
      stopLoss = minStop;
      widened = true;
    }
    if (takeProfit <= high) {
      takeProfit = minTp;
      widened = true;
    }

    const stopDist = low - stopLoss;
    if (
      enforceTwoR &&
      stopDist > 0 &&
      takeProfit - high < 2 * stopDist
    ) {
      takeProfit = roundToTick(high + 2 * stopDist, tickSize, "ceil");
      widened = true;
    }

    if (!(stopLoss > 0) || stopLoss >= low || takeProfit <= high) {
      return {
        ok: false,
        reason: `Tick ${tickSize} is too coarse vs price ${mark} to place a stop. Sitting.`
      };
    }

    return {
      ok: true,
      takeProfit,
      stopLoss,
      widened,
      note: widened
        ? `Widened SL/TP to clear ${MIN_PROTECTIVE_TICKS} ticks off mark/last (cheap alt / fat tick).`
        : ""
    };
  }

  let stopLoss = roundToTick(mark * (1 + slPercent), tickSize, "ceil");
  let takeProfit = roundToTick(mark * (1 - tpPercent), tickSize, "floor");
  const minStop = ticksAbove(high, tickSize, MIN_PROTECTIVE_TICKS);
  const minTp = ticksBelow(low, tickSize, MIN_PROTECTIVE_TICKS);

  if (stopLoss <= high) {
    stopLoss = minStop;
    widened = true;
  }
  if (takeProfit >= low) {
    takeProfit = minTp;
    widened = true;
  }

  const stopDist = stopLoss - high;
  if (
    enforceTwoR &&
    stopDist > 0 &&
    low - takeProfit < 2 * stopDist
  ) {
    takeProfit = roundToTick(low - 2 * stopDist, tickSize, "floor");
    widened = true;
  }

  if (!(takeProfit > 0) || stopLoss <= high || takeProfit >= low) {
    return {
      ok: false,
      reason: `Tick ${tickSize} is too coarse vs price ${mark} to place a stop. Sitting.`
    };
  }

  return {
    ok: true,
    takeProfit,
    stopLoss,
    widened,
    note: widened
      ? `Widened SL/TP to clear ${MIN_PROTECTIVE_TICKS} ticks off mark/last (cheap alt / fat tick).`
      : ""
  };
}

export function roundToTick(
  value: number,
  tick: number,
  mode: "floor" | "ceil"
): number {
  if (!(tick > 0)) {
    throw new Error("Invalid tick size");
  }

  const places = decimalPlaces(tick);
  const units =
    mode === "floor"
      ? Math.floor(value / tick + Number.EPSILON)
      : Math.ceil(value / tick - Number.EPSILON);
  return Number((units * tick).toFixed(places));
}

export function quantityFromNotional(input: {
  notional: number;
  price: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
}): { quantity: number; actualNotional: number } {
  const { notional, price, stepSize, minQty, minNotional } = input;
  if (!(price > 0)) {
    throw new Error("Invalid mark price");
  }

  const quantity = floorToStep(notional / price, stepSize);
  if (quantity < minQty) {
    throw new Error(
      `Qty ${quantity} is below min ${minQty}. Raise --notional or pick a cheaper pair.`
    );
  }

  const actualNotional = quantity * price;
  if (actualNotional + Number.EPSILON < minNotional) {
    throw new Error(
      `Notional ${actualNotional.toFixed(4)} USDT is below exchange min ${minNotional}.`
    );
  }

  return { quantity, actualNotional };
}
