export type GameStatus = "start" | "playing" | "paused" | "gameOver";

export type GameOverReason = "brokenEggs" | "noChickens" | null;

export type ChickenAnimationName = "idle" | "layingEgg" | "scaredStart" | "scaredLoop" | "relieved" | "stolen";

export type ChickenAnimation = {
  name: ChickenAnimationName;
  startedAt: number;
  eventTriggered: boolean;
};

export type Chicken = {
  id: string;
  x: number;
  y: number;
  alive: boolean;
  pendingRemoval: boolean;
  threatenedByFox: boolean;
  animation: ChickenAnimation;
};

export type EggState = "falling" | "caught" | "broken" | "thrown";

export type Egg = {
  id: string;
  x: number;
  y: number;
  vy: number;
  radius: number;
  spawnedAt: number;
  sourceChickenId: string;
  state: EggState;
};

type EggVisualEffectBase = {
  id: string;
  x: number;
  y: number;
  startedAt: number;
  durationMs: number;
};

export type EggVisualEffect =
  | (EggVisualEffectBase & {
      kind: "foxHit";
    })
  | (EggVisualEffectBase & {
      kind: "depositDrop";
      targetX: number;
      targetY: number;
    });

export type FarmerAnimationName = "catch" | "deposit" | "throw" | "slipFall" | "recover";

export type FarmerAnimation = {
  name: FarmerAnimationName;
  startedAt: number;
  durationMs: number;
};

export type Farmer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  walkCycleMs: number;
  isJumping: boolean;
  isFallen: boolean;
  fallenUntil: number | null;
  basketEggs: number;
  animation: FarmerAnimation | null;
};

export type EggCollector = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EggPuddle = {
  id: string;
  x: number;
  y: number;
  radius: number;
  createdAt: number;
  slippedAt: number | null;
  expiresAt: number;
};

export type CollectorFillState =
  | "collector_empty"
  | "collector_low"
  | "collector_medium"
  | "collector_high"
  | "collector_full";

export type CollectorFeedback = {
  startedAt: number;
  durationMs: number;
  pointsAwarded: number;
  fromState: CollectorFillState;
  toState: CollectorFillState;
};

export type FoxAnimationName = "appear" | "lickLips" | "hover" | "steal" | "carryUp" | "hit" | "retreat";

export type FoxAnimation = {
  name: FoxAnimationName;
  startedAt: number;
};

export type Fox = {
  id: string;
  x: number;
  y: number;
  targetChickenId: string;
  appearedAt: number;
  attackAt: number;
  active: boolean;
  animation: FoxAnimation;
};

export type DepositCombo = {
  count: number;
  lastDepositTime: number;
  activeUntil: number;
};

export type GameStats = {
  caughtEggs: number;
  depositedEggs: number;
  foxesRepelled: number;
  chickensLost: number;
};

export type GameState = {
  status: GameStatus;
  gameOverReason: GameOverReason;
  score: number;
  brokenEggsCount: number;
  collectorVisualEggs: number;
  collectorFeedback: CollectorFeedback | null;
  chickens: Chicken[];
  eggs: Egg[];
  puddles: EggPuddle[];
  thrownEggs: Egg[];
  eggEffects: EggVisualEffect[];
  farmer: Farmer;
  collector: EggCollector;
  fox: Fox | null;
  eggsLaidTotal: number;
  eggsLaidSinceLastFox: number;
  eggSpawnIntervalMs: number;
  eggFallSpeed: number;
  lastEggSpawnTime: number;
  lastDifficultyIncreaseTime: number;
  depositCombo: DepositCombo;
  stats: GameStats;
  nextEntityId: number;
  nextChickenIndex: number;
  elapsedMs: number;
  nowMs: number;
};

export type InputState = {
  left: boolean;
  right: boolean;
  jumpQueued: boolean;
  depositQueued: boolean;
  throwQueued: boolean;
};
