import type { CSSProperties } from "react";
import { Tile } from "./Tile";
import type { Board as BoardMatrix, TileTransition } from "../game/types";

type BoardProps = {
  board: BoardMatrix;
  animatedCellIds: string[];
  spawnedCellId: string | null;
  moveId: number;
  animation: BoardAnimation | null;
};

export type BoardAnimation = {
  previousBoard: BoardMatrix;
  transitions: TileTransition[];
  hiddenCellIds: string[];
};

function toCellId(rowIndex: number, colIndex: number) {
  return `${rowIndex}-${colIndex}`;
}

function getMotionStyle(transition: TileTransition): CSSProperties {
  return {
    gridRow: transition.from.row + 1,
    gridColumn: transition.from.col + 1,
    "--move-x": String(transition.to.col - transition.from.col),
    "--move-y": String(transition.to.row - transition.from.row),
  } as CSSProperties;
}

export function Board({ board, animatedCellIds, spawnedCellId, moveId, animation }: BoardProps) {
  const animatedSet = new Set(animatedCellIds);
  const hiddenSet = new Set(animation?.hiddenCellIds ?? []);
  const visibleBoard = animation ? animation.previousBoard : board;

  return (
    <div className="board-grid" role="grid" aria-label="2048 board">
      {visibleBoard.map((row, rowIndex) =>
        row.map((value, colIndex) => {
          const cellId = toCellId(rowIndex, colIndex);
          const isSpawned = spawnedCellId === cellId;
          const isAnimated = animatedSet.has(cellId);
          const animation = isSpawned ? "spawn" : isAnimated ? "pulse" : "idle";
          const animationKey = isAnimated ? moveId : "steady";
          const isHidden = hiddenSet.has(cellId);

          return (
            <div className="board-cell" key={cellId} role="gridcell" aria-label={value === 0 ? "Empty cell" : `Tile ${value}`}>
              {value > 0 && !isHidden ? <Tile key={`${cellId}-${value}-${animationKey}`} value={value} animation={animation} /> : null}
            </div>
          );
        }),
      )}

      {animation ? (
        <div className="board-motion-layer" aria-hidden="true">
          {animation.transitions.map((transition, index) => (
            <div
              className={`motion-tile${transition.merged ? " motion-tile--merged" : ""}`}
              key={`${index}-${transition.from.row}-${transition.from.col}-${transition.to.row}-${transition.to.col}-${transition.value}`}
              style={getMotionStyle(transition)}
            >
              <Tile value={transition.value} animation="idle" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
