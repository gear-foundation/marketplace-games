import { CANVAS_H, CANVAS_W } from "./constants";
import { attachInput, clearInputFrame, detachInput, getInput, resetInput } from "./input";
import {
  sfxAcid,
  sfxExplosion,
  sfxFlamethrower,
  sfxGameOver,
  sfxHit,
  sfxMachineGun,
  sfxPickup,
  sfxPistol,
  sfxRocketLaunch,
  sfxWeaponUpgrade,
} from "./sound";
import type { GameEndPayload, GameStatus, HudData, LoadingData, WeaponType } from "./types";

type EnemyType = "normal" | "acid" | "ninja" | "tank";
type BonusType = "small_medkit" | "big_medkit" | "speed" | "shield" | "airstrike";
type ProjectileType = "bullet" | "rocket" | "acid_spit" | "flame";
type EdgeSide = "top" | "bottom" | "left" | "right";
type EnemyState =
  | "approaching"
  | "perched"
  | "warning"
  | "attacking"
  | "jump_back"
  | "windup"
  | "smash"
  | "recovery"
  | "roar";
type PlayerWeaponStripKey = "pistol" | "rifle" | "bazooka" | "flamethrower";
type PlayerWeaponStripName = "idle" | "walk" | "shoot";
type PlayerSharedStripName = "hit" | "stunned" | "death";
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
  bazookaCooldown: number;
  bazookaPendingDelay: number;
  bazookaPendingAngle: number;
  flamethrowerStreamActive: boolean;
  flamethrowerTickTimer: number;
  idlePhase: number;
  movePhase: number;
  movingAnim: boolean;
  shootAnim: number;
  hitAnim: number;
  deathAnim: number;
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
  state?: EnemyState;
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
  dashTimer?: number;
  recoveryTimer?: number;
  impactTimer?: number;
  jumpVx?: number;
  jumpVy?: number;
  didRoar?: boolean;
  carriedByProjectileId?: string;
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
  harpoonedEnemyIds?: string[];
  hitEnemyIds?: string[];
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
const LOW_POWER_FRAME_MS = 1000 / 12;
const MAX_CANVAS_DPR = 1.5;
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
const NINJA_WARNING_DURATION = 0.22;
const NINJA_ATTACK_ANIM_DURATION = 0.38;
const NINJA_ATTACK_HIT_MOMENT = 0.2;
const NINJA_JUMP_BACK_DURATION = 0.32;
const NINJA_DEATH_ANIM_DURATION = 0.78;
const NINJA_ZIGZAG_FREQUENCY = 8.4;
const NINJA_ZIGZAG_LATERAL_SPEED = 132;
const NINJA_ZIGZAG_DIRECTION_BLEND = 0.52;
const NINJA_JUMP_BACK_DISTANCE_MULTIPLIER = 4;
const TANK_WINDUP_DURATION = 0.7;
const TANK_SMASH_ANIM_DURATION = 0.48;
const TANK_SMASH_HIT_MOMENT = 0.22;
const TANK_RECOVERY_DURATION = 0.72;
const TANK_ROAR_DURATION = 0.68;
const TANK_DEATH_ANIM_DURATION = 1.05;
const TANK_IMPACT_FX_DURATION = 0.24;
const NINJA_ATTACK_RANGE = 40;
const TANK_ATTACK_RANGE = 74;
const TANK_ROAR_TRIGGER_RANGE = 260;
const ACID_STOP_DISTANCE = CANVAS_H * 0.08;
const ACID_POOL_RADIUS = CANVAS_H * 0.055;
const BAZOOKA_RANGE = CANVAS_H / 2;
const FLAMETHROWER_RANGE = CANVAS_H * 0.42;
const FLAMETHROWER_SPEED = 540;
const FLAMETHROWER_INTERVAL = 0.075;
const FLAMETHROWER_DAMAGE = 34;
const FLAMETHROWER_RADIUS = 20;
const EXPLOSION_RADIUS = CANVAS_H * 0.1;
const BANNER_DURATION = 2.1;
const MACHINE_STREAM_INTERVAL = 0.12;
const ASSET_PRELOAD_LEAD_TIME = 6;
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
const PLAYER_SPRITE_BASE_FACING = Math.PI / 2;
const PLAYER_SPRITE_FRAME_W = 320;
const PLAYER_SPRITE_FRAME_H = 320;
const PLAYER_SPRITE_DRAW_SCALE = 0.38;
const PLAYER_SPRITE_PIVOT_X = 0.5;
const PLAYER_SPRITE_PIVOT_Y = 0.5;
const NINJA_ZOMBIE_BASE_FACING = Math.PI / 2;
const NINJA_ZOMBIE_FRAME_W = 448;
const NINJA_ZOMBIE_FRAME_H = 448;
const NINJA_ZOMBIE_DRAW_SCALE = 0.36;
const NINJA_ZOMBIE_PIVOT_X = 0.5;
const NINJA_ZOMBIE_PIVOT_Y = 0.48;
const TANK_ZOMBIE_BASE_FACING = Math.PI / 2;
const TANK_ZOMBIE_FRAME_W = 768;
const TANK_ZOMBIE_FRAME_H = 768;
const TANK_ZOMBIE_DRAW_SCALE = 0.42;
const TANK_ZOMBIE_PIVOT_X = 0.5;
const TANK_ZOMBIE_PIVOT_Y = 0.48;
const SMALL_MEDKIT_DRAW_SIZE = 42;
const BIG_MEDKIT_DRAW_SIZE = 50;
const SHIELD_BONUS_DRAW_SIZE = 46;
const AIRSTRIKE_BONUS_DRAW_SIZE = 50;
const SPEED_BONUS_DRAW_SIZE = 46;
const ACID_POOL_ART_SCALE = 2.15;
const ACID_SPIT_DRAW_SIZE = 52;
const FLAMETHROWER_STREAM_DRAW_SIZE = 92;
const FLAMETHROWER_STREAM_FRAME_W = 320;
const FLAMETHROWER_STREAM_FRAME_H = 320;
const IMAGE_LOAD_RETRY_DELAYS_MS = [350, 1_200, 3_000] as const;
const PUBLIC_ASSET_VERSION = "20260501-art-crop-v2";

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

type PlayerStrip = ZombieStrip;
type ImageSourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type ImageAsset = {
  path: string;
  image: HTMLImageElement | null;
  loaded: boolean;
  source?: ImageSourceRect;
};

type LoadableImageAsset = ZombieStrip | ImageAsset;

type NinjaStripName = "idle" | "run" | "dash" | "attack" | "jump_back" | "hit" | "death" | "warning";
type TankStripName = "idle" | "walk" | "attack_windup" | "smash" | "recovery" | "hit" | "death" | "roar" | "hammer_impact_fx";

