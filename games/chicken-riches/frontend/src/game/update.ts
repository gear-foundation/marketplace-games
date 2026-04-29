import {
  ENEMY_PADDING,
  ENEMY_SPEED_BY_SIZE,
  FISH_VISUAL_SIZES,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  BABY_FISH_REACTION_ANIMATION_MS,
  GAME_OVER_OVERLAY_DELAY_MS,
  GROWTH_REQUIREMENT_BY_SIZE,
  HIGH_LEVEL_ENEMY_SPAWN_INTERVAL_MULTIPLIER,
  HOOK_COOLDOWN_MS_MAX,
  HOOK_COOLDOWN_MS_MIN,
  HOOK_DROP_MS,
  HOOK_HOLD_MS,
  HOOK_MARGIN_X,
  HOOK_METAL_HEIGHT,
  HOOK_METAL_WIDTH,
  HOOK_RISE_MS,
  HOOK_START_Y,
  HOOK_SWING_AMPLITUDE,
  HOOK_SWING_SPEED,
  HOOK_TARGET_Y_MAX,
  HOOK_TARGET_Y_MIN,
  HOOK_UNLOCK_SIZE,
  HOOK_UNLOCK_TIME_MS,
  HOOK_WARNING_MS,
  MAX_FISH_SIZE,
  MAX_FRAME_DELTA_MS,
  MAX_LEVEL_8_ENEMIES,
  MIN_FISH_SIZE,
  PLAYER_BITE_ANIMATION_MS,
  PLAYER_GROWTH_PULSE_MS,
  PLAYER_GROWTH_THRESHOLD,
  PLAYER_PADDING,
  PLAYER_SATURATION_AFTER_GROWTH,
  PLAYER_SPEED,
  PLAYER_SPEED_BY_SIZE,
  PLAYER_VISUAL_SATURATION_CHANGE_PER_SECOND,
  PLANKTON_MAX_COUNT,
  PLANKTON_POINTS,
  PLANKTON_SPAWN_INTERVAL_MS,
  SATURATION_DRAIN_PER_SECOND,
  SATURATION_DRAIN_MULTIPLIER_BY_SIZE,
  SPAWN_INTERVAL_DECAY,
  SPAWN_INTERVAL_MS_MIN,
  SPAWN_INTERVAL_MS_START,
} from "./constants";
import type { EnemyFish, FishingHook, FishingHookPhase, GameState, InputState, Plankton } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function approach(current: number, target: number, maxStep: number) {
  if (current < target) {
    return Math.min(target, current + maxStep);
  }

  return Math.max(target, current - maxStep);
}

export function getFishRadius(size: number) {
  return getFishVisualSize(size).height / 2;
}

export function getFishVisualSize(size: number) {
  const normalizedSize = clamp(Math.round(size), MIN_FISH_SIZE, MAX_FISH_SIZE);
  return FISH_VISUAL_SIZES[normalizedSize];
}

function getFishHalfWidth(size: number) {
  return getFishVisualSize(size).width / 2;
}

export function getPlanktonRadius(plankton: Pick<Plankton, "scale">) {
  return 15 * plankton.scale;
}

function getSpawnInterval(timeMs: number) {
  return Math.max(SPAWN_INTERVAL_MS_MIN, SPAWN_INTERVAL_MS_START - timeMs * SPAWN_INTERVAL_DECAY);
}

function getEnemySpawnInterval(timeMs: number, playerSize: number) {
  const baseInterval = getSpawnInterval(timeMs);
  return playerSize >= 5 ? baseInterval * HIGH_LEVEL_ENEMY_SPAWN_INTERVAL_MULTIPLIER : baseInterval;
}

function getPlanktonSpawnInterval(playerSize: number) {
  return playerSize === MIN_FISH_SIZE ? PLANKTON_SPAWN_INTERVAL_MS : PLANKTON_SPAWN_INTERVAL_MS * 1.45;
}

function getScoreForFish(size: number) {
  return 6 + size * 4;
}

