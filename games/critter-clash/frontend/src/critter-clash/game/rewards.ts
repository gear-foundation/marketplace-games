import { BALANCE } from "./balance";
import { createRandomCritter } from "./critters";
import { Item, Reward, Critter } from "./types";
import { randomPick } from "./random";

const ITEMS: Item[] = [
  { id: "apple", name: "Apple", description: "+2 maxHp" },
  { id: "claw", name: "Claw", description: "+1 atk" },
  { id: "boots", name: "Boots", description: "+1 speed" },
];

export function generateRewards(playerTeam: Critter[], random: () => number): Reward[] {
  const rewards: Reward[] = [];

  rewards.push({ type: "new_pet", pet: createRandomCritter(random) });

  if (playerTeam.length > 0) {
    const pet = randomPick(playerTeam, random);
    rewards.push({ type: "upgrade_pet", petId: pet.id });
  }

  rewards.push({ type: "heal", amount: 0.3 });

  if (random() > 0.55) {
    rewards[Math.floor(random() * rewards.length)] = { type: "item", item: randomPick(ITEMS, random) };
  }

  return rewards.slice(0, 3);
}

export function applyReward(playerTeam: Critter[], reward: Reward, random: () => number): Critter[] {
  const team = playerTeam.map((pet) => ({ ...pet }));

  if (reward.type === "heal") {
    return team.map((pet) => ({ ...pet, hp: Math.min(pet.maxHp, Math.round(pet.hp + pet.maxHp * reward.amount)) }));
  }

  if (reward.type === "upgrade_pet") {
    return team.map((pet) => (pet.id === reward.petId ? upgradePet(pet) : pet));
  }

  if (reward.type === "item") {
    const candidates = team.filter((pet) => !pet.item);
    const target = candidates.length > 0 ? randomPick(candidates, random) : randomPick(team, random);

    return team.map((pet) => {
      if (pet.id !== target.id) return pet;
      if (pet.item) return pet;

      const updated = { ...pet, item: reward.item };
      if (reward.item.id === "apple") {
        updated.maxHp += 2;
        updated.hp += 2;
      }
      if (reward.item.id === "claw") {
        updated.atk += 1;
      }
      if (reward.item.id === "boots") {
        updated.speed += 1;
      }
      return updated;
    });
  }

  const duplicate = team.find((pet) => pet.name === reward.pet.name);
  if (duplicate) {
    return team.map((pet) => (pet.id === duplicate.id ? upgradePet(pet) : pet));
  }

  if (team.length < BALANCE.maxTeamSize) {
    return [...team, { ...reward.pet, id: `${reward.pet.id}-${Math.floor(random() * 100000)}` }];
  }

  const replaceIndex = Math.floor(random() * team.length);
  team[replaceIndex] = { ...reward.pet, id: `${reward.pet.id}-${Math.floor(random() * 100000)}` };
  return team;
}

function upgradePet(pet: Critter): Critter {
  if (pet.level >= BALANCE.maxLevel) {
    return pet;
  }
  return {
    ...pet,
    level: pet.level + 1,
    maxHp: pet.maxHp + 2,
    hp: pet.hp + 2,
    atk: pet.atk + 1,
  };
}

export function describeReward(reward: Reward): string {
  if (reward.type === "new_pet") return `New Pet: ${reward.pet.name}`;
  if (reward.type === "upgrade_pet") return "Upgrade random pet";
  if (reward.type === "heal") return "Heal team 30%";
  return `Item: ${reward.item.name}`;
}
