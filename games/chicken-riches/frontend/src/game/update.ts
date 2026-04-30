import {
  CHICKEN_SIZE,
  CHICKEN_LAY_DURATION_MS,
  CHICKEN_LAY_EVENT_MS,
  CHICKEN_LOST_PENALTY,
  CHICKEN_RELIEVED_DURATION_MS,
  CHICKEN_SCARED_START_DURATION_MS,
  CHICKEN_STOLEN_DURATION_MS,
  COMBO_EGG_POINTS,
  COMBO_WINDOW_MS,
  COLLECTOR_INTERACT_DISTANCE,
  COLLECTOR_RECEIVE_DURATION_MS,
  DIFFICULTY_INCREASE_EVERY_MS,
  EARLY_SEQUENCE_WINDOW_MS,
  EGG_CATCH_HEIGHT,
  EGG_CATCH_OFFSET_X,
  EGG_CATCH_OFFSET_Y,
  EGG_CATCH_WIDTH,
  EGG_POINTS,
  EGG_RADIUS,
  DEPOSIT_EGG_DROP_DURATION_MS,
  FARMER_CATCH_DURATION_MS,
  FARMER_DEPOSIT_DURATION_MS,
  FARMER_FALL_DURATION_MS,
  FARMER_FEET_RADIUS,
  FARMER_GRAVITY,
  FARMER_GROUND_Y,
  FARMER_HEIGHT,
  FARMER_RECOVER_DURATION_MS,
  FARMER_SPEED,
  FARMER_SLIP_DURATION_MS,
  FARMER_THROW_DURATION_MS,
  FARMER_WIDTH,
  FOX_ATTACK_DELAY_MS,
  FOX_APPEAR_DURATION_MS,
  FOX_CARRY_UP_DURATION_MS,
  FOX_HEIGHT,
  FOX_HIT_DURATION_MS,
  FOX_LICK_DURATION_MS,
  FOX_OFFSET_Y,
  FOX_RETREAT_DURATION_MS,
  FOX_STEAL_DURATION_MS,
  FOX_REPEL_POINTS,
  FOX_WIDTH,
  FLOOR_Y,
  INITIAL_EGG_FALL_SPEED,
  INITIAL_EGG_SPAWN_INTERVAL_MS,
  MAX_BASKET_EGGS,
  MAX_BROKEN_EGGS,
  MAX_CHICKENS,
  MAX_EGG_FALL_SPEED,
  MIN_EGG_SPAWN_INTERVAL_MS,
  MIN_EGGS_BETWEEN_FOXES,
  PUDDLE_LIFETIME_MS,
  PUDDLE_RADIUS,
  THROWN_EGG_RADIUS,
  THROWN_EGG_HIT_EFFECT_DURATION_MS,
  THROWN_EGG_SPEED,
  FARMER_JUMP_SPEED,
} from "./constants";
import { MAX_COLLECTOR_VISUAL_EGGS, getCollectorFillState } from "./collector";
import type {
  Chicken,
  ChickenAnimationName,
  CollectorFillState,
  Egg,
  EggCollector,
  EggPuddle,
  EggVisualEffect,
  Farmer,
  FarmerAnimationName,
  Fox,
  FoxAnimationName,
  GameOverReason,
  GameState,
  InputState,
} from "./types";

type EggVisualEffectInput =
  | Omit<Extract<EggVisualEffect, { kind: "foxHit" }>, "id">
  | Omit<Extract<EggVisualEffect, { kind: "depositDrop" }>, "id">;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createId(state: GameState, prefix: string) {
  const id = `${prefix}-${state.nextEntityId}`;
  state.nextEntityId += 1;
  return id;
}

function createEggEffect(
  state: GameState,
  effect: EggVisualEffectInput,
) {
  if (effect.kind === "depositDrop") {
    state.eggEffects.push({
      id: createId(state, "egg-effect"),
      ...effect,
    });
    return;
  }

  state.eggEffects.push({
    id: createId(state, "egg-effect"),
    ...effect,
  });
}

function setFarmerAnimation(state: GameState, name: FarmerAnimationName, now: number, durationMs: number) {
  state.farmer.animation = {
    name,
    startedAt: now,
    durationMs,
  };
}

