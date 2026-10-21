# Velero

Binance USDT-M futures co-trader CLI. The *vela* is the candle; Velero is the
boat. It sizes a ticket from a nominal USDT value, suggests stop/target from
**taker fees**, reads 15m trend + 5m impulse + the last **closed 1m** body,
and refuses to open a second ticket on a pair that is already working.

This is a risk wrapper, not a prophet. Futures can go to zero. Default venue
is **testnet**.

## Setup

```sh
cp apps/velero/.env.example apps/velero/.env
```

Put the API key in `.env` (gitignored). Enable **futures trading only** — no
withdrawals. Testnet keys are not the same as live keys
([Binance futures testnet](https://testnet.binancefuture.com)).

Binance geo-blocks many IPs. If you see `restricted location`, set
`VELERO_PROXY` to Reja (`http://127.0.0.1:3128`) or connect through Paso
before quoting or trading.

```sh
npm run build --workspace @chiwire/velero
npm run velero -- help
```

## Commands

```sh
# Fee desk for a 10 USDT ticket at 0.10% taker (0.01 USDT one way)
npm run velero -- fees --notional 10 --taker-fee 0.1

# Read RLCUSDT: momentum + suggested TP/SL. No order.
npm run velero -- quote RLCUSDT --notional 10 --leverage 10

# Observer: one process, one or many pairs (spaces or commas)
npm run velero -- watch RLCUSDT --notional 10 --max-open 3 --dry-run
npm run velero -- watch RLCUSDT ETHUSDT BTCUSDT --notional 10 --max-open 3
npm run velero -- watch RLCUSDT,ETHUSDT --notional 10 --poll 30 --cooldown 300

# Gold-digger: scan LIVE USDT-M; EYE pairs join this watcher's fleet
npm run velero -- watch --gold-digger
npm run velero -- watch RLCUSDT --gold-digger --gold-top 8 --gold-scan 36 --gold-every 180

# Smart-profit: SL/TP from ATR + swing instead of desk percents
npm run velero -- watch --gold-digger --smart-profit --notional 10 --max-open 3
npm run velero -- watch --gold-digger --smart-profit --smart-cap 12 --notional 10

# Print the order without sending it
npm run velero -- trade RLCUSDT --notional 10 --leverage 10 --max-open 3 --dry-run

# Testnet market + closePosition STOP_MARKET / TAKE_PROFIT_MARKET
npm run velero -- trade RLCUSDT --notional 10 --leverage 10 --max-open 3

# Real book: VELERO_LIVE=true AND both flags
npm run velero -- trade RLCUSDT --notional 10 --live --confirm

npm run velero -- status
```

`--tp` / `--sl` are percents of notional (`--tp 0.5` is 0.5% → 0.05 USDT on a
10 USDT ticket). Omit them and Velero suggests levels that still net about
2:1 **after** round-trip taker fees. The 0.05 / 0.025 USDT sketch is printed
as the `example` row so you can see how tight that is once the house takes
its cut.

## Rules the boat will not break

- Cross margin by default; pass `--isolated` to request isolated (Binance may refuse under Multi-Assets)
- Leverage capped at 10 (or the exchange bracket, if lower)
- No entry if 15m SMA stack and 5m ROC disagree
- No entry if the last **closed 1m** body disagrees (or is a doji) with that 15m/5m bias
- No entry on a likely reversal close: need **two** closed 1m in the trade direction; sit on a rejection wick, a climax bar vs ATR, a 5m close against the trade, or a chase through the signal 1m high/low
- `--smart-profit` places SL beyond 1m/5m/15m ATR noise and the recent swing. TP is a **reachable** 5m/1m target (nearby structure / ATR, capped at 3% of price), not 2R of that stop. While the ticket is open, `watch` pulls TP closer as the tape allows, and **banks** (market close) if the last closed 1m flips against a position that is green after fees. Sits if the stop would be over `--smart-cap` (default 5% of price, max 50%). Cannot mix with `--tp` / `--sl`
- No entry if the pair already has a position or open orders
- No entry if open positions are at `--max-open` / `VELERO_MAX_OPEN`
- Notional capped by `VELERO_MAX_NOTIONAL` (default 25 USDT)
- `watch` uses **closed** 15m/5m candles, not the forming bar; 1m always uses the last closed body (quote/trade too)
- After a sail or dry-run fire, `watch` sits `--cooldown` seconds **per pair** (default 300)
- Several pairs share `--max-open`; a pair that already has a ticket is skipped
- `--gold-digger` reads the **live** tape (even if orders stay on testnet): 24h volume,
  open interest change, funding, EMA 20/50/200, market structure, RSI, MACD,
  Stochastic, Bollinger width/%b, ADX/+DI/−DI, ATR, relative volume, distance
  to 24h high/low. It only prints `EYE` when several of those agree, with the
  justification. Those symbols **join this watcher's fleet** (cap 20, no
  duplicates). They still need 15m/5m/1m alignment, a free berth, and no open
  ticket on that pair before Velero sails.

Live orders need `VELERO_LIVE=true`, `--live`, and `--confirm`.
`watch --live` needs `--confirm` once at launch if it is allowed to send.

Run the observer in tmux; Ctrl-C drops anchor.

If Binance returns `restricted location`, set `VELERO_PROXY` (Reja on
`http://127.0.0.1:3128`) or join Paso before you quote.

`-2015 Invalid API-key, IP, or permissions` on **testnet** almost always
means a live Binance key was used. Testnet keys are a different pair from
[testnet.binancefuture.com](https://testnet.binancefuture.com). Real account:
`VELERO_LIVE=true` plus `--live --confirm`, Enable Futures on the key, and
whitelist the IP Binance actually sees (Reja/Paso egress if you proxy).
