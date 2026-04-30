import { ActorId } from 'sails-js';

declare global {
  /**
   * Per-player profile stored on-chain.
  */
  export interface Profile {
    /**
     * Best single-run score the player has ever submitted.
    */
    high_score: number | string | bigint;
    /**
     * Total runs FINALIZED (death-end OR diamond win).
     * Increments only on `submit_run`, NOT on `submit_checkpoint`.
    */
    runs_completed: number | string | bigint;
    /**
     * Total mid-run checkpoints (each "Continue" after death).
     * Increments only on `submit_checkpoint`.
    */
    checkpoints: number | string | bigint;
  }

  /**
   * One row of the leaderboard, returned by `top_players`.
  */
  export interface LeaderboardEntry {
    player: ActorId;
    high_score: number | string | bigint;
    runs_completed: number | string | bigint;
    checkpoints: number | string | bigint;
  }
};