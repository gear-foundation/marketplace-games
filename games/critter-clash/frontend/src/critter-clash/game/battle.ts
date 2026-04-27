import { BattleEvent, Critter, Enemy } from "./types";

function getFrontAliveIndex<T extends Critter>(team: T[]): number {
  return team.findIndex((unit) => unit.hp > 0);
}

export function isTeamDead(team: Critter[]): boolean {
  return getFrontAliveIndex(team) === -1;
}

export function resolveBattleTurn(playerTeam: Critter[], enemyTeam: Enemy[]): {
  playerTeam: Critter[];
  enemyTeam: Enemy[];
  event: BattleEvent;
} {
  const nextPlayer = playerTeam.map((pet) => ({ ...pet }));
  const nextEnemy = enemyTeam.map((enemy) => ({ ...enemy }));

  const pIndex = getFrontAliveIndex(nextPlayer);
  const eIndex = getFrontAliveIndex(nextEnemy);

  if (pIndex === -1 || eIndex === -1) {
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

  const playerFront = nextPlayer[pIndex];
  const enemyFront = nextEnemy[eIndex];

  if (playerFront.speed >= enemyFront.speed) {
    const damage = playerFront.atk;
    enemyFront.hp = Math.max(0, enemyFront.hp - damage);
    if (enemyFront.hp === 0) {
      return {
        playerTeam: nextPlayer,
        enemyTeam: nextEnemy,
        event: createEvent("player", playerFront.id, enemyFront.id, damage, true),
      };
    }

    const retaliation = enemyFront.atk;
    playerFront.hp = Math.max(0, playerFront.hp - retaliation);
    return {
      playerTeam: nextPlayer,
      enemyTeam: nextEnemy,
      event: createEvent("enemy", enemyFront.id, playerFront.id, retaliation, playerFront.hp === 0),
    };
  }

  const damage = enemyFront.atk;
  playerFront.hp = Math.max(0, playerFront.hp - damage);
  if (playerFront.hp === 0) {
    return {
      playerTeam: nextPlayer,
      enemyTeam: nextEnemy,
      event: createEvent("enemy", enemyFront.id, playerFront.id, damage, true),
    };
  }

  const retaliation = playerFront.atk;
  enemyFront.hp = Math.max(0, enemyFront.hp - retaliation);
  return {
    playerTeam: nextPlayer,
    enemyTeam: nextEnemy,
    event: createEvent("player", playerFront.id, enemyFront.id, retaliation, enemyFront.hp === 0),
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