function clearFinishedFarmerAnimation(state: GameState, now: number) {
  const { animation } = state.farmer;
  if (animation && now - animation.startedAt >= animation.durationMs) {
    state.farmer.animation = null;
  }
}

function getAliveChickens(state: GameState) {
  return state.chickens.filter((chicken) => chicken.alive);
}

function getChickenById(state: GameState, chickenId: string) {
  return state.chickens.find((chicken) => chicken.id === chickenId);
}

function setChickenAnimation(chicken: Chicken, name: ChickenAnimationName, now: number) {
  chicken.animation = {
    name,
    startedAt: now,
    eventTriggered: false,
  };
}

function setFoxAnimation(fox: Fox, name: FoxAnimationName, now: number) {
  fox.animation = {
    name,
    startedAt: now,
  };
}

function isChickenFearAnimation(chicken: Chicken) {
  return chicken.animation.name === "scaredStart" || chicken.animation.name === "scaredLoop";
}

function panicWholeCoop(state: GameState, now: number) {
  for (const chicken of state.chickens) {
    if (
      !chicken.alive ||
      chicken.pendingRemoval ||
      chicken.animation.name === "layingEgg" ||
      chicken.animation.name === "stolen"
    ) {
      continue;
    }

    if (!isChickenFearAnimation(chicken)) {
      setChickenAnimation(chicken, "scaredStart", now);
    }
  }
}

function calmCoopAfterFox(state: GameState, now: number, relievedChickenId?: string) {
  for (const chicken of state.chickens) {
    if (!chicken.alive || chicken.pendingRemoval || chicken.id === relievedChickenId) {
      continue;
    }

    if (isChickenFearAnimation(chicken)) {
      setChickenAnimation(chicken, "idle", now);
    }
  }
}

function createDepositEggDropEffect(state: GameState, now: number) {
  const { collector } = state;
  const targetX = collector.x + (Math.random() * 24 - 12);
  const startX = targetX + (Math.random() * 6 - 3);

  createEggEffect(state, {
    kind: "depositDrop",
    x: startX,
    y: collector.y - collector.height / 2 - 30,
    targetX,
    targetY: collector.y - collector.height * 0.08 + Math.random() * 6,
    startedAt: now,
    durationMs: DEPOSIT_EGG_DROP_DURATION_MS,
  });
}

function createCollectorFeedback(
  state: GameState,
  now: number,
  pointsAwarded: number,
  fromState: CollectorFillState,
  toState: CollectorFillState,
) {
  state.collectorFeedback = {
    startedAt: now,
    durationMs: COLLECTOR_RECEIVE_DURATION_MS,
    pointsAwarded,
    fromState,
    toState,
  };
}

function updateCollectorVisualProgress(state: GameState, now: number, pointsAwarded: number) {
  const fromState = getCollectorFillState(state.collectorVisualEggs);
  state.collectorVisualEggs = Math.min(state.collectorVisualEggs + 1, MAX_COLLECTOR_VISUAL_EGGS);
  const toState = getCollectorFillState(state.collectorVisualEggs);
  createCollectorFeedback(state, now, pointsAwarded, fromState, toState);
}

function canChickenLayEgg(chicken: Chicken) {
  return chicken.alive && !chicken.pendingRemoval && !chicken.threatenedByFox && chicken.animation.name === "idle";
}

function getFoxTargetChickens(state: GameState) {
  return state.chickens.filter((chicken) => chicken.alive && !chicken.pendingRemoval);
}

function getFarmerBasketHitbox(farmer: Farmer) {
  return {
    x: farmer.x + farmer.facing * EGG_CATCH_OFFSET_X,
    y: farmer.y + EGG_CATCH_OFFSET_Y,
    width: EGG_CATCH_WIDTH,
    height: EGG_CATCH_HEIGHT,
  };
}

function isEggCollidingWithBasket(egg: Egg, farmer: Farmer) {
  const hitbox = getFarmerBasketHitbox(farmer);
  return (
    Math.abs(egg.x - hitbox.x) <= hitbox.width / 2 + egg.radius &&
    Math.abs(egg.y - hitbox.y) <= hitbox.height / 2 + egg.radius
  );
}

function isEggHittingFox(egg: Egg, fox: Fox) {
  return (
    Math.abs(egg.x - fox.x) <= FOX_WIDTH * 0.32 + egg.radius &&
    Math.abs(egg.y - fox.y) <= FOX_HEIGHT * 0.36 + egg.radius
  );
}

