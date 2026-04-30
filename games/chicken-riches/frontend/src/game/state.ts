import {
  CHICKEN_POSITIONS,
  CHICKEN_Y,
  COLLECTOR_HEIGHT,
  COLLECTOR_WIDTH,
  COLLECTOR_Y,
  FARMER_GROUND_Y,
  FIELD_WIDTH,
  INITIAL_EGG_FALL_SPEED,
  INITIAL_EGG_SPAWN_INTERVAL_MS,
} from "./constants";
import type { Chicken, GameState } from "./types";

function createChicken(id: number, x: number, now: number): Chicken {
  return {
    id: `chicken-${id}`,
    x,
    y: CHICKEN_Y,
    alive: true,
    pendingRemoval: false,
    threatenedByFox: false,
    animation: {
      name: "idle",
      startedAt: now,
      eventTriggered: false,
    },
  };
}

export function createInitialGameState(now = 0): GameState {
  return {
    status: "start",
    gameOverReason: null,
    score: 0,
    brokenEggsCount: 0,
    collectorVisualEggs: 0,
    collectorFeedback: null,
    chickens: CHICKEN_POSITIONS.map((x, index) => createChicken(index + 1, x, now)),
    eggs: [],
    puddles: [],
    thrownEggs: [],
    eggEffects: [],
    farmer: {
      x: FIELD_WIDTH / 2,
      y: FARMER_GROUND_Y,
      vx: 0,
      vy: 0,
      facing: 1,
      walkCycleMs: 0,
      isJumping: false,
      isFallen: false,
      fallenUntil: null,
      basketEggs: 0,
      animation: null,
    },
    collector: {
      x: FIELD_WIDTH / 2,
      y: COLLECTOR_Y,
      width: COLLECTOR_WIDTH,
      height: COLLECTOR_HEIGHT,
    },
    fox: null,
    eggsLaidTotal: 0,
    eggsLaidSinceLastFox: 0,
    eggSpawnIntervalMs: INITIAL_EGG_SPAWN_INTERVAL_MS,
    eggFallSpeed: INITIAL_EGG_FALL_SPEED,
    lastEggSpawnTime: now,
    lastDifficultyIncreaseTime: now,
    depositCombo: {
      count: 0,
      lastDepositTime: -Infinity,
      activeUntil: 0,
    },
    stats: {
      caughtEggs: 0,
      depositedEggs: 0,
      foxesRepelled: 0,
      chickensLost: 0,
    },
    nextEntityId: 1,
    nextChickenIndex: 0,
    elapsedMs: 0,
    nowMs: now,
  };
}

export function startGame(now = 0): GameState {
  return {
    ...createInitialGameState(now),
    status: "playing",
    lastEggSpawnTime: now,
    lastDifficultyIncreaseTime: now,
  };
}

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    chickens: state.chickens.map((chicken) => ({
      ...chicken,
      animation: { ...chicken.animation },
    })),
    collectorFeedback: state.collectorFeedback ? { ...state.collectorFeedback } : null,
    eggs: state.eggs.map((egg) => ({ ...egg })),
    puddles: state.puddles.map((puddle) => ({ ...puddle })),
    thrownEggs: state.thrownEggs.map((egg) => ({ ...egg })),
    eggEffects: state.eggEffects.map((effect) => ({ ...effect })),
    farmer: {
      ...state.farmer,
      animation: state.farmer.animation ? { ...state.farmer.animation } : null,
    },
    collector: { ...state.collector },
    fox: state.fox ? { ...state.fox, animation: { ...state.fox.animation } } : null,
    depositCombo: { ...state.depositCombo },
    stats: { ...state.stats },
  };
}
