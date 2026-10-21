export type Side = "LONG" | "SHORT";
export type Bias = Side | "FLAT";

export type Kline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SymbolFilters = {
  symbol: string;
  status: string;
  tickSize: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
  maxLeverage: number;
};

export type PositionRow = {
  symbol: string;
  positionAmt: number;
  notional: number;
  leverage: number;
  isolated: boolean;
};

export type OpenOrderRow = {
  symbol: string;
  orderId: number;
  type: string;
  side: string;
  stopPrice: string;
};
