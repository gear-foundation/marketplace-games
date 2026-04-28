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
     * Total runs ended (death or win → submit_run was called).
    */
    runs_completed: number | string | bigint;
  }

  /**
   * One row of the leaderboard, returned by `top_players`.
  */
  export interface LeaderboardEntry {
    player: ActorId;
    high_score: number | string | bigint;
    runs_completed: number | string | bigint;
  }
};