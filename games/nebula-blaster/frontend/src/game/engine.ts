import {
  createGameState,
  spawnBullet,
  spawnEnemy,
  spawnPowerUp,
  spawnParticle,
  spawnFloatText,
  CANVAS_W,
  CANVAS_H,
  PLAYER_W,
  PLAYER_H,
  PLAYER_SPEED,
  FIRE_RATE,
  BULLET_SPEED,
  BULLET_W,
  BULLET_H,
  ENEMY_BULLET_SPEED,
  DRONE_FIRE_INTERVAL,
  MULTIPLIER_WINDOW,
  RUN_DURATION,
  POWERUP_DROP_CHANCE,
  MAX_SCORE_PER_SECOND,
  PLAYER_MAX_HP,
  type GameState,
  type HudData,
} from "./entities";
import { aabb, rectFromCenter } from "./collision";
import { tickSpawner } from "./spawner";
import { renderFrame } from "./renderer";
import { attachInput, detachInput, getInput, clearJustPressed, resetInput } from "./input";
import { sfxPlayerLaser, sfxEnemyLaser, sfxEnemyExplosion, sfxPlayerExplosion, sfxPlayerHit, sfxTakeBonus, sfxGameStart, startBgMusic, stopBgMusic, playVictory } from "./sound";

const STEP_MS = 1000 / 60;

// Random rotation speed: 0.4–2.5 rad/s, random direction
function randRot() {
  return (0.4 + Math.random() * 2.1) * (Math.random() < 0.5 ? 1 : -1);
}

export type GameEndPayload = {
  score: number;
  durationMs: number;
  reason: "timeout" | "death";
};

let state: GameState = createGameState();
let hudData: HudData = snapshotHud(state);
let rafId = 0;
let last = 0;
let acc = 0;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let onEndCallback: ((payload: GameEndPayload) => void) | null = null;

function snapshotHud(s: GameState): HudData {
  return {
    status: s.status,
    score: s.score,
    multiplier: s.multiplier,
    hp: s.player.hp,
    timeLeft: Math.max(0, Math.ceil(RUN_DURATION - s.time)),
    hasShield: s.player.hasShield,
    hasTripleShot: s.time < s.player.tripleShotUntil,
  };
}

export function getHudData(): HudData {
  return hudData;
}

export function mountCanvas(el: HTMLCanvasElement, onEnd: (payload: GameEndPayload) => void) {
  canvas = el;
  ctx = el.getContext("2d");
  onEndCallback = onEnd;
  attachInput();
}

export function unmountCanvas() {
  stop();
  stopBgMusic();
  detachInput();
  resetInput();
  canvas = null;
  ctx = null;
  onEndCallback = null;
}

