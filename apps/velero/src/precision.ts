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
