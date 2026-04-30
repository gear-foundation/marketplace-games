import { CANVAS_H, CANVAS_W } from "./constants";
import { attachInput, clearInputFrame, detachInput, getInput, resetInput } from "./input";
import {
  sfxAcid,
  sfxExplosion,
  sfxGameOver,
  sfxHit,
  sfxMachineGun,
  sfxPickup,
  sfxPistol,
  sfxRocketLaunch,
  sfxShotgun,
  sfxWeaponUpgrade,
} from "./sound";
import type { GameEndPayload, GameStatus, HudData, WeaponType } from "./types";

type EnemyType = "normal" | "acid" | "ninja" | "tank";
type BonusType = "small_medkit" | "big_medkit" | "speed" | "shield" | "airstrike";
type ProjectileType = "bullet" | "rocket" | "acid_spit";
type EdgeSide = "top" | "bottom" | "left" | "right";
type Vec2 = { x: number; y: number };

type Player = {
  x: number;
  y: number;
  angle: number;
  radius: number;
  health: number;
  maxHealth: number;
  baseSpeed: number;
  baseRotationSpeed: number;
  currentWeapon: WeaponType;
  stunTimer: number;
  shieldTimer: number;
  speedBoostTimer: number;
  machineBurstRemaining: number;
  machineBurstTimer: number;
  machineHoldTime: number;
  machineStreamActive: boolean;
  machineStreamTimer: number;
  machineStreamAngle: number;
  shotgunCooldown: number;
  shotgunCharging: boolean;
  shotgunChargeTime: number;
  bazookaCooldown: number;
  bazookaPendingDelay: number;
  bazookaPendingAngle: number;
};

type Enemy = {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  speed: number;
  radius: number;
  attackTimer: number;
  anchorX?: number;
  anchorY?: number;
  edge?: EdgeSide;
  state?: "approaching" | "perched" | "windup";
  zigzagPhase?: number;
  backDistance?: number;
  windupTimer?: number;
  visualAngle?: number;
  gaitPhase?: number;
  idlePhase?: number;
  attackAnim?: number;
  attackDidHit?: boolean;
  hitAnim?: number;
  isDying?: boolean;
  deathAnim?: number;
  corpseFade?: number;
  deathFlip?: number;
  movingThisTick?: boolean;
  hurtFlash: number;
  alive: boolean;
};

type Projectile = {
  id: string;
  type: ProjectileType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  distance: number;
  maxDistance: number;
  targetX?: number;
  targetY?: number;
  alive: boolean;
};

type Bonus = {
  id: string;
  type: BonusType;
  x: number;
  y: number;
  radius: number;
  lifetime: number;
  bobPhase: number;
};

type AcidPool = {
  id: string;
  x: number;
  y: number;
  radius: number;
  lifetime: number;
  damagePerSecond: number;
  slowMultiplier: number;
};

type Particle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
};

type GameState = {
  status: GameStatus;
  time: number;
  kills: number;
  score: number;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  bonuses: Bonus[];
  acidPools: AcidPool[];
  particles: Particle[];
  nextHealthUpgradeAt: number;
  nextEnemySpawnIn: number;
  nextBonusSpawnIn: number;
  bannerText: string;
  bannerTimer: number;
  airstrikeSide: "left" | "right" | null;
  airstrikeTimer: number;
  cameraShake: number;
  result: GameEndPayload | null;
};

const STEP_MS = 1000 / 60;
const PLAYER_RADIUS = 18;
const PLAYER_SPEED = 280;
const PLAYER_ROTATION_SPEED = 2.8;
const BACKWARD_SPEED_FACTOR = 0.7;
const BULLET_SPEED = 900;
const BULLET_RADIUS = 5;
const ROCKET_SPEED = 520;
const ROCKET_RADIUS = 14;
const ROCKET_PUSH_SPEED = 250;
const ACID_SPIT_SPEED = 360;
const ACID_SPIT_RADIUS = 10;
const NORMAL_ATTACK_RANGE = 34;
const NORMAL_ATTACK_ANIM_DURATION = 0.42;
const NORMAL_ATTACK_HIT_MOMENT = 0.24;
const ACID_ATTACK_ANIM_DURATION = 0.5;
const ACID_ATTACK_RELEASE_MOMENT = 0.28;
const ACID_DEATH_ANIM_DURATION = 0.72;
const NINJA_ATTACK_RANGE = 40;
const TANK_ATTACK_RANGE = 74;
const ACID_STOP_DISTANCE = CANVAS_H * 0.08;
const ACID_POOL_RADIUS = CANVAS_H * 0.07;
const SHOTGUN_NORMAL_RANGE = CANVAS_H / 3;
const SHOTGUN_CHARGED_RANGE = (CANVAS_H * 2) / 3;
const SHOTGUN_KNOCKBACK = CANVAS_H * 0.15;
const SHOTGUN_CONE_HALF_ANGLE = (45 * Math.PI) / 180 / 2;
const BAZOOKA_RANGE = CANVAS_H / 2;
const EXPLOSION_RADIUS = CANVAS_H * 0.1;
const BANNER_DURATION = 2.1;
const MACHINE_STREAM_INTERVAL = 0.12;
const TIME_SCORE_FACTOR = 25;
const KILL_SCORE = 120;
const NORMAL_ZOMBIE_BASE_FACING = Math.PI / 2;
const NORMAL_ZOMBIE_FRAME_W = 320;
const NORMAL_ZOMBIE_FRAME_H = 320;
const NORMAL_ZOMBIE_DRAW_SCALE = 0.42;
const NORMAL_ZOMBIE_PIVOT_X = 0.5;
const NORMAL_ZOMBIE_PIVOT_Y = 0.46;
const ACID_ZOMBIE_BASE_FACING = Math.PI / 2;
const ACID_ZOMBIE_FRAME_W = 320;
const ACID_ZOMBIE_FRAME_H = 320;
const ACID_ZOMBIE_DRAW_SCALE = 0.43;
const ACID_ZOMBIE_PIVOT_X = 0.5;
const ACID_ZOMBIE_PIVOT_Y = 0.46;

type ZombieStripName = "idle" | "walk" | "attack" | "hit" | "death";
type ZombieStrip = {
  path: string;
  frames: number;
  fps: number;
  width: number;
  height: number;
  image: HTMLImageElement | null;
  loaded: boolean;
};

