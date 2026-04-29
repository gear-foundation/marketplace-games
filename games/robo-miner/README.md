# Robo Miner

A side-scrolling mining roguelike for Vara. Dig deeper, collect ore, dodge
lava and rocks, and submit your best run on-chain.

## Layout

- `contract/` — Sails program (`RoboMinerProfile`) that stores per-player
  high-score and run count, and emits a `NewHighScore` event.
- `frontend/` — Phaser 3 + Vite browser game. Connects to the player's
  Substrate wallet, fetches a gas voucher from the Vara Arcade voucher
  backend, and signs `submit_run` from the wallet on game over.

## Mainnet Deployment

| Field          | Value |
| -------------- | --- |
| Network        | `vara-mainnet` |
| RPC            | `wss://rpc.vara.network` |
| Program ID     | `0xacc90a11efbb848c75cfd166b00c4bf3d702fd767f0930e9d2840bf091614f1b` |
| Voucher backend| `https://arcade-vara-production.up.railway.app` |

## Quick Start

### Contract

```bash
cd contract
cargo build --release
```

The IDL is regenerated automatically by `build.rs`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Then open the dev server URL printed by Vite.

## Railway Frontend Deploy

Deploy the frontend from `games/robo-miner/frontend` using its local
`Dockerfile`.

Recommended Railway service settings:

- Root Directory: `games/robo-miner/frontend` if Railway points at the
  monorepo root, or just `frontend` if the `robo-miner` directory itself
  is the repository root
- Builder: `Dockerfile`
- Port: `8080`

Recommended environment variables:

- `VITE_NODE_ADDRESS=wss://rpc.vara.network`
- `VITE_PROGRAM_ID=0xacc90a11efbb848c75cfd166b00c4bf3d702fd767f0930e9d2840bf091614f1b`
- `VITE_NETWORK=vara-mainnet`
- `VITE_VOUCHER_BACKEND_URL=https://arcade-vara-production.up.railway.app`
- `VITE_ALLOWED_HOSTS=<your-service>.up.railway.app`

Notes:

- The container is multi-stage: Vite builds static assets, then `nginx`
  serves `dist/` on Railway's `${PORT}`.
- If Railway assigns a different public hostname, add it to
  `VITE_ALLOWED_HOSTS` as a comma-separated list.
- Frontend env vars are baked in at build time, so after changing any
  `VITE_*` value you need a rebuild/redeploy.

## On-Chain Flow

1. Player connects a Substrate wallet (Polkadot.js, Talisman, SubWallet,
   Enkrypt). Addresses are normalised to Vara prefix 137.
2. The frontend asks the Vara Arcade voucher backend for a gas voucher
   for `(player, programId)`. One funded voucher per UTC day per player.
3. On game over, the player signs `submit_run(score)` from their wallet.
   Gas is paid by the voucher; the player pays no VARA value.
4. The contract updates `high_score` if it improved and bumps
   `runs_completed`.
