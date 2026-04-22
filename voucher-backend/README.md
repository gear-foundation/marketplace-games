# Vara Arcade Voucher Backend

Gas voucher distribution service for Vara Arcade games.

The backend issues on-chain Gear/Vara vouchers so players can submit game
transactions without paying gas from their own balance. Players still sign their
transactions in the wallet; the voucher only sponsors gas.

## Behavior

One voucher per player account per UTC day, funded to `DAILY_VARA_CAP`
(default `100 VARA`) on the first `POST /voucher` of the day.

If the same player later requests a voucher for another whitelisted game
contract on the same UTC day, the backend appends that program to the existing
voucher without adding more balance.

This gives Vara Arcade one shared daily gas budget per player across multiple
games.

## Quick Start

```bash
cp .env.example .env
# Edit .env with Postgres credentials, Vara node URL, and voucher issuer account.

npm install
npm run seed
npm run start:dev
```

## API

### `POST /voucher`

Request or renew a gas voucher for a player and game program.

```json
{ "account": "0x...", "program": "0x..." }
```

Returns:

```json
{ "voucherId": "0x..." }
```

Behavior:

- First POST of a UTC day: issue a new voucher or top up the existing voucher to
  `DAILY_VARA_CAP`, then register the program.
- Subsequent same-day POSTs for a new game program: append program only, no
  balance change.
- Subsequent same-day POSTs for the same program: no-op, returns existing
  `voucherId`.

Rate limits:

- 6 POST requests per IP per hour.
- Per-IP daily VARA ceiling (`PER_IP_DAILY_VARA_CEILING`, default `1000`).

### `GET /voucher/:account`

Read-only voucher state for a player. This does not charge cap budget.

If a voucher exists:

```json
{
  "voucherId": "0x...",
  "programs": ["0x...", "0x..."],
  "validUpTo": "2026-04-22T12:00:00.000Z",
  "varaBalance": "100000000000000",
  "balanceKnown": true,
  "fundedToday": true
}
```

If no voucher exists:

```json
{
  "voucherId": null,
  "programs": [],
  "validUpTo": null,
  "varaBalance": "0",
  "balanceKnown": true,
  "fundedToday": false
}
```

### `GET /health`

Health check.

```json
{ "status": "ok", "service": "vara-arcade-voucher" }
```

### `GET /info`

Returns voucher issuer address and balance. Requires:

```text
x-api-key: <INFO_API_KEY>
```

## Environment Variables

| Var | Description |
| --- | --- |
| `NODE_URL` | Vara RPC endpoint, for example `wss://testnet.vara.network` |
| `VOUCHER_ACCOUNT` | Seed phrase, hex seed, or dev URI for the voucher issuer account |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Postgres connection |
| `PORT` | Server port, default `3001` |
| `FRONTEND_ORIGINS` | Comma-separated allowed CORS origins |
| `DAILY_VARA_CAP` | VARA funded to each player voucher on the first POST per UTC day, default `100` |
| `PER_IP_DAILY_VARA_CEILING` | Total VARA issued across all accounts from one IP per UTC day, default `1000` |
| `INFO_API_KEY` | API key for `GET /info`; empty disables the endpoint |

## Game Whitelist

`npm run seed` populates the `gasless_program` table from `src/seed.ts`.

Current whitelisted game:

- `SkyboundJump`:
  `0x5932f41b87423668d9444a29876b69777432729c810742a82b01cdd9250c9cb3`

To add another game contract, add it to `PROGRAMS` in `src/seed.ts` and run:

```bash
npm run seed
```

## Railway Notes

Create a Railway Postgres service and map its variables:

- `PGHOST` -> `DB_HOST`
- `PGPORT` -> `DB_PORT`
- `PGUSER` -> `DB_USER`
- `PGPASSWORD` -> `DB_PASSWORD`
- `PGDATABASE` -> `DB_NAME`

Recommended Railway build command:

```bash
npm ci && npm run build
```

Recommended Railway start command:

```bash
npm run start:prod
```

For a testnet MVP, keep `NODE_ENV=development` until migrations are added so
TypeORM can create the initial tables. For a production deployment, replace this
with explicit migrations.
