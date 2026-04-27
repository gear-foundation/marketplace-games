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
  { id: "corgi", name: "Corgi", class: "balanced", maxHp: 10, atk: 3, speed: 3 },
  { id: "cat", name: "Cat", class: "fast", maxHp: 7, atk: 3, speed: 6 },
  { id: "turtle", name: "Turtle", class: "tank", maxHp: 15, atk: 2, speed: 1 },
  { id: "fox", name: "Fox", class: "damage", maxHp: 8, atk: 5, speed: 4 },
  { id: "panda", name: "Panda", class: "tank", maxHp: 14, atk: 2, speed: 2 },
  { id: "rabbit", name: "Rabbit", class: "fast", maxHp: 6, atk: 3, speed: 7 },
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
