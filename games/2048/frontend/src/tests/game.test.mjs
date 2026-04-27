import assert from "node:assert/strict";
import test from "node:test";
import { addRandomTile } from "../../.test-dist/game/random.js";
import { createNewGame, has2048Tile, isGameOver, stepGame } from "../../.test-dist/game/game-state.js";
import { move } from "../../.test-dist/game/move.js";

function sequenceRandom(values) {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

test("createNewGame creates a 4x4 board with two starting tiles", () => {
  const state = createNewGame(48, sequenceRandom([0, 0, 0.9, 0]));

  assert.equal(state.board.length, 4);
  assert.equal(state.board.every((row) => row.length === 4), true);
  assert.equal(state.status, "playing");
  assert.equal(state.bestScore, 48);
  assert.equal(state.score, 0);

  const tiles = state.board.flat().filter((value) => value !== 0);
  assert.equal(tiles.length, 2);
  assert.deepEqual(tiles.sort((left, right) => left - right), [2, 2]);
});

test("addRandomTile places a new tile into an empty cell", () => {
  const board = [
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  const result = addRandomTile(board, sequenceRandom([0.45, 0.95]));

  assert.deepEqual(result, [
    [2, 0, 0, 0],
    [0, 0, 0, 4],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
});

test("move left merges and compacts correctly", () => {
  const result = move(
    [
      [2, 0, 2, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    "left",
  );

  assert.deepEqual(result.board, [
    [4, 4, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  assert.equal(result.scoreDelta, 4);
  assert.equal(result.changed, true);
});

test("move right merges toward the right edge", () => {
  const result = move(
    [
      [2, 0, 2, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    "right",
  );

  assert.deepEqual(result.board, [
    [0, 0, 4, 4],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
});

test("move up merges columns correctly", () => {
  const result = move(
    [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
    ],
    "up",
  );

  assert.deepEqual(result.board, [
    [4, 0, 0, 0],
    [4, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
});

test("move down merges columns toward the bottom edge", () => {
  const result = move(
    [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
    ],
    "down",
  );

  assert.deepEqual(result.board, [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [4, 0, 0, 0],
    [4, 0, 0, 0],
  ]);
});

test("a tile merges only once per move", () => {
  const result = move(
    [
      [2, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    "left",
  );

  assert.deepEqual(result.board, [
    [4, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  assert.equal(result.scoreDelta, 4);
});

test("double pairs merge independently in one move", () => {
  const result = move(
    [
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    "left",
  );

  assert.deepEqual(result.board, [
    [4, 4, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  assert.equal(result.scoreDelta, 8);
});

test("scoreDelta sums all created tiles", () => {
  const result = move(
    [
      [2, 2, 4, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    "left",
  );

  assert.equal(result.scoreDelta, 12);
  assert.deepEqual(result.board[0], [4, 8, 0, 0]);
});

test("stepGame adds a random tile only after a successful move", () => {
  const state = {
    board: [
      [2, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    bestScore: 0,
    status: "playing",
    hasWon: false,
  };

  const changed = stepGame(state, "left", sequenceRandom([0, 0]));
  assert.equal(changed.changed, true);
  assert.equal(changed.state.score, 4);
  assert.equal(changed.spawnValue, 2);
  assert.deepEqual(changed.state.board, [
    [4, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);

  const unchanged = stepGame(changed.state, "left", sequenceRandom([0, 0.95]));
  assert.equal(unchanged.changed, false);
  assert.deepEqual(unchanged.state.board, changed.state.board);
});

test("has2048Tile detects the win tile", () => {
  assert.equal(
    has2048Tile([
      [0, 0, 0, 0],
      [0, 2048, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]),
    true,
  );
});

test("isGameOver returns true when no moves remain", () => {
  assert.equal(
    isGameOver([
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2, 4],
      [8, 16, 32, 64],
    ]),
    true,
  );
});

test("isGameOver returns false when an empty cell or merge is available", () => {
  assert.equal(
    isGameOver([
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2, 4],
      [8, 16, 32, 0],
    ]),
    false,
  );

  assert.equal(
    isGameOver([
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2, 4],
      [8, 16, 32, 32],
    ]),
    false,
  );
});
