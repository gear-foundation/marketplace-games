## The `game-2048-contract` program

Program for the `2048` game written with the Sails framework.

The workspace includes:
- `game-2048-contract`: the package that builds the WASM binary and IDL
- `game-2048-contract-app`: the contract logic
- `game-2048-contract-client`: the generated client package for tests and integrations

### Building

```bash
cargo build --release
```

### Testing

```bash
cargo test --release
```

### Integration Notes

The on-chain and voucher integration pattern in this repository is the same for `arcade` and `lumberjack`:

- the frontend loads the raw IDL and talks to the program through `sails-js`
- score submission is a normal contract call that can optionally be wrapped with `tx.withVoucher(...)`
- the voucher backend only needs the deployed program address to be present in the backend catalog/gasless config

For `2048`, this contract stores each player's best score in a `HashMap` preallocated with capacity `100_000`.
