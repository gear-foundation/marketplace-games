import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GAME_START_CONFIG,
  HOOK_INITIAL_COOLDOWN_MS,
  PLANKTON_SPAWN_INTERVAL_MS,
  SPAWN_INTERVAL_MS_START,
} from "./constants";
import type { GameState } from "./types";

export function createInitialGameState(): GameState {
  return {
    status: "idle",
    player: {
      x: FIELD_WIDTH / 2,
      y: FIELD_HEIGHT / 2,
      size: GAME_START_CONFIG.size,
      saturation: GAME_START_CONFIG.saturation,
      visualSaturation: GAME_START_CONFIG.saturation,
      growthProgress: GAME_START_CONFIG.growthProgress,
      facing: -1,
      biteAnimationMs: 0,
      growthPulseMs: 0,
      growthTargetSize: null,
    },
    enemies: [],
    plankton: [],
    hook: null,
    hookCooldownMs: HOOK_INITIAL_COOLDOWN_MS,
    score: 0,
    timeMs: 0,
    spawnCooldownMs: SPAWN_INTERVAL_MS_START,
    planktonSpawnCooldownMs: PLANKTON_SPAWN_INTERVAL_MS / 3,
    nextEnemyId: 1,
    nextPlanktonId: 1,
    gameOverOverlayDelayMs: 0,
    reason: null,
  };
}

export function startGame(): GameState {
  return {
    ...createInitialGameState(),
    status: "playing",
  };
}
