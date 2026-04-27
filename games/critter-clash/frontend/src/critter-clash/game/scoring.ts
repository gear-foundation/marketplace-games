import { Critter, RunStats } from "./types";

export function calculateScore(stats: RunStats, playerTeam: Critter[]): number {
  const totalPetLevels = playerTeam.reduce((acc, pet) => acc + pet.level, 0);
  return (
    stats.waveReached * 100 +
    stats.enemiesDefeated * 10 +
    stats.bossesDefeated * 250 +
    totalPetLevels * 50
  );
}
