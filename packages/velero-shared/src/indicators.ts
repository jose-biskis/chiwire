import { sma } from "./momentum.js";
import type { Bias } from "./types.js";

export function ema(values: number[], period: number): number | null {
  const series = emaSeries(values, period);
  return series[series.length - 1] ?? null;
}

export function emaSeries(values: number[], period: number): number[] {
  if (values.length < period || period <= 0) {
    return [];
  }

  const seed = sma(values.slice(0, period), period);
  if (seed === null) {
    return [];
  }

  const k = 2 / (period + 1);
  const series: number[] = [seed];
  for (let i = period; i < values.length; i += 1) {
    const price = values[i];
    const prev = series[series.length - 1];
    if (price === undefined || prev === undefined) {
      continue;
    }
    series.push(price * k + prev * (1 - k));
  }

  return series;
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1 || period <= 0) {
    return null;
  }

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (delta >= 0) {
      gains += delta;
    } else {
      losses -= delta;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) {
    return 100;
  }

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export type MacdRead = {
  macd: number;
  signal: number;
  histogram: number;
  previousHistogram: number | null;
};

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdRead | null {
  const fastSeries = emaSeries(closes, fast);
  const slowSeries = emaSeries(closes, slow);
  const offset = fastSeries.length - slowSeries.length;
  if (slowSeries.length === 0 || offset < 0) {
    return null;
  }

  const macdSeries: number[] = [];
  for (let i = 0; i < slowSeries.length; i += 1) {
    const fastValue = fastSeries[i + offset];
    const slowValue = slowSeries[i];
    if (fastValue === undefined || slowValue === undefined) {
      continue;
    }
    macdSeries.push(fastValue - slowValue);
  }

  const signalSeries = emaSeries(macdSeries, signalPeriod);
  const histogram = macdSeries[macdSeries.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  const macdValue = macdSeries[macdSeries.length - 1];
  if (
    histogram === undefined ||
    signal === undefined ||
    macdValue === undefined
  ) {
    return null;
  }

  const histIndex = macdSeries.length - 1;
  const alignedSignalIndex = signalSeries.length - 1;
  const currentHist = macdValue - signal;
  const prevMacd = macdSeries[histIndex - 1];
  const prevSignal = signalSeries[alignedSignalIndex - 1];
  const previousHistogram =
    prevMacd !== undefined && prevSignal !== undefined
      ? prevMacd - prevSignal
      : null;

  return {
    macd: macdValue,
    signal,
    histogram: currentHist,
    previousHistogram
  };
}

export type StochRead = {
  k: number;
  d: number;
};

export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
  smooth = 3
): StochRead | null {
  if (
    closes.length < period + smooth - 1 ||
    highs.length !== closes.length ||
    lows.length !== closes.length
  ) {
    return null;
  }

  const kSeries: number[] = [];
  for (let end = period - 1; end < closes.length; end += 1) {
    const windowHighs = highs.slice(end - period + 1, end + 1);
    const windowLows = lows.slice(end - period + 1, end + 1);
    const close = closes[end];
    const highest = Math.max(...windowHighs);
    const lowest = Math.min(...windowLows);
    if (close === undefined || highest === lowest) {
      kSeries.push(50);
      continue;
    }
    kSeries.push(((close - lowest) / (highest - lowest)) * 100);
  }

  const d = sma(kSeries.slice(-smooth), smooth);
  const k = kSeries[kSeries.length - 1];
  if (k === undefined || d === null) {
    return null;
  }

  return { k, d };
}

export type BollingerRead = {
  mid: number;
  upper: number;
  lower: number;
  width: number;
  percentB: number;
};

export function bollinger(
  closes: number[],
  period = 20,
  mult = 2
): BollingerRead | null {
  if (closes.length < period) {
    return null;
  }

  const window = closes.slice(-period);
  const mid = sma(window, period);
  if (mid === null) {
    return null;
  }

  const variance =
    window.reduce((sum, price) => sum + (price - mid) ** 2, 0) / period;
  const deviation = Math.sqrt(variance);
  const upper = mid + mult * deviation;
  const lower = mid - mult * deviation;
  const close = closes[closes.length - 1];
  if (close === undefined) {
    return null;
  }

  const band = upper - lower;
  return {
    mid,
    upper,
    lower,
    width: mid === 0 ? 0 : band / mid,
    percentB: band === 0 ? 0.5 : (close - lower) / band
  };
}

