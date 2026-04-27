export type Board = number[][];

export type Direction = "up" | "down" | "left" | "right";

export type GameStatus = "playing" | "won" | "lost";

export type GameState = {
  board: Board;
  score: number;
  bestScore: number;
  status: GameStatus;
  hasWon: boolean;
};

export type MoveResult = {
  board: Board;
  scoreDelta: number;
  changed: boolean;
  transitions: TileTransition[];
};

export type Position = {
  row: number;
  col: number;
};

export type TileTransition = {
  from: Position;
  to: Position;
  value: number;
  merged: boolean;
};

export type RandomTileResult = {
  board: Board;
  position: Position | null;
  value: number | null;
};

export type TurnResult = {
  state: GameState;
  changed: boolean;
  scoreDelta: number;
  spawnPosition: Position | null;
  spawnValue: number | null;
  transitions: TileTransition[];
};
