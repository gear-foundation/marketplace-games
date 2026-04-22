# Feature Spec

## Problem
The game is a Doodle Jump-like vertical platformer. It needs on-chain persistence for final run results and player points without paying storage and gas costs for every jump, movement input, collision, or platform interaction.

## User Goal
Players can play a vertical jumping run in the frontend, finish when they fall or lose, submit the final run result to the Vara program, and have the program store the result and update a points leaderboard.

## In Scope
- Store completed jump-run results.
- Award game points from the submitted run result.
- Keep each player's best submitted result only.
- Keep player points as the best awarded points, not a cumulative total.
- Emit one event only when a submitted run becomes the player's new best result.
- Reject malformed result submissions.

## Out of Scope
- Storing every move, click, turn, frame, or intermediate game action.
- Running the platform generation, physics, enemies, boosts, or collision engine inside the contract.
- Real-money wagering, token rewards, NFT minting, or marketplace behavior.
- Anti-cheat stronger than the first-version validation rules listed in this spec.
- Cross-program integrations.

## Actors
- Player: plays the vertical jump game in the frontend and submits a completed run.
- Game frontend: runs platform generation, controls, physics, collisions, scoring UI, and prepares the final result payload.
- Vara program: validates and stores final results, updates points, and exposes query routes.
- Optional admin: may configure game parameters in a future version; no admin-only behavior is required for v1.

## State Changes
- Update the submitting player's best run only when the new result beats the previous best.
- Update lightweight leaderboard data derived from best player points.

## Messages And Replies
- `submit_run(run_id, height, score, duration_ms)`:
  - Accepts the final run if the result is valid.
  - Awards points according to the contract's scoring formula.
  - Updates the player's stored best run only when the new run is better.
  - Replies with the submitted run summary, current player points, best height, and whether the run improved the stored result.
- `player_points(player)`:
  - Returns the player's best awarded points.
- `player_best_height(player)`:
  - Returns the player's best submitted height.
- `player_best_run(player)`:
  - Returns the player's stored best run, if present.
- `player_rank(player)`:
  - Returns the player's current leaderboard rank, if present.
- `leaderboard(limit)`:
  - Returns the top players by points, within a bounded limit.

## Events
- `BestRunUpdated { run_id, player, height, score, points }`

## Invariants
- Points are derived from accepted final run data, not from arbitrary client-provided point totals.
- A rejected run must not mutate submitted-run tracking, player points, best run, or best height.
- A non-improving accepted run must not overwrite the player's stored best result.
- Leaderboard state must remain consistent with each player's best points.
- Query routes must not change state.
- No per-player run history is stored in MVP.
- Height, score, duration, and points accounting must not overflow.

## Edge Cases
- Zero score or invalid score.
- Zero height or invalid height.
- Implausibly short duration for a very high score.
- Extremely large score intended to overflow point accounting.
- Result submitted by a different account than the account shown in the frontend.
- Leaderboard requested with an excessive `limit`.
- Player with no submitted results.
- Valid run that is worse than the player's current best.

## Acceptance Criteria
- A player can submit one completed jump run and receive an on-chain reply with awarded points.
- Player points update only when an accepted result improves the player's best score.
- Player best run, best points, best height, rank, and top leaderboard entries can be queried from the frontend.
- The contract emits an event only when a submitted run becomes the player's new best result.
- No per-action game log is stored on-chain.
- `gtest` coverage proves accepted submission, best-result update, repeated `run_id` behavior, non-improving submission behavior, and read queries.
