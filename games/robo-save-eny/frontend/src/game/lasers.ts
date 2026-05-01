import { isInside, isLaserGun, isWall, hasStoneAt } from "./collision";
import { nextPosition, positionKey } from "./position";
import type { Direction, Level, Position, Stone } from "./types";

export type LaserCell = Position & {
  direction: Direction;
};

export function getLaserCells(level: Level, stones: Stone[]): LaserCell[] {
  const cells: LaserCell[] = [];

  for (const laser of level.objects.lasers) {
    let current = nextPosition(laser, laser.direction);

    while (isInside(level, current)) {
      if (isWall(level, current) || hasStoneAt(stones, current) || isLaserGun(level, current)) {
        break;
      }

      cells.push({ ...current, direction: laser.direction });
      current = nextPosition(current, laser.direction);
    }
  }

  return cells;
}

export function getLaserCellSet(level: Level, stones: Stone[]) {
  return new Set(getLaserCells(level, stones).map(positionKey));
}

export function getLaserCellDirectionMap(level: Level, stones: Stone[]) {
  const cellsByKey = new Map<string, Direction[]>();

  for (const cell of getLaserCells(level, stones)) {
    const key = positionKey(cell);
    const directions = cellsByKey.get(key) ?? [];

    if (!directions.includes(cell.direction)) {
      directions.push(cell.direction);
    }

    cellsByKey.set(key, directions);
  }

  return cellsByKey;
}

export function isActiveLaserCell(level: Level, stones: Stone[], position: Position) {
  return getLaserCellSet(level, stones).has(positionKey(position));
}