function clearFoxThreat(chicken: Chicken | undefined) {
  if (chicken) {
    chicken.threatenedByFox = false;
  }
}

function breakEggAt(state: GameState, x: number, now: number) {
  state.brokenEggsCount += 1;
  state.puddles.push({
    id: createId(state, "puddle"),
    x: clamp(x, 70, 910),
    y: FLOOR_Y,
    radius: PUDDLE_RADIUS,
    createdAt: now,
    slippedAt: null,
    expiresAt: now + PUDDLE_LIFETIME_MS,
  });
}

function removeBrokenThreats(state: GameState) {
  state.chickens.forEach((chicken) => {
    if (!chicken.alive) {
      chicken.threatenedByFox = false;
    }
  });
}

function endGame(state: GameState, reason: GameOverReason) {
  if (state.status === "gameOver") {
    return;
  }

  state.status = "gameOver";
  state.gameOverReason = reason;
  state.fox = null;
  state.chickens.forEach((chicken) => {
    chicken.threatenedByFox = false;
    if (isChickenFearAnimation(chicken)) {
      setChickenAnimation(chicken, "idle", state.nowMs);
    }
  });
}

export function isFarmerNearCollector(farmer: Farmer, collector: EggCollector) {
  return Math.abs(farmer.x - collector.x) <= collector.width / 2 + COLLECTOR_INTERACT_DISTANCE;
}

function updateFarmerFall(state: GameState, now: number) {
  const { farmer } = state;

  if (!farmer.isFallen) {
    return;
  }

  if (farmer.fallenUntil !== null && now >= farmer.fallenUntil) {
    farmer.isFallen = false;
    farmer.fallenUntil = null;
    setFarmerAnimation(state, "recover", now, FARMER_RECOVER_DURATION_MS);
  }
}

function updateFarmerMovement(state: GameState, input: InputState, deltaSec: number) {
  const { farmer } = state;

  if (farmer.isFallen) {
    farmer.vx = 0;
    farmer.vy = 0;
    farmer.isJumping = false;
    farmer.y = FARMER_GROUND_Y;
    return;
  }

  const horizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  farmer.vx = horizontal * FARMER_SPEED;

  if (horizontal !== 0) {
    farmer.facing = horizontal > 0 ? 1 : -1;
    farmer.walkCycleMs += deltaSec * 1000;
  } else {
    farmer.walkCycleMs = Math.max(0, farmer.walkCycleMs - deltaSec * 320);
  }

  if (input.jumpQueued && !farmer.isJumping) {
    farmer.isJumping = true;
    farmer.vy = -FARMER_JUMP_SPEED;
  }

  farmer.x = clamp(farmer.x + farmer.vx * deltaSec, FARMER_WIDTH / 2 + 10, 980 - FARMER_WIDTH / 2 - 10);

  if (farmer.isJumping || farmer.y < FARMER_GROUND_Y) {
    farmer.vy += FARMER_GRAVITY * deltaSec;
    farmer.y += farmer.vy * deltaSec;

    if (farmer.y >= FARMER_GROUND_Y) {
      farmer.y = FARMER_GROUND_Y;
      farmer.vy = 0;
      farmer.isJumping = false;
    }
  } else {
    farmer.y = FARMER_GROUND_Y;
    farmer.vy = 0;
  }
}

function depositEgg(state: GameState, now: number) {
  const { farmer, collector, depositCombo } = state;

  if (farmer.isFallen || farmer.basketEggs <= 0 || !isFarmerNearCollector(farmer, collector)) {
    return;
  }

  farmer.basketEggs -= 1;
  state.stats.depositedEggs += 1;
  setFarmerAnimation(state, "deposit", now, FARMER_DEPOSIT_DURATION_MS);
  createDepositEggDropEffect(state, now);

  const timeSinceLastDeposit = now - depositCombo.lastDepositTime;
  depositCombo.count = timeSinceLastDeposit <= COMBO_WINDOW_MS ? depositCombo.count + 1 : 1;
  depositCombo.lastDepositTime = now;
  depositCombo.activeUntil = now + COMBO_WINDOW_MS;

  const pointsAwarded = depositCombo.count >= 5 ? COMBO_EGG_POINTS : EGG_POINTS;
  state.score += pointsAwarded;
  updateCollectorVisualProgress(state, now, pointsAwarded);
}

