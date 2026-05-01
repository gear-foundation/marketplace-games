import { samePosition } from "./position";
import type { GameState } from "./types";

export function applyWinCondition(state: GameState): GameState {
  const hasEny = state.hasEny || samePosition(state.robo, state.eny);
  const rescuedThisMove = !state.hasEny && hasEny;
  const isCompleted = hasEny && samePosition(state.robo, state.exit);

  return {
    ...state,
    hasEny,
    rescuedThisMove,
    isCompleted,
  };
}
