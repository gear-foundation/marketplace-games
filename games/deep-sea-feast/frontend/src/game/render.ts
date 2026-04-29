import {
  BABY_FISH_REACTION_ANIMATION_MS,
  BABY_FISH_REACTION_FRAME_DURATION_MS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GAME_OVER_OVERLAY_DELAY_MS,
  HOOK_METAL_HEIGHT,
  HOOK_METAL_WIDTH,
  HOOK_WARNING_MS,
  PLAYER_BITE_ANIMATION_MS,
  PLAYER_BITE_FRAME_DURATION_MS,
  PLAYER_GROWTH_PULSE_MS,
  PLAYER_GROWTH_PULSE_SCALE,
  PLAYER_GROWTH_PULSE_SWAP_AT,
  PLAYER_HURT_FRAME_DURATION_MS,
} from "./constants";
import { getFishRadius, getFishVisualSize, getFishingHookPosition, getPlanktonRadius } from "./update";
import type { EnemyFish, FishingHook, GameState, Plankton } from "./types";

export type PreparedSprite = {
  image: CanvasImageSource;
  width: number;
  height: number;
  aspect: number;
};

export type RawFishRenderAssets = {
  babyFishBiteFrames: HTMLImageElement[];
  level2FishBiteFrames: HTMLImageElement[];
  level2FishHurtFrames: HTMLImageElement[];
  level3FishBiteFrames: HTMLImageElement[];
  level3FishHurtFrames: HTMLImageElement[];
  level4FishBiteFrames: HTMLImageElement[];
  level4FishHurtFrames: HTMLImageElement[];
  level5FishBiteFrames: HTMLImageElement[];
  level5FishHurtFrames: HTMLImageElement[];
  level6FishBiteFrames: HTMLImageElement[];
  level6FishHurtFrames: HTMLImageElement[];
  level7FishBiteFrames: HTMLImageElement[];
  level7FishHurtFrames: HTMLImageElement[];
  level8FishBiteFrames: HTMLImageElement[];
  babyFishReactionFrames: HTMLImageElement[];
  babyFishImage: HTMLImageElement | null;
  backgroundImage: HTMLImageElement | null;
  planktonImage: HTMLImageElement | null;
};

export type FishRenderAssets = {
  babyFishBiteFrames: PreparedSprite[];
  level2FishBiteFrames: PreparedSprite[];
  level2FishHurtFrames: PreparedSprite[];
  level3FishBiteFrames: PreparedSprite[];
  level3FishHurtFrames: PreparedSprite[];
  level4FishBiteFrames: PreparedSprite[];
  level4FishHurtFrames: PreparedSprite[];
  level5FishBiteFrames: PreparedSprite[];
  level5FishHurtFrames: PreparedSprite[];
  level6FishBiteFrames: PreparedSprite[];
  level6FishHurtFrames: PreparedSprite[];
  level7FishBiteFrames: PreparedSprite[];
  level7FishHurtFrames: PreparedSprite[];
  level8FishBiteFrames: PreparedSprite[];
  babyFishReactionFrames: PreparedSprite[];
  babyFishImage: PreparedSprite | null;
  backgroundCanvas: HTMLCanvasElement | null;
  planktonImage: PreparedSprite | null;
};

type ImageBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const imageBoundsCache = new WeakMap<HTMLImageElement, ImageBounds>();

function getImageAlphaBounds(image: HTMLImageElement): ImageBounds {
  const cachedBounds = imageBoundsCache.get(image);
  if (cachedBounds) {
    return cachedBounds;
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return { x: 0, y: 0, width, height };
  }

  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const bounds = maxX < minX
    ? { x: 0, y: 0, width, height }
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };

  imageBoundsCache.set(image, bounds);
  return bounds;
}

function prepareTrimmedSprite(image: HTMLImageElement): PreparedSprite {
  const bounds = getImageAlphaBounds(image);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, bounds.width);
  canvas.height = Math.max(1, bounds.height);
  const context = canvas.getContext("2d");

  if (context) {
    context.drawImage(
      image,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }

  return {
    image: canvas,
    width: canvas.width,
    height: canvas.height,
    aspect: canvas.width / canvas.height,
  };
}

function drawPreparedSprite(
  ctx: CanvasRenderingContext2D,
  sprite: PreparedSprite,
  targetWidth: number,
  targetHeight: number,
) {
  ctx.drawImage(
    sprite.image,
    -targetWidth / 2,
    -targetHeight / 2,
    targetWidth,
    targetHeight,
  );
}

function drawCoverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  const scale = Math.max(FIELD_WIDTH / image.naturalWidth, FIELD_HEIGHT / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const x = (FIELD_WIDTH - drawWidth) / 2;
  const y = (FIELD_HEIGHT - drawHeight) / 2;

  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function prepareBackdropCanvas(backgroundImage: HTMLImageElement | null): HTMLCanvasElement | null {
  if (!backgroundImage) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = FIELD_WIDTH;
  canvas.height = FIELD_HEIGHT;
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    return null;
  }

  drawCoverImage(context, backgroundImage);
  context.fillStyle = "rgba(3, 31, 45, 0.12)";
  context.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  return canvas;
}

export function prepareFishRenderAssets(assets: RawFishRenderAssets): FishRenderAssets {
  const prepareFrames = (frames: HTMLImageElement[]) => frames.map(prepareTrimmedSprite);

  return {
    babyFishBiteFrames: prepareFrames(assets.babyFishBiteFrames),
    level2FishBiteFrames: prepareFrames(assets.level2FishBiteFrames),
    level2FishHurtFrames: prepareFrames(assets.level2FishHurtFrames),
    level3FishBiteFrames: prepareFrames(assets.level3FishBiteFrames),
    level3FishHurtFrames: prepareFrames(assets.level3FishHurtFrames),
    level4FishBiteFrames: prepareFrames(assets.level4FishBiteFrames),
    level4FishHurtFrames: prepareFrames(assets.level4FishHurtFrames),
    level5FishBiteFrames: prepareFrames(assets.level5FishBiteFrames),
    level5FishHurtFrames: prepareFrames(assets.level5FishHurtFrames),
    level6FishBiteFrames: prepareFrames(assets.level6FishBiteFrames),
    level6FishHurtFrames: prepareFrames(assets.level6FishHurtFrames),
    level7FishBiteFrames: prepareFrames(assets.level7FishBiteFrames),
    level7FishHurtFrames: prepareFrames(assets.level7FishHurtFrames),
    level8FishBiteFrames: prepareFrames(assets.level8FishBiteFrames),
    babyFishReactionFrames: prepareFrames(assets.babyFishReactionFrames),
    babyFishImage: assets.babyFishImage ? prepareTrimmedSprite(assets.babyFishImage) : null,
    backgroundCanvas: prepareBackdropCanvas(assets.backgroundImage),
    planktonImage: assets.planktonImage ? prepareTrimmedSprite(assets.planktonImage) : null,
  };
}

