import { isInside, isLaserGun, isWall, hasStoneAt } from "./collision";
import { nextPosition, positionKey } from "./position";
import type { Level, Position, Stone } from "./types";

export function getLaserCells(level: Level, stones: Stone[]): Position[] {
  const cells: Position[] = [];

  for (const laser of level.objects.lasers) {
    let current = nextPosition(laser, laser.direction);

    while (isInside(level, current)) {
      if (isWall(level, current) || hasStoneAt(stones, current) || isLaserGun(level, current)) {
        break;
      }

      cells.push(current);
      current = nextPosition(current, laser.direction);
    }
  }

  return cells;
}

export function getLaserCellSet(level: Level, stones: Stone[]) {
  return new Set(getLaserCells(level, stones).map(positionKey));
}

export function isActiveLaserCell(level: Level, stones: Stone[], position: Position) {
  return getLaserCellSet(level, stones).has(positionKey(position));
}
