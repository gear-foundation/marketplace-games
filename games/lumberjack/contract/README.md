## The `lumberjack-contract` program

Program for the `lumberjack` game written with the Sails framework.

The workspace includes:
- `lumberjack-contract`: the package that builds the WASM binary and IDL
- `lumberjack-contract-app`: the contract logic
- `lumberjack-contract-client`: the generated client package for tests and integrations

### Building

```bash
cargo build --release
```

### Testing

```bash
cargo test --release
```