function getGrowthRequirement(playerSize: number) {
  const normalizedSize = clamp(Math.round(playerSize), MIN_FISH_SIZE, MAX_FISH_SIZE);
  return GROWTH_REQUIREMENT_BY_SIZE[normalizedSize];
}

function getFoodGainPercent(points: number, playerSize: number) {
  return (points / getGrowthRequirement(playerSize)) * PLAYER_GROWTH_THRESHOLD;
}

function getSaturationDrainPerSecond(playerSize: number) {
  const normalizedSize = clamp(Math.round(playerSize), MIN_FISH_SIZE, MAX_FISH_SIZE);
  return SATURATION_DRAIN_PER_SECOND * SATURATION_DRAIN_MULTIPLIER_BY_SIZE[normalizedSize];
}

function getPlayerSpeed(playerSize: number) {
  const normalizedSize = clamp(Math.round(playerSize), MIN_FISH_SIZE, MAX_FISH_SIZE);
  return PLAYER_SPEED_BY_SIZE[normalizedSize] ?? PLAYER_SPEED;
}

function smoothstep(value: number) {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function getHookPhaseDuration(phase: FishingHookPhase) {
  if (phase === "warning") return HOOK_WARNING_MS;
  if (phase === "dropping") return HOOK_DROP_MS;
  if (phase === "holding") return HOOK_HOLD_MS;
  return HOOK_RISE_MS;
}

function getNextHookPhase(phase: FishingHookPhase): FishingHookPhase | null {
  if (phase === "warning") return "dropping";
  if (phase === "dropping") return "holding";
  if (phase === "holding") return "rising";
  return null;
}

function getHookCooldown(random: () => number) {
  return HOOK_COOLDOWN_MS_MIN + random() * (HOOK_COOLDOWN_MS_MAX - HOOK_COOLDOWN_MS_MIN);
}

function createFishingHook(random: () => number): FishingHook {
  return {
    x: HOOK_MARGIN_X + random() * (FIELD_WIDTH - HOOK_MARGIN_X * 2),
    targetY: HOOK_TARGET_Y_MIN + random() * (HOOK_TARGET_Y_MAX - HOOK_TARGET_Y_MIN),
    phase: "warning",
    phaseMs: 0,
    ageMs: 0,
    swingSeed: random() * 1000,
  };
}

function advanceFishingHook(hook: FishingHook, deltaMs: number): FishingHook | null {
  let phase = hook.phase;
  let phaseMs = hook.phaseMs + deltaMs;

  while (phaseMs >= getHookPhaseDuration(phase)) {
    phaseMs -= getHookPhaseDuration(phase);
    const nextPhase = getNextHookPhase(phase);

    if (!nextPhase) {
      return null;
    }

    phase = nextPhase;
  }

  hook.phase = phase;
  hook.phaseMs = phaseMs;
  hook.ageMs += deltaMs;

  return hook;
}

export function getFishingHookPosition(hook: FishingHook) {
  const swing = Math.sin((hook.ageMs + hook.swingSeed) * HOOK_SWING_SPEED) * HOOK_SWING_AMPLITUDE;
  let y = HOOK_START_Y;

  if (hook.phase === "dropping") {
    y = HOOK_START_Y + (hook.targetY - HOOK_START_Y) * smoothstep(hook.phaseMs / HOOK_DROP_MS);
  } else if (hook.phase === "holding") {
    y = hook.targetY;
  } else if (hook.phase === "rising") {
    y = hook.targetY + (HOOK_START_Y - hook.targetY) * smoothstep(hook.phaseMs / HOOK_RISE_MS);
  }

  return {
    x: hook.x + swing,
    y,
  };
}

function getHueForFish(size: number) {
  return clamp(196 - size * 18, 24, 196);
}

function getWeightedEnemySize(playerSize: number, timeMs: number, random: () => number, maxEnemySize = MAX_FISH_SIZE) {
  const normalizedMaxSize = clamp(maxEnemySize, MIN_FISH_SIZE, MAX_FISH_SIZE);
  const sizes = Array.from({ length: normalizedMaxSize - MIN_FISH_SIZE + 1 }, (_, index) => index + MIN_FISH_SIZE);
  const earlyPhase = clamp(timeMs / 32000, 0, 1);
  const highLevelVariety = clamp((playerSize - 4) / 4, 0, 1);
  const weights = sizes.map((size) => {
    const gap = size - playerSize;

    if (gap < 0) {
      const distance = Math.abs(gap);
      const normalWeight = Math.max(6, 20 - distance * 3);
      const variedWeight = Math.max(9, 14 + Math.max(0, 8 - distance * 1.35) + earlyPhase * 3);
      return normalWeight + (variedWeight - normalWeight) * highLevelVariety;
    }

    if (gap === 0) {
      return 7 + earlyPhase * 2 + highLevelVariety * 2;
    }

    if (gap === 1) {
      return 1.8 + earlyPhase * 4.8 + highLevelVariety * 3.2;
    }

    if (gap === 2) {
      return 0.6 + earlyPhase * 3.9 + highLevelVariety * 2.4;
    }

    return 0.14 + earlyPhase * Math.max(0.8, 2.8 - (gap - 3) * 0.45) + highLevelVariety * 0.9;
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = random() * total;

  for (let index = 0; index < sizes.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) {
      return sizes[index];
    }
  }

  return sizes[sizes.length - 1];
}

function createEnemyFish(nextEnemyId: number, playerSize: number, timeMs: number, random: () => number, maxEnemySize = MAX_FISH_SIZE): EnemyFish {
  const size = getWeightedEnemySize(playerSize, timeMs, random, maxEnemySize);
  const halfWidth = getFishHalfWidth(size);
  const halfHeight = getFishRadius(size);
  const spawnLeft = random() >= 0.5;
  const direction = spawnLeft ? 1 : -1;
  const x = spawnLeft ? -halfWidth - ENEMY_PADDING : FIELD_WIDTH + halfWidth + ENEMY_PADDING;
  const baseY = clamp(random() * FIELD_HEIGHT, halfHeight + 18, FIELD_HEIGHT - halfHeight - 18);
  const speed = (ENEMY_SPEED_BY_SIZE[size] ?? 70) + random() * 28 + Math.min(42, timeMs / 2200);
  const driftAmplitude = 10 + random() * 14;
  const driftPhase = random() * Math.PI * 2;
  const driftSpeed = 1.2 + random() * 2;

  return {
    id: `enemy-${nextEnemyId}`,
    x,
    y: baseY,
    baseY,
    size,
    speed,
    direction,
    driftAmplitude,
    driftPhase,
    driftSpeed,
    points: getScoreForFish(size),
    hue: getHueForFish(size),
    reactionAnimationMs: 0,
  };
}

function createPlankton(nextPlanktonId: number, random: () => number): Plankton {
  const scale = 0.74 + random() * 0.42;
  const radius = getPlanktonRadius({ scale });
  const spawnLeft = random() >= 0.5;
  const direction = spawnLeft ? 1 : -1;
  const x = spawnLeft ? -radius - ENEMY_PADDING * 0.45 : FIELD_WIDTH + radius + ENEMY_PADDING * 0.45;
  const baseY = clamp(random() * FIELD_HEIGHT, radius + 28, FIELD_HEIGHT - radius - 92);

  return {
    id: `plankton-${nextPlanktonId}`,
    x,
    y: baseY,
    baseY,
    speed: 32 + random() * 28,
    direction,
    driftAmplitude: 18 + random() * 26,
    driftPhase: random() * Math.PI * 2,
    driftSpeed: 0.75 + random() * 1.35,
    points: PLANKTON_POINTS,
    scale,
  };
}

function normalizeMovement(input: InputState) {
  const horizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const vertical = (input.down ? 1 : 0) - (input.up ? 1 : 0);

  if (horizontal === 0 && vertical === 0) {
    return null;
  }

  const length = Math.hypot(horizontal, vertical) || 1;
  return {
    x: horizontal / length,
    y: vertical / length,
  };
}

function getPointerMovement(
  playerX: number,
  playerY: number,
  pointer: { x: number; y: number } | null,
  deltaSec: number,
  playerSpeed: number,
) {
  if (!pointer) return null;

  const dx = pointer.x - playerX;
  const dy = pointer.y - playerY;
  const distance = Math.hypot(dx, dy);

  if (distance < 6) {
    return null;
  }

  const maxStep = playerSpeed * deltaSec;
  const scale = Math.min(1, maxStep / distance);
  return {
    x: dx * scale,
    y: dy * scale,
  };
}

function resolveFacing(currentFacing: -1 | 1, horizontalMovement: number) {
  if (Math.abs(horizontalMovement) < 0.05) {
    return currentFacing;
  }

  return horizontalMovement > 0 ? 1 : -1;
}

function updatePlayerPosition(state: GameState, input: InputState, deltaSec: number) {
  const halfWidth = getFishHalfWidth(state.player.size);
  const halfHeight = getFishRadius(state.player.size);
  const playerSpeed = getPlayerSpeed(state.player.size);
  const keyboardDirection = normalizeMovement(input);

  if (keyboardDirection) {
    return {
      x: clamp(state.player.x + keyboardDirection.x * playerSpeed * deltaSec, halfWidth + PLAYER_PADDING, FIELD_WIDTH - halfWidth - PLAYER_PADDING),
      y: clamp(state.player.y + keyboardDirection.y * playerSpeed * deltaSec, halfHeight + PLAYER_PADDING, FIELD_HEIGHT - halfHeight - PLAYER_PADDING),
      facing: resolveFacing(state.player.facing, keyboardDirection.x),
    };
  }

  const pointerStep = getPointerMovement(state.player.x, state.player.y, input.pointer, deltaSec, playerSpeed);
  if (!pointerStep) {
    return {
      x: state.player.x,
      y: state.player.y,
      facing: state.player.facing,
    };
  }

  return {
    x: clamp(state.player.x + pointerStep.x, halfWidth + PLAYER_PADDING, FIELD_WIDTH - halfWidth - PLAYER_PADDING),
    y: clamp(state.player.y + pointerStep.y, halfHeight + PLAYER_PADDING, FIELD_HEIGHT - halfHeight - PLAYER_PADDING),
    facing: resolveFacing(state.player.facing, pointerStep.x),
  };
}

function overlapsPlayer(playerX: number, playerY: number, playerSize: number, enemy: EnemyFish) {
  const playerVisualSize = getFishVisualSize(playerSize);
  const enemyVisualSize = getFishVisualSize(enemy.size);
  const horizontalRadius = playerVisualSize.width * 0.36 + enemyVisualSize.width * 0.36;
  const verticalRadius = playerVisualSize.height * 0.34 + enemyVisualSize.height * 0.34;
  const normalizedX = Math.abs(playerX - enemy.x) / horizontalRadius;
  const normalizedY = Math.abs(playerY - enemy.y) / verticalRadius;

  return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
}

function overlapsPlayerMouth(
  playerX: number,
  playerY: number,
  playerSize: number,
  playerFacing: -1 | 1,
  targetX: number,
  targetY: number,
  targetRadius: number,
) {
  const visualSize = getFishVisualSize(playerSize);
  const mouthX = playerX + playerFacing * visualSize.width * 0.32;
  const mouthY = playerY;
  const mouthRadius = Math.max(visualSize.height * 0.3, 14);
  const dx = targetX - mouthX;
  const dy = targetY - mouthY;
  const isInFront = playerFacing === -1
    ? targetX <= playerX + visualSize.width * 0.02
    : targetX >= playerX - visualSize.width * 0.02;

  return isInFront && Math.hypot(dx, dy) <= mouthRadius + targetRadius;
}

function overlapsPlayerPoint(playerX: number, playerY: number, playerSize: number, pointX: number, pointY: number, pointRadius: number) {
  const visualSize = getFishVisualSize(playerSize);
  const radius = visualSize.height * 0.3;
  const bodyHalfLength = Math.max(0, visualSize.width * 0.34 - radius);
  const horizontalGap = Math.max(0, Math.abs(playerX - pointX) - bodyHalfLength);
  const verticalGap = Math.abs(playerY - pointY);

  return Math.hypot(horizontalGap, verticalGap) <= radius + pointRadius;
}

function overlapsFishingHook(playerX: number, playerY: number, playerSize: number, hook: FishingHook) {
  if (hook.phase === "warning") {
    return false;
  }

  const hookPosition = getFishingHookPosition(hook);
  const width = HOOK_METAL_WIDTH;
  const height = HOOK_METAL_HEIGHT;
  const dangerPoints = [
    { x: hookPosition.x, y: hookPosition.y - height * 0.34, radius: width * 0.24 },
    { x: hookPosition.x + width * 0.14, y: hookPosition.y + height * 0.04, radius: width * 0.26 },
    { x: hookPosition.x - width * 0.26, y: hookPosition.y + height * 0.34, radius: width * 0.2 },
  ];

  return dangerPoints.some((point) => overlapsPlayerPoint(playerX, playerY, playerSize, point.x, point.y, point.radius));
}

function canEatEnemyFish(playerSize: number, enemySize: number) {
  return enemySize < playerSize;
}

function overlapsPlanktonMouth(playerX: number, playerY: number, playerSize: number, playerFacing: -1 | 1, plankton: Plankton) {
  const visualSize = getFishVisualSize(playerSize);
  const mouthX = playerX + playerFacing * visualSize.width * 0.34;
  const mouthY = playerY;
  const mouthRadius = Math.max(visualSize.height * 0.34, 17);
  const planktonRadius = getPlanktonRadius(plankton);
  const dx = plankton.x - mouthX;
  const dy = plankton.y - mouthY;
  const isNearFrontHalf = playerFacing === -1
    ? plankton.x <= playerX + visualSize.width * 0.06
    : plankton.x >= playerX - visualSize.width * 0.06;

  return isNearFrontHalf && Math.hypot(dx, dy) <= mouthRadius + planktonRadius * 0.95;
}

export function stepGame(
  state: GameState,
  input: InputState,
  deltaMs: number,
  random: () => number = Math.random,
): GameState {
  const boundedDeltaMs = Math.min(MAX_FRAME_DELTA_MS, deltaMs);
  const deltaSec = boundedDeltaMs / 1000;
  const nextTimeMs = state.timeMs + boundedDeltaMs;

  const isGrowthTransformActive = state.player.growthPulseMs > 0 && state.player.growthTargetSize !== null;
  const decayedGrowthPulseMs = Math.max(0, state.player.growthPulseMs - boundedDeltaMs);

  if (state.status !== "playing") {
    if (state.status === "over" && state.gameOverOverlayDelayMs > 0) {
      state.timeMs = nextTimeMs;
      state.gameOverOverlayDelayMs = Math.max(0, state.gameOverOverlayDelayMs - boundedDeltaMs);
      state.player.growthPulseMs = decayedGrowthPulseMs;
      return state;
    }

    return state;
  }

  const decayedBiteAnimationMs = Math.max(0, state.player.biteAnimationMs - boundedDeltaMs);

  if (isGrowthTransformActive) {
    if (decayedGrowthPulseMs <= 0 && state.player.growthTargetSize !== null) {
      const evolvedSize = state.player.growthTargetSize;
      state.player.size = evolvedSize;
      state.player.saturation = PLAYER_SATURATION_AFTER_GROWTH;
      state.player.visualSaturation = PLAYER_SATURATION_AFTER_GROWTH;
      state.player.growthProgress = evolvedSize >= MAX_FISH_SIZE ? PLAYER_GROWTH_THRESHOLD : 0;
      state.player.biteAnimationMs = 0;
      state.player.growthPulseMs = 0;
      state.player.growthTargetSize = null;
      return state;
    }

    state.player.biteAnimationMs = 0;
    state.player.growthPulseMs = decayedGrowthPulseMs;
    return state;
  }

  let nextSaturation = state.player.saturation - getSaturationDrainPerSecond(state.player.size) * deltaSec;

  if (nextSaturation <= 0) {
    state.status = "over";
    state.reason = "starvation";
    state.timeMs = nextTimeMs;
    state.gameOverOverlayDelayMs = 0;
    state.player.saturation = 0;
    state.player.visualSaturation = approach(state.player.visualSaturation, 0, PLAYER_VISUAL_SATURATION_CHANGE_PER_SECOND * deltaSec);
    state.player.biteAnimationMs = decayedBiteAnimationMs;
    state.player.growthPulseMs = decayedGrowthPulseMs;
    state.player.growthTargetSize = null;
    return state;
  }

  const nextPlayerPosition = updatePlayerPosition(state, input, deltaSec);
  let hook = state.hook;
  let hookCooldownMs = state.hookCooldownMs;

  if (hook) {
    hook = advanceFishingHook(hook, boundedDeltaMs);

    if (!hook) {
      hookCooldownMs = getHookCooldown(random);
    }
  } else if (nextTimeMs >= HOOK_UNLOCK_TIME_MS || state.player.size >= HOOK_UNLOCK_SIZE) {
    hookCooldownMs -= boundedDeltaMs;

    if (hookCooldownMs <= 0) {
      hook = createFishingHook(random);
      hookCooldownMs = getHookCooldown(random);
    }
  }

  let spawnCooldownMs = state.spawnCooldownMs - boundedDeltaMs;
  let planktonSpawnCooldownMs = state.planktonSpawnCooldownMs - boundedDeltaMs;
  let nextEnemyId = state.nextEnemyId;
  let nextPlanktonId = state.nextPlanktonId;
  const enemies = state.enemies;
  let level8EnemyCount = 0;
  let enemyWriteIndex = 0;

  for (let index = 0; index < enemies.length; index += 1) {
    const enemy = enemies[index];
    const halfHeight = getFishRadius(enemy.size);
    enemy.driftPhase += enemy.driftSpeed * deltaSec;
    enemy.x += enemy.direction * enemy.speed * deltaSec;
    enemy.y = clamp(enemy.baseY + Math.sin(enemy.driftPhase) * enemy.driftAmplitude, halfHeight, FIELD_HEIGHT - halfHeight);
    enemy.reactionAnimationMs = Math.max(0, enemy.reactionAnimationMs - boundedDeltaMs);

    if (enemy.x > -getFishHalfWidth(enemy.size) - ENEMY_PADDING * 2 && enemy.x < FIELD_WIDTH + getFishHalfWidth(enemy.size) + ENEMY_PADDING * 2) {
      enemies[enemyWriteIndex] = enemy;
      enemyWriteIndex += 1;
      if (enemy.size === MAX_FISH_SIZE) {
        level8EnemyCount += 1;
      }
    }
  }

  enemies.length = enemyWriteIndex;

  const plankton = state.plankton;
  let planktonWriteIndex = 0;

  for (let index = 0; index < plankton.length; index += 1) {
    const food = plankton[index];
    food.driftPhase += food.driftSpeed * deltaSec;
    food.x += food.direction * food.speed * deltaSec;
    food.y = clamp(food.baseY + Math.sin(food.driftPhase) * food.driftAmplitude, getPlanktonRadius(food), FIELD_HEIGHT - getPlanktonRadius(food) - 84);

    if (food.x > -getPlanktonRadius(food) - ENEMY_PADDING && food.x < FIELD_WIDTH + getPlanktonRadius(food) + ENEMY_PADDING) {
      plankton[planktonWriteIndex] = food;
      planktonWriteIndex += 1;
    }
  }

  plankton.length = planktonWriteIndex;

  while (spawnCooldownMs <= 0) {
    const maxEnemySize = level8EnemyCount >= MAX_LEVEL_8_ENEMIES ? MAX_FISH_SIZE - 1 : MAX_FISH_SIZE;
    const enemy = createEnemyFish(nextEnemyId, state.player.size, nextTimeMs, random, maxEnemySize);
    enemies.push(enemy);
    if (enemy.size === MAX_FISH_SIZE) {
      level8EnemyCount += 1;
    }
    nextEnemyId += 1;
    spawnCooldownMs += getEnemySpawnInterval(nextTimeMs, state.player.size);
  }

  while (planktonSpawnCooldownMs <= 0) {
    if (plankton.length < PLANKTON_MAX_COUNT) {
      plankton.push(createPlankton(nextPlanktonId, random));
      nextPlanktonId += 1;
    }
    planktonSpawnCooldownMs += getPlanktonSpawnInterval(state.player.size);
  }

  if (hook && overlapsFishingHook(nextPlayerPosition.x, nextPlayerPosition.y, state.player.size, hook)) {
    state.status = "over";
    state.reason = "hook";
    state.timeMs = nextTimeMs;
    state.spawnCooldownMs = spawnCooldownMs;
    state.planktonSpawnCooldownMs = planktonSpawnCooldownMs;
    state.hook = hook;
    state.hookCooldownMs = hookCooldownMs;
    state.nextEnemyId = nextEnemyId;
    state.nextPlanktonId = nextPlanktonId;
    state.gameOverOverlayDelayMs = 0;
    state.player.x = nextPlayerPosition.x;
    state.player.y = nextPlayerPosition.y;
    state.player.facing = nextPlayerPosition.facing;
    state.player.saturation = nextSaturation;
    state.player.visualSaturation = approach(state.player.visualSaturation, nextSaturation, PLAYER_VISUAL_SATURATION_CHANGE_PER_SECOND * deltaSec);
    state.player.biteAnimationMs = decayedBiteAnimationMs;
    state.player.growthPulseMs = decayedGrowthPulseMs;
    state.player.growthTargetSize = null;
    return state;
  }

  let predatorCollision = false;

  for (const enemy of enemies) {
    if (enemy.size > state.player.size && overlapsPlayer(nextPlayerPosition.x, nextPlayerPosition.y, state.player.size, enemy)) {
      predatorCollision = true;
      break;
    }
  }

  if (predatorCollision) {
    state.status = "over";
    state.reason = "predator";
    state.timeMs = nextTimeMs;
    state.spawnCooldownMs = spawnCooldownMs;
    state.planktonSpawnCooldownMs = planktonSpawnCooldownMs;
    state.hook = hook;
    state.hookCooldownMs = hookCooldownMs;
    state.nextEnemyId = nextEnemyId;
    state.nextPlanktonId = nextPlanktonId;
    state.gameOverOverlayDelayMs = GAME_OVER_OVERLAY_DELAY_MS;
    state.player.x = nextPlayerPosition.x;
    state.player.y = nextPlayerPosition.y;
    state.player.facing = nextPlayerPosition.facing;
    state.player.saturation = nextSaturation;
    state.player.visualSaturation = approach(state.player.visualSaturation, nextSaturation, PLAYER_VISUAL_SATURATION_CHANGE_PER_SECOND * deltaSec);
    state.player.biteAnimationMs = decayedBiteAnimationMs;
    state.player.growthPulseMs = decayedGrowthPulseMs;
    state.player.growthTargetSize = null;
    return state;
  }

  let fishScoreGain = 0;
  let planktonScoreGain = 0;
  let remainingEnemyWriteIndex = 0;

  for (let index = 0; index < enemies.length; index += 1) {
    const enemy = enemies[index];
    const isPlayerCollision = overlapsPlayer(nextPlayerPosition.x, nextPlayerPosition.y, state.player.size, enemy);
    const isMouthCollision = overlapsPlayerMouth(
      nextPlayerPosition.x,
      nextPlayerPosition.y,
      state.player.size,
      nextPlayerPosition.facing,
      enemy.x,
      enemy.y,
      getFishRadius(enemy.size) * 0.55,
    );

    if (
      enemy.size === MIN_FISH_SIZE
      && enemy.size === state.player.size
      && isPlayerCollision
      && enemy.reactionAnimationMs <= 0
    ) {
      enemy.reactionAnimationMs = BABY_FISH_REACTION_ANIMATION_MS;
    }

    if (canEatEnemyFish(state.player.size, enemy.size) && isPlayerCollision && isMouthCollision) {
      fishScoreGain += enemy.points;
      continue;
    }

    enemies[remainingEnemyWriteIndex] = enemy;
    remainingEnemyWriteIndex += 1;
  }

  enemies.length = remainingEnemyWriteIndex;
  let remainingPlanktonWriteIndex = 0;

  for (let index = 0; index < plankton.length; index += 1) {
    const food = plankton[index];
    if (overlapsPlanktonMouth(nextPlayerPosition.x, nextPlayerPosition.y, state.player.size, nextPlayerPosition.facing, food)) {
      planktonScoreGain += food.points;
      continue;
    }

    plankton[remainingPlanktonWriteIndex] = food;
    remainingPlanktonWriteIndex += 1;
  }

  plankton.length = remainingPlanktonWriteIndex;

  const scoreGain = fishScoreGain + planktonScoreGain;
  const foodGainPercent = getFoodGainPercent(scoreGain, state.player.size);
  const shouldPlayBite = scoreGain > 0;

  let nextSize = state.player.size;
  let nextScore = state.score + scoreGain;
  let nextGrowthProgress = clamp(state.player.growthProgress + foodGainPercent, 0, PLAYER_GROWTH_THRESHOLD);
  nextSaturation = clamp(nextSaturation + foodGainPercent, 0, PLAYER_GROWTH_THRESHOLD);
  let nextGrowthTargetSize = state.player.growthTargetSize;
  let startedGrowthTransform = false;

  if (nextGrowthProgress >= PLAYER_GROWTH_THRESHOLD) {
    if (nextSize < MAX_FISH_SIZE) {
      nextGrowthTargetSize = Math.min(MAX_FISH_SIZE, nextSize + 1);
      nextGrowthProgress = PLAYER_GROWTH_THRESHOLD;
      startedGrowthTransform = true;
    } else {
      nextGrowthProgress = PLAYER_GROWTH_THRESHOLD;
    }
  }

  const nextVisualSaturation = approach(
    state.player.visualSaturation,
    nextSaturation,
    PLAYER_VISUAL_SATURATION_CHANGE_PER_SECOND * deltaSec,
  );
  const nextGrowthPulseMs = startedGrowthTransform ? PLAYER_GROWTH_PULSE_MS : decayedGrowthPulseMs;

  state.timeMs = nextTimeMs;
  state.spawnCooldownMs = spawnCooldownMs;
  state.planktonSpawnCooldownMs = planktonSpawnCooldownMs;
  state.hook = hook;
  state.hookCooldownMs = hookCooldownMs;
  state.nextEnemyId = nextEnemyId;
  state.nextPlanktonId = nextPlanktonId;
  state.score = nextScore;
  state.player.x = nextPlayerPosition.x;
  state.player.y = nextPlayerPosition.y;
  state.player.size = nextSize;
  state.player.saturation = nextSaturation;
  state.player.visualSaturation = nextVisualSaturation;
  state.player.growthProgress = nextGrowthProgress;
  state.player.facing = nextPlayerPosition.facing;
  state.player.biteAnimationMs = startedGrowthTransform ? 0 : (shouldPlayBite ? PLAYER_BITE_ANIMATION_MS : decayedBiteAnimationMs);
  state.player.growthPulseMs = nextGrowthPulseMs;
  state.player.growthTargetSize = nextGrowthTargetSize;

  return state;
}