const normalZombieStrips: Record<ZombieStripName, ZombieStrip> = {
  idle: {
    path: "/assets/zombies/level1/zombie-level1-idle.webp",
    frames: 5,
    fps: 5,
    width: NORMAL_ZOMBIE_FRAME_W,
    height: NORMAL_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  walk: {
    path: "/assets/zombies/level1/zombie-level1-walk.webp",
    frames: 8,
    fps: 10,
    width: NORMAL_ZOMBIE_FRAME_W,
    height: NORMAL_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  attack: {
    path: "/assets/zombies/level1/zombie-level1-attack.webp",
    frames: 5,
    fps: 14,
    width: NORMAL_ZOMBIE_FRAME_W,
    height: NORMAL_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  hit: {
    path: "/assets/zombies/level1/zombie-level1-hit.webp",
    frames: 3,
    fps: 14,
    width: NORMAL_ZOMBIE_FRAME_W,
    height: NORMAL_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  death: {
    path: "/assets/zombies/level1/zombie-level1-death.webp",
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
    path: "/assets/zombies/level2/zombie-level2-idle.webp",
    frames: 5,
    fps: 5,
    width: ACID_ZOMBIE_FRAME_W,
    height: ACID_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  walk: {
    path: "/assets/zombies/level2/zombie-level2-walk.webp",
    frames: 8,
    fps: 8,
    width: ACID_ZOMBIE_FRAME_W,
    height: ACID_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  attack: {
    path: "/assets/zombies/level2/zombie-level2-attack.webp",
    frames: 5,
    fps: 14,
    width: ACID_ZOMBIE_FRAME_W,
    height: ACID_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  hit: {
    path: "/assets/zombies/level2/zombie-level2-hit.webp",
    frames: 3,
    fps: 14,
    width: ACID_ZOMBIE_FRAME_W,
    height: ACID_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  death: {
    path: "/assets/zombies/level2/zombie-level2-death.webp",
    frames: 7,
    fps: 10,
    width: ACID_ZOMBIE_FRAME_W,
    height: ACID_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
};

const ninjaZombieStrips: Record<NinjaStripName, ZombieStrip> = {
  idle: {
    path: "/assets/zombies/level3/zombie-level3-idle.webp",
    frames: 5,
    fps: 5,
    width: NINJA_ZOMBIE_FRAME_W,
    height: NINJA_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  run: {
    path: "/assets/zombies/level3/zombie-level3-run.webp",
    frames: 8,
    fps: 16,
    width: NINJA_ZOMBIE_FRAME_W,
    height: NINJA_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  dash: {
    path: "/assets/zombies/level3/zombie-level3-dash.webp",
    frames: 5,
    fps: 18,
    width: NINJA_ZOMBIE_FRAME_W,
    height: NINJA_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  attack: {
    path: "/assets/zombies/level3/zombie-level3-attack.webp",
    frames: 7,
    fps: 18,
    width: NINJA_ZOMBIE_FRAME_W,
    height: NINJA_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  jump_back: {
    path: "/assets/zombies/level3/zombie-level3-jump_back.webp",
    frames: 6,
    fps: 16,
    width: NINJA_ZOMBIE_FRAME_W,
    height: NINJA_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  hit: {
    path: "/assets/zombies/level3/zombie-level3-hit.webp",
    frames: 3,
    fps: 16,
    width: NINJA_ZOMBIE_FRAME_W,
    height: NINJA_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  death: {
    path: "/assets/zombies/level3/zombie-level3-death.webp",
    frames: 8,
    fps: 10,
    width: NINJA_ZOMBIE_FRAME_W,
    height: NINJA_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  warning: {
    path: "/assets/zombies/level3/zombie-level3-warning.webp",
    frames: 4,
    fps: 14,
    width: NINJA_ZOMBIE_FRAME_W,
    height: NINJA_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
};

const tankZombieStrips: Record<TankStripName, ZombieStrip> = {
  idle: {
    path: "/assets/zombies/level4/zombie-level4-idle.webp",
    frames: 5,
    fps: 4,
    width: TANK_ZOMBIE_FRAME_W,
    height: TANK_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  walk: {
    path: "/assets/zombies/level4/zombie-level4-walk.webp",
    frames: 8,
    fps: 7,
    width: TANK_ZOMBIE_FRAME_W,
    height: TANK_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  attack_windup: {
    path: "/assets/zombies/level4/zombie-level4-attack-windup.webp",
    frames: 6,
    fps: 10,
    width: TANK_ZOMBIE_FRAME_W,
    height: TANK_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  smash: {
    path: "/assets/zombies/level4/zombie-level4-smash.webp",
    frames: 7,
    fps: 14,
    width: TANK_ZOMBIE_FRAME_W,
    height: TANK_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  recovery: {
    path: "/assets/zombies/level4/zombie-level4-recovery.webp",
    frames: 6,
    fps: 8,
    width: TANK_ZOMBIE_FRAME_W,
    height: TANK_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  hit: {
    path: "/assets/zombies/level4/zombie-level4-hit.webp",
    frames: 3,
    fps: 12,
    width: TANK_ZOMBIE_FRAME_W,
    height: TANK_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  death: {
    path: "/assets/zombies/level4/zombie-level4-death.webp",
    frames: 6,
    fps: 7,
    width: TANK_ZOMBIE_FRAME_W,
    height: TANK_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  roar: {
    path: "/assets/zombies/level4/zombie-level4-roar.webp",
    frames: 6,
    fps: 7,
    width: TANK_ZOMBIE_FRAME_W,
    height: TANK_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
  hammer_impact_fx: {
    path: "/assets/zombies/level4/fx-hammer-impact.webp",
    frames: 5,
    fps: 18,
    width: TANK_ZOMBIE_FRAME_W,
    height: TANK_ZOMBIE_FRAME_H,
    image: null,
    loaded: false,
  },
};

const playerWeaponStrips: Record<PlayerWeaponStripKey, Record<PlayerWeaponStripName, PlayerStrip>> = {
  pistol: {
    idle: {
      path: "/assets/player/weapons/pistol/hero-pistol-idle.webp",
      frames: 4,
      fps: 5,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
    walk: {
      path: "/assets/player/weapons/pistol/hero-pistol-walk.webp",
      frames: 8,
      fps: 12,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
    shoot: {
      path: "/assets/player/weapons/pistol/hero-pistol-shoot.webp",
      frames: 4,
      fps: 18,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
  },
  rifle: {
    idle: {
      path: "/assets/player/weapons/rifle/hero-rifle-idle.webp",
      frames: 5,
      fps: 5,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
    walk: {
      path: "/assets/player/weapons/rifle/hero-rifle-walk.webp",
      frames: 8,
      fps: 12,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
    shoot: {
      path: "/assets/player/weapons/rifle/hero-rifle-shoot.webp",
      frames: 4,
      fps: 20,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
  },
  bazooka: {
    idle: {
      path: "/assets/player/weapons/bazooka/hero-bazooka-idle.webp",
      frames: 4,
      fps: 5,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
    walk: {
      path: "/assets/player/weapons/bazooka/hero-bazooka-walk.webp",
      frames: 8,
      fps: 10,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
    shoot: {
      path: "/assets/player/weapons/bazooka/hero-bazooka-shoot.webp",
      frames: 7,
      fps: 11,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
  },
  flamethrower: {
    idle: {
      path: "/assets/player/weapons/flamethrower/hero-flamethrower-idle.webp",
      frames: 4,
      fps: 5,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
    walk: {
      path: "/assets/player/weapons/flamethrower/hero-flamethrower-walk.webp",
      frames: 8,
      fps: 11,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
    shoot: {
      path: "/assets/player/weapons/flamethrower/hero-flamethrower-shoot.webp",
      frames: 6,
      fps: 16,
      width: PLAYER_SPRITE_FRAME_W,
      height: PLAYER_SPRITE_FRAME_H,
      image: null,
      loaded: false,
    },
  },
};

const playerSharedStrips: Record<PlayerSharedStripName, PlayerStrip> = {
  hit: {
    path: "/assets/player/shared/hero-hit.webp",
    frames: 3,
    fps: 14,
    width: PLAYER_SPRITE_FRAME_W,
    height: PLAYER_SPRITE_FRAME_H,
    image: null,
    loaded: false,
  },
  stunned: {
    path: "/assets/player/shared/hero-stunned.webp",
    frames: 5,
    fps: 5,
    width: PLAYER_SPRITE_FRAME_W,
    height: PLAYER_SPRITE_FRAME_H,
    image: null,
    loaded: false,
  },
  death: {
    path: "/assets/player/shared/hero-death.webp",
    frames: 9,
    fps: 9,
    width: PLAYER_SPRITE_FRAME_W,
    height: PLAYER_SPRITE_FRAME_H,
    image: null,
    loaded: false,
  },
};

const bonusImageAssets: {
  small_medkit: ImageAsset;
  big_medkit: ImageAsset;
  shield: ImageAsset;
  airstrike: ImageAsset;
  speed: ImageAsset;
} = {
  small_medkit: {
    path: "/assets/bonuses/small-medkit.webp",
    image: null,
    loaded: false,
    source: { x: 345, y: 346, width: 566, height: 513 },
  },
  big_medkit: {
    path: "/assets/bonuses/big-medkit.webp",
    image: null,
    loaded: false,
    source: { x: 153, y: 160, width: 965, height: 859 },
  },
  shield: {
    path: "/assets/bonuses/shield.webp",
    image: null,
    loaded: false,
    source: { x: 302, y: 223, width: 650, height: 760 },
  },
  airstrike: {
    path: "/assets/bonuses/airstrike.webp",
    image: null,
    loaded: false,
    source: { x: 167, y: 89, width: 916, height: 1084 },
  },
  speed: {
    path: "/assets/bonuses/speed.webp",
    image: null,
    loaded: false,
    source: { x: 131, y: 124, width: 978, height: 969 },
  },
};

const effectImageAssets: { acid_pool: ImageAsset; acid_spit: ImageAsset } = {
  acid_pool: {
    path: "/assets/effects/acid-pool.webp",
    image: null,
    loaded: false,
    source: { x: 71, y: 156, width: 1107, height: 937 },
  },
  acid_spit: {
    path: "/assets/effects/acid-spit.webp",
    image: null,
    loaded: false,
    source: { x: 25, y: 220, width: 1187, height: 767 },
  },
};

const flamethrowerFireStrip: ZombieStrip = {
  path: "/assets/effects/flamethrower-fire.webp",
  frames: 6,
  fps: 18,
  width: FLAMETHROWER_STREAM_FRAME_W,
  height: FLAMETHROWER_STREAM_FRAME_H,
  image: null,
  loaded: false,
};

const arenaImageAsset: ImageAsset = {
  path: "/assets/arena/arena-street.webp",
  image: null,
  loaded: false,
};

let state = createInitialState("menu");
let hudData = snapshotHud(state);
let loadingData = snapshotLoading(state);
let rafId = 0;
let lowPowerTimerId = 0;
let lastTs = 0;
let lastLowPowerTs = 0;
let accumulator = 0;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let onEndCallback: ((payload: GameEndPayload) => void) | null = null;
let canvasResizeObserver: ResizeObserver | null = null;
let idCounter = 0;
let normalZombieSpritesRequested = false;
let acidZombieSpritesRequested = false;
let ninjaZombieSpritesRequested = false;
let tankZombieSpritesRequested = false;
let playerSharedSpritesRequested = false;
const playerWeaponSpritesRequested: Partial<Record<PlayerWeaponStripKey, boolean>> = {};
let bonusSpritesRequested = false;
let effectSpritesRequested = false;
let arenaBackgroundRequested = false;
const uiSubscribers = new Set<() => void>();

function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function createPlayer(): Player {
  return {
    x: CANVAS_W / 2,
    y: CANVAS_H / 2,
    angle: PLAYER_SPRITE_BASE_FACING,
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
    bazookaCooldown: 0,
    bazookaPendingDelay: 0,
    bazookaPendingAngle: 0,
    flamethrowerStreamActive: false,
    flamethrowerTickTimer: 0,
    idlePhase: 0,
    movePhase: 0,
    movingAnim: false,
    shootAnim: 0,
    hitAnim: 0,
    deathAnim: 0,
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
    shotgunCharge: 0,
    shotgunCharged: false,
    banner: current.bannerText,
    bannerTimer: current.bannerTimer,
    result: current.result,
  };
}

function collectRequiredLoadables(current: GameState) {
  const loadables: Array<{ loaded: boolean }> = [
    arenaImageAsset,
    ...Object.values(effectImageAssets),
    ...Object.values(bonusImageAssets),
    ...Object.values(playerSharedStrips),
    ...Object.values(playerWeaponStrips.pistol),
    ...Object.values(playerWeaponStrips.rifle),
    ...Object.values(playerWeaponStrips.bazooka),
    ...Object.values(playerWeaponStrips.flamethrower),
    ...Object.values(normalZombieStrips),
    ...Object.values(acidZombieStrips),
    ...Object.values(ninjaZombieStrips),
    ...Object.values(tankZombieStrips),
    flamethrowerFireStrip,
  ];

  return loadables;
}

function snapshotLoading(current: GameState): LoadingData {
  const required = collectRequiredLoadables(current);
  const total = required.length;
  const loaded = required.filter((asset) => asset.loaded).length;
  const progress = total > 0 ? loaded / total : 1;
  const active = loaded < total;

  return {
    active,
    loaded,
    total,
    progress,
    label: active ? `Loading assets ${loaded}/${total}` : "Ready",
  };
}

function emitUi() {
  loadingData = snapshotLoading(state);
  for (const subscriber of uiSubscribers) {
    subscriber();
  }
}

function syncUi(current: GameState) {
  hudData = snapshotHud(current);
  emitUi();
}

export function getHudData() {
  return hudData;
}

export function getLoadingData() {
  return loadingData;
}

export function subscribeUi(callback: () => void) {
  uiSubscribers.add(callback);
  return () => {
    uiSubscribers.delete(callback);
  };
}

function syncCanvasSize() {
  if (!canvas) {
    return;
  }

  const bounds = canvas.getBoundingClientRect();
  const dpr = Math.min(MAX_CANVAS_DPR, Math.max(1, window.devicePixelRatio || 1));
  const nextW = Math.max(1, Math.round(bounds.width * dpr));
  const nextH = Math.max(1, Math.round(bounds.height * dpr));

  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW;
    canvas.height = nextH;
  }
}

function attachCanvasResize(el: HTMLCanvasElement) {
  detachCanvasResize();
  syncCanvasSize();
  window.addEventListener("resize", syncCanvasSize);

  if (typeof ResizeObserver !== "undefined") {
    canvasResizeObserver = new ResizeObserver(() => syncCanvasSize());
    canvasResizeObserver.observe(el);
  }
}

function detachCanvasResize() {
  window.removeEventListener("resize", syncCanvasSize);
  canvasResizeObserver?.disconnect();
  canvasResizeObserver = null;
}

function scheduleFrame(delayMs = 0) {
  if (delayMs > 0) {
    lowPowerTimerId = window.setTimeout(() => {
      lowPowerTimerId = 0;
      rafId = requestAnimationFrame(frame);
    }, delayMs);
    return;
  }

  rafId = requestAnimationFrame(frame);
}

function wakeFrameLoop() {
  if (lowPowerTimerId) {
    window.clearTimeout(lowPowerTimerId);
    lowPowerTimerId = 0;
  }

  if (!rafId) {
    scheduleFrame();
  }
}

export function mountCanvas(el: HTMLCanvasElement, onEnd: (payload: GameEndPayload) => void) {
  canvas = el;
  ctx = el.getContext("2d");
  onEndCallback = onEnd;
  attachCanvasResize(el);
  ensureGameplaySpriteAssets(0);
  attachInput();
  wakeFrameLoop();
}

export function unmountCanvas() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (lowPowerTimerId) {
    window.clearTimeout(lowPowerTimerId);
    lowPowerTimerId = 0;
  }
  lastTs = 0;
  lastLowPowerTs = 0;
  accumulator = 0;
  detachCanvasResize();
  detachInput();
  resetInput();
  canvas = null;
  ctx = null;
  onEndCallback = null;
  state = createInitialState("menu");
  syncUi(state);
}

export function startGame() {
  ensureGameplaySpriteAssets(0);
  state = createInitialState("playing");
  syncUi(state);
  wakeFrameLoop();
}

export function pauseGame() {
  if (state.status === "playing") {
    state.status = "paused";
    syncUi(state);
  }
}

export function resumeGame() {
  if (state.status === "paused") {
    state.status = "playing";
    syncUi(state);
    wakeFrameLoop();
  }
}

export function goToMenu() {
  state = createInitialState("menu");
  syncUi(state);
}

function frame(timestamp: number) {
  rafId = 0;

  if (document.hidden) {
    lastTs = timestamp;
    accumulator = 0;
    scheduleFrame(LOW_POWER_FRAME_MS);
    return;
  }

  if (lastTs === 0) {
    lastTs = timestamp;
  }

  const frameDt = Math.min((timestamp - lastTs) / 1000, 0.1);
  const elapsedMs = timestamp - lastTs;
  lastTs = timestamp;

  if (state.status !== "playing") {
    const lowPowerDt = lastLowPowerTs
      ? Math.min((timestamp - lastLowPowerTs) / 1000, 0.25)
      : frameDt;
    lastLowPowerTs = timestamp;

    tick(lowPowerDt);
    clearInputFrame();

    if (ctx && canvas) {
      ctx.setTransform(canvas.width / CANVAS_W, 0, 0, canvas.height / CANVAS_H, 0, 0);
      renderFrame(ctx, state, lowPowerDt);
    }

    scheduleFrame(LOW_POWER_FRAME_MS);
    return;
  }

  lastLowPowerTs = 0;
  accumulator += elapsedMs;

  while (accumulator >= STEP_MS) {
    tick(STEP_MS / 1000);
    clearInputFrame();
    accumulator -= STEP_MS;
  }

  if (ctx && canvas) {
    ctx.setTransform(canvas.width / CANVAS_W, 0, 0, canvas.height / CANVAS_H, 0, 0);
    renderFrame(ctx, state, frameDt);
  }

  scheduleFrame();
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
    syncUi(state);
    return;
  }

  updateCosmetics(state, dt);

  state.time += dt;
  ensureGameplaySpriteAssets(state.time);
  loadingData = snapshotLoading(state);
  if (loadingData.active) {
    syncUi(state);
    return;
  }
  state.score = computeScore(state.time, state.kills);

  const player = state.player;
  player.stunTimer = Math.max(0, player.stunTimer - dt);
  player.shieldTimer = Math.max(0, player.shieldTimer - dt);
  player.speedBoostTimer = Math.max(0, player.speedBoostTimer - dt);
  player.bazookaCooldown = Math.max(0, player.bazookaCooldown - dt);
  player.shootAnim = Math.max(0, player.shootAnim - dt);
  player.hitAnim = Math.max(0, player.hitAnim - dt);
  player.idlePhase += dt * 3.2;

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

  syncUi(state);
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

  if (current.player.health <= 0) {
    current.player.deathAnim = Math.max(0, current.player.deathAnim - dt);
  }
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

    player.movingAnim = Math.abs(moveAxis) > 0.001;
    player.x += forward.x * player.baseSpeed * speedMultiplier * moveAxis * dt;
    player.y += forward.y * player.baseSpeed * speedMultiplier * moveAxis * dt;
    if (player.movingAnim) {
      const cadence = player.currentWeapon === "bazooka" ? 5.4 : player.currentWeapon === "flamethrower" ? 6.1 : 7.6;
      player.movePhase += dt * cadence * Math.max(0.55, Math.abs(moveAxis)) * (player.speedBoostTimer > 0 ? 1.3 : 1);
    }
    clampPlayer(player);
  } else {
    player.movingAnim = false;
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

  if (player.currentWeapon === "flamethrower") {
    if (input.fire) {
      player.flamethrowerStreamActive = true;
      player.flamethrowerTickTimer -= dt;
      while (player.flamethrowerTickTimer <= 0) {
        spawnFlamethrowerBurst(current, player.angle);
        triggerPlayerShootAnim(player, "flamethrower");
        sfxFlamethrower();
        player.flamethrowerTickTimer += FLAMETHROWER_INTERVAL;
      }
    } else {
      player.flamethrowerStreamActive = false;
      player.flamethrowerTickTimer = 0;
    }
  } else {
    player.flamethrowerStreamActive = false;
    player.flamethrowerTickTimer = 0;
  }

  if (player.currentWeapon === "bazooka" && input.firePressed && player.bazookaCooldown <= 0 && player.bazookaPendingDelay <= 0) {
    player.bazookaCooldown = 2;
    player.bazookaPendingDelay = 0.5;
    player.bazookaPendingAngle = player.angle;
    triggerPlayerShootAnim(player, "bazooka");
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
    enemy.windupTimer = Math.max(0, (enemy.windupTimer ?? 0) - dt);
    enemy.dashTimer = Math.max(0, (enemy.dashTimer ?? 0) - dt);
    enemy.recoveryTimer = Math.max(0, (enemy.recoveryTimer ?? 0) - dt);
    enemy.impactTimer = Math.max(0, (enemy.impactTimer ?? 0) - dt);
    enemy.idlePhase = (enemy.idlePhase ?? 0) + dt * (enemy.type === "tank" ? 1.5 : enemy.type === "ninja" ? 2.4 : 3.2);

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

    if (enemy.carriedByProjectileId) {
      enemy.attackAnim = 0;
      enemy.attackDidHit = true;
      enemy.windupTimer = 0;
      enemy.recoveryTimer = 0;
      enemy.jumpVx = 0;
      enemy.jumpVy = 0;
      enemy.movingThisTick = true;
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
      enemy.visualAngle = approachAngle(enemy.visualAngle ?? facingAngle, facingAngle, dt * 16);

      const inAttackRange = distanceToPlayer <= enemy.radius + player.radius + NINJA_ATTACK_RANGE;
      const vectorToNinja = normalize(subtract(enemy, player));
      const behindDot = dot(playerForward, vectorToNinja);

      if (enemy.state === "warning") {
        if ((enemy.attackAnim ?? 0) <= 0) {
          enemy.state = "attacking";
          enemy.attackAnim = NINJA_ATTACK_ANIM_DURATION;
          enemy.attackDidHit = false;
        }
      } else if (enemy.state === "attacking") {
        enemy.x += toPlayerNorm.x * 42 * dt;
        enemy.y += toPlayerNorm.y * 42 * dt;
        enemy.visualAngle = approachAngle(enemy.visualAngle ?? facingAngle, facingAngle, dt * 18);

        if ((enemy.attackAnim ?? 0) > 0 && !enemy.attackDidHit && (enemy.attackAnim ?? 0) <= NINJA_ATTACK_HIT_MOMENT) {
          if (inAttackRange && behindDot < -0.35) {
            applyPlayerHit(current, 50, { shake: 0.6 });
          }
          enemy.attackDidHit = true;
        }

        if ((enemy.attackAnim ?? 0) <= 0) {
          const retreat = normalize(subtract(enemy, player));
          const jumpDistance = enemy.radius * NINJA_JUMP_BACK_DISTANCE_MULTIPLIER;
          const jumpSpeed = jumpDistance / NINJA_JUMP_BACK_DURATION;
          enemy.state = "jump_back";
          enemy.attackAnim = NINJA_JUMP_BACK_DURATION;
          enemy.attackTimer = 1.5;
          enemy.jumpVx = retreat.x * jumpSpeed;
          enemy.jumpVy = retreat.y * jumpSpeed;
        }
      } else if (enemy.state === "jump_back") {
        enemy.x += (enemy.jumpVx ?? 0) * dt;
        enemy.y += (enemy.jumpVy ?? 0) * dt;
        enemy.movingThisTick = true;
        enemy.dashTimer = Math.max(enemy.dashTimer ?? 0, enemy.attackAnim ?? 0);

        if ((enemy.attackAnim ?? 0) <= 0) {
          enemy.state = undefined;
          enemy.jumpVx = 0;
          enemy.jumpVy = 0;
        }
      } else {
        const behindTarget = {
          x: player.x - playerForward.x * (enemy.backDistance ?? 64),
          y: player.y - playerForward.y * (enemy.backDistance ?? 64),
        };
        const desiredDirection = normalize(subtract(behindTarget, enemy));
        const zigzagAxis = perpendicular(desiredDirection);
        const zigzagWave = Math.sin(current.time * NINJA_ZIGZAG_FREQUENCY + (enemy.zigzagPhase ?? 0));
        const zigzagVelocity = zigzagWave * NINJA_ZIGZAG_LATERAL_SPEED;
        const moveDirection = normalize({
          x: desiredDirection.x + zigzagAxis.x * zigzagWave * NINJA_ZIGZAG_DIRECTION_BLEND,
          y: desiredDirection.y + zigzagAxis.y * zigzagWave * NINJA_ZIGZAG_DIRECTION_BLEND,
        });

        enemy.x += (desiredDirection.x * enemy.speed + zigzagAxis.x * zigzagVelocity) * dt;
        enemy.y += (desiredDirection.y * enemy.speed + zigzagAxis.y * zigzagVelocity) * dt;
        enemy.visualAngle = approachAngle(
          enemy.visualAngle ?? facingAngle,
          Math.atan2(moveDirection.y, moveDirection.x),
          dt * 18,
        );
        enemy.movingThisTick = true;
        enemy.gaitPhase = (enemy.gaitPhase ?? rand(0, Math.PI * 2)) + dt * 12.5;

        if (Math.abs(zigzagWave) > 0.8 && distanceToPlayer < 220) {
          enemy.dashTimer = Math.max(enemy.dashTimer ?? 0, 0.16);
        }

        if (inAttackRange && behindDot < -0.5 && enemy.attackTimer <= 0) {
          enemy.state = "warning";
          enemy.attackAnim = NINJA_WARNING_DURATION;
          enemy.attackDidHit = false;
          enemy.movingThisTick = false;
        }
      }
    }

    if (enemy.type === "tank") {
      enemy.visualAngle = approachAngle(enemy.visualAngle ?? facingAngle, facingAngle, dt * 5);
      const inAttackRange = distanceToPlayer <= enemy.radius + player.radius + TANK_ATTACK_RANGE;

      if (enemy.state === "roar") {
        if ((enemy.recoveryTimer ?? 0) <= 0) {
          enemy.state = undefined;
        }
      } else if (!enemy.didRoar && distanceToPlayer <= TANK_ROAR_TRIGGER_RANGE) {
        enemy.state = "roar";
        enemy.recoveryTimer = TANK_ROAR_DURATION;
        enemy.attackTimer = Math.max(enemy.attackTimer, 0.55);
        enemy.didRoar = true;
      } else if (enemy.state === "windup") {
        if ((enemy.windupTimer ?? 0) <= 0) {
          enemy.state = "smash";
          enemy.attackAnim = TANK_SMASH_ANIM_DURATION;
          enemy.attackDidHit = false;
        }
      } else if (enemy.state === "smash") {
        enemy.x += toPlayerNorm.x * 36 * dt;
        enemy.y += toPlayerNorm.y * 36 * dt;

        if ((enemy.attackAnim ?? 0) > 0 && !enemy.attackDidHit && (enemy.attackAnim ?? 0) <= TANK_SMASH_HIT_MOMENT) {
          if (inAttackRange) {
            applyPlayerHit(current, 100, { stun: 1, shake: 0.85 });
          }
          enemy.attackDidHit = true;
          enemy.impactTimer = TANK_IMPACT_FX_DURATION;
        }

        if ((enemy.attackAnim ?? 0) <= 0) {
          enemy.state = "recovery";
          enemy.recoveryTimer = TANK_RECOVERY_DURATION;
        }
      } else if (enemy.state === "recovery") {
        if ((enemy.recoveryTimer ?? 0) <= 0) {
          enemy.state = undefined;
        }
      } else {
        enemy.x += toPlayerNorm.x * enemy.speed * dt;
        enemy.y += toPlayerNorm.y * enemy.speed * dt;
        enemy.movingThisTick = true;
        enemy.gaitPhase = (enemy.gaitPhase ?? rand(0, Math.PI * 2)) + dt * 4.6;

        if (inAttackRange && enemy.attackTimer <= 0) {
          enemy.state = "windup";
          enemy.windupTimer = TANK_WINDUP_DURATION;
          enemy.attackTimer = 3.1;
          enemy.attackDidHit = false;
        }
      }
    }

    if (enemy.type === "ninja" || enemy.type === "tank") {
      enemy.x = clamp(enemy.x, -40, CANVAS_W + 40);
      enemy.y = clamp(enemy.y, -40, CANVAS_H + 40);
      continue;
    }

    enemy.x = clamp(enemy.x, -40, CANVAS_W + 40);
    enemy.y = clamp(enemy.y, -40, CANVAS_H + 40);
  }
}

function updateProjectiles(current: GameState, dt: number) {
  const player = current.player;

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
      if (distance(projectile, player) <= projectile.radius + player.radius) {
        projectile.alive = false;
        applyPlayerHit(current, projectile.damage || 20, { shake: 0.35 });
        spawnAcidPool(current, player.x, player.y);
      }

      if (!projectile.alive) {
        continue;
      }

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
      projectile.harpoonedEnemyIds = projectile.harpoonedEnemyIds ?? [];

      for (const enemy of current.enemies) {
        if (!enemy.alive || enemy.isDying) continue;
        if (enemy.carriedByProjectileId && enemy.carriedByProjectileId !== projectile.id) continue;
        if (distance(projectile, enemy) <= projectile.radius + enemy.radius + 6) {
          attachEnemyToRocket(projectile, enemy, direction);
        }
      }

      dragHarpoonedEnemies(current, projectile, direction);

      if (projectile.distance >= projectile.maxDistance) {
        explodeRocket(current, projectile.x, projectile.y);
        projectile.alive = false;
      }
    }

    if (projectile.type === "flame") {
      const direction = normalize({ x: projectile.vx, y: projectile.vy });
      const hitEnemyIds = projectile.hitEnemyIds ?? (projectile.hitEnemyIds = []);

      for (const enemy of current.enemies) {
        if (!enemy.alive || enemy.isDying || hitEnemyIds.includes(enemy.id)) continue;
        if (distance(projectile, enemy) <= projectile.radius + enemy.radius + 8) {
          hitEnemyIds.push(enemy.id);
          damageEnemy(current, enemy, projectile.damage);
          enemy.x += direction.x * 14;
          enemy.y += direction.y * 14;
        }
      }

      if (projectile.distance >= projectile.maxDistance) {
        projectile.alive = false;
      }
    }

    if (!projectile.alive) {
      continue;
    }

    if (
      projectile.x < -80 ||
      projectile.x > CANVAS_W + 80 ||
      projectile.y < -80 ||
      projectile.y > CANVAS_H + 80
    ) {
      if (projectile.type === "rocket") {
        explodeRocket(current, projectile.x, projectile.y);
      }
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

function playerWeaponStripKey(weapon: WeaponType): PlayerWeaponStripKey {
  if (weapon === "machine_gun") return "rifle";
  return weapon;
}

function getPlayerShootDuration(weapon: WeaponType) {
  const key = playerWeaponStripKey(weapon);
  const strip = playerWeaponStrips[key].shoot;
  return strip.frames / strip.fps;
}

function triggerPlayerShootAnim(player: Player, weapon: WeaponType) {
  player.shootAnim = Math.max(player.shootAnim, getPlayerShootDuration(weapon));
}

function fireBullet(current: GameState, angle: number, damage: number) {
  const origin = current.player;
  const dir = vectorFromAngle(angle);
  triggerPlayerShootAnim(origin, origin.currentWeapon);
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

function spawnFlamethrowerBurst(current: GameState, angle: number) {
  const player = current.player;
  const dir = vectorFromAngle(player.angle);

  current.projectiles.push({
    id: nextId("flame"),
    type: "flame",
    x: player.x + dir.x * (player.radius + 18),
    y: player.y + dir.y * (player.radius + 18),
    vx: Math.cos(angle) * FLAMETHROWER_SPEED,
    vy: Math.sin(angle) * FLAMETHROWER_SPEED,
    radius: FLAMETHROWER_RADIUS,
    damage: FLAMETHROWER_DAMAGE,
    distance: 0,
    maxDistance: FLAMETHROWER_RANGE,
    hitEnemyIds: [],
    alive: true,
  });

  current.cameraShake = Math.max(current.cameraShake, 0.22);
  spawnParticles(current, player.x + dir.x * 30, player.y + dir.y * 30, "#ff9d42", 8, 1.8);
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
    harpoonedEnemyIds: [],
    alive: true,
  });
}

function attachEnemyToRocket(projectile: Projectile, enemy: Enemy, direction: Vec2) {
  const attached = projectile.harpoonedEnemyIds ?? (projectile.harpoonedEnemyIds = []);
  if (!attached.includes(enemy.id)) {
    attached.push(enemy.id);
  }

  enemy.carriedByProjectileId = projectile.id;
  enemy.visualAngle = Math.atan2(direction.y, direction.x);
  enemy.state = undefined;
  enemy.attackAnim = 0;
  enemy.attackDidHit = true;
}

function dragHarpoonedEnemies(current: GameState, projectile: Projectile, direction: Vec2) {
  const attached = projectile.harpoonedEnemyIds ?? [];
  if (!attached.length) return;

  let distanceBehindRocket = projectile.radius + 8;
  const survivors: string[] = [];

  for (const enemyId of attached) {
    const enemy = current.enemies.find((item) => item.id === enemyId && item.alive && !item.isDying);
    if (!enemy) continue;

    const slotDepth = distanceBehindRocket + enemy.radius;
    enemy.x = projectile.x - direction.x * slotDepth;
    enemy.y = projectile.y - direction.y * slotDepth;
    enemy.visualAngle = Math.atan2(direction.y, direction.x);
    enemy.carriedByProjectileId = projectile.id;
    enemy.movingThisTick = true;
    survivors.push(enemyId);
    distanceBehindRocket += enemy.radius * 2 + 12;
  }

  projectile.harpoonedEnemyIds = survivors;
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
    damage: 20,
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
    if (enemy.carriedByProjectileId) {
      enemy.x = x;
      enemy.y = y;
      enemy.carriedByProjectileId = undefined;
    }
  }

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
    enemy.visualAngle = Math.atan2(CANVAS_H / 2 - spawn.y, CANVAS_W / 2 - spawn.x);
    enemy.gaitPhase = rand(0, Math.PI * 2);
    enemy.idlePhase = rand(0, Math.PI * 2);
    enemy.attackAnim = 0;
    enemy.attackDidHit = false;
    enemy.hitAnim = 0;
    enemy.deathAnim = 0;
    enemy.corpseFade = 0;
    enemy.deathFlip = Math.random() < 0.5 ? -1 : 1;
    enemy.dashTimer = 0;
    enemy.backDistance = rand(50, 80);
    enemy.zigzagPhase = rand(0, Math.PI * 2);
    enemy.attackTimer = rand(0.5, 1.4);
  }

  if (type === "tank") {
    enemy.health = 250;
    enemy.maxHealth = 250;
    enemy.speed = 42;
    enemy.radius = 28;
    enemy.visualAngle = Math.atan2(CANVAS_H / 2 - spawn.y, CANVAS_W / 2 - spawn.x);
    enemy.gaitPhase = rand(0, Math.PI * 2);
    enemy.idlePhase = rand(0, Math.PI * 2);
    enemy.attackAnim = 0;
    enemy.attackDidHit = false;
    enemy.hitAnim = 0;
    enemy.deathAnim = 0;
    enemy.corpseFade = 0;
    enemy.deathFlip = Math.random() < 0.5 ? -1 : 1;
    enemy.recoveryTimer = 0;
    enemy.impactTimer = 0;
    enemy.didRoar = false;
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
  if (!options.silent) {
    player.hitAnim = Math.max(player.hitAnim, playerSharedStrips.hit.frames / playerSharedStrips.hit.fps);
  }
  if (options.stun) {
    player.stunTimer = Math.max(player.stunTimer, options.stun);
  }
  if (options.shake) {
    current.cameraShake = Math.max(current.cameraShake, options.shake);
  }
  if (!options.silent) {
    sfxHit();
  }
  if (player.health <= 0) {
    player.deathAnim = Math.max(player.deathAnim, playerSharedStrips.death.frames / playerSharedStrips.death.fps);
    player.shootAnim = 0;
    player.hitAnim = 0;
    player.stunTimer = 0;
  }
}

function damageEnemy(current: GameState, enemy: Enemy, damage: number) {
  enemy.health -= damage;
  enemy.hurtFlash = 1;
  if (enemy.type === "normal" || enemy.type === "acid") {
    enemy.hitAnim = 0.22;
  }
  if (enemy.type === "ninja") {
    enemy.hitAnim = 0.18;
  }
  if (enemy.type === "tank") {
    enemy.hitAnim = 0.2;
  }
  spawnParticles(current, enemy.x, enemy.y, enemyBloodColor(enemy.type), 6, 1.2);
  if (enemy.health <= 0) {
    killEnemy(current, enemy, enemyBloodColor(enemy.type));
  }
}

function killEnemy(current: GameState, enemy: Enemy, color: string) {
  if (!enemy.alive || enemy.isDying) return;
  current.kills += 1;
  if (enemy.type === "normal" || enemy.type === "acid" || enemy.type === "ninja" || enemy.type === "tank") {
    enemy.isDying = true;
    enemy.deathAnim =
      enemy.type === "acid"
        ? ACID_DEATH_ANIM_DURATION
        : enemy.type === "ninja"
          ? NINJA_DEATH_ANIM_DURATION
          : enemy.type === "tank"
            ? TANK_DEATH_ANIM_DURATION
            : 0.62;
    enemy.corpseFade = enemy.type === "tank" ? 0.8 : 0.55;
    enemy.attackAnim = 0;
    enemy.attackDidHit = true;
    enemy.hitAnim = enemy.type === "tank" ? 0.2 : 0.18;
    enemy.state = undefined;
    enemy.windupTimer = 0;
    enemy.recoveryTimer = 0;
    enemy.impactTimer = 0;
    enemy.jumpVx = 0;
    enemy.jumpVy = 0;
    enemy.carriedByProjectileId = undefined;
    spawnParticles(
      current,
      enemy.x,
      enemy.y,
      color,
      enemy.type === "tank" ? 22 : enemy.type === "acid" ? 16 : 14,
      enemy.type === "tank" ? 3.6 : enemy.type === "acid" ? 2.9 : 2.6,
    );
    if (enemy.type === "tank") {
      sfxExplosion();
    }
  }
}

function finishRun() {
  state.player.deathAnim = Math.max(
    state.player.deathAnim,
    playerSharedStrips.death.frames / playerSharedStrips.death.fps,
  );
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
  syncUi(state);
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
  if (arenaImageAsset.loaded && arenaImageAsset.image) {
    renderingContext.drawImage(arenaImageAsset.image, 0, 0, CANVAS_W, CANVAS_H);

    const emberPulse = 0.08 + Math.sin(time * 1.8) * 0.018;
    const warmGlow = renderingContext.createRadialGradient(
      CANVAS_W * 0.87,
      CANVAS_H * 0.26,
      10,
      CANVAS_W * 0.87,
      CANVAS_H * 0.26,
      CANVAS_W * 0.2,
    );
    warmGlow.addColorStop(0, `rgba(255, 124, 42, ${emberPulse})`);
    warmGlow.addColorStop(1, "rgba(255, 124, 42, 0)");
    renderingContext.fillStyle = warmGlow;
    renderingContext.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const lowerGlow = renderingContext.createRadialGradient(
      CANVAS_W * 0.07,
      CANVAS_H * 0.92,
      10,
      CANVAS_W * 0.07,
      CANVAS_H * 0.92,
      CANVAS_W * 0.18,
    );
    lowerGlow.addColorStop(0, `rgba(255, 108, 38, ${emberPulse * 0.95})`);
    lowerGlow.addColorStop(1, "rgba(255, 108, 38, 0)");
    renderingContext.fillStyle = lowerGlow;
    renderingContext.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const ambientShade = renderingContext.createLinearGradient(0, 0, 0, CANVAS_H);
    ambientShade.addColorStop(0, "rgba(8, 10, 12, 0.08)");
    ambientShade.addColorStop(1, "rgba(8, 10, 12, 0.18)");
    renderingContext.fillStyle = ambientShade;
    renderingContext.fillRect(0, 0, CANVAS_W, CANVAS_H);

    renderingContext.save();
    const vignette = renderingContext.createRadialGradient(
      CANVAS_W / 2,
      CANVAS_H / 2,
      160,
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_W * 0.6,
    );
    vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.48)");
    renderingContext.fillStyle = vignette;
    renderingContext.fillRect(0, 0, CANVAS_W, CANVAS_H);
    renderingContext.restore();
    return;
  }

  drawBackgroundFallback(renderingContext, time);
}

function drawBackgroundFallback(renderingContext: CanvasRenderingContext2D, time: number) {
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

  if (player.shieldTimer > 0) {
    renderingContext.beginPath();
    renderingContext.arc(0, 0, player.radius + 8 + Math.sin(player.shieldTimer * 8) * 2, 0, Math.PI * 2);
    renderingContext.strokeStyle = "rgba(92, 215, 255, 0.55)";
    renderingContext.lineWidth = 3;
    renderingContext.stroke();
  }

  if (drawPlayerSprite(renderingContext, player)) {
    renderingContext.restore();
    return;
  }

  drawPlayerFallback(renderingContext, player);
  renderingContext.restore();
}

function drawPlayerSprite(renderingContext: CanvasRenderingContext2D, player: Player) {
  const animation = getPlayerAnimation(player);
  const strip = animation.group === "shared"
    ? playerSharedStrips[animation.name]
    : playerWeaponStrips[animation.key][animation.name];

  if (!strip.loaded || !strip.image) {
    return false;
  }

  const drawWidth = strip.width * PLAYER_SPRITE_DRAW_SCALE;
  const drawHeight = strip.height * PLAYER_SPRITE_DRAW_SCALE;
  const rotation = player.angle - PLAYER_SPRITE_BASE_FACING;
  const hitFlash = player.hitAnim > 0 && player.health > 0 ? 0.1 + Math.sin(player.hitAnim * 44) * 0.05 : 0;

  renderingContext.save();
  renderingContext.rotate(rotation);
  renderingContext.imageSmoothingEnabled = true;
  renderingContext.drawImage(
    strip.image,
    animation.frame * strip.width,
    0,
    strip.width,
    strip.height,
    -drawWidth * PLAYER_SPRITE_PIVOT_X,
    -drawHeight * PLAYER_SPRITE_PIVOT_Y,
    drawWidth,
    drawHeight,
  );

  if (hitFlash > 0) {
    renderingContext.globalCompositeOperation = "screen";
    renderingContext.fillStyle = `rgba(255, 116, 92, ${hitFlash})`;
    renderingContext.fillRect(
      -drawWidth * PLAYER_SPRITE_PIVOT_X,
      -drawHeight * PLAYER_SPRITE_PIVOT_Y,
      drawWidth,
      drawHeight,
    );
  }

  renderingContext.fillStyle = "#d4dbc8";
  renderingContext.beginPath();
  renderingContext.arc(0, 0, player.radius * 0.26, 0, Math.PI * 2);
  renderingContext.fillStyle = player.stunTimer > 0 ? "rgba(255, 162, 104, 0.9)" : "rgba(255, 232, 156, 0.35)";
  renderingContext.fill();
  renderingContext.restore();

  return true;
}

function getPlayerAnimation(
  player: Player,
):
  | { group: "shared"; name: PlayerSharedStripName; frame: number }
  | { group: "weapon"; key: PlayerWeaponStripKey; name: PlayerWeaponStripName; frame: number } {
  if (player.health <= 0) {
    const strip = playerSharedStrips.death;
    return {
      group: "shared",
      name: "death",
      frame: getTimedFrame(player.deathAnim, strip.frames / strip.fps, strip.frames),
    };
  }

  if (player.hitAnim > 0) {
    const strip = playerSharedStrips.hit;
    return {
      group: "shared",
      name: "hit",
      frame: getTimedFrame(player.hitAnim, strip.frames / strip.fps, strip.frames),
    };
  }

  if (player.stunTimer > 0) {
    const strip = playerSharedStrips.stunned;
    return {
      group: "shared",
      name: "stunned",
      frame: getLoopFrame(player.idlePhase, strip.frames),
    };
  }

  const weaponKey = playerWeaponStripKey(player.currentWeapon);

  if (player.shootAnim > 0) {
    const strip = playerWeaponStrips[weaponKey].shoot;
    const useLoopingShoot =
      (weaponKey === "rifle" && player.machineStreamActive)
      || (weaponKey === "flamethrower" && player.flamethrowerStreamActive);
    return {
      group: "weapon",
      key: weaponKey,
      name: "shoot",
      frame: useLoopingShoot
        ? getLoopFrame(player.movePhase + player.idlePhase * 0.6, strip.frames)
        : getTimedFrame(player.shootAnim, strip.frames / strip.fps, strip.frames),
    };
  }

  if (player.movingAnim) {
    const strip = playerWeaponStrips[weaponKey].walk;
    return {
      group: "weapon",
      key: weaponKey,
      name: "walk",
      frame: getLoopFrame(player.movePhase, strip.frames),
    };
  }

  const strip = playerWeaponStrips[weaponKey].idle;
  return {
    group: "weapon",
    key: weaponKey,
    name: "idle",
    frame: getLoopFrame(player.idlePhase, strip.frames),
  };
}

function drawPlayerFallback(renderingContext: CanvasRenderingContext2D, player: Player) {
  renderingContext.save();
  renderingContext.rotate(player.angle);

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
    drawNinjaZombieSprite(renderingContext, enemy);
  }

  if (enemy.type === "tank") {
    drawTankZombieSprite(renderingContext, enemy);
  }

  renderingContext.restore();
  drawEnemyHealthBar(renderingContext, enemy);
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
    const asset = effectImageAssets.acid_spit;
    if (asset.loaded && asset.image) {
      const angle = Math.atan2(projectile.vy, projectile.vx);
      const size = ACID_SPIT_DRAW_SIZE * (0.92 + Math.sin(projectile.distance * 0.08) * 0.04);

      renderingContext.save();
      renderingContext.rotate(angle);
      renderingContext.fillStyle = "rgba(177, 255, 68, 0.14)";
      renderingContext.beginPath();
      renderingContext.arc(0, 0, projectile.radius + 8, 0, Math.PI * 2);
      renderingContext.fill();
      drawImageAssetCentered(renderingContext, asset, size);
      renderingContext.restore();
    } else {
      renderingContext.fillStyle = "#6cff9d";
      renderingContext.beginPath();
      renderingContext.arc(0, 0, projectile.radius, 0, Math.PI * 2);
      renderingContext.fill();
    }
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

  if (projectile.type === "flame") {
    if (flamethrowerFireStrip.loaded && flamethrowerFireStrip.image) {
      const angle = Math.atan2(projectile.vy, projectile.vx) - Math.PI / 2;
      const frame = Math.floor((projectile.distance / 24) % flamethrowerFireStrip.frames);
      const size = FLAMETHROWER_STREAM_DRAW_SIZE * (0.92 + Math.sin(projectile.distance * 0.06) * 0.06);

      renderingContext.save();
      renderingContext.rotate(angle);
      renderingContext.globalCompositeOperation = "screen";
      renderingContext.fillStyle = "rgba(255, 145, 64, 0.18)";
      renderingContext.beginPath();
      renderingContext.arc(0, size * 0.12, projectile.radius + 14, 0, Math.PI * 2);
      renderingContext.fill();
      renderingContext.imageSmoothingEnabled = true;
      renderingContext.drawImage(
        flamethrowerFireStrip.image,
        frame * flamethrowerFireStrip.width,
        0,
        flamethrowerFireStrip.width,
        flamethrowerFireStrip.height,
        -size / 2,
        -size / 2,
        size,
        size,
      );
      renderingContext.restore();
    } else {
      renderingContext.fillStyle = "#ffb35f";
      renderingContext.beginPath();
      renderingContext.arc(0, 0, projectile.radius, 0, Math.PI * 2);
      renderingContext.fill();
    }
  }

  renderingContext.restore();
}

function drawImageAssetCentered(renderingContext: CanvasRenderingContext2D, asset: ImageAsset, size: number) {
  if (!asset.image) {
    return;
  }

  const source = asset.source ?? {
    x: 0,
    y: 0,
    width: asset.image.naturalWidth || asset.image.width,
    height: asset.image.naturalHeight || asset.image.height,
  };
  const sourceAspect = source.width / source.height;
  const drawWidth = sourceAspect >= 1 ? size : size * sourceAspect;
  const drawHeight = sourceAspect >= 1 ? size / sourceAspect : size;

  renderingContext.imageSmoothingEnabled = true;
  renderingContext.drawImage(
    asset.image,
    source.x,
    source.y,
    source.width,
    source.height,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );
}

function drawBonus(renderingContext: CanvasRenderingContext2D, bonus: Bonus, time: number) {
  const y = bonus.y + Math.sin(time * 2 + bonus.bobPhase) * 4;
  renderingContext.save();
  renderingContext.translate(bonus.x, y);

  if (bonus.type === "small_medkit" && drawSmallMedkitBonus(renderingContext, bonus, time)) {
    renderingContext.restore();
    return;
  }

  if (bonus.type === "big_medkit" && drawBigMedkitBonus(renderingContext, bonus, time)) {
    renderingContext.restore();
    return;
  }

  if (bonus.type === "shield" && drawShieldBonus(renderingContext, bonus, time)) {
    renderingContext.restore();
    return;
  }

  if (bonus.type === "airstrike" && drawAirstrikeBonus(renderingContext, bonus, time)) {
    renderingContext.restore();
    return;
  }

  if (bonus.type === "speed" && drawSpeedBonus(renderingContext, bonus, time)) {
    renderingContext.restore();
    return;
  }

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

function drawSmallMedkitBonus(renderingContext: CanvasRenderingContext2D, bonus: Bonus, time: number) {
  const asset = bonusImageAssets.small_medkit;
  if (!asset.loaded || !asset.image) {
    const pulse = 1 + Math.sin(time * 5.2 + bonus.bobPhase) * 0.04;
    const size = SMALL_MEDKIT_DRAW_SIZE * pulse;

    renderingContext.fillStyle = "rgba(255, 110, 96, 0.18)";
    renderingContext.beginPath();
    renderingContext.arc(0, 0, bonus.radius + 7, 0, Math.PI * 2);
    renderingContext.fill();

    renderingContext.fillStyle = "#f4f0e7";
    renderingContext.strokeStyle = "rgba(22, 18, 18, 0.9)";
    renderingContext.lineWidth = 2.2;
    roundedRectPath(renderingContext, -size * 0.42, -size * 0.33, size * 0.84, size * 0.66, size * 0.14);
    renderingContext.fill();
    renderingContext.stroke();

    renderingContext.fillStyle = "#e4433d";
    renderingContext.fillRect(-size * 0.09, -size * 0.2, size * 0.18, size * 0.4);
    renderingContext.fillRect(-size * 0.2, -size * 0.09, size * 0.4, size * 0.18);
    return true;
  }

  const pulse = 1 + Math.sin(time * 5.2 + bonus.bobPhase) * 0.04;
  const size = SMALL_MEDKIT_DRAW_SIZE * pulse;

  drawImageAssetCentered(renderingContext, asset, size);
  return true;
}

function drawBigMedkitBonus(renderingContext: CanvasRenderingContext2D, bonus: Bonus, time: number) {
  const asset = bonusImageAssets.big_medkit;
  if (!asset.loaded || !asset.image) {
    const pulse = 1 + Math.sin(time * 4.6 + bonus.bobPhase) * 0.035;
    const size = BIG_MEDKIT_DRAW_SIZE * pulse;

    renderingContext.fillStyle = "rgba(255, 156, 102, 0.22)";
    renderingContext.beginPath();
    renderingContext.arc(0, 0, bonus.radius + 9, 0, Math.PI * 2);
    renderingContext.fill();

    renderingContext.fillStyle = "#f6f2ea";
    renderingContext.strokeStyle = "rgba(24, 20, 20, 0.92)";
    renderingContext.lineWidth = 2.4;
    roundedRectPath(renderingContext, -size * 0.46, -size * 0.35, size * 0.92, size * 0.7, size * 0.14);
    renderingContext.fill();
    renderingContext.stroke();

    renderingContext.fillStyle = "#e4433d";
    renderingContext.fillRect(-size * 0.11, -size * 0.24, size * 0.22, size * 0.48);
    renderingContext.fillRect(-size * 0.24, -size * 0.11, size * 0.48, size * 0.22);
    return true;
  }

  const pulse = 1 + Math.sin(time * 4.6 + bonus.bobPhase) * 0.035;
  const size = BIG_MEDKIT_DRAW_SIZE * pulse;

  drawImageAssetCentered(renderingContext, asset, size);
  return true;
}

function drawShieldBonus(renderingContext: CanvasRenderingContext2D, bonus: Bonus, time: number) {
  const asset = bonusImageAssets.shield;
  if (!asset.loaded || !asset.image) {
    return false;
  }

  const pulse = 1 + Math.sin(time * 4.2 + bonus.bobPhase) * 0.04;
  const size = SHIELD_BONUS_DRAW_SIZE * pulse;

  drawImageAssetCentered(renderingContext, asset, size);
  return true;
}

function drawAirstrikeBonus(renderingContext: CanvasRenderingContext2D, bonus: Bonus, time: number) {
  const asset = bonusImageAssets.airstrike;
  if (!asset.loaded || !asset.image) {
    return false;
  }

  const pulse = 1 + Math.sin(time * 4 + bonus.bobPhase) * 0.045;
  const size = AIRSTRIKE_BONUS_DRAW_SIZE * pulse;

  drawImageAssetCentered(renderingContext, asset, size);
  return true;
}

function drawSpeedBonus(renderingContext: CanvasRenderingContext2D, bonus: Bonus, time: number) {
  const asset = bonusImageAssets.speed;
  if (!asset.loaded || !asset.image) {
    return false;
  }

  const pulse = 1 + Math.sin(time * 5.6 + bonus.bobPhase) * 0.045;
  const size = SPEED_BONUS_DRAW_SIZE * pulse;

  drawImageAssetCentered(renderingContext, asset, size);
  return true;
}

function drawAcidPool(renderingContext: CanvasRenderingContext2D, pool: AcidPool) {
  const asset = effectImageAssets.acid_pool;
  const fade = pool.lifetime < 0.6 ? clamp(pool.lifetime / 0.6, 0, 1) : 1;

  if (asset.loaded && asset.image) {
    const pulse = 1 + Math.sin((3 - pool.lifetime) * 8 + pool.x * 0.03 + pool.y * 0.02) * 0.025;
    const size = pool.radius * ACID_POOL_ART_SCALE * pulse;

    renderingContext.save();
    renderingContext.globalAlpha *= fade;
    renderingContext.translate(pool.x, pool.y);
    drawImageAssetCentered(renderingContext, asset, size);
    renderingContext.restore();
    return;
  }

  const gradient = renderingContext.createRadialGradient(pool.x, pool.y, 6, pool.x, pool.y, pool.radius * 1.05);
  gradient.addColorStop(0, "rgba(208, 255, 92, 0.82)");
  gradient.addColorStop(0.55, "rgba(116, 255, 72, 0.5)");
  gradient.addColorStop(1, "rgba(20, 92, 32, 0.18)");
  renderingContext.globalAlpha = fade;
  renderingContext.fillStyle = gradient;
  renderingContext.beginPath();
  renderingContext.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
  renderingContext.fill();

  renderingContext.strokeStyle = "rgba(179, 255, 79, 0.72)";
  renderingContext.lineWidth = 2;
  renderingContext.beginPath();
  renderingContext.arc(pool.x, pool.y, pool.radius * 0.92, 0, Math.PI * 2);
  renderingContext.stroke();
  renderingContext.globalAlpha = 1;
}

function drawEnemyHealthBar(renderingContext: CanvasRenderingContext2D, enemy: Enemy) {
  if (!enemy.alive || enemy.isDying || enemy.health <= 0) {
    return;
  }

  const width = enemy.type === "tank" ? 64 : enemy.type === "ninja" ? 44 : 40;
  const height = enemy.type === "tank" ? 7 : 6;
  const offsetY = enemy.type === "tank" ? enemy.radius + 36 : enemy.type === "ninja" ? enemy.radius + 22 : enemy.radius + 18;
  const ratio = clamp(enemy.health / Math.max(1, enemy.maxHealth), 0, 1);
  const fillColor = ratio > 0.66 ? "#85ef7e" : ratio > 0.33 ? "#ffcd58" : "#ff6b63";

  renderingContext.save();
  renderingContext.translate(enemy.x, enemy.y - offsetY);
  renderingContext.fillStyle = "rgba(6, 8, 6, 0.72)";
  renderingContext.fillRect(-width / 2 - 2, -2, width + 4, height + 4);
  renderingContext.fillStyle = "rgba(255, 255, 255, 0.14)";
  renderingContext.fillRect(-width / 2, 0, width, height);
  renderingContext.fillStyle = fillColor;
  renderingContext.fillRect(-width / 2, 0, width * ratio, height);
  renderingContext.strokeStyle = "rgba(255, 255, 255, 0.28)";
  renderingContext.lineWidth = 1;
  renderingContext.strokeRect(-width / 2, 0, width, height);
  renderingContext.restore();
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
  if (time <= 60) return "pistol";
  if (time <= 120) return "machine_gun";
  if (time <= 180) return "bazooka";
  return "flamethrower";
}

function weaponName(weapon: WeaponType) {
  if (weapon === "pistol") return "PISTOL";
  if (weapon === "machine_gun") return "MACHINE GUN";
  if (weapon === "flamethrower") return "FLAMETHROWER";
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
  player.bazookaPendingDelay = 0;
  player.flamethrowerStreamActive = false;
  player.flamethrowerTickTimer = 0;
}

function cancelShootingFlow(player: Player) {
  player.machineBurstRemaining = 0;
  player.machineBurstTimer = 0;
  player.machineHoldTime = 0;
  player.machineStreamActive = false;
  player.machineStreamTimer = 0;
  player.flamethrowerStreamActive = false;
  player.flamethrowerTickTimer = 0;
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

function roundedRectPath(
  renderingContext: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  renderingContext.beginPath();
  renderingContext.moveTo(x + r, y);
  renderingContext.lineTo(x + width - r, y);
  renderingContext.quadraticCurveTo(x + width, y, x + width, y + r);
  renderingContext.lineTo(x + width, y + height - r);
  renderingContext.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  renderingContext.lineTo(x + r, y + height);
  renderingContext.quadraticCurveTo(x, y + height, x, y + height - r);
  renderingContext.lineTo(x, y + r);
  renderingContext.quadraticCurveTo(x, y, x + r, y);
  renderingContext.closePath();
}

function resolveAssetUrl(path: string) {
  if (/^(?:https?:|data:|blob:)/.test(path)) {
    return path;
  }

  const isPublicAsset = path.startsWith("/assets/");
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const resolvedPath = normalizedBase && normalizedBase !== "/" && isPublicAsset
    ? `${normalizedBase}${path}`
    : path;

  if (isPublicAsset) {
    const separator = resolvedPath.includes("?") ? "&" : "?";
    return `${resolvedPath}${separator}v=${PUBLIC_ASSET_VERSION}`;
  }

  return resolvedPath;
}

function loadImageWithRetry(asset: LoadableImageAsset, label: string, attempt = 0) {
  const image = new Image();
  const resolvedUrl = resolveAssetUrl(asset.path);

  asset.loaded = false;
  asset.image = image;
  image.decoding = "async";
  image.onload = () => {
    asset.loaded = true;
    emitUi();
  };
  image.onerror = () => {
    const nextDelay = IMAGE_LOAD_RETRY_DELAYS_MS[attempt];

    if (nextDelay !== undefined) {
      window.setTimeout(() => loadImageWithRetry(asset, label, attempt + 1), nextDelay);
      return;
    }

    asset.loaded = true;
    asset.image = null;
    console.warn(
      `[Zombie Apocalypse Survival] Failed to load ${label} after ${attempt + 1} attempts: ${asset.path}`,
      { resolvedUrl },
    );
    emitUi();
  };
  image.src = resolvedUrl;
}

function loadZombieStripSet(strips: Record<string, ZombieStrip>) {
  for (const [name, strip] of Object.entries(strips)) {
    loadImageWithRetry(strip, `sprite "${name}"`);
  }
}

function loadImageAsset(asset: ImageAsset) {
  loadImageWithRetry(asset, "asset");
}

function ensureArenaBackgroundAsset() {
  if (arenaBackgroundRequested || typeof Image === "undefined") {
    return;
  }

  arenaBackgroundRequested = true;
  loadImageAsset(arenaImageAsset);
}

function ensureEffectSpriteAssets() {
  if (effectSpritesRequested || typeof Image === "undefined") {
    return;
  }

  effectSpritesRequested = true;
  for (const asset of Object.values(effectImageAssets)) {
    loadImageAsset(asset);
  }
  loadZombieStripSet({ flamethrowerFireStrip });
}

function ensureBonusSpriteAssets() {
  if (bonusSpritesRequested || typeof Image === "undefined") {
    return;
  }

  bonusSpritesRequested = true;
  for (const asset of Object.values(bonusImageAssets)) {
    loadImageAsset(asset);
  }
}

function ensureNormalZombieSpriteAssets() {
  if (normalZombieSpritesRequested || typeof Image === "undefined") {
    return;
  }

  normalZombieSpritesRequested = true;
  loadZombieStripSet(normalZombieStrips);
}

function ensureAcidZombieSpriteAssets() {
  if (acidZombieSpritesRequested || typeof Image === "undefined") {
    return;
  }

  acidZombieSpritesRequested = true;
  loadZombieStripSet(acidZombieStrips);
}

function ensureNinjaZombieSpriteAssets() {
  if (ninjaZombieSpritesRequested || typeof Image === "undefined") {
    return;
  }

  ninjaZombieSpritesRequested = true;
  loadZombieStripSet(ninjaZombieStrips);
}

function ensureTankZombieSpriteAssets() {
  if (tankZombieSpritesRequested || typeof Image === "undefined") {
    return;
  }

  tankZombieSpritesRequested = true;
  loadZombieStripSet(tankZombieStrips);
}

function ensurePlayerWeaponSpriteAssets(weapon: PlayerWeaponStripKey) {
  if (playerWeaponSpritesRequested[weapon] || typeof Image === "undefined") {
    return;
  }

  playerWeaponSpritesRequested[weapon] = true;
  loadZombieStripSet(playerWeaponStrips[weapon]);
}

function ensurePlayerSharedSpriteAssets() {
  if (playerSharedSpritesRequested || typeof Image === "undefined") {
    return;
  }

  playerSharedSpritesRequested = true;
  loadZombieStripSet(playerSharedStrips);
}

function ensureGameplaySpriteAssets(time: number) {
  void time;
  ensureArenaBackgroundAsset();
  ensureEffectSpriteAssets();
  ensureBonusSpriteAssets();
  ensureNormalZombieSpriteAssets();
  ensureAcidZombieSpriteAssets();
  ensureNinjaZombieSpriteAssets();
  ensureTankZombieSpriteAssets();
  ensurePlayerSharedSpriteAssets();
  ensurePlayerWeaponSpriteAssets("pistol");
  ensurePlayerWeaponSpriteAssets("rifle");
  ensurePlayerWeaponSpriteAssets("bazooka");
  ensurePlayerWeaponSpriteAssets("flamethrower");
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

function getLoopFrame(phase: number | undefined, frames: number) {
  const progress = ((phase ?? 0) / (Math.PI * 2)) % 1;
  return ((Math.floor(progress * frames) % frames) + frames) % frames;
}

function getTimedFrame(remaining: number | undefined, duration: number, frames: number) {
  const progress = clamp(1 - (remaining ?? 0) / duration, 0, 0.999);
  return Math.min(frames - 1, Math.floor(progress * frames));
}

function drawNinjaZombieSprite(renderingContext: CanvasRenderingContext2D, enemy: Enemy) {
  const animation = getNinjaZombieAnimation(enemy);
  const strip = ninjaZombieStrips[animation.name];

  if (!strip.loaded || !strip.image) {
    drawNinjaZombieFallback(renderingContext, enemy);
    return;
  }

  const drawWidth = strip.width * NINJA_ZOMBIE_DRAW_SCALE;
  const drawHeight = strip.height * NINJA_ZOMBIE_DRAW_SCALE;
  const rotation = (enemy.visualAngle ?? 0) - NINJA_ZOMBIE_BASE_FACING;
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
    -drawWidth * NINJA_ZOMBIE_PIVOT_X,
    -drawHeight * NINJA_ZOMBIE_PIVOT_Y,
    drawWidth,
    drawHeight,
  );
}

function drawTankZombieSprite(renderingContext: CanvasRenderingContext2D, enemy: Enemy) {
  const animation = getTankZombieAnimation(enemy);
  const strip = tankZombieStrips[animation.name];

  if (!strip.loaded || !strip.image) {
    drawTankZombieFallback(renderingContext, enemy);
    return;
  }

  const hitScaleCompensation = animation.name === "hit" ? 0.82 : 1;
  const drawWidth = strip.width * TANK_ZOMBIE_DRAW_SCALE * hitScaleCompensation;
  const drawHeight = strip.height * TANK_ZOMBIE_DRAW_SCALE * hitScaleCompensation;
  const rotation = (enemy.visualAngle ?? 0) - TANK_ZOMBIE_BASE_FACING;
  const corpseAlpha = enemy.isDying && (enemy.deathAnim ?? 0) <= 0
    ? clamp((enemy.corpseFade ?? 0) / 0.8, 0, 1)
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
    -drawWidth * TANK_ZOMBIE_PIVOT_X,
    -drawHeight * TANK_ZOMBIE_PIVOT_Y,
    drawWidth,
    drawHeight,
  );

  const impactStrip = tankZombieStrips.hammer_impact_fx;
  if ((enemy.impactTimer ?? 0) > 0 && impactStrip.loaded && impactStrip.image) {
    const impactFrame = getTimedFrame(enemy.impactTimer, TANK_IMPACT_FX_DURATION, impactStrip.frames);
    const impactAlpha = clamp((enemy.impactTimer ?? 0) / TANK_IMPACT_FX_DURATION, 0, 1);
    renderingContext.save();
    renderingContext.globalAlpha *= impactAlpha * 0.85;
    renderingContext.drawImage(
      impactStrip.image,
      impactFrame * impactStrip.width,
      0,
      impactStrip.width,
      impactStrip.height,
      -drawWidth * 0.52,
      drawHeight * 0.02,
      drawWidth,
      drawHeight,
    );
    renderingContext.restore();
  }
}

function getNinjaZombieAnimation(enemy: Enemy): { name: NinjaStripName; frame: number } {
  if (enemy.isDying) {
    return {
      name: "death",
      frame: getTimedFrame(enemy.deathAnim, NINJA_DEATH_ANIM_DURATION, ninjaZombieStrips.death.frames),
    };
  }

  if ((enemy.hitAnim ?? 0) > 0) {
    return {
      name: "hit",
      frame: getTimedFrame(enemy.hitAnim, 0.18, ninjaZombieStrips.hit.frames),
    };
  }

  if (enemy.state === "warning" && (enemy.attackAnim ?? 0) > 0) {
    return {
      name: "warning",
      frame: getTimedFrame(enemy.attackAnim, NINJA_WARNING_DURATION, ninjaZombieStrips.warning.frames),
    };
  }

  if (enemy.state === "attacking" && (enemy.attackAnim ?? 0) > 0) {
    return {
      name: "attack",
      frame: getTimedFrame(enemy.attackAnim, NINJA_ATTACK_ANIM_DURATION, ninjaZombieStrips.attack.frames),
    };
  }

  if (enemy.state === "jump_back" && (enemy.attackAnim ?? 0) > 0) {
    return {
      name: "jump_back",
      frame: getTimedFrame(enemy.attackAnim, NINJA_JUMP_BACK_DURATION, ninjaZombieStrips.jump_back.frames),
    };
  }

  if ((enemy.dashTimer ?? 0) > 0 && enemy.movingThisTick) {
    return {
      name: "dash",
      frame: getLoopFrame(enemy.gaitPhase, ninjaZombieStrips.dash.frames),
    };
  }

  if (enemy.movingThisTick) {
    return {
      name: "run",
      frame: getLoopFrame(enemy.gaitPhase, ninjaZombieStrips.run.frames),
    };
  }

  return {
    name: "idle",
    frame: getLoopFrame(enemy.idlePhase, ninjaZombieStrips.idle.frames),
  };
}

function getTankZombieAnimation(enemy: Enemy): { name: TankStripName; frame: number } {
  if (enemy.isDying) {
    return {
      name: "death",
      frame: getTimedFrame(enemy.deathAnim, TANK_DEATH_ANIM_DURATION, tankZombieStrips.death.frames),
    };
  }

  if ((enemy.hitAnim ?? 0) > 0) {
    return {
      name: "hit",
      frame: getTimedFrame(enemy.hitAnim, 0.2, tankZombieStrips.hit.frames),
    };
  }

  if (enemy.state === "windup" && (enemy.windupTimer ?? 0) > 0) {
    return {
      name: "attack_windup",
      frame: getTimedFrame(enemy.windupTimer, TANK_WINDUP_DURATION, tankZombieStrips.attack_windup.frames),
    };
  }

  if (enemy.state === "smash" && (enemy.attackAnim ?? 0) > 0) {
    return {
      name: "smash",
      frame: getTimedFrame(enemy.attackAnim, TANK_SMASH_ANIM_DURATION, tankZombieStrips.smash.frames),
    };
  }

  if (enemy.state === "recovery" && (enemy.recoveryTimer ?? 0) > 0) {
    return {
      name: "recovery",
      frame: getTimedFrame(enemy.recoveryTimer, TANK_RECOVERY_DURATION, tankZombieStrips.recovery.frames),
    };
  }

  if (enemy.state === "roar" && (enemy.recoveryTimer ?? 0) > 0) {
    return {
      name: "roar",
      frame: getTimedFrame(enemy.recoveryTimer, TANK_ROAR_DURATION, tankZombieStrips.roar.frames),
    };
  }

  if (enemy.movingThisTick) {
    return {
      name: "walk",
      frame: getLoopFrame(enemy.gaitPhase, tankZombieStrips.walk.frames),
    };
  }

  return {
    name: "idle",
    frame: getLoopFrame(enemy.idlePhase, tankZombieStrips.idle.frames),
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

function drawNinjaZombieFallback(renderingContext: CanvasRenderingContext2D, enemy: Enemy) {
  const corpseAlpha = enemy.isDying && (enemy.deathAnim ?? 0) <= 0
    ? clamp((enemy.corpseFade ?? 0) / 0.55, 0, 1)
    : 1;

  renderingContext.globalAlpha *= corpseAlpha;
  renderingContext.rotate((enemy.visualAngle ?? 0) - NINJA_ZOMBIE_BASE_FACING);
  renderingContext.fillStyle = enemy.hurtFlash > 0 ? "#ffd1d1" : "#202224";
  renderingContext.beginPath();
  renderingContext.ellipse(0, 0, 18, 21, 0, 0, Math.PI * 2);
  renderingContext.fill();
  renderingContext.strokeStyle = "#ff7267";
  renderingContext.lineWidth = 3;
  renderingContext.beginPath();
  renderingContext.moveTo(-20, 11);
  renderingContext.lineTo(28, -16);
  renderingContext.stroke();
}

function drawTankZombieFallback(renderingContext: CanvasRenderingContext2D, enemy: Enemy) {
  const corpseAlpha = enemy.isDying && (enemy.deathAnim ?? 0) <= 0
    ? clamp((enemy.corpseFade ?? 0) / 0.8, 0, 1)
    : 1;

  renderingContext.globalAlpha *= corpseAlpha;
  renderingContext.rotate((enemy.visualAngle ?? 0) - TANK_ZOMBIE_BASE_FACING);
  renderingContext.fillStyle = enemy.hurtFlash > 0 ? "#ffd3b8" : "#8b6250";
  renderingContext.beginPath();
  renderingContext.roundRect(-34, -28, 68, 56, 14);
  renderingContext.fill();

  renderingContext.fillStyle = "#2b1b16";
  renderingContext.fillRect(-12, 24, 24, 34);
  renderingContext.beginPath();
  renderingContext.arc(0, 60, 14, 0, Math.PI * 2);
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
