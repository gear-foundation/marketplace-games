import { BALANCE, getDifficulty } from "./balance";
import { Enemy, EnemyType, PetClass, Biome } from "./types";
import { randomPick } from "./random";

const ENEMY_POOLS: Record<Biome, { name: string; class: PetClass; spriteKey: string }[]> = {
  forest: [
    { name: "Hamster", class: "fast", spriteKey: "hamster" },
    { name: "Mountain Goat", class: "tank", spriteKey: "goat" },
    { name: "Fox", class: "damage", spriteKey: "red-panda" },
    { name: "Frog", class: "balanced", spriteKey: "frog" },
  ],
  snow: [
    { name: "Penguin", class: "fast", spriteKey: "penguin" },
    { name: "Snow Dog", class: "damage", spriteKey: "shiba" },
    { name: "Ice Seal", class: "tank", spriteKey: "seal" },
    { name: "Snow Corgi", class: "balanced", spriteKey: "corgi" },
  ],
  desert: [
    { name: "Sand Duck", class: "fast", spriteKey: "duck" },
    { name: "Dune Otter", class: "damage", spriteKey: "otter" },
    { name: "Camel", class: "tank", spriteKey: "alpaca" },
    { name: "Desert Cat", class: "balanced", spriteKey: "cat" },
  ],
  jungle: [
    { name: "Jungle Raccoon", class: "fast", spriteKey: "raccoon" },
    { name: "Wild Cat", class: "damage", spriteKey: "cat" },
    { name: "Hippo", class: "tank", spriteKey: "capybara" },
    { name: "Tropical Pigeon", class: "balanced", spriteKey: "pigeon" },
  ],
  ancient: [
    { name: "Stone Owl", class: "fast", spriteKey: "owl" },
    { name: "Temple Hound", class: "damage", spriteKey: "shiba" },
    { name: "Golem Goat", class: "tank", spriteKey: "goat" },
    { name: "Relic Frog", class: "balanced", spriteKey: "frog" },
  ],
};

const CLASS_STATS: Record<PetClass, { hp: number; atk: number; speed: number }> = {
  tank: { hp: 13, atk: 2, speed: 2 },
  damage: { hp: 8, atk: 5, speed: 4 },
  fast: { hp: 7, atk: 3, speed: 7 },
  balanced: { hp: 10, atk: 3, speed: 4 },
};

function getEnemyType(wave: number): EnemyType {
  if (wave % 5 === 0) return "boss";
  if (wave >= 8 && wave % 3 === 0) return "elite";
  return "normal";
}

export function createEnemyTeam(wave: number, biome: Biome, random: () => number): Enemy[] {
  const type = getEnemyType(wave);
  const count = type === "boss" ? 1 : 3;
  const difficulty = getDifficulty(wave);
  const typeHpMultiplier =
    type === "boss" ? BALANCE.bossHpMultiplier : type === "elite" ? BALANCE.eliteHpMultiplier : 1;
  const typeAtkMultiplier =
    type === "boss" ? BALANCE.bossAtkMultiplier : type === "elite" ? BALANCE.eliteAtkMultiplier : 1;

  return Array.from({ length: count }, (_, i) => {
    const enemyBase = randomPick(ENEMY_POOLS[biome], random);
    const stats = CLASS_STATS[enemyBase.class];
    const maxHp = Math.max(
      1,
      Math.round(stats.hp * difficulty * BALANCE.enemyHpScale * typeHpMultiplier)
    );
    const atk = Math.max(
      1,
      Math.round(stats.atk * Math.sqrt(difficulty) * BALANCE.enemyAtkScale * typeAtkMultiplier)
    );
    const speed = Math.max(1, Math.round(stats.speed + difficulty * 0.08));

    return {
      id: `enemy-${wave}-${i}-${Math.floor(random() * 100000)}`,
      name: type === "boss" ? `${enemyBase.name} Boss` : enemyBase.name,
      class: enemyBase.class,
      level: Math.max(1, Math.round(difficulty)),
      maxHp,
      hp: maxHp,
      atk,
      speed,
      spriteKey: enemyBase.spriteKey,
      enemyType: type,
    };
  });
}
