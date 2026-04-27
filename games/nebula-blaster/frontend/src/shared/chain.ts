import type { Sails } from "sails-js";
import { shortAddress, toDisplayNumber, unwrapOption } from "./format";

export type LeaderboardEntry = {
  name: string;
  score: number;
  player?: string;
};

export type ChainScoreEntry = {
  player?: unknown;
  score?: unknown;
  submitted_at?: unknown;
};

export type ChainPlayerStats = {
  runs_played?: unknown;
  best_score?: unknown;
  last_played_at?: unknown;
};

export type PlayerStats = {
  runsPlayed: number;
  bestScore: number;
};

export type ChainSubmitOutcome = {
  Accepted?: {
    rank_daily?: unknown;
    rank_alltime?: unknown;
    new_best?: unknown;
  };
};

export type SubmitOutcome = {
  rankDaily: number | null;
  rankAlltime: number | null;
  newBest: boolean;
};

export function getConfiguredProgramId(programId: string): `0x${string}` | "" {
  return /^0x[0-9a-fA-F]{64}$/.test(programId) ? (programId as `0x${string}`) : "";
}

export async function createSailsClient(
  api: Parameters<Sails["setApi"]>[0],
  programId: `0x${string}`,
  idl: string,
) {
  const [{ Sails }, { SailsIdlParser }] = await Promise.all([import("sails-js"), import("sails-js-parser")]);
  const parser = await SailsIdlParser.new();
  return new Sails(parser).setApi(api).setProgramId(programId).parseIdl(idl);
}

export function mapChainLeaderboard(
  entries: ChainScoreEntry[],
  currentPlayerName: string,
  currentPlayer?: string,
): LeaderboardEntry[] {
  return entries.map((entry) => {
    const player = String(entry.player || "");
    const isCurrentPlayer = currentPlayer !== undefined && player.toLowerCase() === currentPlayer.toLowerCase();
    return {
      name: isCurrentPlayer ? currentPlayerName : shortAddress(player),
      score: toDisplayNumber(entry.score),
      player,
    };
  });
}

export function parseSubmitOutcome(raw: unknown): SubmitOutcome | null {
  if (!raw || typeof raw !== "object") return null;
  const outcome = raw as ChainSubmitOutcome;
  const accepted = outcome.Accepted;
  if (!accepted) return null;
  return {
    rankDaily: unwrapOption<unknown>(accepted.rank_daily) !== null ? toDisplayNumber(unwrapOption<unknown>(accepted.rank_daily)) : null,
    rankAlltime: unwrapOption<unknown>(accepted.rank_alltime) !== null ? toDisplayNumber(unwrapOption<unknown>(accepted.rank_alltime)) : null,
    newBest: Boolean(accepted.new_best),
  };
}

export function parsePlayerStats(raw: unknown): PlayerStats | null {
  const inner = unwrapOption<ChainPlayerStats>(raw);
  if (!inner) return null;
  return {
    runsPlayed: toDisplayNumber(inner.runs_played),
    bestScore: toDisplayNumber(inner.best_score),
  };
}