function hitFox(state: GameState) {
  if (!state.fox || !state.fox.active) {
    return;
  }

  const targetChicken = getChickenById(state, state.fox.targetChickenId);
  clearFoxThreat(targetChicken);
  calmCoopAfterFox(state, state.nowMs, targetChicken?.id);
  if (targetChicken && targetChicken.alive && !targetChicken.pendingRemoval && targetChicken.animation.name !== "layingEgg") {
    setChickenAnimation(targetChicken, "relieved", state.nowMs);
  }
  state.score += FOX_REPEL_POINTS;
  state.stats.foxesRepelled += 1;
  state.fox.active = false;
  setFoxAnimation(state.fox, "hit", state.nowMs);
}

function throwEgg(state: GameState) {
  const { farmer } = state;

  if (farmer.isFallen || farmer.basketEggs <= 0) {
    return;
  }

  farmer.basketEggs -= 1;
  setFarmerAnimation(state, "throw", state.nowMs, FARMER_THROW_DURATION_MS);
  state.thrownEggs.push({
    id: createId(state, "thrown"),
    x: farmer.x,
    y: farmer.y - FARMER_HEIGHT * 0.38,
    vy: -THROWN_EGG_SPEED,
    radius: THROWN_EGG_RADIUS,
    spawnedAt: state.nowMs,
    sourceChickenId: "",
    state: "thrown",
  });
}

function maybeSpawnFox(state: GameState, now: number) {
  if (state.fox || state.eggsLaidSinceLastFox < MIN_EGGS_BETWEEN_FOXES) {
    return;
  }

  const availableChickens = getFoxTargetChickens(state);
  if (availableChickens.length === 0) {
    return;
  }

  state.chickens.forEach((chicken) => {
    chicken.threatenedByFox = false;
  });

  const targetChicken = randomFrom(availableChickens);
  targetChicken.threatenedByFox = true;
  panicWholeCoop(state, now);
  state.eggsLaidSinceLastFox = 0;
  state.fox = {
    id: createId(state, "fox"),
    x: targetChicken.x,
    y: targetChicken.y - FOX_OFFSET_Y,
    targetChickenId: targetChicken.id,
    appearedAt: now,
    attackAt: now + FOX_ATTACK_DELAY_MS,
    active: true,
    animation: {
      name: "appear",
      startedAt: now,
    },
  };
}

function spawnEggFromChicken(state: GameState, chicken: Chicken, now: number) {
  state.eggs.push({
    id: createId(state, "egg"),
    x: chicken.x + (Math.random() * 16 - 8),
    y: chicken.y + CHICKEN_SIZE * 0.62,
    vy: state.eggFallSpeed * (0.92 + Math.random() * 0.18),
    radius: EGG_RADIUS,
    spawnedAt: now,
    sourceChickenId: chicken.id,
    state: "falling",
  });

  state.eggsLaidTotal += 1;
  state.eggsLaidSinceLastFox += 1;
  maybeSpawnFox(state, now);
}

function updateChickenAnimations(state: GameState, now: number) {
  for (const chicken of state.chickens) {
    if (!chicken.alive && !chicken.pendingRemoval) {
      continue;
    }

    const elapsed = now - chicken.animation.startedAt;

    if (chicken.animation.name === "layingEgg") {
      if (!chicken.animation.eventTriggered && elapsed >= CHICKEN_LAY_EVENT_MS) {
        chicken.animation.eventTriggered = true;
        spawnEggFromChicken(state, chicken, now);
      }

      if (elapsed >= CHICKEN_LAY_DURATION_MS) {
        if (state.fox?.active) {
          setChickenAnimation(chicken, "scaredStart", now);
        } else {
          setChickenAnimation(chicken, "idle", now);
        }
      }

      continue;
    }

    if (chicken.animation.name === "scaredStart" && elapsed >= CHICKEN_SCARED_START_DURATION_MS) {
      setChickenAnimation(chicken, "scaredLoop", now);
      continue;
    }

    if (chicken.animation.name === "relieved" && elapsed >= CHICKEN_RELIEVED_DURATION_MS) {
      setChickenAnimation(chicken, "idle", now);
      continue;
    }

    if (chicken.animation.name === "stolen" && elapsed >= CHICKEN_STOLEN_DURATION_MS) {
      chicken.alive = false;
      chicken.pendingRemoval = false;
      chicken.threatenedByFox = false;
      setChickenAnimation(chicken, "idle", now);
    }
  }
}

