import {
  CANVAS_W,
  CANVAS_H,
  PLAYER_W,
  PLAYER_H,
  BULLET_W,
  BULLET_H,
  type GameState,
} from "./entities";
import { drawSprite } from "./sprites";

// Star colour tiers: bright white-blue core → mid blue → deep indigo dim
const STAR_PALETTES = [
  { r: 220, g: 235, b: 255 }, // bright white-blue
  { r: 140, g: 190, b: 255 }, // sky blue
  { r:  80, g: 140, b: 255 }, // vivid blue
  { r:  60, g:  90, b: 220 }, // mid blue
  { r:  40, g:  55, b: 180 }, // deep blue
  { r:  30, g:  40, b: 130 }, // dim indigo
];

type Star = { x: number; y: number; r: number; speed: number; palette: typeof STAR_PALETTES[number]; phase: number };

const STAR_COUNT = 110;
const stars: Star[] = Array.from({ length: STAR_COUNT }, () => {
  // Bias toward slower (dimmer) stars — most are in tiers 3-5
  const tierRoll = Math.random();
  const tier =
    tierRoll < 0.08 ? 0 :   // 8%  brightest
    tierRoll < 0.20 ? 1 :   // 12%
    tierRoll < 0.40 ? 2 :   // 20%
    tierRoll < 0.65 ? 3 :   // 25%
    tierRoll < 0.85 ? 4 :   // 20%
                      5;    // 15% dimmest
  // Faster stars are larger and brighter (parallax layers)
  const speedBase = tier === 0 ? 200 : tier === 1 ? 130 : tier === 2 ? 90 : tier === 3 ? 55 : tier === 4 ? 30 : 15;
  return {
    x: Math.random() * CANVAS_W,
    y: Math.random() * CANVAS_H,
    r: 0.4 + (5 - tier) * 0.28 + Math.random() * 0.4,
    speed: speedBase * (0.8 + Math.random() * 0.4),
    palette: STAR_PALETTES[tier],
    phase: Math.random() * Math.PI * 2, // for glow pulse
  };
});

let starTime = 0;

export function renderFrame(ctx: CanvasRenderingContext2D, state: GameState, dt: number, shakeX: number, shakeY: number) {
  starTime += dt;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Sky
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bg.addColorStop(0, "#03040d");
  bg.addColorStop(1, "#06080f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars — parallax scroll with per-tier colour and glow pulse
  for (const star of stars) {
    star.y += star.speed * dt;
    star.phase += dt * (1.2 + star.r * 0.4); // brighter stars pulse faster
    if (star.y > CANVAS_H + 4) {
      star.y = -4;
      star.x = Math.random() * CANVAS_W;
    }

    const { r, g, b } = star.palette;
    // Core alpha: bright tiers fully opaque, dim tiers semi-transparent
    const baseAlpha = 0.5 + (1 - star.speed / 240) * 0.45;
    const pulse = 0.08 * Math.sin(star.phase); // subtle twinkle ±8%
    const alpha = Math.min(1, Math.max(0.15, baseAlpha + pulse));

    // Outer glow — shadowBlur scaled to star size and tier brightness
    const glowRadius = star.r * (2.5 + (1 - star.speed / 240) * 3);
    ctx.shadowBlur = glowRadius;
    ctx.shadowColor = `rgba(${r},${g},${b},${alpha * 0.7})`;

    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Particles
  for (const p of state.particles) {
    if (!p.alive) continue;
    ctx.globalAlpha = p.life;
    ctx.fillStyle = `rgb(${p.red},${p.green},${p.blue})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.radius * p.life), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Power-ups
  for (const pu of state.powerUps) {
    if (!pu.alive) continue;
    if (pu.type === "tripleShot") {
      drawSprite(ctx, "bonusFire", pu.x, pu.y, 28, 28);
    } else if (pu.type === "hp") {
      drawSprite(ctx, "health", pu.x, pu.y, 28, 28);
    } else {
      drawSprite(ctx, "shield", pu.x, pu.y, 28, 28);
    }
  }

  // Enemy bullets
  for (const b of state.bullets) {
    if (!b.alive || !b.fromEnemy) continue;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#ff2020";
    ctx.fillStyle = "#ff6060";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fill();
    // bright core
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#ffe0e0";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Enemies
  for (const e of state.enemies) {
    if (!e.alive) continue;
    drawEnemy(ctx, e.x, e.y, e.type, e.hp, e.angle);
  }

  // Player bullets
  for (const b of state.bullets) {
    if (!b.alive || b.fromEnemy) continue;
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#38bdf8";
    ctx.fillStyle = "#7dd3fc";
    ctx.fillRect(b.x - BULLET_W / 2, b.y - BULLET_H / 2, BULLET_W, BULLET_H);
    // bright core
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#e0f7ff";
    ctx.fillRect(b.x - 1, b.y - BULLET_H / 2, 2, BULLET_H);
  }
  ctx.shadowBlur = 0;

  // Player
  if (state.status !== "ended") {
    drawPlayer(ctx, state.player.x, state.player.y, state.player.hp, state.player.hasShield, state.time, state.player.invulnUntil);
  }

  // Float texts
  for (const ft of state.floatTexts) {
    if (!ft.alive) continue;
    ctx.globalAlpha = ft.life;
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  // Overlay screens
  if (state.status === "idle") {
    drawOverlay(ctx, "NEBULA BLASTER", "Connect wallet & click Play");
  } else if (state.status === "ended") {
    const title = state.endReason === "timeout" ? "VICTORY!" : "GAME OVER";
    drawOverlay(ctx, title, `Score: ${state.score}`);
  }

  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, x: number, y: number, type: string, _hp: number, angle = 0) {
  if (type === "asteroid") {
    drawSprite(ctx, "asteroid", x, y, 40, 40, angle);
  } else if (type === "chunk") {
    drawSprite(ctx, "chunk", x, y, 24, 24, angle);
  } else if (type === "drone") {
    drawSprite(ctx, "drone", x, y, 36, 36);
  } else if (type === "splitter") {
    drawSprite(ctx, "splitter", x, y, 52, 52);
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hp: number,
  hasShield: boolean,
  time: number,
  invulnUntil: number,
) {
  const invuln = time < invulnUntil;
  if (invuln && Math.floor(time * 12) % 2 === 0) return; // blink when invulnerable

  ctx.save();
  ctx.translate(x, y);

  // Shield ring
  if (hasShield) {
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#38bdf8";
    ctx.strokeStyle = "rgba(56,189,248,0.7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_W / 2 + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // HP-tinted engine glow beneath the sprite
  const hpColor = hp >= 3 ? "#00e87b" : hp === 2 ? "#f59e0b" : "#ef4444";
  ctx.shadowBlur = 14;
  ctx.shadowColor = hpColor;
  ctx.fillStyle = hpColor;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(0, PLAYER_H / 2 + 2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  ctx.restore();

  // Ship sprite (drawn outside save/restore so translate doesn't stack)
  drawSprite(ctx, "playerShip", x, y, PLAYER_W * 1.6, PLAYER_H * 1.6);
}

function drawOverlay(ctx: CanvasRenderingContext2D, title: string, sub: string) {
  ctx.fillStyle = "rgba(3,4,13,0.72)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "900 38px Trebuchet MS, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 20);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 16px Trebuchet MS, system-ui";
  ctx.fillText(sub, CANVAS_W / 2, CANVAS_H / 2 + 20);
  ctx.textAlign = "left";
}
