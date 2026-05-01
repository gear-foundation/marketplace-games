import rawLevels from "../levels/levels.json";
import { isInside, isWall } from "./collision";
import type { GameState, Level, Position } from "./types";

function assertPosition(level: Level, label: string, position: Position) {
  if (!isInside(level, position)) {
    throw new Error(`Level ${level.id}: ${label} is outside the map`);
  }

  if (isWall(level, position)) {
    throw new Error(`Level ${level.id}: ${label} is placed inside a wall`);
  }
}

export function validateLevel(level: Level) {
  if (level.tiles.length !== level.height) {
    throw new Error(`Level ${level.id}: height does not match tiles length`);
  }

  for (const row of level.tiles) {
    if (row.length !== level.width) {
      throw new Error(`Level ${level.id}: row width mismatch`);
    }
  }

  assertPosition(level, "Robo", level.objects.robo);
  assertPosition(level, "Eny", level.objects.eny);
  assertPosition(level, "exit", level.objects.exit);
  level.objects.stones.forEach((stone, index) => assertPosition(level, `stone ${index}`, stone));
  level.objects.lasers.forEach((laser, index) => assertPosition(level, `laser ${index}`, laser));

  if (level.rules.goal !== "save_eny_then_exit") {
    throw new Error(`Level ${level.id}: unsupported goal`);
  }

  return level;
}

export function getLevels(): Level[] {
  return (rawLevels as Level[]).map(validateLevel).sort((left, right) => left.id - right.id);
}

export function createInitialState(level: Level): GameState {
  return {
    levelId: level.id,
    robo: { ...level.objects.robo },
    eny: { ...level.objects.eny },
    exit: { ...level.objects.exit },
    stones: level.objects.stones.map((stone) => ({ ...stone })),
    lasers: level.objects.lasers.map((laser) => ({ ...laser })),
    hasEny: false,
    movesCount: 0,
    pushesCount: 0,
    isCompleted: false,
    rescuedThisMove: false,
  };
}
