import type { Direction, Position } from "./types";

export const DIRECTION_DELTAS: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function nextPosition(position: Position, direction: Direction): Position {
  const delta = DIRECTION_DELTAS[direction];
  return { x: position.x + delta.x, y: position.y + delta.y };
}

export function samePosition(left: Position, right: Position) {
  return left.x === right.x && left.y === right.y;
}

export function positionKey(position: Position) {
  return `${position.x},${position.y}`;
}
