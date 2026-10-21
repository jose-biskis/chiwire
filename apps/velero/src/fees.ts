const EXAMPLE_NOTIONAL = 10;
const EXAMPLE_TP_USDT = 0.05;
const EXAMPLE_SL_USDT = 0.025;
const MIN_STOP_OVER_ROUND_TRIP = 2;
const NET_REWARD_RATIO = 2;

export type FeeSuggestion = {
  notional: number;
  takerFeeRate: number;
  oneWayFeeUsdt: number;
  roundTripFeeUsdt: number;
  roundTripPercent: number;
  exampleTpPercent: number;
  exampleSlPercent: number;
  exampleTpUsdt: number;
  exampleSlUsdt: number;
  tpPercent: number;
  slPercent: number;
  tpUsdt: number;
  slUsdt: number;
  netTpUsdt: number;
  netSlUsdt: number;
  netRewardRatio: number;
  note: string;
};

export function suggestPercents(input: {
  notional: number;
  takerFeeRate: number;
  tpPercent?: number;
  slPercent?: number;
}): FeeSuggestion {
  const { notional, takerFeeRate } = input;
  if (!(notional > 0)) {
    throw new Error("notional must be > 0");
  }
  if (!(takerFeeRate >= 0) || takerFeeRate >= 0.05) {
    throw new Error(`taker fee rate looks wrong: ${takerFeeRate}`);
  }

  const oneWayFeeUsdt = notional * takerFeeRate;
  const roundTripFeeUsdt = oneWayFeeUsdt * 2;
  const roundTripPercent = takerFeeRate * 2;
  const scale = notional / EXAMPLE_NOTIONAL;
  const exampleTpUsdt = EXAMPLE_TP_USDT * scale;
  const exampleSlUsdt = EXAMPLE_SL_USDT * scale;
  const exampleTpPercent = exampleTpUsdt / notional;
  const exampleSlPercent = exampleSlUsdt / notional;

  let slPercent: number;
  let tpPercent: number;
  const customTp = input.tpPercent;
  const customSl = input.slPercent;

  if (customTp !== undefined || customSl !== undefined) {
    tpPercent = customTp ?? exampleTpPercent;
    slPercent = customSl ?? tpPercent / NET_REWARD_RATIO;
  } else {
    slPercent = Math.max(
      exampleSlPercent,
      roundTripPercent * MIN_STOP_OVER_ROUND_TRIP
    );
    tpPercent = NET_REWARD_RATIO * slPercent + 3 * roundTripPercent;
  }

  const tpUsdt = notional * tpPercent;
  const slUsdt = notional * slPercent;
  const netTpUsdt = tpUsdt - roundTripFeeUsdt;
  const netSlUsdt = slUsdt + roundTripFeeUsdt;
  const netRewardRatio = netSlUsdt > 0 ? netTpUsdt / netSlUsdt : 0;

  let note: string;
  if (netTpUsdt <= 0) {
    note =
      "Take profit does not clear round-trip taker fees. Raise TP or the house keeps the boat.";
  } else if (customTp !== undefined || customSl !== undefined) {
    note =
      netRewardRatio + Number.EPSILON < NET_REWARD_RATIO
        ? "Custom levels. After fees this is weaker than 2:1 net — still legal, just not generous."
        : "Custom levels. Net reward still covers a 2:1 after taker both ways.";
  } else {
    note =
      "Desk default: stop at least 2× round-trip, take profit sized for ~2:1 *after* fees. Your 0.05/0.025 sketch on 10 USDT is the 'example' row — tight scalping that fees chew up.";
  }

  return {
    notional,
    takerFeeRate,
    oneWayFeeUsdt,
    roundTripFeeUsdt,
    roundTripPercent,
    exampleTpPercent,
    exampleSlPercent,
    exampleTpUsdt,
    exampleSlUsdt,
    tpPercent,
    slPercent,
    tpUsdt,
    slUsdt,
    netTpUsdt,
    netSlUsdt,
    netRewardRatio,
    note
  };
}

export function percentToRate(percent: number): number {
  return percent / 100;
}

export function rateToPercent(rate: number): number {
  return rate * 100;
}
