import { Critter, PetClass } from "./types";

type CritterBase = {
  id: string;
  name: string;
  class: PetClass;
  maxHp: number;
  atk: number;
  speed: number;
};

export const CRITTERS: CritterBase[] = [
  { id: "capybara", name: "Capybara", class: "tank", maxHp: 15, atk: 3, speed: 2 },
  { id: "shiba", name: "Shiba Inu", class: "fast", maxHp: 8, atk: 4, speed: 7 },
  { id: "frog", name: "Frog", class: "balanced", maxHp: 10, atk: 3, speed: 4 },
  { id: "raccoon", name: "Raccoon", class: "damage", maxHp: 9, atk: 5, speed: 4 },
  { id: "penguin", name: "Penguin", class: "fast", maxHp: 9, atk: 3, speed: 6 },
  { id: "cat", name: "Cat", class: "fast", maxHp: 7, atk: 4, speed: 7 },
  { id: "duck", name: "Duck", class: "balanced", maxHp: 10, atk: 3, speed: 5 },
  { id: "corgi", name: "Corgi", class: "balanced", maxHp: 11, atk: 3, speed: 4 },
  { id: "owl", name: "Owl", class: "balanced", maxHp: 10, atk: 4, speed: 4 },
  { id: "axolotl", name: "Axolotl", class: "balanced", maxHp: 10, atk: 3, speed: 5 },
  { id: "seal", name: "Seal", class: "tank", maxHp: 14, atk: 2, speed: 2 },
  { id: "red-panda", name: "Red Panda", class: "damage", maxHp: 8, atk: 5, speed: 5 },
];

export function toCritter(base: CritterBase): Critter {
  return {
    ...base,
    level: 1,
    hp: base.maxHp,
    spriteKey: base.id,
  };
}

export function createStarterOptions(random: () => number): Critter[] {
  const pool = [...CRITTERS];
  const shuffled: Critter[] = [];

  while (pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    const [base] = pool.splice(index, 1);
    shuffled.push(toCritter(base));
  }

  return shuffled;
}

export function createRandomCritter(random: () => number): Critter {
  const base = CRITTERS[Math.floor(random() * CRITTERS.length)];
  return toCritter(base);
}
