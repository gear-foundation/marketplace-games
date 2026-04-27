import { Biome } from "./types";

export const BIOMES: Biome[] = ["forest", "snow", "desert", "jungle", "ancient"];

export const BALANCE = {
  easyUntilWave: 5,
  hardFromWave: 11,
  brutalFromWave: 21,
  enemyHpScale: 1,
  enemyAtkScale: 0.65,
  bossHpMultiplier: 2.5,
  bossAtkMultiplier: 1.3,
  eliteHpMultiplier: 1.4,
  eliteAtkMultiplier: 1.15,
  maxTeamSize: 3,
  maxLevel: 5,
};

export function getDifficulty(wave: number): number {
  if (wave <= 5) return 1 + wave * 0.06;
  if (wave <= 10) return 1.3 + (wave - 5) * 0.1;
  if (wave <= 20) return 1.8 + (wave - 10) * 0.18;
  if (wave <= 30) return 3.6 + (wave - 20) * 0.3;
  return 6.6 + (wave - 30) * 0.45;
}

export function getBiomeForWave(wave: number): Biome {
  const biomeIndex = Math.floor((Math.max(1, wave) - 1) / 10) % BIOMES.length;
  return BIOMES[biomeIndex];
}
