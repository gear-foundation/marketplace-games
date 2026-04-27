import { SPAWN_TWO_CHANCE } from "./constants.js";
import { cloneBoard, getEmptyPositions } from "./board.js";
export function addRandomTileDetailed(board, random = Math.random) {
    const nextBoard = cloneBoard(board);
    const emptyPositions = getEmptyPositions(nextBoard);
    if (emptyPositions.length === 0) {
        return {
            board: nextBoard,
            position: null,
            value: null,
        };
    }
    const position = emptyPositions[Math.floor(random() * emptyPositions.length)];
    const value = random() < SPAWN_TWO_CHANCE ? 2 : 4;
    nextBoard[position.row][position.col] = value;
    return {
        board: nextBoard,
        position,
        value,
    };
}
export function addRandomTile(board, random = Math.random) {
    return addRandomTileDetailed(board, random).board;
}