function updateEggSpawning(state: GameState, now: number) {
  if (state.fox) {
    return;
  }

  if (state.chickens.some((chicken) => chicken.animation.name === "layingEgg")) {
    return;
  }

  if (now - state.lastEggSpawnTime < state.eggSpawnIntervalMs) {
    return;
  }

  const availableChickens = state.chickens.filter(canChickenLayEgg);
  if (availableChickens.length === 0) {
    return;
  }

  const chicken =
    state.elapsedMs < EARLY_SEQUENCE_WINDOW_MS
      ? availableChickens[state.nextChickenIndex++ % availableChickens.length]
      : randomFrom(availableChickens);

  setChickenAnimation(chicken, "layingEgg", now);
  state.lastEggSpawnTime = now;
}

function updateEggs(state: GameState, deltaSec: number, now: number) {
  const nextEggs: Egg[] = [];

  for (const egg of state.eggs) {
    egg.y += egg.vy * deltaSec;

    if (!state.farmer.isFallen && isEggCollidingWithBasket(egg, state.farmer)) {
      if (state.farmer.basketEggs < MAX_BASKET_EGGS) {
        state.farmer.basketEggs += 1;
        state.stats.caughtEggs += 1;
        setFarmerAnimation(state, "catch", now, FARMER_CATCH_DURATION_MS);
      } else {
        breakEggAt(state, egg.x, now);
      }
      continue;
    }

    if (egg.y + egg.radius >= FLOOR_Y) {
      breakEggAt(state, egg.x, now);
      continue;
    }

    nextEggs.push(egg);
  }

  state.eggs = nextEggs;
}

function updateThrownEggs(state: GameState, deltaSec: number) {
  const nextEggs: Egg[] = [];

  for (const egg of state.thrownEggs) {
    egg.y += egg.vy * deltaSec;

    if (state.fox?.active && isEggHittingFox(egg, state.fox)) {
      createEggEffect(state, {
        x: state.fox.x,
        y: state.fox.y + 8,
        kind: "foxHit",
        startedAt: state.nowMs,
        durationMs: THROWN_EGG_HIT_EFFECT_DURATION_MS,
      });
      hitFox(state);
      continue;
    }

    if (egg.y + egg.radius < -20) {
      continue;
    }

    nextEggs.push(egg);
  }

  state.thrownEggs = nextEggs;
}

function updateEggEffects(state: GameState, now: number) {
  state.eggEffects = state.eggEffects.filter((effect) => now - effect.startedAt <= effect.durationMs);
}

function updateCollectorFeedback(state: GameState, now: number) {
  if (state.collectorFeedback && now - state.collectorFeedback.startedAt > state.collectorFeedback.durationMs) {
    state.collectorFeedback = null;
  }
}

function updateFox(state: GameState, now: number) {
  if (!state.fox) {
    return;
  }

  const fox = state.fox;
  const targetChicken = getChickenById(state, fox.targetChickenId);
  if (!targetChicken) {
    clearFoxThreat(targetChicken);
    calmCoopAfterFox(state, now);
    state.fox = null;
    return;
  }

  if (!targetChicken.alive && fox.animation.name !== "carryUp" && fox.animation.name !== "retreat") {
    clearFoxThreat(targetChicken);
    calmCoopAfterFox(state, now);
    state.fox = null;
    return;
  }

  if (targetChicken.alive) {
    fox.x = targetChicken.x;
    fox.y = targetChicken.y - FOX_OFFSET_Y;
  }

  const animationElapsed = now - fox.animation.startedAt;

  if (fox.animation.name === "appear" && animationElapsed >= FOX_APPEAR_DURATION_MS) {
    setFoxAnimation(fox, "lickLips", now);
    return;
  }

  if (fox.animation.name === "lickLips" && animationElapsed >= FOX_LICK_DURATION_MS) {
    setFoxAnimation(fox, "hover", now);
    return;
  }

  if (fox.animation.name === "hit" && animationElapsed >= FOX_HIT_DURATION_MS) {
    setFoxAnimation(fox, "retreat", now);
    return;
  }

  if (fox.animation.name === "retreat" && animationElapsed >= FOX_RETREAT_DURATION_MS) {
    calmCoopAfterFox(state, now);
    state.fox = null;
    return;
  }

  if (fox.animation.name === "steal" && animationElapsed >= FOX_STEAL_DURATION_MS) {
    setFoxAnimation(fox, "carryUp", now);
    return;
  }

  if (fox.animation.name === "carryUp" && animationElapsed >= FOX_CARRY_UP_DURATION_MS) {
    calmCoopAfterFox(state, now);
    state.fox = null;
    return;
  }

  if (!fox.active || now < fox.attackAt) {
    return;
  }

  targetChicken.threatenedByFox = false;
  targetChicken.pendingRemoval = true;
  setChickenAnimation(targetChicken, "stolen", now);
  calmCoopAfterFox(state, now, targetChicken.id);
  state.stats.chickensLost += 1;
  state.score -= CHICKEN_LOST_PENALTY;
  fox.active = false;
  setFoxAnimation(fox, "steal", now);
}

