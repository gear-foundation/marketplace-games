import { BOARD_SIZE } from "./constants.js";
import { boardsEqual, createEmptyBoard } from "./board.js";
function processLine(line) {
    const compact = line
        .map((value, sourceIndex) => ({ sourceIndex, value }))
        .filter((entry) => entry.value !== 0);
    const merged = [];
    const transitions = [];
    let scoreDelta = 0;
    let targetIndex = 0;
    for (let index = 0; index < compact.length; index += 1) {
        const entry = compact[index];
        const nextEntry = compact[index + 1];
        if (nextEntry && entry.value === nextEntry.value) {
            const doubled = entry.value * 2;
            merged.push(doubled);
            scoreDelta += doubled;
            transitions.push({
                fromIndex: entry.sourceIndex,
                toIndex: targetIndex,
                value: entry.value,
                merged: true,
            }, {
                fromIndex: nextEntry.sourceIndex,
                toIndex: targetIndex,
                value: nextEntry.value,
                merged: true,
            });
            index += 1;
        }
        else {
            merged.push(entry.value);
            transitions.push({
                fromIndex: entry.sourceIndex,
                toIndex: targetIndex,
                value: entry.value,
                merged: false,
            });
        }
        targetIndex += 1;
    }
    while (merged.length < BOARD_SIZE) {
        merged.push(0);
    }
    return {
        line: merged,
        scoreDelta,
        transitions: transitions.filter((transition) => transition.merged || transition.fromIndex !== transition.toIndex),
    };
}
function readLine(board, index, direction) {
    switch (direction) {
        case "left":
            return [...board[index]];
        case "right":
            return [...board[index]].reverse();
        case "up":
            return board.map((row) => row[index]);
        case "down":
            return board.map((row) => row[index]).reverse();
    }
}
function writeLine(board, index, direction, line) {
    const resolvedLine = direction === "right" || direction === "down" ? [...line].reverse() : line;
    if (direction === "left" || direction === "right") {
        board[index] = resolvedLine;
        return;
    }
    resolvedLine.forEach((value, rowIndex) => {
        board[rowIndex][index] = value;
    });
}
function toBoardPosition(fixedIndex, lineIndex, direction) {
    switch (direction) {
        case "left":
            return { row: fixedIndex, col: lineIndex };
        case "right":
            return { row: fixedIndex, col: BOARD_SIZE - 1 - lineIndex };
        case "up":
            return { row: lineIndex, col: fixedIndex };
        case "down":
            return { row: BOARD_SIZE - 1 - lineIndex, col: fixedIndex };
    }
}
export function move(board, direction) {
    const nextBoard = createEmptyBoard();
    const transitions = [];
    let scoreDelta = 0;
    for (let index = 0; index < BOARD_SIZE; index += 1) {
        const line = readLine(board, index, direction);
        const processed = processLine(line);
        writeLine(nextBoard, index, direction, processed.line);
        scoreDelta += processed.scoreDelta;
        processed.transitions.forEach((transition) => {
            transitions.push({
                from: toBoardPosition(index, transition.fromIndex, direction),
                to: toBoardPosition(index, transition.toIndex, direction),
                value: transition.value,
                merged: transition.merged,
            });
        });
    }
    return {
        board: nextBoard,
        scoreDelta,
        changed: !boardsEqual(board, nextBoard),
        transitions,
    };
}
