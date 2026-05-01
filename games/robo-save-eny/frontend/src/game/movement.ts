import { canMoveStoneTo, isLaserGun, isWall, stoneIndexAt } from "./collision";
import { getLaserCellSet } from "./lasers";
import { nextPosition, positionKey } from "./position";
import { applyWinCondition } from "./winCondition";
import type { Direction, GameState, Level, MoveResult, Stone } from "./types";

export function movePlayer(level: Level, state: GameState, direction: Direction): MoveResult {
  if (state.isCompleted) {
    return { state, moved: false, pushed: false, reason: "completed" };
  }

  const next = nextPosition(state.robo, direction);

  if (isWall(level, next)) {
    return { state, moved: false, pushed: false, reason: "wall" };
  }

  if (isLaserGun(level, next)) {
    return { state, moved: false, pushed: false, reason: "laser_gun" };
  }

  let stones: Stone[] = state.stones.map((stone) => ({ ...stone }));
  let pushed = false;
  const stoneIndex = stoneIndexAt(stones, next);

  if (stoneIndex !== -1) {
    const stoneNext = nextPosition(next, direction);
    if (!canMoveStoneTo(level, stones, stoneNext, state.eny, state.hasEny)) {
      return { state, moved: false, pushed: false, reason: "stone_blocked" };
    }

    stones = stones.map((stone, index) => (index === stoneIndex ? stoneNext : stone));
    pushed = true;
  }

  const laserCellsAfterMove = getLaserCellSet(level, stones);
  if (laserCellsAfterMove.has(positionKey(next))) {
    return { state, moved: false, pushed: false, reason: "laser_beam" };
  }

  const movedState = applyWinCondition({
    ...state,
    robo: next,
    stones,
    movesCount: state.movesCount + 1,
    pushesCount: state.pushesCount + (pushed ? 1 : 0),
    rescuedThisMove: false,
  });

  return {
    state: movedState,
    moved: true,
    pushed,
  };
}
