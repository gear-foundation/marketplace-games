import { samePosition } from "./position";
import type { Level, Position, Stone } from "./types";

export function isInside(level: Level, position: Position) {
  return position.x >= 0 && position.y >= 0 && position.x < level.width && position.y < level.height;
}

export function tileAt(level: Level, position: Position) {
  if (!isInside(level, position)) return "#";
  return level.tiles[position.y]?.[position.x] ?? "#";
}

export function isWall(level: Level, position: Position) {
  return tileAt(level, position) === "#";
}

export function isLaserGun(level: Level, position: Position) {
  return level.objects.lasers.some((laser) => samePosition(laser, position));
}

export function stoneIndexAt(stones: Stone[], position: Position) {
  return stones.findIndex((stone) => samePosition(stone, position));
}

export function hasStoneAt(stones: Stone[], position: Position) {
  return stoneIndexAt(stones, position) !== -1;
}

export function isBlockedForRobo(level: Level, stones: Stone[], position: Position) {
  return !isInside(level, position) || isWall(level, position) || isLaserGun(level, position) || hasStoneAt(stones, position);
}

export function canMoveStoneTo(level: Level, stones: Stone[], position: Position, eny: Position, hasEny: boolean) {
  if (!isInside(level, position) || isWall(level, position) || isLaserGun(level, position) || hasStoneAt(stones, position)) {
    return false;
  }

  return hasEny || !samePosition(position, eny);
}
