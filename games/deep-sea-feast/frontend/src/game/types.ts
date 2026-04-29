export type GameStatus = "idle" | "playing" | "over";

export type GameOverReason = "predator" | "starvation" | "hook";

export type FishingHookPhase = "warning" | "dropping" | "holding" | "rising";

export type PlayerFish = {
  x: number;
  y: number;
  size: number;
  saturation: number;
  visualSaturation: number;
  growthProgress: number;
  facing: -1 | 1;
  biteAnimationMs: number;
  growthPulseMs: number;
  growthTargetSize: number | null;
};

export type EnemyFish = {
  id: string;
  x: number;
  y: number;
  baseY: number;
  size: number;
  speed: number;
  direction: -1 | 1;
  driftAmplitude: number;
  driftPhase: number;
  driftSpeed: number;
  points: number;
  hue: number;
  reactionAnimationMs: number;
};

export type Plankton = {
  id: string;
  x: number;
  y: number;
  baseY: number;
  speed: number;
  direction: -1 | 1;
  driftAmplitude: number;
  driftPhase: number;
  driftSpeed: number;
  points: number;
  scale: number;
};

export type FishingHook = {
  x: number;
  targetY: number;
  phase: FishingHookPhase;
  phaseMs: number;
  ageMs: number;
  swingSeed: number;
};

export type GameState = {
  status: GameStatus;
  player: PlayerFish;
  enemies: EnemyFish[];
  plankton: Plankton[];
  hook: FishingHook | null;
  hookCooldownMs: number;
  score: number;
  timeMs: number;
  spawnCooldownMs: number;
  planktonSpawnCooldownMs: number;
  nextEnemyId: number;
  nextPlanktonId: number;
  gameOverOverlayDelayMs: number;
  reason: GameOverReason | null;
};

export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  pointer: { x: number; y: number } | null;
};
