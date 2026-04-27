# Nebula Blaster — Implementation Spec for Claude Code

> **Target repo:** [`gear-foundation/marketplace-games`](https://github.com/gear-foundation/marketplace-games)
> **Live shell:** https://vara-games.up.railway.app/
> **Goal:** Add a new mini-game (`games/nebula-blaster/`) consisting of a Sails Rust contract + React/TS frontend, integrated with Vara wallet and gasless/signless transactions.

---

## 0. Honest preamble (read before coding)

Two facts the implementer must know up front:

1. **"Nebula Blaster" is not confirmed to be on the published mini-games list.** The deployed app at `vara-games.up.railway.app` is a client-rendered React SPA, so its game list cannot be enumerated by static fetch. Treat this as a *new* mini-game proposal that fits the existing repo's conventions — not a confirmed roadmap item.
2. **Verified repo top-level structure** (read directly from the GitHub repo page):
   - `games/`
   - `platform/`
   - `voucher-backend/`
   - Languages: TypeScript ~75%, CSS ~13%, Rust ~11%
   - Source: https://github.com/gear-foundation/marketplace-games

The presence of `voucher-backend/` strongly implies the platform already runs the gasless-voucher pattern documented in Vara's EZ-Transactions guide. **Reuse it. Do not stand up a second voucher backend.**

Anything in this spec marked **[design choice]** is a proposal, not a fact — feel free to override with sound reason.

---

## 1. Game concept

**Nebula Blaster** is a top-down, 60-second wave-survival arcade shooter.

- You pilot a ship at the bottom of a starfield.
- Asteroids and alien drones spawn from the top and come at you.
- You dodge, shoot, and chain kills for a score multiplier.
- When the 60-second timer ends or you die, your final score is submitted on-chain.
- Two leaderboards: **Daily** (resets every 24h) and **All-time**.

**Retention loop** **[design choice]**:

- Runs are short (~60s) → low friction to "one more try".
- Daily reset → permanent re-engagement window for any player, not just the top whales.
- One on-chain write per run → cheap contract, simple anti-cheat.

---

## 2. Game mechanics (kept deliberately small)

| System | Spec |
| --- | --- |
| **Controls** | WASD or Arrow keys to move; Space or left-click to shoot. Mouse aim **disabled in v1** for cross-device-friendliness. **[design choice]** |
| **Player ship** | 1 hull, 3 HP, fixed fire rate (~5 shots/sec) |
| **Enemy: Asteroid** (wave 1+) | Drifts down, 1 HP, +10 score |
| **Enemy: Drone** (wave 2+) | Tracks player slowly, 2 HP, fires 1 bullet every 2s, +30 score |
| **Enemy: Splitter** (wave 3+) | Asteroid that splits into 2 small chunks on death, +20 (parent) + 2×5 (children) |
| **Power-ups (3% drop on enemy death)** | Triple-shot (10s), Shield (1 hit absorbed), +1 HP |
| **Score multiplier** | x1 → x2 → x3 → x4. Each kill within 1.5s of the last increments. Taking damage resets to x1. |
| **Run length** | 60-second timer **OR** 0 HP — whichever comes first |
| **Difficulty curve** | Spawn interval scales with run time: `spawnInterval = max(1.5s − 0.15·t_seconds, 0.3s)` **[design choice]** |

That's the whole game. No upgrades, no shop, no economy. Ship v1 small, iterate based on data.

---

## 3. Architecture (matches existing repo conventions)

```
marketplace-games/
├── games/
│   └── nebula-blaster/                    ← NEW (this spec)
│       ├── frontend/                      (TypeScript + React + Vite)
│       │   ├── src/
│       │   │   ├── game/                  (canvas game loop — pure TS, NO React)
│       │   │   │   ├── engine.ts          (RAF loop, fixed 60Hz timestep)
│       │   │   │   ├── entities.ts        (Player, Enemy, Bullet, PowerUp)
│       │   │   │   ├── input.ts           (keyboard handler)
│       │   │   │   ├── collision.ts       (AABB)
│       │   │   │   ├── spawner.ts         (wave logic)
│       │   │   │   └── renderer.ts        (Canvas2D draws)
│       │   │   ├── components/
│       │   │   │   ├── GameCanvas.tsx     (mounts engine, exposes onGameEnd)
│       │   │   │   ├── HUD.tsx            (score, timer, HP, multiplier)
│       │   │   │   ├── Leaderboard.tsx
│       │   │   │   └── WalletGate.tsx     (gates Play behind connection)
│       │   │   ├── hooks/
│       │   │   │   ├── useNebulaProgram.ts  (sails-js generated client)
│       │   │   │   └── useSubmitScore.ts
│       │   │   └── App.tsx
│       │   ├── package.json
│       │   └── vite.config.ts
│       └── contract/                      (Rust + Sails)
│           ├── app/
│           │   └── src/
│           │       └── lib.rs             (NebulaBlasterService)
│           ├── client/                    (auto-generated TS client)
│           ├── tests/
│           │   └── gtest.rs
│           ├── Cargo.toml
│           └── build.rs
└── platform/                              (already exists — integrate the new game here)
└── voucher-backend/                       (already exists — REUSE for gasless txs)
```

This mirrors Vara's documented Sails project layout (`app/` for contract code, `client/` for the auto-generated TS client, `tests/` for `gtest`). Source: Vara wiki, Sails framework page (https://wiki.vara.network/docs/build/sails/).

---

## 4. Smart contract spec (Sails / Rust)

### 4.1 Core principle

**The contract stores results, not gameplay.** Validating physics on-chain would be expensive, slow, and a glitch farm. The contract is essentially a leaderboard with a thin anti-cheat layer. **[design choice]**

### 4.2 State

```rust
struct NebulaBlasterState {
    // Per-player stats
    players: BTreeMap<ActorId, PlayerStats>,
    // Daily leaderboard (top 100, resets every 24h)
    daily_top: Vec<ScoreEntry>,        // sorted desc, capped at 100
    daily_epoch_start: u64,            // block timestamp ms
    // All-time leaderboard (top 100)
    alltime_top: Vec<ScoreEntry>,      // sorted desc, capped at 100
    // Anti-replay: per-player nonce
    nonces: BTreeMap<ActorId, u64>,
    // Outstanding run tickets, keyed by ticket_id
    open_tickets: BTreeMap<u64, Ticket>,
    next_ticket_id: u64,
}

struct PlayerStats {
    runs_played: u32,
    best_score: u32,
    last_played_at: u64,
}

struct ScoreEntry {
    player: ActorId,
    score: u32,
    submitted_at: u64,
}

struct Ticket {
    player: ActorId,
    issued_at: u64,
}

struct RunTicket {
    id: u64,
    issued_at: u64,
}

enum SubmitOutcome {
    Accepted { rank_daily: Option<u32>, rank_alltime: Option<u32>, new_best: bool },
}

enum Error {
    UnknownTicket,
    TicketBelongsToOther,
    TicketExpired,         // > 5 min between start_run and submit_score
    ImplausibleScore,      // exceeds sanity bound
    BadDuration,           // duration > 90s or < 1s
}
```

### 4.3 Service methods (Sails `#[service]`)

| Method | Type | Signature | Purpose |
| --- | --- | --- | --- |
| `start_run` | command | `(nonce: u64) -> Result<RunTicket, Error>` | Records intent, returns a ticket the frontend embeds in the score submission. Increments per-player nonce. |
| `submit_score` | command | `(ticket_id: u64, score: u32, run_duration_ms: u32) -> Result<SubmitOutcome, Error>` | Validates ticket ownership + freshness + sanity bound, updates leaderboards. |
| `get_daily_top` | query | `(limit: u32) -> Vec<ScoreEntry>` | Read daily leaderboard. |
| `get_alltime_top` | query | `(limit: u32) -> Vec<ScoreEntry>` | Read all-time leaderboard. |
| `get_player_stats` | query | `(who: ActorId) -> Option<PlayerStats>` | Personal best + run count. |

### 4.4 Why a `start_run` / `submit_score` pair?

- **Without it:** anyone can submit any score from any tab → leaderboard is junk.
- **With it:** a run requires a fresh on-chain ticket, must arrive within a plausible time window, and must satisfy `score ≤ MAX_SCORE_PER_SECOND × duration_seconds`. Not cheat-proof against a determined scripter, but filters casual cheating.

### 4.5 Daily reset (lazy)

Inside `submit_score`, before writing:

```rust
let now = exec::block_timestamp();
if now - state.daily_epoch_start > 86_400_000 {
    state.daily_top.clear();
    state.daily_epoch_start = now;
}
```

No cron, no scheduled task — the next submission performs the reset. **[design choice]**

### 4.6 Sanity bound

```rust
const MAX_SCORE_PER_SECOND: u32 = 200;  // tune after playtesting
const MAX_RUN_MS: u32 = 90_000;         // 60s game + 30s grace
const MIN_RUN_MS: u32 = 1_000;
const TICKET_TTL_MS: u64 = 300_000;     // 5 minutes

if run_duration_ms > MAX_RUN_MS || run_duration_ms < MIN_RUN_MS {
    return Err(Error::BadDuration);
}
let cap = MAX_SCORE_PER_SECOND.saturating_mul(run_duration_ms / 1000 + 1);
if score > cap {
    return Err(Error::ImplausibleScore);
}
```

### 4.7 Sails framework facts (verified)

- Sails is the official Rust framework for Vara contracts; it auto-generates an IDL file from the Rust code, and from that IDL you can auto-generate a TypeScript client. Source: Vara wiki — https://wiki.vara.network/docs/build/sails/
- The standard Sails project layout includes `app/` (Rust code), `client/` (generated TS client), `tests/` (gtest). Source: Vara Network Medium article — https://medium.com/@VaraNetwork/sails-a-new-way-to-develop-on-vara-network-05ce144ba593
- `gtest` is the Vara-recommended crate for local unit testing of programs. Source: Vara wiki "Attention developers!" page — https://wiki.vara.network/docs/build/introduction

---

## 5. Frontend spec

### 5.1 Required Vara packages (verified names)

From the gear-tech awesome list (https://github.com/gear-tech/awesome-gear-protocol):

| Package | Role |
| --- | --- |
| `@gear-js/api` | Vara RPC client (substrate API wrapper) |
| `@gear-js/react-hooks` | React hooks (useApi, useAccount, etc.) |
| `@gear-js/wallet-connect` | Standardized Substrate wallet picker (Polkadot.js, Talisman, SubWallet, etc.) |
| `gear-ez-transactions` | Gasless + signless transaction wrappers |
| `sails-js` | Consumes the IDL-generated client |

### 5.2 Wallet + gasless/signless flow (verified pattern)

Wrap the game in `<EzTransactionsProvider>`. With this set up:

- The user connects their wallet **once** to authorize the dApp.
- A temporary local sub-account is created and signs each `submit_score` automatically (signless).
- A voucher issued by the existing `voucher-backend/` pays the gas (gasless).
- **Net result: after the initial connect, every "play again" = zero clicks, zero popups.**

This is the documented Vara pattern. Sources:

- https://medium.com/@VaraNetwork/ez-transactions-effortless-gasless-signless-transactions-for-your-dapp-on-vara-063a8803d69c
- https://wiki.vara.network/docs/api/tooling/gasless-txs

This is why a 60-second arcade loop is viable on-chain — without it, every run would interrupt the player with a signing popup.

### 5.3 Game loop / React separation (CRITICAL for no-glitch)

**Keep the canvas game fully decoupled from React.** **[design choice — but strongly recommended]**

- React renders the HUD shell, leaderboard, and wallet UI.
- The canvas runs a pure-TS game loop with `requestAnimationFrame` and a fixed 60 Hz physics step.
- The only React → game interface: `engine.start()` and `engine.stop()`.
- The only game → React interface: an `onGameEnd({ score, durationMs })` callback fired once.

Why: React re-renders inside the game loop are the #1 cause of stutter and "glitching" in canvas games. HUD updates should write to a small mutable HUD state object that React reads at a *throttled* cadence (e.g. 4 Hz for score, the timer can use a CSS animation instead of React state).

### 5.4 Run sequence

```
1. User clicks "Play"
2. Frontend → contract.start_run(nonce)        → returns RunTicket
3. Game starts (canvas runs, React shows HUD)
4. Game ends (timer hit 0 or 0 HP)             → onGameEnd({score, durationMs})
5. Frontend → contract.submit_score(ticket.id, score, durationMs)
6. On success: refetch leaderboard, show "New best!" if applicable, "Play again" button
7. On network failure: keep score local, show "couldn't submit — retry?" button (run is not lost)
```

### 5.5 Leaderboard UI

Two tabs: **Today** and **All-time**.

Each row: rank, address (truncated `0x12…ab`), score, time-ago.

- Highlight the current player's row.
- Poll every 30 s while idle (keeps it feeling live without spamming the node).
- Refetch immediately after a successful submit. **[design choice]**

---

## 6. Step-by-step implementation order (do not reorder)

Each step is a discrete, testable commit. This order is chosen so you never have a half-broken state.

| # | Step | Done when |
| --- | --- | --- |
| 1 | Scaffold the contract with `sails-cli new nebula-blaster`. Replace the hello-world service with the state + 5 methods from §4. Compile to wasm. | `cargo build --release --target wasm32-unknown-unknown` succeeds and produces an optimized wasm blob. |
| 2 | Write `gtest` unit tests: nonce increments correctly, sanity bound rejects `score = 999_999`, daily epoch resets after 24h elapsed, leaderboard caps at 100 entries, ticket expires after 5 minutes. | All tests green via `cargo test`. |
| 3 | Deploy to Vara **testnet** via the Gear IDEA portal. Save the program ID. | Program ID written into a `frontend/.env` file. |
| 4 | Generate the TS client via the Sails build script. | `client/` folder contains a usable typed client. |
| 5 | Scaffold the frontend as Vite + React + TS in `games/nebula-blaster/frontend/`. Install all packages from §5.1. | `npm run dev` shows a hello-world page. |
| 6 | **Build the canvas game in isolation — no contract, no wallet.** Engine, entities, collision, spawner, renderer. Open the `index.html` directly and play. | Stable 60 fps in Chrome, game ends correctly at 0 HP and at 60s, no console errors. |
| 7 | Add the React HUD around the canvas. Verify the canvas still hits 60 fps with HUD updating. | DevTools performance tab shows no dropped frames during a 60s run. |
| 8 | Wire wallet connect with `@gear-js/wallet-connect`. Gate the "Play" button behind connection. | Disconnected user sees a "Connect wallet" CTA; connected user sees "Play". |
| 9 | Wire `start_run` / `submit_score` using the generated sails-js client. Test on testnet. | A full run end-to-end records a score visible in the contract state. |
| 10 | Wrap the app in `EzTransactionsProvider`. Verify the **second** run requires zero popups. | Runs 2..N submit silently; only run 1 (or post-disconnect) requires signing. |
| 11 | Build the leaderboard component using the two `query` methods. Two tabs (Today / All-time), poll every 30s. | Leaderboard updates after each submit; current player highlighted. |
| 12 | Polish: particle explosions (cheap expanding circles, pooled), screen shake on hit, "+10 / +30" floating numbers, simple sound effects (optional). | Game feels punchy. **Particle pool is pre-allocated** — no per-frame allocations. |
| 13 | Integrate into the `platform/` shell so the game appears alongside others on the arcade home page. | Tile renders, click navigates into the game, back button returns. |

---

## 7. Anti-glitch rules (the part that matters)

These are the failure modes most likely to bite, with preemptive fixes.

1. **Fixed timestep, not delta-time-everywhere.** Use a 16.67 ms accumulator. Multiplying variable delta through every entity is the standard cause of "tunneling" bullets and unreproducible bugs. **[design choice]**

   ```ts
   let acc = 0;
   const STEP = 1000 / 60;
   function frame(t: number) {
     acc += t - last;
     last = t;
     while (acc >= STEP) { update(STEP / 1000); acc -= STEP; }
     render();
     requestAnimationFrame(frame);
   }
   ```

2. **Pre-allocate object pools** for bullets and particles. Spawning/GC during play causes frame drops. Caps: 200 bullets, 500 particles, 100 enemies.

3. **Pause the loop when the tab is backgrounded** (`document.hidden`). Otherwise the accumulator catches up on refocus and the player dies in one frame.

4. **All transactions are async, all UI for them is non-blocking.** Never `await` inside the game loop. `submit_score` happens *after* the game-over screen renders.

5. **Treat the contract as eventually consistent.** Show optimistic UI on submit, reconcile on confirmation, fall back gracefully on timeout — the local run is never lost just because the network hiccupped.

6. **One source of truth per state.** Game state lives in the engine. Wallet state lives in React context. Chain state lives in sails-js hooks. Don't cross-write.

7. **Bound everything user-controllable.** The contract's sanity bound is one layer; the frontend should also clamp the score it submits to the same value defensively, in case of a bug.

8. **No React inside the game loop.** Repeating because it matters: the HUD reads from a mutable object, throttled. Do not call `setState` from inside the engine tick.

---

## 8. Out of scope for v1 (good v2 candidates)

Listed so they don't accidentally creep in:

- Multiplayer / PvP (latency, matchmaking, escrow — separate project).
- Token rewards / NFT skins (economic design is its own problem).
- Mobile touch controls (possible, but desktop keyboard ships first).
- On-chain replay verification (would require submitting input traces and re-simulating — expensive).
- Cosmetic ship customization.
- Achievements / badges.

---

## 9. Verifiability summary

| Claim | Status | Source |
| --- | --- | --- |
| Repo top-level structure (`games/`, `platform/`, `voucher-backend/`) | ✅ verified | https://github.com/gear-foundation/marketplace-games |
| Repo language mix (~75% TS, ~13% CSS, ~11% Rust) | ✅ verified | Same repo page |
| Sails framework auto-generates IDL + TS client | ✅ verified | https://wiki.vara.network/docs/build/sails/ |
| Standard Sails project layout (`app/`, `client/`, `tests/`) | ✅ verified | https://medium.com/@VaraNetwork/sails-a-new-way-to-develop-on-vara-network-05ce144ba593 |
| `@gear-js/react-hooks`, `@gear-js/wallet-connect`, `gear-ez-transactions` are the official libs | ✅ verified | https://github.com/gear-tech/awesome-gear-protocol |
| `gtest` for local contract unit testing | ✅ verified | https://wiki.vara.network/docs/build/introduction |
| Voucher-based gasless + sub-account signless flow | ✅ verified | https://medium.com/@VaraNetwork/ez-transactions-effortless-gasless-signless-transactions-for-your-dapp-on-vara-063a8803d69c |
| "Nebula Blaster" is on the existing arcade list | ❌ **could not verify** | The deployed app is a client-rendered SPA; the static HTML does not list games |
| All `[design choice]` items | ⚠️ proposal, not fact | Override freely with sound reasoning |

---

## 10. Glossary (for anyone landing here cold)

- **Vara Network** — Layer-1 Substrate-based chain, runs Wasm smart contracts via the Gear Protocol.
- **Gear Protocol** — The execution engine under Vara. Uses an actor model: every contract is an actor that communicates by message-passing.
- **Sails** — The high-level Rust framework for writing Vara contracts. Generates IDL + TS client automatically.
- **IDL** — Interface Definition Language. Language-agnostic description of a contract's API; used to generate clients.
- **Voucher** — A pre-funded credit that pays gas for a user's transactions (the "gasless" half).
- **Signless transaction** — A flow where a temporary local sub-account signs on the user's behalf after a one-time authorization (the "signless" half).
- **gtest** — Vara's local unit-test crate for contracts; runs in-process without a real node.
- **Gear IDEA portal** — Vara's web tool for compiling, deploying, and interacting with programs in-browser.