const normalZombieStrips: Record<ZombieStripName, ZombieStrip> = {
  idle: {
    path: "/assets/zombies/level1/zombie-level1-idle.png",
    frames: 5,
    fps: 5,
    width: NORMAL_ZOMBIE_FRAME_W,
    height: NORMAL_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  walk: {
    path: "/assets/zombies/level1/zombie-level1-walk.png",
    frames: 8,
    fps: 10,
    width: NORMAL_ZOMBIE_FRAME_W,
    height: NORMAL_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  attack: {
    path: "/assets/zombies/level1/zombie-level1-attack.png",
    frames: 5,
    fps: 14,
    width: NORMAL_ZOMBIE_FRAME_W,
    height: NORMAL_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  hit: {
    path: "/assets/zombies/level1/zombie-level1-hit.png",
    frames: 3,
    fps: 14,
    width: NORMAL_ZOMBIE_FRAME_W,
    height: NORMAL_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  death: {
    path: "/assets/zombies/level1/zombie-level1-death.png",
    frames: 7,
    fps: 10,
    width: NORMAL_ZOMBIE_FRAME_W,
    height: NORMAL_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
};

const acidZombieStrips: Record<ZombieStripName, ZombieStrip> = {
  idle: {
    path: "/assets/zombies/level2/zombie-level2-idle.png",
    frames: 5,
    fps: 5,
    width: ACID_ZOMBIE_FRAME_W,
    height: ACID_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  walk: {
    path: "/assets/zombies/level2/zombie-level2-walk.png",
    frames: 8,
    fps: 8,
    width: ACID_ZOMBIE_FRAME_W,
    height: ACID_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  attack: {
    path: "/assets/zombies/level2/zombie-level2-attack.png",
    frames: 5,
    fps: 14,
    width: ACID_ZOMBIE_FRAME_W,
    height: ACID_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  hit: {
    path: "/assets/zombies/level2/zombie-level2-hit.png",
    frames: 3,
    fps: 14,
    width: ACID_ZOMBIE_FRAME_W,
    height: ACID_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  death: {
    path: "/assets/zombies/level2/zombie-level2-death.png",
    frames: 7,
    fps: 10,
    width: ACID_ZOMBIE_FRAME_W,
    height: ACID_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
};

let state = createInitialState("menu");
let hudData = snapshotHud(state);
let rafId = 0;
let lastTs = 0;
let accumulator = 0;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let onEndCallback: ((payload: GameEndPayload) => void) | null = null;
let idCounter = 0;
let normalZombieSpritesRequested = false;
let acidZombieSpritesRequested = false;

function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function createPlayer(): Player {
  return {
    x: CANVAS_W / 2,
    y: CANVAS_H / 2,
    angle: -Math.PI / 2,
    radius: PLAYER_RADIUS,
    health: 100,
    maxHealth: 100,
    baseSpeed: PLAYER_SPEED,
    baseRotationSpeed: PLAYER_ROTATION_SPEED,
    currentWeapon: "pistol",
    stunTimer: 0,
    shieldTimer: 0,
    speedBoostTimer: 0,
    machineBurstRemaining: 0,
    machineBurstTimer: 0,
    machineHoldTime: 0,
    machineStreamActive: false,
    machineStreamTimer: 0,
    machineStreamAngle: 0,
    shotgunCooldown: 0,
    shotgunCharging: false,
    shotgunChargeTime: 0,
    bazookaCooldown: 0,
    bazookaPendingDelay: 0,
    bazookaPendingAngle: 0,
  };
}

function createInitialState(status: GameStatus): GameState {
  return {
    status,
    time: 0,
    kills: 0,
    score: 0,
    player: createPlayer(),
    enemies: [],
    projectiles: [],
    bonuses: [],
    acidPools: [],
    particles: [],
    nextHealthUpgradeAt: 30,
    nextEnemySpawnIn: 1.5,
    nextBonusSpawnIn: rand(8, 15),
    bannerText: "",
    bannerTimer: 0,
    airstrikeSide: null,
    airstrikeTimer: 0,
    cameraShake: 0,
    result: null,
  };
}

function snapshotHud(current: GameState): HudData {
  const chargeRatio = current.player.shotgunCharging
    ? Math.min(1, current.player.shotgunChargeTime / 1)
    : 0;

  return {
    status: current.status,
    health: Math.max(0, Math.ceil(current.player.health)),
    maxHealth: Math.ceil(current.player.maxHealth),
    weapon: current.player.currentWeapon,
    kills: current.kills,
    score: current.score,
    time: Math.floor(current.time),
    shieldTime: Math.ceil(current.player.shieldTimer),
    speedTime: Math.ceil(current.player.speedBoostTimer),
    stunTime: Math.ceil(current.player.stunTimer),
    shotgunCharge: chargeRatio,
    shotgunCharged: chargeRatio >= 1,
    banner: current.bannerText,
    bannerTimer: current.bannerTimer,
    result: current.result,
  };
}

export function getHudData() {
  return hudData;
}

export function mountCanvas(el: HTMLCanvasElement, onEnd: (payload: GameEndPayload) => void) {
  canvas = el;
  ctx = el.getContext("2d");
  onEndCallback = onEnd;
  ensureNormalZombieSpriteAssets();
  ensureAcidZombieSpriteAssets();
  attachInput();
  if (!rafId) {
    rafId = requestAnimationFrame(frame);
  }
}

export function unmountCanvas() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  lastTs = 0;
  accumulator = 0;
  detachInput();
  resetInput();
  canvas = null;
  ctx = null;
  onEndCallback = null;
  state = createInitialState("menu");
  hudData = snapshotHud(state);
}

export function startGame() {
  ensureNormalZombieSpriteAssets();
  ensureAcidZombieSpriteAssets();
  state = createInitialState("playing");
  hudData = snapshotHud(state);
}

export function pauseGame() {
  if (state.status === "playing") {
    state.status = "paused";
    hudData = snapshotHud(state);
  }
}

export function resumeGame() {
  if (state.status === "paused") {
    state.status = "playing";
    hudData = snapshotHud(state);
  }
}

export function goToMenu() {
  state = createInitialState("menu");
  hudData = snapshotHud(state);
}

function frame(timestamp: number) {
  if (document.hidden) {
    lastTs = timestamp;
    accumulator = 0;
    rafId = requestAnimationFrame(frame);
    return;
  }

  if (lastTs === 0) {
    lastTs = timestamp;
  }

  const frameDt = Math.min((timestamp - lastTs) / 1000, 0.1);
  accumulator += timestamp - lastTs;
  lastTs = timestamp;

  while (accumulator >= STEP_MS) {
    tick(STEP_MS / 1000);
    clearInputFrame();
    accumulator -= STEP_MS;
  }

  if (ctx && canvas) {
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const nextW = Math.max(1, Math.round(bounds.width * dpr));
    const nextH = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }

    ctx.setTransform(canvas.width / CANVAS_W, 0, 0, canvas.height / CANVAS_H, 0, 0);
    renderFrame(ctx, state, frameDt);
  }

  rafId = requestAnimationFrame(frame);
}

function tick(dt: number) {
  const input = getInput();

  if (input.pausePressed) {
    if (state.status === "playing") {
      state.status = "paused";
    } else if (state.status === "paused") {
      state.status = "playing";
    }
  }

  if (state.status !== "playing") {
    updateCosmetics(state, dt);
    hudData = snapshotHud(state);
    return;
  }

  updateCosmetics(state, dt);

  state.time += dt;
  state.score = computeScore(state.time, state.kills);

  const player = state.player;
  player.stunTimer = Math.max(0, player.stunTimer - dt);
  player.shieldTimer = Math.max(0, player.shieldTimer - dt);
  player.speedBoostTimer = Math.max(0, player.speedBoostTimer - dt);
  player.shotgunCooldown = Math.max(0, player.shotgunCooldown - dt);
  player.bazookaCooldown = Math.max(0, player.bazookaCooldown - dt);

  while (state.time >= state.nextHealthUpgradeAt) {
    const bonus = state.nextHealthUpgradeAt <= 120 ? 25 : 10;
    player.maxHealth += bonus;
    player.health = Math.min(player.maxHealth, player.health + bonus);
    showBanner(state, `MAX HP +${bonus}`);
    state.nextHealthUpgradeAt += 30;
  }

  const desiredWeapon = weaponForTime(state.time);
  if (desiredWeapon !== player.currentWeapon) {
    player.currentWeapon = desiredWeapon;
    resetWeaponFlow(player);
    showBanner(state, `NEW WEAPON: ${weaponName(desiredWeapon)}`);
    sfxWeaponUpgrade();
  }

  const insideAcidBeforeMove = player.shieldTimer <= 0 && state.acidPools.some((pool) => distance(pool, player) <= pool.radius + player.radius);
  updatePlayer(state, dt, insideAcidBeforeMove);

  state.nextEnemySpawnIn -= dt;
  if (state.enemies.filter((enemy) => enemy.alive).length < enemyCapForTime(state.time) && state.nextEnemySpawnIn <= 0) {
    spawnEnemy(state);
    const [minDelay, maxDelay] = enemySpawnIntervalForTime(state.time);
    state.nextEnemySpawnIn = rand(minDelay, maxDelay);
  }

  state.nextBonusSpawnIn -= dt;
  if (state.nextBonusSpawnIn <= 0) {
    spawnBonus(state);
    state.nextBonusSpawnIn = rand(8, 15);
  }

  updateEnemies(state, dt);
  updateProjectiles(state, dt);
  updateAcidPools(state, dt);
  updateBonuses(state, dt);
  updateParticles(state, dt);

  state.enemies = state.enemies.filter((enemy) => enemy.alive);
  state.projectiles = state.projectiles.filter((projectile) => projectile.alive);
  state.bonuses = state.bonuses.filter((bonus) => bonus.lifetime > 0);
  state.acidPools = state.acidPools.filter((pool) => pool.lifetime > 0);
  state.particles = state.particles.filter((particle) => particle.life > 0);

  state.score = computeScore(state.time, state.kills);

  if (player.health <= 0) {
    finishRun();
  }

  hudData = snapshotHud(state);
}

function updateCosmetics(current: GameState, dt: number) {
  current.bannerTimer = Math.max(0, current.bannerTimer - dt);
  if (current.bannerTimer <= 0) {
    current.bannerText = "";
  }

  current.airstrikeTimer = Math.max(0, current.airstrikeTimer - dt);
  if (current.airstrikeTimer <= 0) {
    current.airstrikeSide = null;
  }

  current.cameraShake = Math.max(0, current.cameraShake - dt * 8);
}

function updatePlayer(current: GameState, dt: number, insideAcid: boolean) {
  const input = getInput();
  const player = current.player;
  const isStunned = player.stunTimer > 0;
  const speedMultiplier = (player.speedBoostTimer > 0 ? 2 : 1) * (insideAcid ? 0.5 : 1);
  const rotationMultiplier = player.speedBoostTimer > 0 ? 2 : 1;
  const forward = vectorFromAngle(player.angle);

  if (!isStunned) {
    if (!player.machineStreamActive) {
      if (input.left) {
        player.angle -= player.baseRotationSpeed * rotationMultiplier * dt;
      }
      if (input.right) {
        player.angle += player.baseRotationSpeed * rotationMultiplier * dt;
      }
    }

    let moveAxis = 0;
    if (input.up) moveAxis += 1;
    if (input.down) moveAxis -= BACKWARD_SPEED_FACTOR;

    player.x += forward.x * player.baseSpeed * speedMultiplier * moveAxis * dt;
    player.y += forward.y * player.baseSpeed * speedMultiplier * moveAxis * dt;
    clampPlayer(player);
  } else {
    cancelShootingFlow(player);
  }

  if (player.bazookaPendingDelay > 0) {
    player.bazookaPendingDelay = Math.max(0, player.bazookaPendingDelay - dt);
    if (player.bazookaPendingDelay === 0) {
      spawnRocket(current, player.bazookaPendingAngle);
      sfxRocketLaunch();
    }
  }

  if (isStunned) {
    return;
  }

  if (player.currentWeapon === "pistol" && input.firePressed) {
    fireBullet(current, player.angle, 50);
    sfxPistol();
  }

  if (player.currentWeapon === "machine_gun") {
    if (input.firePressed) {
      player.machineBurstRemaining = 3;
      player.machineBurstTimer = 0;
      player.machineHoldTime = 0;
    }

    if (input.fire) {
      player.machineHoldTime += dt;
      if (
        !player.machineStreamActive &&
        player.machineHoldTime >= 0.28 &&
        player.machineBurstRemaining === 0
      ) {
        player.machineStreamActive = true;
        player.machineStreamAngle = player.angle;
        player.machineStreamTimer = 0;
      }
    } else {
      player.machineHoldTime = 0;
      player.machineStreamActive = false;
    }

    if (player.machineBurstRemaining > 0) {
      player.machineBurstTimer -= dt;
      while (player.machineBurstRemaining > 0 && player.machineBurstTimer <= 0) {
        fireBullet(current, player.angle, 40);
        sfxMachineGun();
        player.machineBurstRemaining -= 1;
        if (player.machineBurstRemaining > 0) {
          player.machineBurstTimer += 0.1;
        }
      }
    }

    if (player.machineStreamActive) {
      player.machineStreamTimer -= dt;
      while (player.machineStreamTimer <= 0) {
        fireBullet(current, player.machineStreamAngle, 40);
        sfxMachineGun();
        player.machineStreamTimer += MACHINE_STREAM_INTERVAL;
      }
    }
  }

  if (player.currentWeapon === "shotgun") {
    if (input.firePressed && player.shotgunCooldown <= 0) {
      player.shotgunCharging = true;
      player.shotgunChargeTime = 0;
    }

    if (player.shotgunCharging && input.fire) {
      player.shotgunChargeTime += dt;
    }

    if (player.shotgunCharging && input.fireReleased) {
      fireShotgun(current, player.shotgunChargeTime >= 1);
      player.shotgunCharging = false;
      player.shotgunChargeTime = 0;
      player.shotgunCooldown = 1;
    }
  } else {
    player.shotgunCharging = false;
    player.shotgunChargeTime = 0;
  }

  if (player.currentWeapon === "bazooka" && input.firePressed && player.bazookaCooldown <= 0 && player.bazookaPendingDelay <= 0) {
    player.bazookaCooldown = 2;
    player.bazookaPendingDelay = 0.5;
    player.bazookaPendingAngle = player.angle;
    showBanner(current, "ROCKET PRIMED");
  }
}

function updateEnemies(current: GameState, dt: number) {
  const player = current.player;
  const playerForward = vectorFromAngle(player.angle);

  for (const enemy of current.enemies) {
    if (!enemy.alive) continue;

    enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
    enemy.hurtFlash = Math.max(0, enemy.hurtFlash - dt * 4);
    enemy.movingThisTick = false;
    enemy.attackAnim = Math.max(0, (enemy.attackAnim ?? 0) - dt);
    enemy.hitAnim = Math.max(0, (enemy.hitAnim ?? 0) - dt);
    enemy.idlePhase = (enemy.idlePhase ?? 0) + dt * 3.2;

    if (enemy.isDying) {
      enemy.deathAnim = Math.max(0, (enemy.deathAnim ?? 0) - dt);
      if ((enemy.deathAnim ?? 0) <= 0) {
        enemy.corpseFade = Math.max(0, (enemy.corpseFade ?? 0) - dt);
        if ((enemy.corpseFade ?? 0) <= 0) {
          enemy.alive = false;
        }
      }
      continue;
    }

    const toPlayer = subtract(player, enemy);
    const toPlayerNorm = normalize(toPlayer);
    const distanceToPlayer = length(toPlayer);
    const facingAngle = Math.atan2(toPlayerNorm.y, toPlayerNorm.x);

    if (enemy.type === "normal") {
      enemy.visualAngle = approachAngle(enemy.visualAngle ?? facingAngle, facingAngle, dt * 10);

      const inAttackRange = distanceToPlayer <= enemy.radius + player.radius + NORMAL_ATTACK_RANGE;
      const attackLocked = (enemy.attackAnim ?? 0) > 0.16;
      const canAdvance = !inAttackRange || !attackLocked;

      if (canAdvance) {
        enemy.x += toPlayerNorm.x * enemy.speed * dt;
        enemy.y += toPlayerNorm.y * enemy.speed * dt;
        enemy.movingThisTick = true;
        enemy.gaitPhase = (enemy.gaitPhase ?? rand(0, Math.PI * 2)) + dt * 9.4;
      }

      if ((enemy.attackAnim ?? 0) > 0 && !enemy.attackDidHit && (enemy.attackAnim ?? 0) <= NORMAL_ATTACK_HIT_MOMENT) {
        if (inAttackRange) {
          applyPlayerHit(current, 20, { shake: 0.35 });
        }
        enemy.attackDidHit = true;
      }

      if (inAttackRange && enemy.attackTimer <= 0 && (enemy.attackAnim ?? 0) <= 0) {
        enemy.attackTimer = 1;
        enemy.attackAnim = NORMAL_ATTACK_ANIM_DURATION;
        enemy.attackDidHit = false;
      }
    }

    if (enemy.type === "acid") {
      enemy.visualAngle = approachAngle(enemy.visualAngle ?? facingAngle, facingAngle, dt * 7);

      const target = {
        x: enemy.anchorX ?? enemy.x,
        y: enemy.anchorY ?? enemy.y,
      };

      if (enemy.state !== "perched") {
        const towardAnchor = normalize(subtract(target, enemy));
        enemy.x += towardAnchor.x * enemy.speed * dt;
        enemy.y += towardAnchor.y * enemy.speed * dt;
        enemy.movingThisTick = true;
        enemy.gaitPhase = (enemy.gaitPhase ?? rand(0, Math.PI * 2)) + dt * 5.6;
        if (distance(enemy, target) <= 8) {
          enemy.state = "perched";
        }
      }

      if ((enemy.attackAnim ?? 0) > 0 && !enemy.attackDidHit && (enemy.attackAnim ?? 0) <= ACID_ATTACK_RELEASE_MOMENT) {
        spawnAcidSpit(current, enemy, { x: player.x, y: player.y });
        enemy.attackTimer = 5;
        enemy.attackDidHit = true;
        sfxAcid();
      }

      if (enemy.state === "perched" && enemy.attackTimer <= 0 && (enemy.attackAnim ?? 0) <= 0) {
        enemy.attackAnim = ACID_ATTACK_ANIM_DURATION;
        enemy.attackDidHit = false;
      }
    }

    if (enemy.type === "ninja") {
      const behindTarget = {
        x: player.x - playerForward.x * (enemy.backDistance ?? 64),
        y: player.y - playerForward.y * (enemy.backDistance ?? 64),
      };
      const desiredDirection = normalize(subtract(behindTarget, enemy));
      const zigzag = perpendicular(desiredDirection);
      const zigzagOffset = Math.sin(current.time * 6 + (enemy.zigzagPhase ?? 0)) * 34;
      enemy.x += (desiredDirection.x * enemy.speed + zigzag.x * zigzagOffset) * dt;
      enemy.y += (desiredDirection.y * enemy.speed + zigzag.y * zigzagOffset) * dt;

      const vectorToNinja = normalize(subtract(enemy, player));
      const behindDot = dot(playerForward, vectorToNinja);
      if (
        distanceToPlayer <= enemy.radius + player.radius + NINJA_ATTACK_RANGE &&
        behindDot < -0.5 &&
        enemy.attackTimer <= 0
      ) {
        applyPlayerHit(current, 50, { shake: 0.6 });
        enemy.attackTimer = 1.5;
        const retreat = normalize(subtract(enemy, player));
        enemy.x += retreat.x * 90;
        enemy.y += retreat.y * 90;
      }
    }

    if (enemy.type === "tank") {
      const windingUp = (enemy.windupTimer ?? 0) > 0;

      if (windingUp) {
        enemy.windupTimer = Math.max(0, (enemy.windupTimer ?? 0) - dt);
        if (enemy.windupTimer === 0 && distanceToPlayer <= enemy.radius + player.radius + TANK_ATTACK_RANGE) {
          applyPlayerHit(current, 100, { stun: 1, shake: 0.85 });
        }
      } else {
        enemy.x += toPlayerNorm.x * enemy.speed * dt;
        enemy.y += toPlayerNorm.y * enemy.speed * dt;

        if (distanceToPlayer <= enemy.radius + player.radius + TANK_ATTACK_RANGE && enemy.attackTimer <= 0) {
          enemy.windupTimer = 0.7;
          enemy.attackTimer = 3.2;
        }
      }
    }

    enemy.x = clamp(enemy.x, -40, CANVAS_W + 40);
    enemy.y = clamp(enemy.y, -40, CANVAS_H + 40);
  }
}

function updateProjectiles(current: GameState, dt: number) {
  for (const projectile of current.projectiles) {
    if (!projectile.alive) continue;

    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.distance += Math.hypot(projectile.vx * dt, projectile.vy * dt);

    if (projectile.type === "bullet") {
      for (const enemy of current.enemies) {
        if (!enemy.alive) continue;
        if (distance(projectile, enemy) <= projectile.radius + enemy.radius) {
          projectile.alive = false;
          damageEnemy(current, enemy, projectile.damage);
          break;
        }
      }
    }

    if (projectile.type === "acid_spit") {
      if (
        projectile.distance >= projectile.maxDistance ||
        distance(projectile, { x: projectile.targetX ?? projectile.x, y: projectile.targetY ?? projectile.y }) <= projectile.radius + 4
      ) {
        projectile.alive = false;
        spawnAcidPool(current, projectile.x, projectile.y);
      }
    }

    if (projectile.type === "rocket") {
      const direction = normalize({ x: projectile.vx, y: projectile.vy });
      for (const enemy of current.enemies) {
        if (!enemy.alive) continue;
        if (distance(projectile, enemy) <= projectile.radius + enemy.radius + 6) {
          enemy.x += direction.x * ROCKET_PUSH_SPEED * dt;
          enemy.y += direction.y * ROCKET_PUSH_SPEED * dt;
        }
      }

      if (projectile.distance >= projectile.maxDistance) {
        projectile.alive = false;
        explodeRocket(current, projectile.x, projectile.y);
      }
    }

    if (
      projectile.x < -80 ||
      projectile.x > CANVAS_W + 80 ||
      projectile.y < -80 ||
      projectile.y > CANVAS_H + 80
    ) {
      projectile.alive = false;
    }
  }
}

function updateAcidPools(current: GameState, dt: number) {
  const player = current.player;
  const insideAnyPool = player.shieldTimer <= 0 && current.acidPools.some((pool) => distance(pool, player) <= pool.radius + player.radius);

  for (const pool of current.acidPools) {
    pool.lifetime = Math.max(0, pool.lifetime - dt);
    if (player.shieldTimer <= 0 && distance(pool, player) <= pool.radius + player.radius) {
      applyPlayerHit(current, pool.damagePerSecond * dt, { silent: true });
    }
  }

  if (insideAnyPool) {
    current.cameraShake = Math.max(current.cameraShake, 0.12);
  }
}

function updateBonuses(current: GameState, dt: number) {
  const player = current.player;

  for (const bonus of current.bonuses) {
    bonus.lifetime = Math.max(0, bonus.lifetime - dt);
    bonus.bobPhase += dt * 3;

    if (distance(bonus, player) <= bonus.radius + player.radius + 6) {
      applyBonus(current, bonus.type);
      bonus.lifetime = 0;
      sfxPickup();
      spawnParticles(current, bonus.x, bonus.y, bonusColor(bonus.type), 18, 2.4);
    }
  }
}

function updateParticles(current: GameState, dt: number) {
  for (const particle of current.particles) {
    particle.life = Math.max(0, particle.life - dt);
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
  }
}

function fireBullet(current: GameState, angle: number, damage: number) {
  const origin = current.player;
  const dir = vectorFromAngle(angle);
  current.projectiles.push({
    id: nextId("bullet"),
    type: "bullet",
    x: origin.x + dir.x * (origin.radius + 12),
    y: origin.y + dir.y * (origin.radius + 12),
    vx: dir.x * BULLET_SPEED,
    vy: dir.y * BULLET_SPEED,
    radius: BULLET_RADIUS,
    damage,
    distance: 0,
    maxDistance: Math.hypot(CANVAS_W, CANVAS_H),
    alive: true,
  });
}

function fireShotgun(current: GameState, charged: boolean) {
  const player = current.player;
  const dir = vectorFromAngle(player.angle);
  const range = charged ? SHOTGUN_CHARGED_RANGE : SHOTGUN_NORMAL_RANGE;
  const coneCos = Math.cos(SHOTGUN_CONE_HALF_ANGLE);

  for (const enemy of current.enemies) {
    if (!enemy.alive) continue;
    const delta = subtract(enemy, player);
    const deltaNorm = normalize(delta);
    const alignment = dot(dir, deltaNorm);
    const distanceToEnemy = length(delta);
    if (distanceToEnemy <= range + enemy.radius && alignment >= coneCos) {
      damageEnemy(current, enemy, 80);
      const knock = normalize(delta);
      enemy.x += knock.x * (charged ? 32 : 20);
      enemy.y += knock.y * (charged ? 32 : 20);
    }
  }

  if (charged) {
    player.x -= dir.x * SHOTGUN_KNOCKBACK;
    player.y -= dir.y * SHOTGUN_KNOCKBACK;
    clampPlayer(player);
  }

  current.cameraShake = Math.max(current.cameraShake, charged ? 0.8 : 0.5);
  spawnParticles(current, player.x + dir.x * 28, player.y + dir.y * 28, "#ffd7a6", charged ? 22 : 16, charged ? 4 : 3);
  sfxShotgun();
}

function spawnRocket(current: GameState, angle: number) {
  const player = current.player;
  const dir = vectorFromAngle(angle);
  current.projectiles.push({
    id: nextId("rocket"),
    type: "rocket",
    x: player.x + dir.x * (player.radius + 16),
    y: player.y + dir.y * (player.radius + 16),
    vx: dir.x * ROCKET_SPEED,
    vy: dir.y * ROCKET_SPEED,
    radius: ROCKET_RADIUS,
    damage: 200,
    distance: 0,
    maxDistance: BAZOOKA_RANGE,
    alive: true,
  });
}

function spawnAcidSpit(current: GameState, enemy: Enemy, target: Vec2) {
  const direction = normalize(subtract(target, enemy));
  const distanceToTarget = Math.max(1, distance(enemy, target));

  current.projectiles.push({
    id: nextId("acid"),
    type: "acid_spit",
    x: enemy.x,
    y: enemy.y,
    vx: direction.x * ACID_SPIT_SPEED,
    vy: direction.y * ACID_SPIT_SPEED,
    radius: ACID_SPIT_RADIUS,
    damage: 0,
    distance: 0,
    maxDistance: distanceToTarget,
    targetX: target.x,
    targetY: target.y,
    alive: true,
  });
}

function spawnAcidPool(current: GameState, x: number, y: number) {
  current.acidPools.push({
    id: nextId("pool"),
    x,
    y,
    radius: ACID_POOL_RADIUS,
    lifetime: 3,
    damagePerSecond: 15,
    slowMultiplier: 0.5,
  });
  spawnParticles(current, x, y, "#62ff8a", 18, 2.5);
}

function explodeRocket(current: GameState, x: number, y: number) {
  for (const enemy of current.enemies) {
    if (!enemy.alive) continue;
    if (distance(enemy, { x, y }) <= EXPLOSION_RADIUS + enemy.radius) {
      damageEnemy(current, enemy, 200);
    }
  }

  current.cameraShake = Math.max(current.cameraShake, 1);
  spawnParticles(current, x, y, "#ffb25c", 42, 4.8);
  sfxExplosion();
}

function spawnEnemy(current: GameState) {
  const edge = pickEdge();
  const spawn = spawnPointOnEdge(edge);
  const type = pickEnemyType(current.time);

  const enemy: Enemy = {
    id: nextId("enemy"),
    type,
    x: spawn.x,
    y: spawn.y,
    health: 100,
    maxHealth: 100,
    speed: 64,
    radius: 20,
    attackTimer: rand(0.15, 0.8),
    hurtFlash: 0,
    alive: true,
  };

    if (type === "normal") {
    enemy.health = 100;
    enemy.maxHealth = 100;
    enemy.speed = 72;
    enemy.radius = 21;
    enemy.visualAngle = Math.atan2(CANVAS_H / 2 - spawn.y, CANVAS_W / 2 - spawn.x);
    enemy.gaitPhase = rand(0, Math.PI * 2);
    enemy.idlePhase = rand(0, Math.PI * 2);
    enemy.attackAnim = 0;
    enemy.attackDidHit = false;
    enemy.hitAnim = 0;
    enemy.deathAnim = 0;
    enemy.corpseFade = 0;
    enemy.deathFlip = Math.random() < 0.5 ? -1 : 1;
  }

  if (type === "acid") {
    enemy.health = 50;
    enemy.maxHealth = 50;
    enemy.speed = 46;
    enemy.radius = 18;
    enemy.visualAngle = Math.atan2(CANVAS_H / 2 - spawn.y, CANVAS_W / 2 - spawn.x);
    enemy.gaitPhase = rand(0, Math.PI * 2);
    enemy.idlePhase = rand(0, Math.PI * 2);
    enemy.attackAnim = 0;
    enemy.attackDidHit = false;
    enemy.hitAnim = 0;
    enemy.deathAnim = 0;
    enemy.corpseFade = 0;
    enemy.deathFlip = Math.random() < 0.5 ? -1 : 1;
    enemy.state = "approaching";
    enemy.edge = edge;
    enemy.anchorX = edge === "left" ? ACID_STOP_DISTANCE : edge === "right" ? CANVAS_W - ACID_STOP_DISTANCE : clamp(spawn.x, 60, CANVAS_W - 60);
    enemy.anchorY = edge === "top" ? ACID_STOP_DISTANCE : edge === "bottom" ? CANVAS_H - ACID_STOP_DISTANCE : clamp(spawn.y, 60, CANVAS_H - 60);
    enemy.attackTimer = 1.8;
  }

  if (type === "ninja") {
    enemy.health = 120;
    enemy.maxHealth = 120;
    enemy.speed = 168;
    enemy.radius = 17;
    enemy.backDistance = rand(50, 80);
    enemy.zigzagPhase = rand(0, Math.PI * 2);
    enemy.attackTimer = rand(0.5, 1.4);
  }

  if (type === "tank") {
    enemy.health = 250;
    enemy.maxHealth = 250;
    enemy.speed = 42;
    enemy.radius = 28;
    enemy.attackTimer = rand(0.8, 1.8);
    enemy.windupTimer = 0;
  }

  current.enemies.push(enemy);
}

function spawnBonus(current: GameState) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = rand(80, CANVAS_W - 80);
    const y = rand(80, CANVAS_H - 80);

    if (distance({ x, y }, current.player) < 140) continue;
    if (current.enemies.some((enemy) => enemy.alive && distance(enemy, { x, y }) < enemy.radius + 36)) continue;

    current.bonuses.push({
      id: nextId("bonus"),
      type: pickBonusType(),
      x,
      y,
      radius: 18,
      lifetime: 5,
      bobPhase: rand(0, Math.PI * 2),
    });
    return;
  }
}

function applyBonus(current: GameState, type: BonusType) {
  const player = current.player;

  if (type === "small_medkit") {
    player.health = Math.min(player.maxHealth, player.health + 50);
    showBanner(current, "MEDKIT +50");
  }

  if (type === "big_medkit") {
    player.health = Math.min(player.maxHealth, player.health + 100);
    showBanner(current, "MEDKIT +100");
  }

  if (type === "speed") {
    player.speedBoostTimer = 20;
    showBanner(current, "ADRENALINE SURGE");
  }

  if (type === "shield") {
    player.shieldTimer = 10;
    player.stunTimer = 0;
    showBanner(current, "SHIELD ONLINE");
  }

  if (type === "airstrike") {
    const targetHalf = player.x < CANVAS_W / 2 ? "right" : "left";
    current.airstrikeSide = targetHalf;
    current.airstrikeTimer = 1.4;

    for (const enemy of current.enemies) {
      if (!enemy.alive) continue;
      if ((targetHalf === "right" && enemy.x >= CANVAS_W / 2) || (targetHalf === "left" && enemy.x < CANVAS_W / 2)) {
        killEnemy(current, enemy, "#ff8a64");
      }
    }

    showBanner(current, "AIRSTRIKE INBOUND");
  }
}

function applyPlayerHit(
  current: GameState,
  damage: number,
  options: { stun?: number; shake?: number; silent?: boolean } = {},
) {
  const player = current.player;
  if (player.shieldTimer > 0) return;

  player.health = Math.max(0, player.health - damage);
  if (options.stun) {
    player.stunTimer = Math.max(player.stunTimer, options.stun);
  }
  if (options.shake) {
    current.cameraShake = Math.max(current.cameraShake, options.shake);
  }
  if (!options.silent) {
    sfxHit();
  }
}

function damageEnemy(current: GameState, enemy: Enemy, damage: number) {
  enemy.health -= damage;
  enemy.hurtFlash = 1;
  enemy.hitAnim = enemy.type === "normal" || enemy.type === "acid" ? 0.22 : enemy.hitAnim;
  spawnParticles(current, enemy.x, enemy.y, enemyBloodColor(enemy.type), 6, 1.2);
  if (enemy.health <= 0) {
    killEnemy(current, enemy, enemyBloodColor(enemy.type));
  }
}

function killEnemy(current: GameState, enemy: Enemy, color: string) {
  if (!enemy.alive || enemy.isDying) return;
  current.kills += 1;
  if (enemy.type === "normal" || enemy.type === "acid") {
    enemy.isDying = true;
    enemy.deathAnim = enemy.type === "acid" ? ACID_DEATH_ANIM_DURATION : 0.62;
    enemy.corpseFade = 0.55;
    enemy.attackAnim = 0;
    enemy.attackDidHit = true;
    enemy.hitAnim = 0.18;
    spawnParticles(current, enemy.x, enemy.y, color, enemy.type === "acid" ? 16 : 14, enemy.type === "acid" ? 2.9 : 2.6);
    return;
  }

  enemy.alive = false;
  spawnParticles(current, enemy.x, enemy.y, color, enemy.type === "tank" ? 22 : 12, enemy.type === "tank" ? 3.6 : 2.4);
  if (enemy.type === "tank") {
    sfxExplosion();
  }
}

function finishRun() {
  state.status = "game_over";
  state.result = {
    score: Math.max(1, state.score),
    durationMs: Math.round(state.time * 1000),
    survivalSeconds: Math.round(state.time),
    kills: state.kills,
    weapon: state.player.currentWeapon,
    reason: "death",
  };
  state.bannerText = "";
  state.bannerTimer = 0;
  hudData = snapshotHud(state);
  sfxGameOver();
  onEndCallback?.(state.result);
}

function renderFrame(renderingContext: CanvasRenderingContext2D, current: GameState, frameDt: number) {
  renderingContext.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const shakeX = current.cameraShake > 0 ? (Math.random() - 0.5) * 10 * current.cameraShake : 0;
  const shakeY = current.cameraShake > 0 ? (Math.random() - 0.5) * 10 * current.cameraShake : 0;

  renderingContext.save();
  renderingContext.translate(shakeX, shakeY);

  drawBackground(renderingContext, current.time);

  if (current.airstrikeSide && current.airstrikeTimer > 0) {
    drawAirstrikeWarning(renderingContext, current.airstrikeSide, current.airstrikeTimer);
  }

  for (const pool of current.acidPools) {
    drawAcidPool(renderingContext, pool);
  }

  for (const bonus of current.bonuses) {
    drawBonus(renderingContext, bonus, current.time);
  }

  for (const projectile of current.projectiles) {
    drawProjectile(renderingContext, projectile);
  }

  for (const enemy of current.enemies) {
    drawEnemy(renderingContext, enemy);
  }

  drawPlayer(renderingContext, current.player);

  for (const particle of current.particles) {
    drawParticle(renderingContext, particle);
  }

  renderingContext.restore();

  if (current.status === "paused" || current.status === "game_over") {
    renderingContext.fillStyle = current.status === "paused" ? "rgba(4, 8, 6, 0.35)" : "rgba(22, 6, 4, 0.42)";
    renderingContext.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  if (current.status === "menu") {
    renderingContext.fillStyle = "rgba(4, 8, 6, 0.4)";
    renderingContext.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  if (frameDt > 0) {
    // no-op keeps lint quiet for the parameter while still allowing future motion effects.
  }
}

function drawBackground(renderingContext: CanvasRenderingContext2D, time: number) {
  const gradient = renderingContext.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  gradient.addColorStop(0, "#101712");
  gradient.addColorStop(0.45, "#16211a");
  gradient.addColorStop(1, "#050807");
  renderingContext.fillStyle = gradient;
  renderingContext.fillRect(0, 0, CANVAS_W, CANVAS_H);

  renderingContext.save();
  renderingContext.strokeStyle = "rgba(142, 196, 132, 0.08)";
  renderingContext.lineWidth = 1;
  for (let x = 24; x < CANVAS_W; x += 64) {
    renderingContext.beginPath();
    renderingContext.moveTo(x, 0);
    renderingContext.lineTo(x + Math.sin(time * 0.5 + x * 0.02) * 12, CANVAS_H);
    renderingContext.stroke();
  }
  for (let y = 20; y < CANVAS_H; y += 64) {
    renderingContext.beginPath();
    renderingContext.moveTo(0, y);
    renderingContext.lineTo(CANVAS_W, y + Math.cos(time * 0.4 + y * 0.02) * 10);
    renderingContext.stroke();
  }
  renderingContext.restore();

  renderingContext.save();
  const vignette = renderingContext.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H / 2,
    120,
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_W * 0.58,
  );
  vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  renderingContext.fillStyle = vignette;
  renderingContext.fillRect(0, 0, CANVAS_W, CANVAS_H);
  renderingContext.restore();
}

function drawAirstrikeWarning(renderingContext: CanvasRenderingContext2D, side: "left" | "right", timer: number) {
  const alpha = 0.14 + Math.sin(timer * 20) * 0.05;
  const x = side === "left" ? 0 : CANVAS_W / 2;
  renderingContext.save();
  renderingContext.fillStyle = `rgba(255, 96, 72, ${alpha})`;
  renderingContext.fillRect(x, 0, CANVAS_W / 2, CANVAS_H);

  renderingContext.strokeStyle = "rgba(255, 208, 186, 0.25)";
  for (let y = -CANVAS_H; y < CANVAS_H; y += 42) {
    renderingContext.beginPath();
    renderingContext.moveTo(x, y);
    renderingContext.lineTo(x + CANVAS_W / 2, y + CANVAS_W / 3);
    renderingContext.stroke();
  }
  renderingContext.restore();
}

function drawPlayer(renderingContext: CanvasRenderingContext2D, player: Player) {
  renderingContext.save();
  renderingContext.translate(player.x, player.y);
  renderingContext.rotate(player.angle);

  if (player.shieldTimer > 0) {
    renderingContext.beginPath();
    renderingContext.arc(0, 0, player.radius + 8 + Math.sin(player.shieldTimer * 8) * 2, 0, Math.PI * 2);
    renderingContext.strokeStyle = "rgba(92, 215, 255, 0.55)";
    renderingContext.lineWidth = 3;
    renderingContext.stroke();
  }

  renderingContext.fillStyle = "#d4dbc8";
  renderingContext.beginPath();
  renderingContext.arc(0, 0, player.radius, 0, Math.PI * 2);
  renderingContext.fill();

  renderingContext.fillStyle = player.stunTimer > 0 ? "#ff7a57" : "#ffcf8d";
  renderingContext.beginPath();
  renderingContext.moveTo(8, 0);
  renderingContext.lineTo(player.radius + 20, -8);
  renderingContext.lineTo(player.radius + 20, 8);
  renderingContext.closePath();
  renderingContext.fill();

  renderingContext.fillStyle = "#1f2a1f";
  renderingContext.beginPath();
  renderingContext.arc(-5, -5, 3, 0, Math.PI * 2);
  renderingContext.arc(-5, 5, 3, 0, Math.PI * 2);
  renderingContext.fill();

  renderingContext.restore();
}

function drawEnemy(renderingContext: CanvasRenderingContext2D, enemy: Enemy) {
  renderingContext.save();
  renderingContext.translate(enemy.x, enemy.y);

  if (enemy.type === "normal") {
    drawNormalZombieSprite(renderingContext, enemy);
  }

  if (enemy.type === "acid") {
    drawAcidZombieSprite(renderingContext, enemy);
  }

  if (enemy.type === "ninja") {
    renderingContext.fillStyle = enemy.hurtFlash > 0 ? "#ffc0c0" : "#252525";
    renderingContext.beginPath();
    renderingContext.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    renderingContext.fill();
    renderingContext.strokeStyle = "#ff6f61";
    renderingContext.lineWidth = 3;
    renderingContext.beginPath();
    renderingContext.moveTo(-enemy.radius, enemy.radius - 3);
    renderingContext.lineTo(enemy.radius + 8, -enemy.radius + 3);
    renderingContext.stroke();
  }

  if (enemy.type === "tank") {
    renderingContext.fillStyle = enemy.hurtFlash > 0 ? "#ffd3b8" : "#8b6250";
    renderingContext.beginPath();
    renderingContext.roundRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2, 8);
    renderingContext.fill();

    renderingContext.fillStyle = "#2b1b16";
    renderingContext.fillRect(enemy.radius - 3, -8, 20, 16);
    renderingContext.beginPath();
    renderingContext.arc(enemy.radius + 18, 0, 10, 0, Math.PI * 2);
    renderingContext.fill();
  }

  renderingContext.restore();
}

function drawProjectile(renderingContext: CanvasRenderingContext2D, projectile: Projectile) {
  renderingContext.save();
  renderingContext.translate(projectile.x, projectile.y);

  if (projectile.type === "bullet") {
    renderingContext.fillStyle = "#ffe6a1";
    renderingContext.beginPath();
    renderingContext.arc(0, 0, projectile.radius, 0, Math.PI * 2);
    renderingContext.fill();
  }

  if (projectile.type === "acid_spit") {
    renderingContext.fillStyle = "#6cff9d";
    renderingContext.beginPath();
    renderingContext.arc(0, 0, projectile.radius, 0, Math.PI * 2);
    renderingContext.fill();
  }

  if (projectile.type === "rocket") {
    renderingContext.rotate(Math.atan2(projectile.vy, projectile.vx));
    renderingContext.fillStyle = "#f9b065";
    renderingContext.beginPath();
    renderingContext.moveTo(18, 0);
    renderingContext.lineTo(-10, -8);
    renderingContext.lineTo(-6, 0);
    renderingContext.lineTo(-10, 8);
    renderingContext.closePath();
    renderingContext.fill();

    renderingContext.fillStyle = "rgba(255, 136, 68, 0.55)";
    renderingContext.beginPath();
    renderingContext.moveTo(-8, 0);
    renderingContext.lineTo(-22, -6);
    renderingContext.lineTo(-22, 6);
    renderingContext.closePath();
    renderingContext.fill();
  }

  renderingContext.restore();
}

function drawBonus(renderingContext: CanvasRenderingContext2D, bonus: Bonus, time: number) {
  const y = bonus.y + Math.sin(time * 2 + bonus.bobPhase) * 4;
  renderingContext.save();
  renderingContext.translate(bonus.x, y);
  renderingContext.fillStyle = bonusColor(bonus.type);
  renderingContext.strokeStyle = "rgba(255, 255, 255, 0.5)";
  renderingContext.lineWidth = 2;

  renderingContext.beginPath();
  renderingContext.arc(0, 0, bonus.radius, 0, Math.PI * 2);
  renderingContext.fill();
  renderingContext.stroke();

  renderingContext.fillStyle = "#112211";
  renderingContext.font = "700 18px 'IBM Plex Sans', sans-serif";
  renderingContext.textAlign = "center";
  renderingContext.textBaseline = "middle";
  renderingContext.fillText(bonusGlyph(bonus.type), 0, 1);
  renderingContext.restore();
}

function drawAcidPool(renderingContext: CanvasRenderingContext2D, pool: AcidPool) {
  const gradient = renderingContext.createRadialGradient(pool.x, pool.y, 6, pool.x, pool.y, pool.radius);
  gradient.addColorStop(0, "rgba(121, 255, 138, 0.55)");
  gradient.addColorStop(1, "rgba(28, 86, 29, 0.12)");
  renderingContext.fillStyle = gradient;
  renderingContext.beginPath();
  renderingContext.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
  renderingContext.fill();
}

function drawParticle(renderingContext: CanvasRenderingContext2D, particle: Particle) {
  const alpha = particle.maxLife > 0 ? particle.life / particle.maxLife : 0;
  renderingContext.save();
  renderingContext.globalAlpha = alpha;
  renderingContext.fillStyle = particle.color;
  renderingContext.beginPath();
  renderingContext.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
  renderingContext.fill();
  renderingContext.restore();
}

function spawnParticles(current: GameState, x: number, y: number, color: string, count: number, size: number) {
  for (let index = 0; index < count; index += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(50, 240);
    current.particles.push({
      id: nextId("particle"),
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: rand(size * 0.08, size * 0.24),
      life: rand(0.25, 0.7),
      maxLife: rand(0.25, 0.7),
      color,
    });
  }
}

function pickEnemyType(time: number): EnemyType {
  const roll = Math.random() * 100;

  if (time <= 30) {
    return roll < 85 ? "normal" : "acid";
  }
  if (time <= 90) {
    if (roll < 55) return "normal";
    if (roll < 75) return "acid";
    return "ninja";
  }
  if (time <= 120) {
    if (roll < 45) return "normal";
    if (roll < 65) return "acid";
    if (roll < 85) return "ninja";
    return "tank";
  }

  if (roll < 40) return "normal";
  if (roll < 60) return "acid";
  if (roll < 80) return "ninja";
  return "tank";
}

function pickBonusType(): BonusType {
  const roll = Math.random() * 100;
  if (roll < 40) return "small_medkit";
  if (roll < 65) return "big_medkit";
  if (roll < 83) return "speed";
  if (roll < 95) return "shield";
  return "airstrike";
}

function enemyCapForTime(time: number) {
  if (time <= 30) return 2;
  if (time <= 60) return 5;
  if (time <= 90) return 8;
  if (time <= 120) return 12;
  if (time <= 150) return 15;
  return 20;
}

function enemySpawnIntervalForTime(time: number): [number, number] {
  if (time <= 30) return [3, 5];
  if (time <= 60) return [2, 4];
  if (time <= 90) return [1.5, 3];
  if (time <= 120) return [1, 2];
  return [0.8, 1.5];
}

function weaponForTime(time: number): WeaponType {
  if (time <= 30) return "pistol";
  if (time <= 90) return "machine_gun";
  if (time <= 120) return "shotgun";
  return "bazooka";
}

function weaponName(weapon: WeaponType) {
  if (weapon === "pistol") return "PISTOL";
  if (weapon === "machine_gun") return "MACHINE GUN";
  if (weapon === "shotgun") return "SHOTGUN";
  return "BAZOOKA";
}

function computeScore(time: number, kills: number) {
  return Math.max(1, Math.round(time * TIME_SCORE_FACTOR + kills * KILL_SCORE));
}

function resetWeaponFlow(player: Player) {
  player.machineBurstRemaining = 0;
  player.machineBurstTimer = 0;
  player.machineHoldTime = 0;
  player.machineStreamActive = false;
  player.machineStreamTimer = 0;
  player.shotgunCharging = false;
  player.shotgunChargeTime = 0;
  player.bazookaPendingDelay = 0;
}

function cancelShootingFlow(player: Player) {
  player.machineBurstRemaining = 0;
  player.machineBurstTimer = 0;
  player.machineHoldTime = 0;
  player.machineStreamActive = false;
  player.machineStreamTimer = 0;
  player.shotgunCharging = false;
  player.shotgunChargeTime = 0;
}

function clampPlayer(player: Player) {
  player.x = clamp(player.x, player.radius, CANVAS_W - player.radius);
  player.y = clamp(player.y, player.radius, CANVAS_H - player.radius);
}

function showBanner(current: GameState, text: string) {
  current.bannerText = text;
  current.bannerTimer = BANNER_DURATION;
}

function enemyBloodColor(type: EnemyType) {
  if (type === "acid") return "#80ff80";
  if (type === "ninja") return "#ff7b72";
  if (type === "tank") return "#ff9c73";
  return "#b2d56d";
}

function bonusColor(type: BonusType) {
  if (type === "small_medkit") return "#f26b5b";
  if (type === "big_medkit") return "#ff9d5c";
  if (type === "speed") return "#ffd54a";
  if (type === "shield") return "#67d8ff";
  return "#f3f3f3";
}

function bonusGlyph(type: BonusType) {
  if (type === "small_medkit") return "+";
  if (type === "big_medkit") return "++";
  if (type === "speed") return "Z";
  if (type === "shield") return "O";
  return "A";
}

function pickEdge(): EdgeSide {
  const edges: EdgeSide[] = ["top", "right", "bottom", "left"];
  return edges[Math.floor(Math.random() * edges.length)] ?? "top";
}

function spawnPointOnEdge(edge: EdgeSide): Vec2 {
  if (edge === "top") return { x: rand(0, CANVAS_W), y: -32 };
  if (edge === "bottom") return { x: rand(0, CANVAS_W), y: CANVAS_H + 32 };
  if (edge === "left") return { x: -32, y: rand(0, CANVAS_H) };
  return { x: CANVAS_W + 32, y: rand(0, CANVAS_H) };
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function vectorFromAngle(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function length(vector: Vec2) {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector: Vec2): Vec2 {
  const len = length(vector);
  if (len <= 0.0001) return { x: 0, y: 0 };
  return { x: vector.x / len, y: vector.y / len };
}

function perpendicular(vector: Vec2): Vec2 {
  return { x: -vector.y, y: vector.x };
}

function dot(a: Vec2, b: Vec2) {
  return a.x * b.x + a.y * b.y;
}

function distance(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function approachAngle(current: number, target: number, maxStep: number) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

function ensureNormalZombieSpriteAssets() {
  if (normalZombieSpritesRequested || typeof Image === "undefined") {
    return;
  }

  normalZombieSpritesRequested = true;

  for (const strip of Object.values(normalZombieStrips)) {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      strip.loaded = true;
    };
    image.src = strip.path;
    strip.image = image;
  }
}

function ensureAcidZombieSpriteAssets() {
  if (acidZombieSpritesRequested || typeof Image === "undefined") {
    return;
  }

  acidZombieSpritesRequested = true;

  for (const strip of Object.values(acidZombieStrips)) {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      strip.loaded = true;
    };
    image.src = strip.path;
    strip.image = image;
  }
}

function drawNormalZombieSprite(renderingContext: CanvasRenderingContext2D, enemy: Enemy) {
  const animation = getNormalZombieAnimation(enemy);
  const strip = normalZombieStrips[animation.name];

  if (!strip.loaded || !strip.image) {
    drawNormalZombieFallback(renderingContext, enemy);
    return;
  }

  const drawWidth = strip.width * NORMAL_ZOMBIE_DRAW_SCALE;
  const drawHeight = strip.height * NORMAL_ZOMBIE_DRAW_SCALE;
  const rotation = (enemy.visualAngle ?? 0) - NORMAL_ZOMBIE_BASE_FACING;
  const corpseAlpha = enemy.isDying && (enemy.deathAnim ?? 0) <= 0
    ? clamp((enemy.corpseFade ?? 0) / 0.55, 0, 1)
    : 1;

  renderingContext.globalAlpha *= corpseAlpha;
  renderingContext.rotate(rotation);

  if (animation.name === "death" && (enemy.deathFlip ?? 1) < 0) {
    renderingContext.scale(-1, 1);
  }

  renderingContext.imageSmoothingEnabled = true;
  renderingContext.drawImage(
    strip.image,
    animation.frame * strip.width,
    0,
    strip.width,
    strip.height,
    -drawWidth * NORMAL_ZOMBIE_PIVOT_X,
    -drawHeight * NORMAL_ZOMBIE_PIVOT_Y,
    drawWidth,
    drawHeight,
  );
}

function drawAcidZombieSprite(renderingContext: CanvasRenderingContext2D, enemy: Enemy) {
  const animation = getAcidZombieAnimation(enemy);
  const strip = acidZombieStrips[animation.name];

  if (!strip.loaded || !strip.image) {
    drawAcidZombieFallback(renderingContext, enemy);
    return;
  }

  const drawWidth = strip.width * ACID_ZOMBIE_DRAW_SCALE;
  const drawHeight = strip.height * ACID_ZOMBIE_DRAW_SCALE;
  const rotation = (enemy.visualAngle ?? 0) - ACID_ZOMBIE_BASE_FACING;
  const corpseAlpha = enemy.isDying && (enemy.deathAnim ?? 0) <= 0
    ? clamp((enemy.corpseFade ?? 0) / 0.55, 0, 1)
    : 1;

  renderingContext.globalAlpha *= corpseAlpha;
  renderingContext.rotate(rotation);

  if (animation.name === "death" && (enemy.deathFlip ?? 1) < 0) {
    renderingContext.scale(-1, 1);
  }

  renderingContext.imageSmoothingEnabled = true;
  renderingContext.drawImage(
    strip.image,
    animation.frame * strip.width,
    0,
    strip.width,
    strip.height,
    -drawWidth * ACID_ZOMBIE_PIVOT_X,
    -drawHeight * ACID_ZOMBIE_PIVOT_Y,
    drawWidth,
    drawHeight,
  );
}

function getNormalZombieAnimation(enemy: Enemy): { name: ZombieStripName; frame: number } {
  if (enemy.isDying) {
    const progress = clamp(1 - (enemy.deathAnim ?? 0) / 0.62, 0, 0.999);
    return {
      name: "death",
      frame: Math.min(normalZombieStrips.death.frames - 1, Math.floor(progress * normalZombieStrips.death.frames)),
    };
  }

  if ((enemy.hitAnim ?? 0) > 0) {
    const progress = clamp(1 - (enemy.hitAnim ?? 0) / 0.22, 0, 0.999);
    return {
      name: "hit",
      frame: Math.min(normalZombieStrips.hit.frames - 1, Math.floor(progress * normalZombieStrips.hit.frames)),
    };
  }

  if ((enemy.attackAnim ?? 0) > 0) {
    const progress = clamp(1 - (enemy.attackAnim ?? 0) / NORMAL_ATTACK_ANIM_DURATION, 0, 0.999);
    return {
      name: "attack",
      frame: Math.min(normalZombieStrips.attack.frames - 1, Math.floor(progress * normalZombieStrips.attack.frames)),
    };
  }

  if (enemy.movingThisTick) {
    const progress = ((enemy.gaitPhase ?? 0) / (Math.PI * 2)) % 1;
    return {
      name: "walk",
      frame: ((Math.floor(progress * normalZombieStrips.walk.frames) % normalZombieStrips.walk.frames) + normalZombieStrips.walk.frames) % normalZombieStrips.walk.frames,
    };
  }

  const progress = ((enemy.idlePhase ?? 0) / (Math.PI * 2)) % 1;
  return {
    name: "idle",
    frame: ((Math.floor(progress * normalZombieStrips.idle.frames) % normalZombieStrips.idle.frames) + normalZombieStrips.idle.frames) % normalZombieStrips.idle.frames,
  };
}

function getAcidZombieAnimation(enemy: Enemy): { name: ZombieStripName; frame: number } {
  if (enemy.isDying) {
    const progress = clamp(1 - (enemy.deathAnim ?? 0) / ACID_DEATH_ANIM_DURATION, 0, 0.999);
    return {
      name: "death",
      frame: Math.min(acidZombieStrips.death.frames - 1, Math.floor(progress * acidZombieStrips.death.frames)),
    };
  }

  if ((enemy.hitAnim ?? 0) > 0) {
    const progress = clamp(1 - (enemy.hitAnim ?? 0) / 0.22, 0, 0.999);
    return {
      name: "hit",
      frame: Math.min(acidZombieStrips.hit.frames - 1, Math.floor(progress * acidZombieStrips.hit.frames)),
    };
  }

  if ((enemy.attackAnim ?? 0) > 0) {
    const progress = clamp(1 - (enemy.attackAnim ?? 0) / ACID_ATTACK_ANIM_DURATION, 0, 0.999);
    return {
      name: "attack",
      frame: Math.min(acidZombieStrips.attack.frames - 1, Math.floor(progress * acidZombieStrips.attack.frames)),
    };
  }

  if (enemy.movingThisTick) {
    const progress = ((enemy.gaitPhase ?? 0) / (Math.PI * 2)) % 1;
    return {
      name: "walk",
      frame: ((Math.floor(progress * acidZombieStrips.walk.frames) % acidZombieStrips.walk.frames) + acidZombieStrips.walk.frames) % acidZombieStrips.walk.frames,
    };
  }

  const progress = ((enemy.idlePhase ?? 0) / (Math.PI * 2)) % 1;
  return {
    name: "idle",
    frame: ((Math.floor(progress * acidZombieStrips.idle.frames) % acidZombieStrips.idle.frames) + acidZombieStrips.idle.frames) % acidZombieStrips.idle.frames,
  };
}

function drawAcidZombieFallback(renderingContext: CanvasRenderingContext2D, enemy: Enemy) {
  const corpseAlpha = enemy.isDying && (enemy.deathAnim ?? 0) <= 0
    ? clamp((enemy.corpseFade ?? 0) / 0.55, 0, 1)
    : 1;

  renderingContext.globalAlpha *= corpseAlpha;
  renderingContext.fillStyle = "rgba(111, 255, 130, 0.16)";
  renderingContext.beginPath();
  renderingContext.arc(0, 0, enemy.radius + 10, 0, Math.PI * 2);
  renderingContext.fill();

  renderingContext.fillStyle = enemy.hurtFlash > 0 ? "#fff3cf" : "#7df27d";
  renderingContext.beginPath();
  renderingContext.arc(0, 0, enemy.radius, 0, Math.PI * 2);
  renderingContext.fill();
}

function drawNormalZombieFallback(renderingContext: CanvasRenderingContext2D, enemy: Enemy) {
  const outline = "#11120d";
  const skinBase = enemy.hurtFlash > 0 ? "#f0c4b5" : "#cfb393";
  const jacketBase = enemy.hurtFlash > 0 ? "#95a171" : "#657457";
  const pantsBase = enemy.hurtFlash > 0 ? "#78665d" : "#4e433b";
  const bootsBase = "#342920";
  const deathDuration = 0.62;
  const deathProgress = enemy.isDying ? 1 - (enemy.deathAnim ?? 0) / deathDuration : 0;
  const corpseAlpha = enemy.isDying && (enemy.deathAnim ?? 0) <= 0 ? clamp((enemy.corpseFade ?? 0) / 0.55, 0, 1) : 1;
  const gait = Math.sin(enemy.gaitPhase ?? 0);
  const counterGait = Math.sin((enemy.gaitPhase ?? 0) + Math.PI);
  const sway = gait * 1.8;
  const idle = Math.sin(enemy.idlePhase ?? 0);
  const hitKick = clamp((enemy.hitAnim ?? 0) / 0.22, 0, 1);

  let attackReach = 0;
  let armSpread = 0;
  let torsoLunge = 0;

  if ((enemy.attackAnim ?? 0) > 0) {
    const progress = 1 - (enemy.attackAnim ?? 0) / NORMAL_ATTACK_ANIM_DURATION;
    if (progress < 0.28) {
      const t = progress / 0.28;
      attackReach = -8 * t;
      armSpread = 4 * t;
    } else if (progress < 0.62) {
      const t = (progress - 0.28) / 0.34;
      attackReach = -8 + 20 * t;
      armSpread = 4 + 2 * t;
      torsoLunge = 7 * t;
    } else {
      const t = (progress - 0.62) / 0.38;
      attackReach = 12 * (1 - t);
      armSpread = 6 * (1 - t);
      torsoLunge = 7 * (1 - t);
    }
  }

  renderingContext.globalAlpha *= corpseAlpha;
  renderingContext.rotate((enemy.visualAngle ?? 0) + deathProgress * (enemy.deathFlip ?? 1) * 0.8);

  const shadowScale = 1 - deathProgress * 0.28;
  renderingContext.save();
  renderingContext.translate(-4 - deathProgress * 8, 10 + deathProgress * 6);
  renderingContext.scale(1, 0.7 * shadowScale);
  renderingContext.fillStyle = `rgba(0, 0, 0, ${0.18 * corpseAlpha})`;
  renderingContext.beginPath();
  renderingContext.ellipse(0, 0, 26, 18, 0, 0, Math.PI * 2);
  renderingContext.fill();
  renderingContext.restore();

  renderingContext.translate(
    -deathProgress * 12,
    deathProgress * (enemy.deathFlip ?? 1) * 10 + idle * 0.9 - hitKick * 3,
  );
  renderingContext.scale(1, 1 - deathProgress * 0.22);

  const armForward = 14 + attackReach - deathProgress * 10;
  const torsoTilt = sway * (enemy.isDying ? 0.1 : 1) + hitKick * 2;
  const headBob = counterGait * 1.8 + idle * 1.2 - hitKick * 1.5 - deathProgress * 6;
  const legFront = 16 + gait * 4 - deathProgress * 3;
  const legBack = -15 + counterGait * 4 + deathProgress * 2;
  const bodyWidth = 23 + deathProgress * 3;
  const bodyHeight = 15 - deathProgress * 3;

  renderingContext.lineJoin = "round";
  renderingContext.lineCap = "round";
  renderingContext.lineWidth = 4;
  renderingContext.strokeStyle = outline;

  renderingContext.fillStyle = bootsBase;
  renderingContext.beginPath();
  renderingContext.ellipse(-15 + legBack, -7 + counterGait * 2, 7, 5, -0.4, 0, Math.PI * 2);
  renderingContext.ellipse(-13 + legFront, 10 + gait * 2, 7, 5, 0.2, 0, Math.PI * 2);
  renderingContext.fill();
  renderingContext.stroke();

  renderingContext.fillStyle = pantsBase;
  renderingContext.beginPath();
  renderingContext.moveTo(-10, -10);
  renderingContext.quadraticCurveTo(-18 + counterGait * 1.5, -11, -18 + legBack * 0.2, -5 + counterGait * 2);
  renderingContext.lineTo(-12 + legBack * 0.35, -1);
  renderingContext.quadraticCurveTo(-4, -2, 0, -1);
  renderingContext.quadraticCurveTo(-7 + gait, 6, -13 + legFront * 0.2, 12 + gait * 1.5);
  renderingContext.lineTo(-5 + legFront * 0.25, 13);
  renderingContext.quadraticCurveTo(5, 10, 8, 2);
  renderingContext.lineTo(0, -10);
  renderingContext.closePath();
  renderingContext.fill();
  renderingContext.stroke();

  renderingContext.fillStyle = jacketBase;
  renderingContext.beginPath();
  renderingContext.roundRect(-12 + torsoLunge * 0.25, -bodyWidth / 1.8, 30, bodyWidth, bodyHeight);
  renderingContext.fill();
  renderingContext.stroke();

  renderingContext.fillStyle = "#516046";
  renderingContext.beginPath();
  renderingContext.moveTo(-6, -10);
  renderingContext.lineTo(5, -13);
  renderingContext.lineTo(16, -4);
  renderingContext.lineTo(9, 0);
  renderingContext.lineTo(2, -2);
  renderingContext.closePath();
  renderingContext.fill();
  renderingContext.stroke();

  renderingContext.fillStyle = skinBase;
  renderingContext.beginPath();
  renderingContext.moveTo(1 + armForward * 0.18, -10 - armSpread);
  renderingContext.quadraticCurveTo(14 + armForward * 0.42, -18 - armSpread * 1.2, 26 + armForward, -14 - armSpread);
  renderingContext.quadraticCurveTo(32 + armForward, -10 - armSpread, 33 + armForward, -4 - armSpread * 0.5);
  renderingContext.quadraticCurveTo(28 + armForward * 0.95, -1 - armSpread * 0.3, 23 + armForward * 0.78, -3 - armSpread * 0.2);
  renderingContext.quadraticCurveTo(11 + armForward * 0.4, -5, 4, -4);
  renderingContext.closePath();
  renderingContext.fill();
  renderingContext.stroke();

  renderingContext.beginPath();
  renderingContext.moveTo(0 + armForward * 0.14, 10 + armSpread * 0.7);
  renderingContext.quadraticCurveTo(13 + armForward * 0.32, 18 + armSpread, 24 + armForward * 0.95, 15 + armSpread * 0.8);
  renderingContext.quadraticCurveTo(31 + armForward, 12 + armSpread * 0.7, 34 + armForward, 6 + armSpread * 0.4);
  renderingContext.quadraticCurveTo(31 + armForward * 0.92, 0 + armSpread * 0.3, 24 + armForward * 0.7, 1 + armSpread * 0.1);
  renderingContext.quadraticCurveTo(10 + armForward * 0.34, 2, 3, 4);
  renderingContext.closePath();
  renderingContext.fill();
  renderingContext.stroke();

  renderingContext.fillStyle = skinBase;
  renderingContext.beginPath();
  renderingContext.ellipse(19 + torsoLunge * 0.55, 0, 11, 13, 0.05, 0, Math.PI * 2);
  renderingContext.fill();
  renderingContext.stroke();

  renderingContext.fillStyle = "#4c3528";
  renderingContext.beginPath();
  renderingContext.ellipse(20, 0, 10.5, 8.5, 0.04, Math.PI, Math.PI * 2);
  renderingContext.fill();

  renderingContext.fillStyle = outline;
  renderingContext.beginPath();
  renderingContext.arc(21.5, -4.2 + headBob * 0.1, 1.2, 0, Math.PI * 2);
  renderingContext.arc(21.5, 4.2 - headBob * 0.1, 1.2, 0, Math.PI * 2);
  renderingContext.fill();
  renderingContext.fillRect(24, -2.8, 5.2, 5.6);

  renderingContext.strokeStyle = "#8d3328";
  renderingContext.lineWidth = 2.5;
  renderingContext.beginPath();
  renderingContext.moveTo(6, -13);
  renderingContext.lineTo(12, -9);
  renderingContext.moveTo(8, 11);
  renderingContext.lineTo(14, 8);
  renderingContext.moveTo(18 + armForward * 0.45, -13 - armSpread * 0.9);
  renderingContext.lineTo(24 + armForward * 0.65, -15 - armSpread * 0.8);
  renderingContext.moveTo(18 + armForward * 0.4, 13 + armSpread * 0.6);
  renderingContext.lineTo(25 + armForward * 0.62, 12 + armSpread * 0.55);
  renderingContext.stroke();

  if (hitKick > 0) {
    renderingContext.strokeStyle = `rgba(255, 114, 90, ${0.35 * hitKick})`;
    renderingContext.lineWidth = 6;
    renderingContext.beginPath();
    renderingContext.ellipse(6, 0, 26, 19, 0, 0, Math.PI * 2);
    renderingContext.stroke();
  }
}
