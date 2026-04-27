export const CANVAS_W = 480;
export const CANVAS_H = 720;

export const MAX_BULLETS = 200;
export const MAX_PARTICLES = 500;
export const MAX_ENEMIES = 100;
export const MAX_POWERUPS = 20;
export const MAX_FLOAT_TEXTS = 50;

export const PLAYER_W = 36;
export const PLAYER_H = 36;
export const PLAYER_SPEED = 260; // px/s
export const PLAYER_MAX_HP = 3;
export const FIRE_RATE = 5; // shots/s
export const BULLET_SPEED = 640; // px/s
export const BULLET_W = 4;
export const BULLET_H = 12;

export const ENEMY_BULLET_SPEED = 400;
export const DRONE_FIRE_INTERVAL = 2.0; // s
export const MULTIPLIER_WINDOW = 1.5; // s — kill within this window to increment
export const RUN_DURATION = 60.0; // s
export const POWERUP_DROP_CHANCE = 0.03; // 3%
export const MAX_SCORE_PER_SECOND = 200; // matches contract sanity bound

export type EnemyType = "asteroid" | "drone" | "splitter" | "chunk";
export type PowerUpType = "tripleShot" | "shield" | "hp";

export type Player = {
  x: number;
  y: number;
  hp: number;
  invulnUntil: number; // game time s
  tripleShotUntil: number;
  hasShield: boolean;
  sinceLastShot: number; // accumulated time since last shot
};

export type Bullet = {
  alive: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  fromEnemy: boolean;
};

export type Enemy = {
  alive: boolean;
  type: EnemyType;
  x: number;
  y: number;
  dx: number;
  dy: number;
  hp: number;
  sinceLastShot: number; // drone only
  angle: number;     // radians, used for rotation
  rotSpeed: number;  // radians/s, 0 for non-rotating types
};

export type PowerUp = {
  alive: boolean;
  type: PowerUpType;
  x: number;
  y: number;
  dy: number;
};

export type Particle = {
  alive: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  r: number;
  life: number; // 0-1
  decayRate: number;
  radius: number;
  red: number;
  green: number;
  blue: number;
};

export type FloatText = {
  alive: boolean;
  x: number;
  y: number;
  dy: number;
  life: number; // 0-1
  decayRate: number;
  text: string;
};

export type GameStatus = "idle" | "playing" | "ended";
export type EndReason = "timeout" | "death" | null;

export type GameState = {
  status: GameStatus;
  endReason: EndReason;
  time: number; // elapsed s
  score: number;
  multiplier: number;
  lastKillTime: number;
  spawnAccum: number;
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  powerUps: PowerUp[];
  particles: Particle[];
  floatTexts: FloatText[];
  shakeDuration: number;
  shakeStrength: number;
};

export type HudData = {
  status: GameStatus;
  score: number;
  multiplier: number;
  hp: number;
  timeLeft: number;
  hasShield: boolean;
  hasTripleShot: boolean;
};

function makeBullets(): Bullet[] {
  return Array.from({ length: MAX_BULLETS }, () => ({
    alive: false, x: 0, y: 0, dx: 0, dy: 0, fromEnemy: false,
  }));
}

function makeEnemies(): Enemy[] {
  return Array.from({ length: MAX_ENEMIES }, () => ({
    alive: false, type: "asteroid" as EnemyType, x: 0, y: 0,
    dx: 0, dy: 0, hp: 0, sinceLastShot: 0, angle: 0, rotSpeed: 0,
  }));
}

function makePowerUps(): PowerUp[] {
  return Array.from({ length: MAX_POWERUPS }, () => ({
    alive: false, type: "hp" as PowerUpType, x: 0, y: 0, dy: 0,
  }));
}

function makeParticles(): Particle[] {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    alive: false, x: 0, y: 0, dx: 0, dy: 0, r: 0,
    life: 0, decayRate: 0, radius: 0, red: 255, green: 255, blue: 255,
  }));
}

function makeFloatTexts(): FloatText[] {
  return Array.from({ length: MAX_FLOAT_TEXTS }, () => ({
    alive: false, x: 0, y: 0, dy: 0, life: 0, decayRate: 0, text: "",
  }));
}

export function createGameState(): GameState {
  return {
    status: "idle",
    endReason: null,
    time: 0,
    score: 0,
    multiplier: 1,
    lastKillTime: -99,
    spawnAccum: 0,
    player: {
      x: CANVAS_W / 2,
      y: CANVAS_H - 80,
      hp: PLAYER_MAX_HP,
      invulnUntil: 0,
      tripleShotUntil: 0,
      hasShield: false,
      sinceLastShot: 99,
    },
    bullets: makeBullets(),
    enemies: makeEnemies(),
    powerUps: makePowerUps(),
    particles: makeParticles(),
    floatTexts: makeFloatTexts(),
    shakeDuration: 0,
    shakeStrength: 0,
  };
}

export function spawnBullet(
  state: GameState,
  x: number,
  y: number,
  dx: number,
  dy: number,
  fromEnemy: boolean,
) {
  for (const b of state.bullets) {
    if (!b.alive) {
      b.alive = true;
      b.x = x;
      b.y = y;
      b.dx = dx;
      b.dy = dy;
      b.fromEnemy = fromEnemy;
      return;
    }
  }
}

export function spawnEnemy(
  state: GameState,
  type: EnemyType,
  x: number, y: number,
  dx: number, dy: number,
  hp: number,
  rotSpeed = 0,
) {
  for (const e of state.enemies) {
    if (!e.alive) {
      e.alive = true;
      e.type = type;
      e.x = x;
      e.y = y;
      e.dx = dx;
      e.dy = dy;
      e.hp = hp;
      e.sinceLastShot = 0;
      e.angle = Math.random() * Math.PI * 2;
      e.rotSpeed = rotSpeed;
      return;
    }
  }
}

export function spawnPowerUp(state: GameState, type: PowerUpType, x: number, y: number) {
  for (const p of state.powerUps) {
    if (!p.alive) {
      p.alive = true;
      p.type = type;
      p.x = x;
      p.y = y;
      p.dy = 60;
      return;
    }
  }
}

export function spawnParticle(
  state: GameState,
  x: number,
  y: number,
  dx: number,
  dy: number,
  radius: number,
  red: number,
  green: number,
  blue: number,
  life = 1.0,
  decayRate = 1.8,
) {
  for (const p of state.particles) {
    if (!p.alive) {
      p.alive = true;
      p.x = x;
      p.y = y;
      p.dx = dx;
      p.dy = dy;
      p.radius = radius;
      p.red = red;
      p.green = green;
      p.blue = blue;
      p.life = life;
      p.decayRate = decayRate;
      return;
    }
  }
}

export function spawnFloatText(state: GameState, x: number, y: number, text: string) {
  for (const f of state.floatTexts) {
    if (!f.alive) {
      f.alive = true;
      f.x = x;
      f.y = y;
      f.dy = -60;
      f.text = text;
      f.life = 1.0;
      f.decayRate = 1.4;
      return;
    }
  }
}