function drawBackdrop(ctx: CanvasRenderingContext2D, timeMs: number, backgroundCanvas?: HTMLCanvasElement | null) {
  if (backgroundCanvas) {
    ctx.drawImage(backgroundCanvas, 0, 0);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD_HEIGHT);
  gradient.addColorStop(0, "#042d40");
  gradient.addColorStop(0.5, "#0b6275");
  gradient.addColorStop(1, "#0a2233");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = "#8cf7ff";
  ctx.lineWidth = 16;
  for (let index = -1; index < 11; index += 1) {
    const offset = ((timeMs * 0.02) + index * 120) % (FIELD_WIDTH + 220);
    ctx.beginPath();
    ctx.moveTo(offset - 120, 0);
    ctx.bezierCurveTo(offset - 10, FIELD_HEIGHT * 0.2, offset - 180, FIELD_HEIGHT * 0.6, offset + 40, FIELD_HEIGHT);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = "rgba(200, 255, 255, 0.18)";
  for (let index = 0; index < 28; index += 1) {
    const drift = (timeMs * 0.018 + index * 47) % (FIELD_HEIGHT + 80);
    const x = 26 + (index * 41) % (FIELD_WIDTH - 40);
    const radius = 3 + (index % 4);
    ctx.beginPath();
    ctx.arc(x, FIELD_HEIGHT - drift, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(5, 31, 42, 0.85)";
  ctx.fillRect(0, FIELD_HEIGHT - 84, FIELD_WIDTH, 84);
}

function drawFishShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  hue: number,
  facing: -1 | 1,
  label: string,
  isPlayer: boolean,
  scale = 1,
) {
  const visualSize = getFishVisualSize(size);
  const radius = visualSize.height / 2;
  const bodyLength = visualSize.width / 2.34;
  const bodyHeight = visualSize.height * 0.36;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);

  const bodyGradient = ctx.createLinearGradient(-bodyLength * 0.8, 0, bodyLength * 0.7, 0);
  if (isPlayer) {
    bodyGradient.addColorStop(0, "#f0b833");
    bodyGradient.addColorStop(0.55, "#ffef9f");
    bodyGradient.addColorStop(1, "#eb7f3b");
  } else {
    bodyGradient.addColorStop(0, `hsl(${hue} 78% 38%)`);
    bodyGradient.addColorStop(0.55, `hsl(${Math.max(18, hue - 18)} 88% 68%)`);
    bodyGradient.addColorStop(1, `hsl(${Math.max(12, hue - 28)} 75% 44%)`);
  }

  ctx.beginPath();
  ctx.ellipse(0, 0, bodyLength, bodyHeight, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-bodyLength * 0.86, 0);
  ctx.lineTo(-bodyLength * 1.34, -bodyHeight * 0.82);
  ctx.lineTo(-bodyLength * 1.34, bodyHeight * 0.82);
  ctx.closePath();
  ctx.fillStyle = isPlayer ? "#ffcf59" : `hsl(${Math.max(10, hue - 10)} 86% 50%)`;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-bodyLength * 0.08, -bodyHeight * 0.18);
  ctx.lineTo(bodyLength * 0.18, -bodyHeight * 1.08);
  ctx.lineTo(bodyLength * 0.56, -bodyHeight * 0.08);
  ctx.closePath();
  ctx.fillStyle = isPlayer ? "rgba(173, 248, 255, 0.82)" : "rgba(212, 255, 255, 0.72)";
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#042636";
  ctx.beginPath();
  ctx.arc(bodyLength * 0.58, -bodyHeight * 0.1, Math.max(4, radius * 0.13), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(bodyLength * 0.62, -bodyHeight * 0.18, Math.max(1.5, radius * 0.05), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isPlayer ? "#063544" : "#ffffff";
  ctx.font = `900 ${Math.max(14, radius * 0.6)}px Trebuchet MS, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, bodyLength * 0.12, 2);

  ctx.restore();
}

function drawSeaweed(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "rgba(33, 191, 119, 0.65)";
  ctx.lineWidth = 5;
  const stalks = 16;
  for (let index = 0; index < stalks; index += 1) {
    const baseX = 20 + index * ((FIELD_WIDTH - 40) / (stalks - 1));
    ctx.beginPath();
    ctx.moveTo(baseX, FIELD_HEIGHT);
    ctx.quadraticCurveTo(baseX - 18, FIELD_HEIGHT - 40, baseX + 10, FIELD_HEIGHT - 88);
    ctx.quadraticCurveTo(baseX + 28, FIELD_HEIGHT - 126, baseX + 6, FIELD_HEIGHT - 170);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOverlay(ctx: CanvasRenderingContext2D, title: string, subtitle: string, helper: string) {
  ctx.save();
  ctx.fillStyle = "rgba(198, 229, 241, 0.58)";
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  const panelWidth = Math.min(FIELD_WIDTH * 0.62, 620);
  const panelHeight = 188;
  const panelX = (FIELD_WIDTH - panelWidth) / 2;
  const panelY = (FIELD_HEIGHT - panelHeight) / 2;

  const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX + panelWidth, panelY + panelHeight);
  panelGradient.addColorStop(0, "rgba(216, 240, 248, 0.96)");
  panelGradient.addColorStop(1, "rgba(181, 220, 236, 0.98)");
  ctx.fillStyle = panelGradient;
  ctx.strokeStyle = "rgba(95, 170, 203, 0.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 26);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#24556d";
  ctx.textAlign = "center";
  ctx.font = "900 44px Trebuchet MS, sans-serif";
  ctx.fillText(title, FIELD_WIDTH / 2, panelY + 64);
  ctx.font = "600 20px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#387995";
  ctx.fillText(subtitle, FIELD_WIDTH / 2, panelY + 108);
  ctx.font = "500 16px Trebuchet MS, sans-serif";
  ctx.fillStyle = "rgba(43, 92, 115, 0.88)";
  ctx.fillText(helper, FIELD_WIDTH / 2, panelY + 144);
  ctx.restore();
}

function getBiteFrameIndex(state: GameState, frameCount: number) {
  if (frameCount === 0 || state.player.biteAnimationMs <= 0) {
    return 0;
  }

  const elapsedMs = PLAYER_BITE_ANIMATION_MS - state.player.biteAnimationMs;
  return Math.min(frameCount - 1, Math.floor(elapsedMs / PLAYER_BITE_FRAME_DURATION_MS));
}

function getReactionFrameIndex(enemy: EnemyFish, frameCount: number) {
  if (frameCount === 0 || enemy.reactionAnimationMs <= 0) {
    return 0;
  }

  const elapsedMs = BABY_FISH_REACTION_ANIMATION_MS - enemy.reactionAnimationMs;
  return Math.min(frameCount - 1, Math.floor(elapsedMs / BABY_FISH_REACTION_FRAME_DURATION_MS));
}

function getPlayerHurtFrameIndex(state: GameState, frameCount: number) {
  if (frameCount === 0 || state.gameOverOverlayDelayMs <= 0) {
    return 0;
  }

  const elapsedMs = GAME_OVER_OVERLAY_DELAY_MS - state.gameOverOverlayDelayMs;
  return Math.min(frameCount - 1, Math.floor(elapsedMs / PLAYER_HURT_FRAME_DURATION_MS));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getGrowthPulseProgress(state: GameState) {
  if (state.player.growthPulseMs <= 0 || state.player.growthTargetSize === null) {
    return null;
  }

  return 1 - state.player.growthPulseMs / PLAYER_GROWTH_PULSE_MS;
}

function getDisplayedPlayerSize(state: GameState) {
  const growthPulseProgress = getGrowthPulseProgress(state);

  if (growthPulseProgress === null || state.player.growthTargetSize === null) {
    return state.player.size;
  }

  return growthPulseProgress >= PLAYER_GROWTH_PULSE_SWAP_AT
    ? state.player.growthTargetSize
    : state.player.size;
}

function getPlayerDrawSize(state: GameState) {
  const displayedSize = getDisplayedPlayerSize(state);
  const baseSize = getFishVisualSize(displayedSize);
  const saturationFromRest = state.player.visualSaturation - 50;
  const growth = clamp(saturationFromRest / 50, 0, 1) * 0.07;
  const shrink = clamp(-saturationFromRest / 50, 0, 1) * 0.18;
  const pulseProgress = getGrowthPulseProgress(state);
  const pulse = pulseProgress === null
    ? 0
    : Math.sin(pulseProgress * Math.PI) * PLAYER_GROWTH_PULSE_SCALE;
  const scale = 1 + growth - shrink + pulse;

  return {
    width: baseSize.width * scale,
    height: baseSize.height * scale,
    scale,
    displayedSize,
  };
}

function getPlayerFrames(state: GameState, assets?: FishRenderAssets): PreparedSprite[] {
  if (!assets) {
    return [];
  }

  const displayedSize = getDisplayedPlayerSize(state);

  if (displayedSize <= 1) {
    return assets.babyFishBiteFrames;
  }

  if (displayedSize === 2) {
    return assets.level2FishBiteFrames;
  }

  if (displayedSize === 3) {
    return assets.level3FishBiteFrames;
  }

  if (displayedSize === 4) {
    return assets.level4FishBiteFrames;
  }

  if (displayedSize === 5) {
    return assets.level5FishBiteFrames;
  }

  if (displayedSize === 6) {
    return assets.level6FishBiteFrames;
  }

  if (displayedSize === 7) {
    return assets.level7FishBiteFrames;
  }

  return assets.level8FishBiteFrames;
}

function drawPlayerFish(ctx: CanvasRenderingContext2D, state: GameState, assets?: FishRenderAssets) {
  const drawSize = getPlayerDrawSize(state);
  const displayedSize = drawSize.displayedSize;
  const frames = getPlayerFrames(state, assets);
  const frameIndex = getBiteFrameIndex(state, frames.length);
  const isBiting = state.player.biteAnimationMs > 0;
  const isPredatorHurt = state.status === "over"
    && state.reason === "predator"
    && state.gameOverOverlayDelayMs > 0;
  const hurtFrames = displayedSize >= 7
    ? assets?.level7FishHurtFrames
    : displayedSize === 6
      ? assets?.level6FishHurtFrames
    : displayedSize === 5
      ? assets?.level5FishHurtFrames
    : displayedSize === 4
      ? assets?.level4FishHurtFrames
      : displayedSize === 3
      ? assets?.level3FishHurtFrames
      : assets?.level2FishHurtFrames;
  const levelHurtFrame = hurtFrames?.[getPlayerHurtFrameIndex(state, hurtFrames.length)];
  const image = isPredatorHurt && displayedSize <= 1 && assets?.babyFishReactionFrames[2]
    ? assets.babyFishReactionFrames[2]
    : isPredatorHurt && displayedSize > 1 && levelHurtFrame
      ? levelHurtFrame
    : displayedSize <= 1 && !isBiting && assets?.babyFishReactionFrames[0]
      ? assets.babyFishReactionFrames[0]
      : frames[frameIndex];

  if (!image) {
    drawFishShape(
      ctx,
      state.player.x,
      state.player.y,
      displayedSize,
      42,
      state.player.facing,
      String(displayedSize),
      true,
      drawSize.scale,
    );
    return;
  }

  const radius = getFishRadius(displayedSize);
  const swimBob = state.status === "playing" ? Math.sin(state.timeMs / 170) * Math.min(4, radius * 0.09) : 0;

  ctx.save();
  ctx.translate(state.player.x, state.player.y + swimBob);
  if (state.player.facing === 1) {
    ctx.scale(-1, 1);
  }
  drawPreparedSprite(ctx, image, drawSize.width, drawSize.height);
  ctx.restore();
}

function drawPlankton(ctx: CanvasRenderingContext2D, food: Plankton, image: PreparedSprite | null | undefined, timeMs: number) {
  const radius = getPlanktonRadius(food);
  const wobble = Math.sin(timeMs / 190 + food.driftPhase) * 2.4;

  ctx.save();
  ctx.translate(food.x, food.y + wobble);
  ctx.rotate(Math.sin(timeMs / 260 + food.driftPhase) * 0.16);
  ctx.globalAlpha = 0.94;

  if (image) {
    const drawWidth = radius * 2.95;
    const drawHeight = drawWidth / image.aspect;
    ctx.drawImage(image.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
    return;
  }

  ctx.fillStyle = "rgba(132, 255, 175, 0.86)";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(232, 255, 190, 0.9)";
  ctx.beginPath();
  ctx.arc(radius * 0.18, -radius * 0.22, radius * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFishingHookWarning(ctx: CanvasRenderingContext2D, hook: FishingHook) {
  const progress = clamp(hook.phaseMs / HOOK_WARNING_MS, 0, 1);
  const pulse = 0.55 + Math.sin(progress * Math.PI * 8) * 0.22;

  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = "rgba(255, 215, 87, 0.8)";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo(hook.x, 12);
  ctx.lineTo(hook.x, Math.min(FIELD_HEIGHT * 0.72, hook.targetY + HOOK_METAL_HEIGHT * 0.7));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255, 83, 66, 0.86)";
  ctx.beginPath();
  ctx.moveTo(hook.x, 18);
  ctx.lineTo(hook.x - 18, 50);
  ctx.lineTo(hook.x + 18, 50);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff7c7";
  ctx.font = "900 24px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", hook.x, 39);
  ctx.restore();
}

function drawFishingHook(ctx: CanvasRenderingContext2D, hook: FishingHook) {
  if (hook.phase === "warning") {
    drawFishingHookWarning(ctx, hook);
    return;
  }

  const position = getFishingHookPosition(hook);
  const width = HOOK_METAL_WIDTH;
  const height = HOOK_METAL_HEIGHT;
  const sway = Math.sin(hook.ageMs * 0.004 + hook.swingSeed) * 0.08;

  ctx.save();
  ctx.strokeStyle = "rgba(174, 226, 255, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hook.x, -8);
  ctx.quadraticCurveTo((hook.x + position.x) / 2, position.y * 0.35, position.x, position.y - height * 0.48);
  ctx.stroke();

  ctx.translate(position.x, position.y);
  ctx.rotate(sway);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "#1c3550";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(0, -height * 0.34, width * 0.27, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width * 0.08, -height * 0.13);
  ctx.bezierCurveTo(width * 0.3, height * 0.04, width * 0.12, height * 0.45, -width * 0.12, height * 0.42);
  ctx.bezierCurveTo(-width * 0.42, height * 0.38, -width * 0.36, height * 0.05, -width * 0.12, height * 0.1);
  ctx.stroke();

  ctx.strokeStyle = "#dce9f1";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(0, -height * 0.34, width * 0.27, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width * 0.08, -height * 0.13);
  ctx.bezierCurveTo(width * 0.3, height * 0.04, width * 0.12, height * 0.45, -width * 0.12, height * 0.42);
  ctx.bezierCurveTo(-width * 0.42, height * 0.38, -width * 0.36, height * 0.05, -width * 0.12, height * 0.1);
  ctx.stroke();

  ctx.strokeStyle = "#6f8294";
  ctx.lineWidth = 5;
  for (let index = 0; index < 3; index += 1) {
    const y = -height * 0.18 + index * 7;
    ctx.beginPath();
    ctx.moveTo(-width * 0.16, y);
    ctx.quadraticCurveTo(0, y + 5, width * 0.19, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#e8f4ff";
  ctx.beginPath();
  ctx.moveTo(-width * 0.33, height * 0.12);
  ctx.lineTo(-width * 0.5, -height * 0.02);
  ctx.lineTo(-width * 0.38, height * 0.24);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.74)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width * 0.02, -height * 0.48);
  ctx.bezierCurveTo(width * 0.16, -height * 0.18, width * 0.2, height * 0.24, -width * 0.12, height * 0.34);
  ctx.stroke();
  ctx.restore();
}

function drawBabyFishEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyFish, image: PreparedSprite) {
  const drawSize = getFishVisualSize(enemy.size);

  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.direction === 1) {
    ctx.scale(-1, 1);
  }
  drawPreparedSprite(ctx, image, drawSize.width, drawSize.height);
  ctx.restore();
}

function drawLevelImageFishEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyFish, image: PreparedSprite) {
  const drawSize = getFishVisualSize(enemy.size);

  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.direction === 1) {
    ctx.scale(-1, 1);
  }
  drawPreparedSprite(ctx, image, drawSize.width, drawSize.height);
  ctx.restore();
}

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState, assets?: FishRenderAssets) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";

  drawBackdrop(ctx, state.timeMs, assets?.backgroundCanvas);
  if (!assets?.backgroundCanvas) {
    drawSeaweed(ctx);
  }

  state.plankton.forEach((food) => {
    drawPlankton(ctx, food, assets?.planktonImage, state.timeMs);
  });

  state.enemies.forEach((enemy: EnemyFish) => {
    if (enemy.size === 1 && assets?.babyFishImage) {
      const reactionFrame = assets.babyFishReactionFrames[getReactionFrameIndex(enemy, assets.babyFishReactionFrames.length)];
      drawBabyFishEnemy(ctx, enemy, reactionFrame ?? assets.babyFishImage);
      return;
    }

    if (enemy.size === 2 && assets?.level2FishBiteFrames[0]) {
      drawLevelImageFishEnemy(ctx, enemy, assets.level2FishBiteFrames[0]);
      return;
    }

    if (enemy.size === 3 && assets?.level3FishBiteFrames[0]) {
      drawLevelImageFishEnemy(ctx, enemy, assets.level3FishBiteFrames[0]);
      return;
    }

    if (enemy.size === 4 && assets?.level4FishBiteFrames[0]) {
      drawLevelImageFishEnemy(ctx, enemy, assets.level4FishBiteFrames[0]);
      return;
    }

    if (enemy.size === 5 && assets?.level5FishBiteFrames[0]) {
      drawLevelImageFishEnemy(ctx, enemy, assets.level5FishBiteFrames[0]);
      return;
    }

    if (enemy.size === 6 && assets?.level6FishBiteFrames[0]) {
      drawLevelImageFishEnemy(ctx, enemy, assets.level6FishBiteFrames[0]);
      return;
    }

    if (enemy.size === 7 && assets?.level7FishBiteFrames[0]) {
      drawLevelImageFishEnemy(ctx, enemy, assets.level7FishBiteFrames[0]);
      return;
    }

    if (enemy.size === 8 && assets?.level8FishBiteFrames[0]) {
      drawLevelImageFishEnemy(ctx, enemy, assets.level8FishBiteFrames[0]);
      return;
    }

    drawFishShape(ctx, enemy.x, enemy.y, enemy.size, enemy.hue, enemy.direction, String(enemy.size), false);
  });

  if (state.hook) {
    drawFishingHook(ctx, state.hook);
  }

  drawPlayerFish(ctx, state, assets);

  if (state.status === "idle") {
    drawOverlay(ctx, "Deep Sea Feast", "Eat smaller fish and stay fed.", "Move with WASD, arrows, or your pointer.");
  }

  if (state.status === "over" && state.gameOverOverlayDelayMs <= 0) {
    const title = state.reason === "predator"
      ? "Caught By A Bigger Fish"
      : state.reason === "hook"
        ? "Hooked!"
        : "You Starved";
    const subtitle = `Final score: ${state.score.toLocaleString()} points`;
    const helper = state.reason === "hook"
      ? "The line is harmless, but the metal hook ends the dive."
      : "Dive again and keep your saturation above zero.";
    drawOverlay(ctx, title, subtitle, helper);
  }

}
