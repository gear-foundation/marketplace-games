# Architecture Note

## Summary

The game is a Doodle Jump-like vertical platformer. The frontend owns real-time gameplay: input, physics, platform generation, collisions, boosts, enemies, and the moment a run ends. The Vara Sails program owns only submitted run-id tracking, best-result accounting, best-height tracking, and leaderboard queries.

## Program And Service Boundaries

- `JumpGameProgram` stays thin and exposes a constructor plus `GameService`.
- `GameService` owns all business logic, exported commands, read-only queries, and events.
- The first version uses one service because the contract domain is small: result submission, points, and leaderboard.

## State Ownership

Use program-owned state plus a service wrapper.

State:
- `best_run_by_player: HashMap<ActorId, RunRecord>` preallocated for 100,000 players at init
- `leaderboard: Vec<LeaderboardEntry>`

Core DTOs:
- `RunId`
- `RunRecord { run_id, player, height, score, duration_ms, points_awarded }`
- `LeaderboardEntry { player, points, best_height }`
- `SubmitRunReply { run, player_points, best_height, improved }`

## Message Flow

1. The player finishes a run in the frontend.
2. The frontend creates a unique `run_id` and submits final `height`, `score`, and `duration_ms`.
3. `GameService::submit_run` reads `msg::source()` as the player identity.
4. The service rejects invalid runs before mutating state.
5. The service computes `points_awarded` from submitted run data.
6. If the submitted run is better than the player's current best, the service updates `best_run_by_player`, refreshes leaderboard state, emits one `BestRunUpdated` event, and replies with `improved = true`.
7. If the submitted run is valid but not better, the service keeps the previous best result and replies with `improved = false`.

No delayed messages, gas reservations, waitlist behavior, or cross-program calls are required in v1.

## Routing And Public Interface

- Existing public routes that must remain stable: none; this is v1.
- New routes introduced by this release:
  - `GameService::submit_run(run_id, height, score, duration_ms)`
  - `GameService::player_points(player)`
  - `GameService::player_best_height(player)`
  - `GameService::player_best_run(player)`
  - `GameService::player_rank(player)`
  - `GameService::leaderboard(limit)`
- Any intentionally deprecated routes: none.
- Whether any method signature or reply shape changes are proposed: not applicable for v1.

## Event Contract

- Existing events that must remain stable: none.
- New event surface introduced by this release:
  - `BestRunUpdated { run_id, player, height, score, points }`
- Whether any existing event payload changes are proposed: no.
- Whether event versioning is required: no for v1.

## Generated Client Or IDL Impact

- This release requires IDL generation from the Sails workspace build.
- The frontend consumes the generated IDL/client to call `submit_run`, read `leaderboard(5)`, and read the current player's rank separately with `player_rank(player)`.
- Old and new generated clients do not need to coexist for v1.

## Contract Version And Status Surface

- Expose a read-only `version()` query returning a semantic version string or compact version tuple.
- No lifecycle status is required for v1.
- No old-version writes need to be disabled for v1.

## Off-Chain Components

- Frontend stores the deployed program id in environment configuration.
- Frontend runs the game loop locally and submits only final run data.
- Frontend displays wallet readiness, submit pending state, accepted result, best points, best height, top-5 leaderboard, and the current player's rank.
- No indexer is required for v1; direct queries are enough.

## Release And Cutover Plan

- Deploy the Sails program.
- Generate or refresh the IDL/client.
- Configure frontend endpoint and program id.
- Verify one read query and one signed `submit_run` transaction from the UI.
- Old version remains irrelevant for v1.

## Failure And Recovery Paths

- Invalid run: return an error and do not mutate state.
- Leaderboard limit too high: clamp or reject according to implementation choice; prefer reject with a clear error.
- Frontend submission fails: show the transaction error and allow the player to retry with the same `run_id`.
- New deployment not adopted: revert frontend program id to the previous known-good deployment if one exists.

## MVP Decisions

- Use a preallocated `HashMap` for player best runs.
- Keep an in-contract top leaderboard capped at 1,000 entries.
- Do not store `runs_by_player` or per-player history in MVP.
- Do not store submitted `run_id` values separately in MVP.
- Do not submit or store `result_hash` in MVP.
- Derive points as `height + score / 10`.
