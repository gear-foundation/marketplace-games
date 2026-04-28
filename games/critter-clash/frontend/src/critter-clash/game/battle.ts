import { BattleEvent, Critter, Enemy } from "./types";

type BattleSide = "player" | "enemy";

export type TurnQueueEntry = {
  side: BattleSide;
  unitId: string;
  slot: number;
  speed: number;
  name: string;
  spriteKey: string;
};

function getFrontAliveIndex<T extends Critter>(team: T[]): number {
  return team.findIndex((unit) => unit.hp > 0);
}

function collectAliveWithSlots<T extends Critter>(team: T[], side: BattleSide): TurnQueueEntry[] {
  return team
    .map((unit, slot) => ({ unit, slot }))
    .filter(({ unit }) => unit.hp > 0)
    .map(({ unit, slot }) => ({
      side,
      unitId: unit.id,
      slot,
      speed: unit.speed,
      name: unit.name,
      spriteKey: unit.spriteKey,
    }));
}

export function getTurnQueue(playerTeam: Critter[], enemyTeam: Enemy[]): TurnQueueEntry[] {
  const queue = [
    ...collectAliveWithSlots(playerTeam, "player"),
    ...collectAliveWithSlots(enemyTeam, "enemy"),
  ];

  queue.sort((a, b) => {
    if (a.speed !== b.speed) return b.speed - a.speed;
    if (a.slot !== b.slot) return a.slot - b.slot;
    return Math.random() < 0.5 ? -1 : 1;
  });

  return queue;
}

export function createRoundTurnOrderIds(playerTeam: Critter[], enemyTeam: Enemy[]): string[] {
  return getTurnQueue(playerTeam, enemyTeam).map((entry) => entry.unitId);
}

export function isTeamDead(team: Critter[]): boolean {
  return getFrontAliveIndex(team) === -1;
}

export function resolveBattleTurn(
  playerTeam: Critter[],
  enemyTeam: Enemy[],
  attackerId?: string
): {
  playerTeam: Critter[];
  enemyTeam: Enemy[];
  event: BattleEvent;
} {
  const nextPlayer = playerTeam.map((pet) => ({ ...pet }));
  const nextEnemy = enemyTeam.map((enemy) => ({ ...enemy }));

  const turnQueue = getTurnQueue(nextPlayer, nextEnemy);
  const attacker = attackerId
    ? turnQueue.find((entry) => entry.unitId === attackerId)
    : turnQueue[0];

  if (!attacker) {
    return {
      playerTeam: nextPlayer,
      enemyTeam: nextEnemy,
      event: {
        id: `noop-${Date.now()}`,
        attackerSide: "player",
        attackerId: "none",
        targetId: "none",
        damage: 0,
        targetDied: false,
      },
    };
  }

  const actingTeam = attacker.side === "player" ? nextPlayer : nextEnemy;
  const defendingTeam = attacker.side === "player" ? nextEnemy : nextPlayer;

  const actingUnit = actingTeam.find((unit) => unit.id === attacker.unitId);
  const targetIndex = getFrontAliveIndex(defendingTeam);

  if (!actingUnit || targetIndex === -1) {
    return {
      playerTeam: nextPlayer,
      enemyTeam: nextEnemy,
      event: {
        id: `noop-${Date.now()}`,
        attackerSide: attacker.side,
        attackerId: attacker.unitId,
        targetId: "none",
        damage: 0,
        targetDied: false,
      },
    };
  }

  const target = defendingTeam[targetIndex];
  const damage = actingUnit.atk;
  target.hp = Math.max(0, target.hp - damage);
  const targetDied = target.hp === 0;

  return {
    playerTeam: nextPlayer,
    enemyTeam: nextEnemy,
    event: createEvent(attacker.side, actingUnit.id, target.id, damage, targetDied),
  };
}

function createEvent(
  attackerSide: "player" | "enemy",
  attackerId: string,
  targetId: string,
  damage: number,
  targetDied: boolean
): BattleEvent {
  return {
    id: `${attackerId}-${targetId}-${Date.now()}-${Math.random()}`,
    attackerSide,
    attackerId,
    targetId,
    damage,
    targetDied,
  };
}
