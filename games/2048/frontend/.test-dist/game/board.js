import { BOARD_SIZE } from "./constants.js";
export function createEmptyBoard(size = BOARD_SIZE) {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}
export function cloneBoard(board) {
    return board.map((row) => [...row]);
}
export function boardsEqual(a, b) {
    return a.every((row, rowIndex) => row.every((value, colIndex) => value === b[rowIndex][colIndex]));
}
export function getEmptyPositions(board) {
    const positions = [];
    board.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
            if (value === 0) {
                positions.push({ row: rowIndex, col: colIndex });
            }
        });
    });
    return positions;
}
export function hasEmptyCell(board) {
    return board.some((row) => row.some((value) => value === 0));
}
