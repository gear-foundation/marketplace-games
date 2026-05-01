# Robo. Save Eny!

Top-down puzzle rescue game for Vara Arcade.

The frontend contains the full puzzle loop: JSON levels, laser recalculation, stone pushes, level unlocking, local best moves, and optional Vara score submission.

The contract is a leaderboard-only Sails contract that stores each player's best rescue score.

## Frontend

```bash
cd games/robo-save-eny/frontend
npm install --legacy-peer-deps
npm run verify-levels
npm run build
```

Set `VITE_ENABLE_CHAIN=true` plus `VITE_PROGRAM_ID` after deploying the contract to enable wallet and voucher score submission.

## Contract

```bash
cd games/robo-save-eny/contract
cargo test --release
```
