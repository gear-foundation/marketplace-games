import { WIN_TILE } from "./constants.js";
import { createEmptyBoard, hasEmptyCell } from "./board.js";
import { move } from "./move.js";
import { addRandomTileDetailed } from "./random.js";
export function has2048Tile(board) {
    return board.some((row) => row.some((value) => value >= WIN_TILE));
}
export function canMove(board) {
    if (hasEmptyCell(board)) {
        return true;
    }
    for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
        for (let colIndex = 0; colIndex < board[rowIndex].length; colIndex += 1) {
            const value = board[rowIndex][colIndex];
            const right = board[rowIndex][colIndex + 1];
            const down = board[rowIndex + 1]?.[colIndex];
            if (value === right || value === down) {
                return true;
            }
        }
    }
    return false;
}
export function isGameOver(board) {
    return !canMove(board);
}
export function createNewGame(bestScore = 0, random = Math.random) {
    const firstSpawn = addRandomTileDetailed(createEmptyBoard(), random);
    const secondSpawn = addRandomTileDetailed(firstSpawn.board, random);
    return {
        board: secondSpawn.board,
        score: 0,
        bestScore,
        status: "playing",
        hasWon: false,
    };
}
export function continueAfterWin(state) {
    if (state.status !== "won") {
        return state;
    }
    return {
        ...state,
        status: "playing",
    };
}
export function stepGame(state, direction, random = Math.random) {
    if (state.status !== "playing") {
        return {
            state,
            changed: false,
            scoreDelta: 0,
            spawnPosition: null,
            spawnValue: null,
            transitions: [],
        };
    }
    const moveResult = move(state.board, direction);
    if (!moveResult.changed) {
        return {
            state,
            changed: false,
            scoreDelta: 0,
            spawnPosition: null,
            spawnValue: null,
            transitions: [],
        };
    }
    const spawnResult = addRandomTileDetailed(moveResult.board, random);
    const nextScore = state.score + moveResult.scoreDelta;
    const nextBestScore = Math.max(state.bestScore, nextScore);
    const hasWonNow = !state.hasWon && has2048Tile(spawnResult.board);
    const isLostNow = isGameOver(spawnResult.board);
    const nextState = {
        board: spawnResult.board,
        score: nextScore,
        bestScore: nextBestScore,
        status: hasWonNow ? "won" : isLostNow ? "lost" : "playing",
        hasWon: state.hasWon || hasWonNow,
    };
    return {
        state: nextState,
        changed: true,
        scoreDelta: moveResult.scoreDelta,
        spawnPosition: spawnResult.position,
        spawnValue: spawnResult.value,
        transitions: moveResult.transitions,
    };
}