export function startGame() {
  state = createGameState();
  state.status = "playing";
  hudData = snapshotHud(state);
  last = 0;
  acc = 0;
  sfxGameStart();
  startBgMusic();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

export function stop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function frame(t: number) {
  if (document.hidden) {
    last = t;
    acc = 0;
    rafId = requestAnimationFrame(frame);
    return;
  }

  if (last === 0) last = t;
  const frameDt = Math.min((t - last) / 1000, 0.1); // true wall-clock delta, capped at 100ms
  acc += t - last;
  last = t;

  while (acc >= STEP_MS) {
    tick(STEP_MS / 1000);
    acc -= STEP_MS;
  }

  if (ctx && canvas) {
    const { width: cssW, height: cssH } = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const nextW = Math.max(1, Math.round(cssW * dpr));
    const nextH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    ctx.setTransform(canvas.width / CANVAS_W, 0, 0, canvas.height / CANVAS_H, 0, 0);

    let shakeX = 0;
    let shakeY = 0;
    if (state.shakeDuration > 0) {
      const str = state.shakeStrength * (state.shakeDuration / 0.3);
      shakeX = (Math.random() - 0.5) * str;
      shakeY = (Math.random() - 0.5) * str;
    }

    renderFrame(ctx, state, frameDt, shakeX, shakeY);
  }

  rafId = requestAnimationFrame(frame);
}

function tick(dt: number) {
  if (state.status !== "playing") return;

  state.time += dt;

  if (state.shakeDuration > 0) {
    state.shakeDuration = Math.max(0, state.shakeDuration - dt);
  }

  // Player movement
  const input = getInput();
  const p = state.player;
  if (input.left) p.x -= PLAYER_SPEED * dt;
  if (input.right) p.x += PLAYER_SPEED * dt;
  if (input.up) p.y -= PLAYER_SPEED * dt;
  if (input.down) p.y += PLAYER_SPEED * dt;
  p.x = Math.max(PLAYER_W / 2, Math.min(CANVAS_W - PLAYER_W / 2, p.x));
  p.y = Math.max(PLAYER_H / 2, Math.min(CANVAS_H - PLAYER_H / 2, p.y));

  // Player shooting
  p.sinceLastShot += dt;
  if (input.fire && p.sinceLastShot >= 1 / FIRE_RATE) {
    p.sinceLastShot = 0;
    const hasTriple = state.time < p.tripleShotUntil;
    sfxPlayerLaser();
    spawnBullet(state, p.x, p.y - PLAYER_H / 2, 0, -BULLET_SPEED, false);
    if (hasTriple) {
      spawnBullet(state, p.x, p.y - PLAYER_H / 2, -BULLET_SPEED * 0.25, -BULLET_SPEED * 0.97, false);
      spawnBullet(state, p.x, p.y - PLAYER_H / 2, BULLET_SPEED * 0.25, -BULLET_SPEED * 0.97, false);
    }
  }
  clearJustPressed();

  // Move bullets
  for (const b of state.bullets) {
    if (!b.alive) continue;
    b.x += b.dx * dt;
    b.y += b.dy * dt;
    if (b.x < -20 || b.x > CANVAS_W + 20 || b.y < -20 || b.y > CANVAS_H + 20) {
      b.alive = false;
    }
  }

  // Move power-ups
  for (const pu of state.powerUps) {
    if (!pu.alive) continue;
    pu.y += pu.dy * dt;
    if (pu.y > CANVAS_H + 20) pu.alive = false;

    // Player picks up power-up
    if (aabb(rectFromCenter(p.x, p.y, PLAYER_W, PLAYER_H), rectFromCenter(pu.x, pu.y, 20, 20))) {
      pu.alive = false;
      sfxTakeBonus();
      if (pu.type === "tripleShot") {
        p.tripleShotUntil = state.time + 10;
        spawnFloatText(state, pu.x, pu.y, "Triple Shot!");
      } else if (pu.type === "shield") {
        p.hasShield = true;
        spawnFloatText(state, pu.x, pu.y, "Shield!");
      } else {
        p.hp = Math.min(PLAYER_MAX_HP, p.hp + 1);
        spawnFloatText(state, pu.x, pu.y, "+1 HP");
      }
    }
  }

  // Move / think enemies
  for (const e of state.enemies) {
    if (!e.alive) continue;
    e.x += e.dx * dt;
    e.y += e.dy * dt;
    if (e.rotSpeed !== 0) e.angle += e.rotSpeed * dt;

    if (e.type === "drone") {
      // Track player horizontally
      const dir = p.x > e.x ? 1 : -1;
      e.dx += dir * 80 * dt;
      e.dx = Math.max(-120, Math.min(120, e.dx));

      // Drone fires at player only in the upper half of the screen
      e.sinceLastShot += dt;
      if (e.y < CANVAS_H / 2 && e.sinceLastShot >= DRONE_FIRE_INTERVAL) {
        e.sinceLastShot = 0;
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        sfxEnemyLaser();
        spawnBullet(state, e.x, e.y, (dx / len) * ENEMY_BULLET_SPEED, (dy / len) * ENEMY_BULLET_SPEED, true);
      }
    }

    // Off-screen
    if (e.x < -60 || e.x > CANVAS_W + 60 || e.y > CANVAS_H + 60) {
      e.alive = false;
    }
  }

  // Bullet–enemy collisions
  for (const b of state.bullets) {
    if (!b.alive || b.fromEnemy) continue;
    const br = rectFromCenter(b.x, b.y, BULLET_W, BULLET_H);
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const er = rectFromCenter(e.x, e.y, e.type === "chunk" ? 20 : e.type === "drone" ? 28 : e.type === "splitter" ? 32 : 36, e.type === "chunk" ? 20 : e.type === "drone" ? 28 : e.type === "splitter" ? 32 : 36);
      if (!aabb(br, er)) continue;

      b.alive = false;
      e.hp -= 1;

      if (e.hp <= 0) {
        killEnemy(e.type, e.x, e.y);
        e.alive = false;
      } else {
        // Hit flash particles
        spawnHitParticles(e.x, e.y, 3);
      }
      break;
    }
  }

  // Enemy bullets hit player
  if (state.time >= p.invulnUntil) {
    for (const b of state.bullets) {
      if (!b.alive || !b.fromEnemy) continue;
      if (aabb(rectFromCenter(b.x, b.y, 8, 8), rectFromCenter(p.x, p.y, PLAYER_W * 0.7, PLAYER_H * 0.7))) {
        b.alive = false;
        damagePlayer();
      }
    }
  }

  // Enemy body collision with player
  if (state.time >= p.invulnUntil) {
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const r = e.type === "chunk" ? 10 : 18;
      if (aabb(rectFromCenter(e.x, e.y, r * 2, r * 2), rectFromCenter(p.x, p.y, PLAYER_W * 0.7, PLAYER_H * 0.7))) {
        e.alive = false;
        damagePlayer();
      }
    }
  }

  // Particles
  for (const pt of state.particles) {
    if (!pt.alive) continue;
    pt.x += pt.dx * dt;
    pt.y += pt.dy * dt;
    pt.life -= pt.decayRate * dt;
    if (pt.life <= 0) pt.alive = false;
  }

  // Float texts
  for (const ft of state.floatTexts) {
    if (!ft.alive) continue;
    ft.y += ft.dy * dt;
    ft.life -= ft.decayRate * dt;
    if (ft.life <= 0) ft.alive = false;
  }

  // Spawner
  tickSpawner(state, dt);

  // Timer
  if (state.time >= RUN_DURATION) {
    endGame("timeout");
    return;
  }

  // Snapshot HUD (will be read by React at 4Hz)
  hudData = snapshotHud(state);
}

