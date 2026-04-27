import type { Sails } from "sails-js";
import { shortAddress, toDisplayNumber } from "./format";

export type LeaderboardEntry = {
  name: string;
  branches: number;
  player?: string;
};

export type ChainLeaderboardEntry = {
  player?: string;
  branches?: unknown;
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
  entries: ChainLeaderboardEntry[],
  currentPlayerName: string,
  currentPlayer?: string,
): LeaderboardEntry[] {
  return entries.map((entry) => {
    const player = String(entry.player || "");
    const isCurrentPlayer = currentPlayer !== undefined && player.toLowerCase() === currentPlayer.toLowerCase();

    return {
      name: isCurrentPlayer ? currentPlayerName : shortAddress(player),
      branches: toDisplayNumber(entry.branches),
      player,
    };
  });
}
