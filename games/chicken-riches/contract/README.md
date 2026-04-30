## The `chicken-riches-contract` program

Program for the `Chicken Riches` game written with the Sails framework.

The workspace includes:
- `chicken-riches-contract`: the package that builds the WASM binary and IDL
- `chicken-riches-contract-app`: the contract logic
- `chicken-riches-contract-client`: the generated client package for tests and integrations

### Building

```bash
cargo build --release
```

### Testing

```bash
cargo test --release
```

### Integration Notes

The on-chain and voucher integration pattern matches `2048`:

- the frontend loads the raw IDL and talks to the program through `sails-js`
- score submission is a normal contract call that can optionally be wrapped with `tx.withVoucher(...)`
- the voucher backend only needs the deployed program address to be registered in the gasless config

This contract stores each player's best score in a `HashMap` preallocated with capacity `100_000`.