function killEnemy(type: string, x: number, y: number) {
  sfxEnemyExplosion();
  const basePoints =
    type === "drone" ? 30 :
    type === "splitter" ? 20 :
    type === "chunk" ? 5 : 10;

  const points = basePoints * state.multiplier;
  // Clamp score to contract sanity bound defensively
  const cap = MAX_SCORE_PER_SECOND * Math.ceil(state.time + 1);
  state.score = Math.min(state.score + points, cap);

  // Multiplier logic
  const timeSinceKill = state.time - state.lastKillTime;
  if (timeSinceKill <= MULTIPLIER_WINDOW) {
    state.multiplier = Math.min(4, state.multiplier + 1);
  } else {
    state.multiplier = 1;
  }
  state.lastKillTime = state.time;

  spawnFloatText(state, x, y - 10, `+${points}`);

  // Explosion particles
  const count = type === "drone" ? 18 : 12;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 60 + Math.random() * 120;
    const r = type === "drone" ? 168 : type === "splitter" ? 249 : 150;
    const g = type === "drone" ? 85 : type === "splitter" ? 115 : 150;
    const b2 = type === "drone" ? 247 : type === "splitter" ? 22 : 150;
    spawnParticle(state, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 3 + Math.random() * 3, r, g, b2);
  }

  // Splitter spawns children
  if (type === "splitter") {
    spawnEnemy(state, "chunk", x - 14, y, -70,  70, 1, randRot());
    spawnEnemy(state, "chunk", x + 14, y,  70,  70, 1, randRot());
    spawnEnemy(state, "chunk", x,      y,   0, 130, 1, randRot());
  }

  // Power-up drop
  if (Math.random() < POWERUP_DROP_CHANCE) {
    const roll = Math.random();
    const puType = roll < 0.33 ? "tripleShot" : roll < 0.66 ? "shield" : "hp";
    spawnPowerUp(state, puType, x, y);
  }

  // Screen shake
  state.shakeDuration = 0.1;
  state.shakeStrength = type === "drone" ? 6 : 4;
}

function spawnHitParticles(x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    spawnParticle(state, x, y, Math.cos(angle) * 80, Math.sin(angle) * 80, 2, 255, 220, 100, 1, 3);
  }
}

function damagePlayer() {
  const p = state.player;
  if (p.hasShield) {
    p.hasShield = false;
    sfxPlayerHit();
    spawnFloatText(state, p.x, p.y - 30, "Shield broke!");
    state.shakeDuration = 0.15;
    state.shakeStrength = 5;
    p.invulnUntil = state.time + 1.2;
    return;
  }

  sfxPlayerHit();
  p.hp -= 1;
  state.multiplier = 1; // Taking damage resets multiplier
  state.shakeDuration = 0.25;
  state.shakeStrength = 10;
  p.invulnUntil = state.time + 1.5;

  // Damage particles
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    spawnParticle(state, p.x, p.y, Math.cos(angle) * 100, Math.sin(angle) * 100, 4, 239, 68, 68, 1, 2.5);
  }

  if (p.hp <= 0) {
    p.hp = 0;
    sfxPlayerExplosion();
    endGame("death");
  }
}

function endGame(reason: "timeout" | "death") {
  if (state.status === "ended") return;
  state.status = "ended";
  state.endReason = reason;
  hudData = snapshotHud(state);
  if (reason === "timeout") {
    playVictory();
  } else {
    stopBgMusic();
  }

  const durationMs = Math.round(state.time * 1000);
  const finalScore = state.score;
  if (onEndCallback) {
    onEndCallback({ score: finalScore, durationMs, reason });
  }
}
