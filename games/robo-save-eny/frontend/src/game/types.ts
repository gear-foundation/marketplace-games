export type Position = {
  x: number;
  y: number;
};

export type Direction = "up" | "down" | "left" | "right";

export type Laser = Position & {
  direction: Direction;
};

export type Stone = Position;

export type LevelRules = {
  goal: "save_eny_then_exit";
  stonesBlockLasers: boolean;
};

export type LevelMeta = {
  template?: string;
  difficulty?: "tutorial" | "easy" | "medium" | "hard" | "very hard";
  solutionSteps?: number;
  solutionPushes?: number;
};

export type Level = {
  id: number;
  width: number;
  height: number;
  tiles: string[];
  objects: {
    robo: Position;
    eny: Position;
    exit: Position;
    stones: Stone[];
    lasers: Laser[];
  };
  rules: LevelRules;
  meta?: LevelMeta;
};

export type GameState = {
  levelId: number;
  robo: Position;
  eny: Position;
  exit: Position;
  stones: Stone[];
  lasers: Laser[];
  hasEny: boolean;
  movesCount: number;
  pushesCount: number;
  isCompleted: boolean;
  rescuedThisMove: boolean;
};

export type MoveResult = {
  state: GameState;
  moved: boolean;
  pushed: boolean;
  reason?: "wall" | "laser_gun" | "stone_blocked" | "laser_beam" | "completed";
};

export type CompletedLevel = {
  bestMoves: number;
  bestScore: number;
};

export type ProgressState = {
  unlockedLevel: number;
  completedLevels: Record<string, CompletedLevel>;
  settings: {
    sound: boolean;
    music: boolean;
  };
};

export type LevelCompletion = {
  levelId: number;
  moves: number;
  pushes: number;
  score: number;
  sessionId: number;
};