function updatePuddles(state: GameState, now: number) {
  state.puddles = state.puddles.filter((puddle) => puddle.expiresAt > now);

  if (state.depositCombo.count > 0 && now > state.depositCombo.activeUntil) {
    state.depositCombo.count = 0;
  }
}

function checkPuddleCollision(state: GameState, now: number) {
  const { farmer } = state;
  if (farmer.isFallen || farmer.isJumping) {
    return;
  }

  for (const puddle of state.puddles) {
    if (puddle.slippedAt !== null) {
      continue;
    }

    if (Math.abs(farmer.x - puddle.x) <= puddle.radius * 0.86 + FARMER_FEET_RADIUS) {
      farmer.isFallen = true;
      farmer.fallenUntil = now + FARMER_FALL_DURATION_MS;
      setFarmerAnimation(state, "slipFall", now, FARMER_SLIP_DURATION_MS);
      farmer.vx = 0;
      farmer.vy = 0;
      farmer.isJumping = false;
      farmer.y = FARMER_GROUND_Y;

      const lostEggs = Math.floor(farmer.basketEggs / 2);
      farmer.basketEggs -= lostEggs;
      state.depositCombo.count = 0;
      puddle.slippedAt = now;
      puddle.expiresAt = now + FARMER_SLIP_DURATION_MS;
      break;
    }
  }
}

function updateDifficulty(state: GameState, now: number) {
  while (now - state.lastDifficultyIncreaseTime >= DIFFICULTY_INCREASE_EVERY_MS) {
    state.lastDifficultyIncreaseTime += DIFFICULTY_INCREASE_EVERY_MS;
    state.eggSpawnIntervalMs = Math.max(MIN_EGG_SPAWN_INTERVAL_MS, state.eggSpawnIntervalMs * 0.9);
    state.eggFallSpeed = Math.min(MAX_EGG_FALL_SPEED, state.eggFallSpeed * 1.08);
  }
}

function handleActions(state: GameState, input: InputState, now: number) {
  if (input.depositQueued) {
    depositEgg(state, now);
  }

  if (input.throwQueued) {
    throwEgg(state);
  }
}

function checkGameOver(state: GameState) {
  removeBrokenThreats(state);

  if (state.brokenEggsCount >= MAX_BROKEN_EGGS) {
    endGame(state, "brokenEggs");
    return;
  }

  if (getAliveChickens(state).length === 0) {
    endGame(state, "noChickens");
  }
}

export function stepGame(state: GameState, input: InputState, deltaMs: number, now: number) {
  state.nowMs = now;

  if (state.status !== "playing") {
    return;
  }

  state.elapsedMs += deltaMs;
  clearFinishedFarmerAnimation(state, now);
  updateFarmerFall(state, now);
  updateFarmerMovement(state, input, deltaMs / 1000);
  handleActions(state, input, now);
  updateChickenAnimations(state, now);
  updateEggSpawning(state, now);
  updateEggs(state, deltaMs / 1000, now);
  updateThrownEggs(state, deltaMs / 1000);
  updateEggEffects(state, now);
  updateCollectorFeedback(state, now);
  updateFox(state, now);
  updatePuddles(state, now);
  checkPuddleCollision(state, now);
  updateDifficulty(state, now);
  checkGameOver(state);
}
