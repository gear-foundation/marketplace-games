import { BOARD_SIZE } from "./constants.js";
import type { Board, Position } from "./types.js";

export function createEmptyBoard(size = BOARD_SIZE): Board {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function boardsEqual(a: Board, b: Board): boolean {
  return a.every((row, rowIndex) => row.every((value, colIndex) => value === b[rowIndex][colIndex]));
}

export function getEmptyPositions(board: Board): Position[] {
  const positions: Position[] = [];

  board.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === 0) {
        positions.push({ row: rowIndex, col: colIndex });
      }
    });
  });

  return positions;
}

export function hasEmptyCell(board: Board): boolean {
  return board.some((row) => row.some((value) => value === 0));
}