export type AdxRead = {
  adx: number;
  plusDi: number;
  minusDi: number;
};

export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): AdxRead | null {
  if (
    closes.length < period * 2 ||
    highs.length !== closes.length ||
    lows.length !== closes.length
  ) {
    return null;
  }

  const trueRanges: number[] = [];
  const plusDms: number[] = [];
  const minusDms: number[] = [];

  for (let i = 1; i < closes.length; i += 1) {
    const high = highs[i] ?? 0;
    const low = lows[i] ?? 0;
    const prevHigh = highs[i - 1] ?? 0;
    const prevLow = lows[i - 1] ?? 0;
    const prevClose = closes[i - 1] ?? 0;
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    trueRanges.push(
      Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    );
    plusDms.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDms.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const smooth = (values: number[]): number[] => {
    const first = sma(values.slice(0, period), period);
    if (first === null) {
      return [];
    }
    const out = [first];
    for (let i = period; i < values.length; i += 1) {
      const prev = out[out.length - 1] ?? first;
      out.push(prev - prev / period + (values[i] ?? 0));
    }
    return out;
  };

  const trs = smooth(trueRanges);
  const plus = smooth(plusDms);
  const minus = smooth(minusDms);
  const dx: number[] = [];
  const count = Math.min(trs.length, plus.length, minus.length);
  for (let i = 0; i < count; i += 1) {
    const tr = trs[i] ?? 0;
    const p = plus[i] ?? 0;
    const m = minus[i] ?? 0;
    const plusDi = tr === 0 ? 0 : (100 * p) / tr;
    const minusDi = tr === 0 ? 0 : (100 * m) / tr;
    const denom = plusDi + minusDi;
    dx.push(denom === 0 ? 0 : (100 * Math.abs(plusDi - minusDi)) / denom);
  }

  const adxValue = sma(dx.slice(-period), period);
  const lastTr = trs[trs.length - 1] ?? 0;
  const lastPlus = plus[plus.length - 1] ?? 0;
  const lastMinus = minus[minus.length - 1] ?? 0;
  if (adxValue === null) {
    return null;
  }

  return {
    adx: adxValue,
    plusDi: lastTr === 0 ? 0 : (100 * lastPlus) / lastTr,
    minusDi: lastTr === 0 ? 0 : (100 * lastMinus) / lastTr
  };
}

export function relativeVolume(volumes: number[], period = 20): number | null {
  if (volumes.length < period + 1) {
    return null;
  }

  const last = volumes[volumes.length - 1];
  const avg = sma(volumes.slice(-period - 1, -1), period);
  if (last === undefined || avg === null || avg === 0) {
    return null;
  }

  return last / avg;
}

export function marketStructure(
  highs: number[],
  lows: number[]
): "up" | "down" | "chop" {
  if (highs.length < 20 || lows.length < 20) {
    return "chop";
  }

  const recentHigh = Math.max(...highs.slice(-10));
  const priorHigh = Math.max(...highs.slice(-20, -10));
  const recentLow = Math.min(...lows.slice(-10));
  const priorLow = Math.min(...lows.slice(-20, -10));

  if (recentHigh > priorHigh && recentLow >= priorLow) {
    return "up";
  }
  if (recentHigh <= priorHigh && recentLow < priorLow) {
    return "down";
  }
  return "chop";
}

export type TapeSnapshot = {
  symbol: string;
  close: number;
  change24h: number;
  quoteVolume: number;
  high24h: number;
  low24h: number;
  fundingRate: number | null;
  volumeRatio: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  macd: MacdRead | null;
  stoch: StochRead | null;
  bollinger: BollingerRead | null;
  atrPercent: number | null;
  adx: AdxRead | null;
  oi: number | null;
  oiChange: number | null;
  structure: "up" | "down" | "chop";
};

export type EyeSuggestion = {
  symbol: string;
  score: number;
  bias: Bias;
  setup: string;
  reasons: string[];
};

function nearHigh(snapshot: TapeSnapshot): number | null {
  if (!(snapshot.high24h > 0)) {
    return null;
  }
  return (snapshot.close - snapshot.high24h) / snapshot.high24h;
}

function nearLow(snapshot: TapeSnapshot): number | null {
  if (!(snapshot.low24h > 0)) {
    return null;
  }
  return (snapshot.close - snapshot.low24h) / snapshot.low24h;
}

export function scoreTape(snapshot: TapeSnapshot): EyeSuggestion | null {
  const reasons: string[] = [];
  let longScore = 0;
  let shortScore = 0;

  const ema20 = snapshot.ema20;
  const ema50 = snapshot.ema50;
  const ema200 = snapshot.ema200;
  if (ema20 !== null && ema50 !== null && snapshot.close > ema20 && ema20 > ema50) {
    longScore += 2;
    reasons.push(
      `EMA stack bullish (price ${snapshot.close.toPrecision(6)} > EMA20 > EMA50).`
    );
  } else if (
    ema20 !== null &&
    ema50 !== null &&
    snapshot.close < ema20 &&
    ema20 < ema50
  ) {
    shortScore += 2;
    reasons.push("EMA stack bearish (price < EMA20 < EMA50).");
  }

  if (ema200 !== null) {
    if (snapshot.close > ema200) {
      longScore += 1;
      reasons.push("Above EMA200 — higher-timeframe tide is up.");
    } else {
      shortScore += 1;
      reasons.push("Below EMA200 — higher-timeframe tide is down.");
    }
  }

  if (snapshot.structure === "up") {
    longScore += 2;
    reasons.push("Market structure: higher highs / higher lows on 1h.");
  } else if (snapshot.structure === "down") {
    shortScore += 2;
    reasons.push("Market structure: lower highs / lower lows on 1h.");
  }

  const rsiValue = snapshot.rsi;
  if (rsiValue !== null) {
    if (rsiValue >= 45 && rsiValue <= 65) {
      longScore += 1;
      reasons.push(`RSI ${rsiValue.toFixed(1)} in a healthy bull band (not blown).`);
    } else if (rsiValue >= 35 && rsiValue <= 55) {
      shortScore += 1;
      reasons.push(`RSI ${rsiValue.toFixed(1)} in a healthy bear band.`);
    } else if (rsiValue < 30) {
      longScore += 2;
      reasons.push(`RSI ${rsiValue.toFixed(1)} oversold — bounce watch, not a chase.`);
    } else if (rsiValue > 70) {
      shortScore += 2;
      reasons.push(`RSI ${rsiValue.toFixed(1)} overbought — fade/short watch.`);
    } else {
      reasons.push(`RSI ${rsiValue.toFixed(1)} is mixed.`);
    }
  }

  const macdRead = snapshot.macd;
  if (macdRead) {
    if (
      macdRead.histogram > 0 &&
      (macdRead.previousHistogram === null ||
        macdRead.histogram > macdRead.previousHistogram)
    ) {
      longScore += 2;
      reasons.push("MACD histogram positive and expanding.");
    } else if (
      macdRead.histogram < 0 &&
      (macdRead.previousHistogram === null ||
        macdRead.histogram < macdRead.previousHistogram)
    ) {
      shortScore += 2;
      reasons.push("MACD histogram negative and expanding.");
    } else if (
      macdRead.previousHistogram !== null &&
      macdRead.previousHistogram < 0 &&
      macdRead.histogram > 0
    ) {
      longScore += 2;
      reasons.push("MACD histogram flipped up through zero.");
    } else if (
      macdRead.previousHistogram !== null &&
      macdRead.previousHistogram > 0 &&
      macdRead.histogram < 0
    ) {
      shortScore += 2;
      reasons.push("MACD histogram flipped down through zero.");
    }
  }

  const stoch = snapshot.stoch;
  if (stoch) {
    if (stoch.k < 20 && stoch.k >= stoch.d) {
      longScore += 1;
      reasons.push(`Stochastic %K ${stoch.k.toFixed(1)} curling up from oversold.`);
    } else if (stoch.k > 80 && stoch.k <= stoch.d) {
      shortScore += 1;
      reasons.push(`Stochastic %K ${stoch.k.toFixed(1)} rolling over from overbought.`);
    }
  }

  const bands = snapshot.bollinger;
  if (bands) {
    if (bands.width < 0.04) {
      reasons.push(
        `Bollinger squeeze (width ${(bands.width * 100).toFixed(1)}%) — energy coiled.`
      );
      longScore += 1;
      shortScore += 1;
    }
    if (bands.percentB > 0.8) {
      longScore += 1;
      reasons.push("Close in the upper Bollinger band (trend or climax).");
    } else if (bands.percentB < 0.2) {
      shortScore += 1;
      reasons.push("Close in the lower Bollinger band.");
    }
  }

  const adxRead = snapshot.adx;
  if (adxRead) {
    if (adxRead.adx >= 25 && adxRead.plusDi > adxRead.minusDi) {
      longScore += 2;
      reasons.push(
        `ADX ${adxRead.adx.toFixed(1)} with +DI > −DI — trend has teeth.`
      );
    } else if (adxRead.adx >= 25 && adxRead.minusDi > adxRead.plusDi) {
      shortScore += 2;
      reasons.push(
        `ADX ${adxRead.adx.toFixed(1)} with −DI > +DI — downtrend has teeth.`
      );
    } else if (adxRead.adx < 18) {
      reasons.push(`ADX ${adxRead.adx.toFixed(1)} is weak — chop risk.`);
    }
  }

  if (snapshot.volumeRatio !== null && snapshot.volumeRatio >= 1.4) {
    longScore += 1;
    shortScore += 1;
    reasons.push(
      `Relative volume ${snapshot.volumeRatio.toFixed(2)}× average — people are actually here.`
    );
  }

  if (snapshot.quoteVolume >= 50_000_000) {
    reasons.push(
      `24h quote volume ${(snapshot.quoteVolume / 1_000_000).toFixed(0)}M USDT — liquid enough to leave.`
    );
  } else if (snapshot.quoteVolume < 8_000_000) {
    reasons.push("Volume is thin — easy to get stuck. Discounted.");
    longScore -= 2;
    shortScore -= 2;
  }

  if (snapshot.oiChange !== null) {
    const oiPct = snapshot.oiChange * 100;
    if (snapshot.oiChange > 0.03 && snapshot.change24h > 0) {
      longScore += 2;
      reasons.push(
        `OI up ${oiPct.toFixed(1)}% with price up — new longs, not just covering.`
      );
    } else if (snapshot.oiChange > 0.03 && snapshot.change24h < 0) {
      shortScore += 2;
      reasons.push(
        `OI up ${oiPct.toFixed(1)}% with price down — new shorts arriving.`
      );
    } else if (snapshot.oiChange < -0.03 && snapshot.change24h > 0) {
      reasons.push(
        `OI down ${oiPct.toFixed(1)}% on a green day — short covering, trend may be hollow.`
      );
      longScore -= 1;
    } else if (snapshot.oiChange < -0.03 && snapshot.change24h < 0) {
      reasons.push(
        `OI down ${oiPct.toFixed(1)}% on a red day — long liquidation, bounce risk.`
      );
      shortScore -= 1;
    }
  }

  const funding = snapshot.fundingRate;
  if (funding !== null) {
    const fundingPct = funding * 100;
    if (funding > 0.0004) {
      shortScore += 1;
      reasons.push(
        `Funding ${fundingPct.toFixed(3)}% — longs pay, crowded long.`
      );
    } else if (funding < -0.0004) {
      longScore += 1;
      reasons.push(
        `Funding ${fundingPct.toFixed(3)}% — shorts pay, crowded short.`
      );
    }
  }

  const highGap = nearHigh(snapshot);
  const lowGap = nearLow(snapshot);
  if (highGap !== null && highGap > -0.008) {
    longScore += 1;
    reasons.push("Hugging the 24h high — breakout or fakeout watch.");
  } else if (lowGap !== null && lowGap < 0.008) {
    shortScore += 1;
    reasons.push("Hugging the 24h low — breakdown or capitulation watch.");
  }

  if (snapshot.atrPercent !== null) {
    reasons.push(
      `ATR ${(snapshot.atrPercent * 100).toFixed(2)}% of price — size stops with this, not hopes.`
    );
  }

  const bias: Bias =
    longScore - shortScore >= 3
      ? "LONG"
      : shortScore - longScore >= 3
        ? "SHORT"
        : "FLAT";
  const score = Math.max(longScore, shortScore);

  if (bias === "FLAT" || score < 6 || reasons.length < 3) {
    return null;
  }

  let setup = "confluence";
  if (rsiValue !== null && rsiValue < 30 && bias === "LONG") {
    setup = "oversold bounce";
  } else if (rsiValue !== null && rsiValue > 70 && bias === "SHORT") {
    setup = "overbought fade";
  } else if (bands && bands.width < 0.04) {
    setup = "squeeze";
  } else if (highGap !== null && highGap > -0.008 && bias === "LONG") {
    setup = "high-of-day break";
  } else if (adxRead && adxRead.adx >= 25) {
    setup = "trend continuation";
  }

  return {
    symbol: snapshot.symbol,
    score,
    bias,
    setup,
    reasons
  };
}
