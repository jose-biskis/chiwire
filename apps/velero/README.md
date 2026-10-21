# Velero

Binance USDT-M futures co-trader CLI. The *vela* is the candle; Velero is the
boat. It sizes a ticket from a nominal USDT value, suggests stop/target from
**taker fees**, reads 15m trend + 5m impulse, and refuses to open a second
ticket on a pair that is already working.

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

# Observer: poll closed candles, skip FLAT / already-open, cooldown after a sail
npm run velero -- watch RLCUSDT --notional 10 --max-open 3 --dry-run
npm run velero -- watch RLCUSDT --notional 10 --poll 30 --cooldown 300

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

- Isolated margin, leverage capped at 10 (or the exchange bracket, if lower)
- No entry if 15m SMA stack and 5m ROC disagree
- No entry if the pair already has a position or open orders
- No entry if open positions are at `--max-open` / `VELERO_MAX_OPEN`
- Notional capped by `VELERO_MAX_NOTIONAL` (default 25 USDT)
- `watch` uses **closed** 5m/15m candles, not the forming bar
- After a sail or dry-run fire, `watch` sits `--cooldown` seconds (default 300)

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
