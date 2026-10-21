import { createHmac } from "node:crypto";
import { fetch, ProxyAgent, type Dispatcher } from "undici";
import { newGateJobId, type GateHttpMethod, type GateJob, type GateResult } from "./gate.js";
import type { Kline, OpenOrderRow, PositionRow, SymbolFilters } from "./types.js";

export class BinanceError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(`Binance ${code}: ${message}`);
    this.name = "BinanceError";
  }
}

type ClientOptions = {
  baseUrl: string;
  apiKey: string | null;
  apiSecret: string | null;
  proxyUrl: string | null;
  gateFetchUrl?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  throw new Error("Unexpected Binance payload");
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

export function explainBinanceError(
  code: number,
  message: string,
  baseUrl: string
): string {
  if (/restricted location/i.test(message)) {
    return `${message} Velero needs an allowed IP — set VELERO_PROXY (e.g. http://127.0.0.1:3128 for Reja) or connect through Paso.`;
  }

  if (code === -4168) {
    return `${message} This account is in Multi-Assets mode, so isolated margin cannot be set. Velero will leave the margin mode alone.`;
  }

  if (code === -4120) {
    return `${message} Conditional SL/TP must go through POST /fapi/v1/algoOrder (algoType=CONDITIONAL).`;
  }

  if (code !== -2015) {
    return message;
  }

  const testnet = /testnet/i.test(baseUrl);
  if (testnet) {
    return `${message} Signed against ${baseUrl} (testnet). A live Binance key will not work here — make futures testnet keys at https://testnet.binancefuture.com or run with --live --confirm (and VELERO_LIVE=true). If you meant live, this is the mismatch. Also check Enable Futures and IP whitelist (the proxy egress IP if VELERO_PROXY is set).`;
  }

  return `${message} Signed against ${baseUrl} (LIVE). Check Enable Futures on the key, that the secret matches, and that the IP whitelist includes this machine (or Reja/Paso egress), not only your home IP. Testnet keys do not work on live.`;
}

export class BinanceFutures {
  private timeOffsetMs = 0;
  private readonly dispatcher: Dispatcher | undefined;
  private readonly gateFetchUrl: string | null;

  constructor(private readonly options: ClientOptions) {
    this.dispatcher = options.proxyUrl
      ? new ProxyAgent(options.proxyUrl)
      : undefined;
    this.gateFetchUrl =
      options.gateFetchUrl?.trim() ||
      process.env.VELERO_GATE_FETCH?.trim() ||
      null;
  }

  async syncTime(): Promise<void> {
    const started = Date.now();
    const payload = asRecord(await this.publicGet("/fapi/v1/time"));
    const finished = Date.now();
    const serverTime = asNumber(payload.serverTime, Date.now());
    this.timeOffsetMs = serverTime - Math.floor((started + finished) / 2);
  }

  async klines(
    symbol: string,
    interval: string,
    limit: number
  ): Promise<Kline[]> {
    const payload = await this.publicGet("/fapi/v1/klines", {
      symbol,
      interval,
      limit: String(limit)
    });
    if (!Array.isArray(payload)) {
      throw new Error("Unexpected klines payload");
    }

    return payload.map((row) => {
      if (!Array.isArray(row)) {
        throw new Error("Unexpected kline row");
      }
      return {
        openTime: asNumber(row[0]),
        open: asNumber(row[1]),
        high: asNumber(row[2]),
        low: asNumber(row[3]),
        close: asNumber(row[4]),
        volume: asNumber(row[5])
      };
    });
  }

  async markPrice(symbol: string): Promise<number> {
    const payload = asRecord(
      await this.publicGet("/fapi/v1/premiumIndex", { symbol })
    );
    const price = asNumber(payload.markPrice);
    if (!(price > 0)) {
      throw new Error(`No mark price for ${symbol}`);
    }
    return price;
  }

  async lastPrice(symbol: string): Promise<number> {
    const payload = asRecord(
      await this.publicGet("/fapi/v1/ticker/price", { symbol })
    );
    const price = asNumber(payload.price);
    if (!(price > 0)) {
      throw new Error(`No last price for ${symbol}`);
    }
    return price;
  }

  async perpetualUsdtSymbols(): Promise<string[]> {
    const payload = asRecord(await this.publicGet("/fapi/v1/exchangeInfo"));
    const symbols = payload.symbols;
    if (!Array.isArray(symbols)) {
      return [];
    }

    const skipBase = new Set(["USDC", "FDUSD", "TUSD", "BFUSD", "EUR", "AEUR"]);
    const listed: string[] = [];
    for (const entry of symbols) {
      const row = asRecord(entry);
      const symbol = asString(row.symbol);
      const quote = asString(row.quoteAsset);
      const base = asString(row.baseAsset);
      const status = asString(row.status);
      const contractType = asString(row.contractType);
      if (
        quote === "USDT" &&
        status === "TRADING" &&
        contractType === "PERPETUAL" &&
        !skipBase.has(base) &&
        symbol.endsWith("USDT")
      ) {
        listed.push(symbol);
      }
    }
    return listed;
  }

  async tickers24h(): Promise<
    Array<{
      symbol: string;
      quoteVolume: number;
      priceChangePercent: number;
      highPrice: number;
      lowPrice: number;
      lastPrice: number;
    }>
  > {
    const payload = await this.publicGet("/fapi/v1/ticker/24hr");
    if (!Array.isArray(payload)) {
      throw new Error("Unexpected 24h ticker payload");
    }

    return payload.map((entry) => {
      const row = asRecord(entry);
      return {
        symbol: asString(row.symbol),
        quoteVolume: asNumber(row.quoteVolume),
        priceChangePercent: asNumber(row.priceChangePercent),
        highPrice: asNumber(row.highPrice),
        lowPrice: asNumber(row.lowPrice),
        lastPrice: asNumber(row.lastPrice)
      };
    });
  }

  async premiumIndexAll(): Promise<
    Array<{ symbol: string; markPrice: number; lastFundingRate: number }>
  > {
    const payload = await this.publicGet("/fapi/v1/premiumIndex");
    const rows = Array.isArray(payload) ? payload : [payload];
    return rows.map((entry) => {
      const row = asRecord(entry);
      return {
        symbol: asString(row.symbol),
        markPrice: asNumber(row.markPrice),
        lastFundingRate: asNumber(row.lastFundingRate)
      };
    });
  }

  async openInterest(symbol: string): Promise<number | null> {
    try {
      const payload = asRecord(
        await this.publicGet("/fapi/v1/openInterest", { symbol })
      );
      const value = asNumber(payload.openInterest, Number.NaN);
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  async openInterestChange(symbol: string): Promise<number | null> {
    try {
      const payload = await this.publicGet("/futures/data/openInterestHist", {
        symbol,
        period: "1h",
        limit: "12"
      });
      if (!Array.isArray(payload) || payload.length < 2) {
        return null;
      }
      const first = asRecord(payload[0]);
      const last = asRecord(payload[payload.length - 1] ?? payload[0]);
      const start = asNumber(first.sumOpenInterest, Number.NaN);
      const end = asNumber(last.sumOpenInterest, Number.NaN);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) {
        return null;
      }
      return (end - start) / start;
    } catch {
      return null;
    }
  }

  async symbolFilters(symbol: string): Promise<SymbolFilters> {
    const payload = asRecord(await this.publicGet("/fapi/v1/exchangeInfo"));
    const symbols = payload.symbols;
    if (!Array.isArray(symbols)) {
      throw new Error("exchangeInfo missing symbols");
    }

    const match = symbols.find((entry) => {
      const row = asRecord(entry);
      return asString(row.symbol) === symbol;
    });
    if (!match) {
      throw new Error(`${symbol} is not a USDT-M futures pair on this venue.`);
    }

    const row = asRecord(match);
    const filters = Array.isArray(row.filters) ? row.filters : [];
    let tickSize = 0.0001;
    let stepSize = 0.001;
    let minQty = 0;
    let minNotional = 5;

    for (const filter of filters) {
      const item = asRecord(filter);
      const type = asString(item.filterType);
      if (type === "PRICE_FILTER") {
        tickSize = asNumber(item.tickSize, tickSize);
      }
      if (type === "LOT_SIZE" || type === "MARKET_LOT_SIZE") {
        stepSize = asNumber(item.stepSize, stepSize);
        minQty = asNumber(item.minQty, minQty);
      }
      if (type === "MIN_NOTIONAL") {
        minNotional = asNumber(item.notional, minNotional);
      }
    }

    let maxLeverage = 20;
    try {
      maxLeverage = await this.maxLeverage(symbol);
    } catch {
      maxLeverage = 20;
    }

    return {
      symbol,
      status: asString(row.status, "UNKNOWN"),
      tickSize,
      stepSize,
      minQty,
      minNotional,
      maxLeverage
    };
  }

  async maxLeverage(symbol: string): Promise<number> {
    const payload = await this.signedGet("/fapi/v1/leverageBracket", { symbol });
    const rows = Array.isArray(payload) ? payload : [payload];
    const first = rows[0];
    if (!first) {
      return 20;
    }
    const brackets = asRecord(first).brackets;
    if (!Array.isArray(brackets) || brackets.length === 0) {
      return 20;
    }
    const top = asRecord(brackets[0]);
    const leverage = asNumber(top.initialLeverage, 20);
    return leverage > 0 ? leverage : 20;
  }

  async takerFeeRate(symbol: string): Promise<number | null> {
    try {
      const payload = asRecord(
        await this.signedGet("/fapi/v1/commissionRate", { symbol })
      );
      const rate = asNumber(payload.takerCommissionRate, Number.NaN);
      return Number.isFinite(rate) ? rate : null;
    } catch {
      return null;
    }
  }

  async dualSidePosition(): Promise<boolean> {
    const payload = asRecord(
      await this.signedGet("/fapi/v1/positionSide/dual")
    );
    return asBoolean(payload.dualSidePosition);
  }

  async positions(): Promise<PositionRow[]> {
    const payload = await this.signedGet("/fapi/v2/positionRisk");
    if (!Array.isArray(payload)) {
      throw new Error("Unexpected positionRisk payload");
    }

    return payload
      .map((entry) => {
        const row = asRecord(entry);
        return {
          symbol: asString(row.symbol),
          positionAmt: asNumber(row.positionAmt),
          notional: Math.abs(asNumber(row.notional)),
          leverage: asNumber(row.leverage, 1),
          isolated: asString(row.marginType).toLowerCase() === "isolated",
          entryPrice: asNumber(row.entryPrice),
          markPrice: asNumber(row.markPrice)
        };
      })
      .filter((row) => row.symbol !== "" && row.positionAmt !== 0);
  }

  async openOrders(symbol?: string): Promise<OpenOrderRow[]> {
    const classic = await this.openClassicOrders(symbol);
    const algo = await this.openAlgoOrders(symbol);
    return [...classic, ...algo];
  }

  private async openClassicOrders(symbol?: string): Promise<OpenOrderRow[]> {
    const params = symbol ? { symbol } : {};
    const payload = await this.signedGet("/fapi/v1/openOrders", params);
    if (!Array.isArray(payload)) {
      throw new Error("Unexpected openOrders payload");
    }

    return payload.map((entry) => {
      const row = asRecord(entry);
      return {
        symbol: asString(row.symbol),
        orderId: asNumber(row.orderId),
        type: asString(row.type),
        side: asString(row.side),
        stopPrice: asString(row.stopPrice, "0")
      };
    });
  }

  private async openAlgoOrders(symbol?: string): Promise<OpenOrderRow[]> {
    try {
      const params: Record<string, string> = { algoType: "CONDITIONAL" };
      if (symbol) {
        params.symbol = symbol;
      }
      const payload = await this.signedGet("/fapi/v1/openAlgoOrders", params);
      if (!Array.isArray(payload)) {
        return [];
      }

      return payload.map((entry) => {
        const row = asRecord(entry);
        return {
          symbol: asString(row.symbol),
          orderId: asNumber(row.algoId, asNumber(row.orderId)),
          type: asString(row.orderType, asString(row.type, "ALGO")),
          side: asString(row.side),
          stopPrice: asString(row.triggerPrice, asString(row.stopPrice, "0"))
        };
      });
    } catch {
      return [];
    }
  }

  async setMarginType(
    symbol: string,
    marginType: "ISOLATED" | "CROSSED"
  ): Promise<"set" | "already" | "multi-assets"> {
    try {
      await this.signedPost("/fapi/v1/marginType", {
        symbol,
        marginType
      });
      return "set";
    } catch (error) {
      if (error instanceof BinanceError && error.code === -4046) {
        return "already";
      }
      if (error instanceof BinanceError && error.code === -4168) {
        return "multi-assets";
      }
      throw error;
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    await this.signedPost("/fapi/v1/leverage", {
      symbol,
      leverage: String(Math.floor(leverage))
    });
  }

  async marketOrder(input: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    positionSide?: "LONG" | "SHORT";
    reduceOnly?: boolean;
  }): Promise<unknown> {
    const params: Record<string, string> = {
      symbol: input.symbol,
      side: input.side,
      type: "MARKET",
      quantity: String(input.quantity),
      newOrderRespType: "RESULT"
    };
    if (input.positionSide) {
      params.positionSide = input.positionSide;
    }
    if (input.reduceOnly) {
      params.reduceOnly = "true";
    }
    return this.signedPost("/fapi/v1/order", params);
  }

  async cancelAlgoOrder(algoId: number): Promise<unknown> {
    return this.signedDelete("/fapi/v1/algoOrder", {
      algoId: String(algoId)
    });
  }

  async cancelOrder(symbol: string, orderId: number): Promise<unknown> {
    return this.signedDelete("/fapi/v1/order", {
      symbol,
      orderId: String(orderId)
    });
  }

  isTakeProfit(type: string): boolean {
    return type.toUpperCase().includes("TAKE_PROFIT");
  }

  isStopLoss(type: string): boolean {
    const upper = type.toUpperCase();
    return upper.includes("STOP") && !this.isTakeProfit(type);
  }

  async closePositionStop(input: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "STOP_MARKET" | "TAKE_PROFIT_MARKET";
    stopPrice: number;
    positionSide?: "LONG" | "SHORT";
  }): Promise<unknown> {
    const params: Record<string, string> = {
      algoType: "CONDITIONAL",
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      triggerPrice: String(input.stopPrice),
      closePosition: "true",
      workingType: "MARK_PRICE",
      priceProtect: "TRUE"
    };
    if (input.positionSide) {
      params.positionSide = input.positionSide;
    }
    return this.signedPost("/fapi/v1/algoOrder", params);
  }

  private headers(signed: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json"
    };
    if (signed) {
      if (!this.options.apiKey) {
        throw new Error("BINANCE_API_KEY is missing");
      }
      headers["X-MBX-APIKEY"] = this.options.apiKey;
    }
    return headers;
  }

  private timestamp(): number {
    return Date.now() + this.timeOffsetMs;
  }

  private sign(query: string): string {
    if (!this.options.apiSecret) {
      throw new Error("BINANCE_API_SECRET is missing");
    }
    return createHmac("sha256", this.options.apiSecret)
      .update(query)
      .digest("hex");
  }

  async publicGet(
    path: string,
    params: Record<string, string> = {}
  ): Promise<unknown> {
    if (this.gateFetchUrl) {
      return this.viaGate("GET", path, params, false);
    }
    const url = new URL(path, this.options.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return this.read(await this.request(url, { headers: this.headers(false) }));
  }

  async signedGet(
    path: string,
    params: Record<string, string> = {}
  ): Promise<unknown> {
    if (this.gateFetchUrl) {
      return this.viaGate("GET", path, params, true);
    }
    const url = new URL(path, this.options.baseUrl);
    const search = new URLSearchParams(params);
    search.set("timestamp", String(this.timestamp()));
    search.set("recvWindow", "10000");
    const query = search.toString();
    url.search = `${query}&signature=${this.sign(query)}`;
    return this.read(await this.request(url, { headers: this.headers(true) }));
  }

  async signedDelete(
    path: string,
    params: Record<string, string>
  ): Promise<unknown> {
    if (this.gateFetchUrl) {
      return this.viaGate("DELETE", path, params, true);
    }
    const url = new URL(path, this.options.baseUrl);
    const search = new URLSearchParams(params);
    search.set("timestamp", String(this.timestamp()));
    search.set("recvWindow", "10000");
    const query = search.toString();
    url.search = `${query}&signature=${this.sign(query)}`;
    return this.read(
      await this.request(url, {
        method: "DELETE",
        headers: this.headers(true)
      })
    );
  }

  async signedPost(
    path: string,
    params: Record<string, string>
  ): Promise<unknown> {
    if (this.gateFetchUrl) {
      return this.viaGate("POST", path, params, true);
    }
    const url = new URL(path, this.options.baseUrl);
    const body = new URLSearchParams(params);
    body.set("timestamp", String(this.timestamp()));
    body.set("recvWindow", "10000");
    const query = body.toString();
    const signed = `${query}&signature=${this.sign(query)}`;
    return this.read(
      await this.request(url, {
        method: "POST",
        headers: {
          ...this.headers(true),
          "content-type": "application/x-www-form-urlencoded"
        },
        body: signed
      })
    );
  }

  private async viaGate(
    method: GateHttpMethod,
    path: string,
    params: Record<string, string>,
    signed: boolean
  ): Promise<unknown> {
    const job: GateJob = {
      id: newGateJobId(),
      signed,
      method,
      path,
      params,
      baseUrl: this.options.baseUrl
    };
    const response = await fetch(this.gateFetchUrl ?? "", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(job)
    });
    const payload = (await response.json()) as GateResult & { error?: string };
    if (!payload.body && !response.ok) {
      throw new Error(
        payload.error || `Harbor is not connected (${response.status}).`
      );
    }
    return this.parseHttp(
      payload.status || response.status,
      payload.ok || response.ok,
      payload.body ?? ""
    );
  }

  private request(
    url: URL,
    init: {
      method?: string;
      headers: Record<string, string>;
      body?: string;
    }
  ): ReturnType<typeof fetch> {
    const options: {
      method?: string;
      headers: Record<string, string>;
      body?: string;
      dispatcher?: Dispatcher;
    } = {
      headers: init.headers
    };
    if (init.method) {
      options.method = init.method;
    }
    if (init.body !== undefined) {
      options.body = init.body;
    }
    if (this.dispatcher) {
      options.dispatcher = this.dispatcher;
    }
    return fetch(url, options);
  }

  private async read(
    response: Awaited<ReturnType<typeof fetch>>
  ): Promise<unknown> {
    return this.parseHttp(
      response.status,
      response.ok,
      await response.text(),
      response.statusText
    );
  }

  private parseHttp(
    status: number,
    ok: boolean,
    text: string,
    statusText = ""
  ): unknown {
    let payload: unknown = text;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { msg: text };
    }

    if (!ok) {
      const row = typeof payload === "object" && payload !== null ? payload : {};
      const record = row as Record<string, unknown>;
      throw new BinanceError(
        asNumber(record.code, status),
        explainBinanceError(
          asNumber(record.code, status),
          asString(record.msg, statusText || "request failed"),
          this.options.baseUrl
        )
      );
    }

    if (typeof payload === "object" && payload !== null && "code" in payload) {
      const record = payload as Record<string, unknown>;
      const code = asNumber(record.code, 0);
      if (code !== 0 && code !== 200) {
        throw new BinanceError(
          code,
          explainBinanceError(
            code,
            asString(record.msg, "request failed"),
            this.options.baseUrl
          )
        );
      }
    }

    return payload;
  }
}
