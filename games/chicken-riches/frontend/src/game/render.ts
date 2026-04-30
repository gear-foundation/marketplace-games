import {
  CHICKEN_HEIGHT,
  CHICKEN_IDLE_CYCLE_MS,
  CHICKEN_LAY_DURATION_MS,
  CHICKEN_LAY_EVENT_MS,
  CHICKEN_LAY_TELL_MS,
  CHICKEN_RELIEVED_DURATION_MS,
  CHICKEN_SCARED_START_DURATION_MS,
  CHICKEN_STOLEN_DURATION_MS,
  CHICKEN_WIDTH,
  COMBO_EGG_POINTS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FARMER_HEIGHT,
  FLOOR_Y,
  FOX_APPEAR_DURATION_MS,
  FOX_ATTACK_DELAY_MS,
  FOX_CARRY_UP_DURATION_MS,
  FOX_HEIGHT,
  FOX_HIT_DURATION_MS,
  FOX_LICK_DURATION_MS,
  FOX_RETREAT_DURATION_MS,
  FOX_STEAL_DURATION_MS,
  FOX_WIDTH,
  GAME_TITLE,
  THROWN_EGG_LAUNCH_DURATION_MS,
  THROWN_EGG_MISS_EXIT_Y,
} from "./constants";
import {
  brokenEggTrimmedAssets,
  chickenAlignedAssets,
  collectorAssets,
  environmentAssets,
  fallingEggTrimmedAssets,
  farmerAlignedAssets,
  farmerBasketFillAssets,
  foxAlignedAssets,
  getPreloadedAssetImage,
  thrownEggTrimmedAssets,
} from "./assets";
import { getCollectorFillState } from "./collector";
import { isFarmerNearCollector } from "./update";
import type {
  Chicken,
  ChickenAnimationName,
  CollectorFeedback,
  CollectorFillState,
  Egg,
  EggPuddle,
  EggVisualEffect,
  Farmer,
  Fox,
  FoxAnimationName,
  GameState,
} from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string | CanvasGradient,
  strokeStyle?: string,
) {
  roundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }
}

function getWrappedTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    const nextLine = `${currentLine} ${word}`;
    if (ctx.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const lines = getWrappedTextLines(ctx, text, maxWidth);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return lines.length;
}

const CHICKEN_SPRITE_WIDTH = 112;
const CHICKEN_SPRITE_HEIGHT = (CHICKEN_SPRITE_WIDTH * 627) / 418;
const CHICKEN_SPRITE_X = -CHICKEN_SPRITE_WIDTH / 2;
const CHICKEN_SPRITE_Y = -CHICKEN_SPRITE_HEIGHT * 0.69;

const chickenSpriteSources: Record<ChickenAnimationName, string> = {
  idle: chickenAlignedAssets.idle,
  layingEgg: chickenAlignedAssets.layingEgg,
  scaredStart: chickenAlignedAssets.scaredStart,
  scaredLoop: chickenAlignedAssets.scaredLoop,
  relieved: chickenAlignedAssets.relieved,
  stolen: chickenAlignedAssets.stolen,
};

const chickenSpriteCache: Partial<Record<ChickenAnimationName, HTMLImageElement>> = {};

type EggSpriteName = "throwStart" | "flyingLoop" | "hit" | "missExit";
type FallingEggSpriteName = "center" | "left" | "right";
type CollectorSpriteName = "basket";
type EnvironmentSpriteName = "back" | "shelf";
type FarmerSpriteName =
  | "idle"
  | "run01"
  | "run02"
  | "run03"
  | "run04"
  | "jump"
  | "catch"
  | "deposit"
  | "throw"
  | "slipFall"
  | "lying"
  | "recover";
type BasketFillSpriteName = "one" | "two" | "full";
type FoxSpriteName = FoxAnimationName;

const eggSpriteSources: Record<EggSpriteName, string> = {
  throwStart: thrownEggTrimmedAssets.throwStart,
  flyingLoop: thrownEggTrimmedAssets.flyingLoop,
  hit: thrownEggTrimmedAssets.hit,
  missExit: thrownEggTrimmedAssets.missExit,
};

const eggSpriteCache: Partial<Record<EggSpriteName, HTMLImageElement>> = {};
const fallingEggSpriteCache: Partial<Record<FallingEggSpriteName, HTMLImageElement>> = {};
const collectorSpriteCache: Partial<Record<CollectorSpriteName, HTMLImageElement>> = {};
const environmentSpriteCache: Partial<Record<EnvironmentSpriteName, HTMLImageElement>> = {};

const fallingEggSpriteSources: Record<FallingEggSpriteName, string> = {
  center: fallingEggTrimmedAssets.center,
  left: fallingEggTrimmedAssets.left,
  right: fallingEggTrimmedAssets.right,
};

const collectorSpriteSources: Record<CollectorSpriteName, string> = {
  basket: collectorAssets.basket,
};

const environmentSpriteSources: Record<EnvironmentSpriteName, string> = {
  back: environmentAssets.back,
  shelf: environmentAssets.shelf,
};

let brokenEggSprite: HTMLImageElement | null = null;
let shelfCutoutSprite: HTMLCanvasElement | HTMLImageElement | null | undefined;

const farmerSpriteSources: Record<FarmerSpriteName, string> = {
  idle: farmerAlignedAssets.idle,
  run01: farmerAlignedAssets.run01,
  run02: farmerAlignedAssets.run02,
  run03: farmerAlignedAssets.run03,
  run04: farmerAlignedAssets.run04,
  jump: farmerAlignedAssets.jump,
  catch: farmerAlignedAssets.catch,
  deposit: farmerAlignedAssets.deposit,
  throw: farmerAlignedAssets.throw,
  slipFall: farmerAlignedAssets.slipFall,
  lying: farmerAlignedAssets.lying,
  recover: farmerAlignedAssets.recover,
};

const farmerSpriteCache: Partial<Record<FarmerSpriteName, HTMLImageElement>> = {};
const FARMER_RUN_FRAME_MS = 85;
const FARMER_RUN_FRAMES = ["run01", "run02", "run03", "run04"] as const;

const basketFillSpriteSources: Record<BasketFillSpriteName, string> = {
  one: farmerBasketFillAssets.one,
  two: farmerBasketFillAssets.two,
  full: farmerBasketFillAssets.full,
};

const basketFillSpriteCache: Partial<Record<BasketFillSpriteName, HTMLImageElement>> = {};

const foxSpriteSources: Record<FoxSpriteName, string> = {
  appear: foxAlignedAssets.appear,
  lickLips: foxAlignedAssets.lickLips,
  hover: foxAlignedAssets.hover,
  steal: foxAlignedAssets.steal,
  carryUp: foxAlignedAssets.carryUp,
  hit: foxAlignedAssets.hit,
  retreat: foxAlignedAssets.retreat,
};

const foxSpriteCache: Partial<Record<FoxSpriteName, HTMLImageElement>> = {};
const lazyLoadedImageCache = new Map<string, HTMLImageElement>();

function getLoadedImageAsset(src: string) {
  if (typeof Image === "undefined") {
    return null;
  }

  const preloadedImage = getPreloadedAssetImage(src);
  if (preloadedImage) {
    return preloadedImage;
  }

  let image = lazyLoadedImageCache.get(src);
  if (!image) {
    image = new Image();
    image.decoding = "async";
    image.src = src;
    lazyLoadedImageCache.set(src, image);
  }

  return image.complete && image.naturalWidth > 0 ? image : null;
}

function getChickenSprite(name: ChickenAnimationName) {
  let image = chickenSpriteCache[name];
  if (!image) {
    image = getLoadedImageAsset(chickenSpriteSources[name]) ?? undefined;
    chickenSpriteCache[name] = image;
  }

  return image ?? null;
}

function getEggSprite(name: EggSpriteName) {
  let image = eggSpriteCache[name];
  if (!image) {
    image = getLoadedImageAsset(eggSpriteSources[name]) ?? undefined;
    eggSpriteCache[name] = image;
  }

  return image ?? null;
}

function getFallingEggSprite(name: FallingEggSpriteName) {
  let image = fallingEggSpriteCache[name];
  if (!image) {
    image = getLoadedImageAsset(fallingEggSpriteSources[name]) ?? undefined;
    fallingEggSpriteCache[name] = image;
  }

  return image ?? null;
}

function getBrokenEggSprite() {
  if (!brokenEggSprite) {
    brokenEggSprite = getLoadedImageAsset(brokenEggTrimmedAssets.broken);
  }

  return brokenEggSprite ?? null;
}

function getCollectorSprite(name: CollectorSpriteName) {
  let image = collectorSpriteCache[name];
  if (!image) {
    image = getLoadedImageAsset(collectorSpriteSources[name]) ?? undefined;
    collectorSpriteCache[name] = image;
  }

  return image ?? null;
}

function getEnvironmentSprite(name: EnvironmentSpriteName) {
  let image = environmentSpriteCache[name];
  if (!image) {
    image = getLoadedImageAsset(environmentSpriteSources[name]) ?? undefined;
    environmentSpriteCache[name] = image;
  }

  return image ?? null;
}

function getImageSourceSize(image: HTMLImageElement | HTMLCanvasElement) {
  if ("naturalWidth" in image) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }

  return { width: image.width, height: image.height };
}

function createShelfCutoutSprite(image: HTMLImageElement) {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const brightness = red + green + blue;
    const channelRange = Math.max(red, green, blue) - Math.min(red, green, blue);

    if (brightness > 742 && channelRange < 20) {
      data[index + 3] = 0;
      continue;
    }

    if (brightness > 720 && channelRange < 24) {
      const fade = clamp((742 - brightness) / 22, 0, 1);
      data[index + 3] = Math.round(data[index + 3] * fade);
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function getShelfSprite() {
  if (shelfCutoutSprite !== undefined) {
    return shelfCutoutSprite;
  }

  const shelfImage = getEnvironmentSprite("shelf");
  if (!shelfImage) {
    return null;
  }

  shelfCutoutSprite = createShelfCutoutSprite(shelfImage) ?? shelfImage;
  return shelfCutoutSprite;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceAspect = image.naturalWidth / image.naturalHeight;
  const targetAspect = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (sourceAspect > targetAspect) {
    sourceWidth = image.naturalHeight * targetAspect;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetAspect;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function getFarmerSprite(name: FarmerSpriteName) {
  let image = farmerSpriteCache[name];
  if (!image) {
    image = getLoadedImageAsset(farmerSpriteSources[name]) ?? undefined;
    farmerSpriteCache[name] = image;
  }

  return image ?? null;
}

function getBasketFillSprite(name: BasketFillSpriteName) {
  let image = basketFillSpriteCache[name];
  if (!image) {
    image = getLoadedImageAsset(basketFillSpriteSources[name]) ?? undefined;
    basketFillSpriteCache[name] = image;
  }

  return image ?? null;
}

function getFoxSprite(name: FoxSpriteName) {
  let image = foxSpriteCache[name];
  if (!image) {
    image = getLoadedImageAsset(foxSpriteSources[name]) ?? undefined;
    foxSpriteCache[name] = image;
  }

  return image ?? null;
}

function drawBackdrop(ctx: CanvasRenderingContext2D, timeMs: number) {
  const backdropSprite = getEnvironmentSprite("back");
  if (backdropSprite) {
    drawImageCover(ctx, backdropSprite, 0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    return;
  }

  const wallGradient = ctx.createLinearGradient(0, 0, 0, FIELD_HEIGHT);
  wallGradient.addColorStop(0, "#f7d08b");
  wallGradient.addColorStop(0.42, "#e0a35e");
  wallGradient.addColorStop(1, "#8a5331");
  ctx.fillStyle = wallGradient;
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  ctx.fillStyle = "rgba(131, 66, 34, 0.26)";
  for (let beamX = 56; beamX < FIELD_WIDTH; beamX += 124) {
    ctx.fillRect(beamX, 0, 22, FIELD_HEIGHT);
  }

  ctx.fillStyle = "rgba(118, 60, 31, 0.18)";
  for (let plankY = 36; plankY < FLOOR_Y - 42; plankY += 42) {
    ctx.fillRect(0, plankY, FIELD_WIDTH, 12);
  }

  const windowXs = [116, FIELD_WIDTH - 316];
  for (const windowX of windowXs) {
    fillRoundRect(ctx, windowX, 68, 200, 138, 26, "#694126", "#4d2f1c");
    fillRoundRect(ctx, windowX + 14, 82, 172, 110, 18, "#b8e9ff");
    const sky = ctx.createLinearGradient(0, 82, 0, 192);
    sky.addColorStop(0, "#dff8ff");
    sky.addColorStop(1, "#7ec2ef");
    ctx.fillStyle = sky;
    ctx.fillRect(windowX + 14, 82, 172, 110);

    ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
    for (let index = 0; index < 3; index += 1) {
      const cloudX = windowX + 48 + index * 44 + Math.sin(timeMs * 0.00042 + index) * 8;
      const cloudY = 110 + index * 16;
      ctx.beginPath();
      ctx.arc(cloudX, cloudY, 14, 0, Math.PI * 2);
      ctx.arc(cloudX + 14, cloudY - 6, 18, 0, Math.PI * 2);
      ctx.arc(cloudX + 30, cloudY, 13, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(92, 54, 31, 0.34)";
    ctx.fillRect(windowX + 96, 82, 10, 110);
    ctx.fillRect(windowX + 14, 132, 172, 10);
  }

  ctx.save();
  ctx.translate(FIELD_WIDTH / 2, 84);
  ctx.rotate(Math.sin(timeMs * 0.0012) * 0.05);
  ctx.fillStyle = "#6d4126";
  ctx.fillRect(-4, -48, 8, 52);
  fillRoundRect(ctx, -28, 0, 56, 78, 20, "#f3b74b", "#6d4126");
  ctx.fillStyle = "rgba(255, 248, 170, 0.38)";
  ctx.beginPath();
  ctx.arc(0, 40, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const hayGradient = ctx.createLinearGradient(0, FLOOR_Y, 0, FIELD_HEIGHT);
  hayGradient.addColorStop(0, "#9f5c33");
  hayGradient.addColorStop(1, "#6d3c21");
  ctx.fillStyle = hayGradient;
  ctx.fillRect(0, FLOOR_Y, FIELD_WIDTH, FIELD_HEIGHT - FLOOR_Y);

  ctx.strokeStyle = "rgba(251, 214, 119, 0.55)";
  ctx.lineWidth = 2;
  for (let index = 0; index < 54; index += 1) {
    const strawX = (index * 19) % FIELD_WIDTH;
    const strawY = FLOOR_Y + 18 + (index % 4) * 18;
    ctx.beginPath();
    ctx.moveTo(strawX, strawY);
    ctx.lineTo(strawX + 28, strawY - 8);
    ctx.lineTo(strawX + 44, strawY + 6);
    ctx.stroke();
  }
}

function drawRoost(ctx: CanvasRenderingContext2D) {
  const shelfSprite = getShelfSprite();
  if (shelfSprite) {
    const { width: sourceWidth, height: sourceHeight } = getImageSourceSize(shelfSprite);
    const drawWidth = FIELD_WIDTH - 48;
    const drawHeight = drawWidth * (sourceHeight / sourceWidth);
    const drawX = (FIELD_WIDTH - drawWidth) / 2;
    const drawY = 40;

    ctx.save();
    ctx.shadowColor = "rgba(84, 42, 16, 0.24)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(shelfSprite, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
    return;
  }

  fillRoundRect(ctx, 92, 204, FIELD_WIDTH - 184, 20, 12, "#5d321e", "#3c2012");
  fillRoundRect(ctx, 104, 222, 20, 110, 10, "#724229");
  fillRoundRect(ctx, FIELD_WIDTH - 124, 222, 20, 110, 10, "#724229");
  fillRoundRect(ctx, FIELD_WIDTH / 2 - 10, 222, 20, 126, 10, "#724229");
}

function drawChickenFallback(ctx: CanvasRenderingContext2D, chicken: Chicken, timeMs: number) {
  if (!chicken.alive && !chicken.pendingRemoval) {
    return;
  }

  const bob = Math.sin(timeMs * 0.0032 + chicken.x * 0.01) * 2;
  const panic = chicken.threatenedByFox || chicken.animation.name === "scaredLoop" ? Math.sin(timeMs * 0.018 + chicken.x) * 4 : 0;

  ctx.save();
  ctx.translate(chicken.x + panic, chicken.y + bob);

  ctx.fillStyle = chicken.threatenedByFox ? "#fff0e0" : "#fff6ef";
  ctx.beginPath();
  ctx.ellipse(0, 0, CHICKEN_WIDTH / 2, CHICKEN_HEIGHT / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7d4ad";
  ctx.beginPath();
  ctx.ellipse(-12, 8, 24, 18, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7b733";
  ctx.beginPath();
  ctx.moveTo(34, -2);
  ctx.lineTo(54, 6);
  ctx.lineTo(34, 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#d84832";
  ctx.beginPath();
  ctx.arc(16, -22, 8, 0, Math.PI * 2);
  ctx.arc(4, -28, 7, 0, Math.PI * 2);
  ctx.arc(-8, -22, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#473020";
  ctx.beginPath();
  ctx.arc(20, -4, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#d08c32";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, 28);
  ctx.lineTo(-6, 44);
  ctx.moveTo(10, 28);
  ctx.lineTo(10, 44);
  ctx.stroke();

  if (chicken.threatenedByFox) {
    fillRoundRect(ctx, -24, -72, 48, 28, 14, "rgba(116, 33, 22, 0.88)");
    ctx.fillStyle = "#fff8ef";
    ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("FOX!", 0, -53);
  }

  ctx.restore();
}

function drawChickenThreatBadge(ctx: CanvasRenderingContext2D) {
  fillRoundRect(ctx, -24, -72, 48, 28, 14, "rgba(116, 33, 22, 0.88)");
  ctx.fillStyle = "#fff8ef";
  ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("FOX!", 0, -53);
}

function drawChicken(ctx: CanvasRenderingContext2D, chicken: Chicken, timeMs: number, coopPanic = false) {
  if (!chicken.alive && !chicken.pendingRemoval) {
    return;
  }

  const sprite = getChickenSprite(chicken.animation.name);
  if (!sprite) {
    drawChickenFallback(ctx, chicken, timeMs);
    return;
  }

  const phase = (timeMs / CHICKEN_IDLE_CYCLE_MS) * Math.PI * 2 + chicken.x * 0.015;
  const idleBob = Math.sin(phase);
  const elapsed = timeMs - chicken.animation.startedAt;

  let spriteName: ChickenAnimationName = chicken.animation.name;
  let drawX = chicken.x;
  let drawY = chicken.y + idleBob * 1.6;
  let rotation = Math.sin(phase * 0.5) * 0.01;
  let scaleX = 1;
  let scaleY = 1;
  let shadowWidth = 32;
  let shadowHeight = 8;
  let shadowOffsetY = 42;
  let alpha = 1;
  let warningGlow = 0;
  const flockShake =
    coopPanic &&
    !chicken.threatenedByFox &&
    chicken.animation.name !== "stolen" &&
    chicken.animation.name !== "scaredStart" &&
    chicken.animation.name !== "scaredLoop";

  switch (chicken.animation.name) {
    case "layingEgg": {
      const progress = clamp(elapsed / CHICKEN_LAY_DURATION_MS, 0, 1);
      const squeeze = Math.sin(Math.min(1, progress / 0.7) * Math.PI);
      spriteName = elapsed >= CHICKEN_LAY_TELL_MS ? "layingEgg" : "idle";
      drawY += squeeze * 8 - Math.max(0, progress - 0.7) * 16;
      rotation = -0.025 * Math.sin(progress * Math.PI * 1.6);
      scaleX += squeeze * 0.07;
      scaleY -= squeeze * 0.09;
      shadowWidth += squeeze * 6;
      break;
    }
    case "scaredStart": {
      const progress = clamp(elapsed / CHICKEN_SCARED_START_DURATION_MS, 0, 1);
      spriteName = progress < 0.2 ? "idle" : "scaredStart";
      drawY -= progress * 10;
      drawX += Math.sin(progress * 18) * progress * 2;
      rotation = -0.08 * progress;
      scaleX -= progress * 0.04;
      scaleY += progress * 0.08;
      warningGlow = 0.2 + progress * 0.24;
      shadowWidth += progress * 3;
      break;
    }
    case "scaredLoop": {
      const shake = Math.sin(timeMs * 0.052 + chicken.x * 0.08);
      drawX += shake * 3.6;
      drawY += Math.cos(timeMs * 0.038 + chicken.x * 0.04) * 1.2 - 2;
      rotation = shake * 0.04;
      scaleX += Math.sin(timeMs * 0.06) * 0.018;
      scaleY += Math.cos(timeMs * 0.057) * 0.02;
      warningGlow = 0.28 + ((Math.sin(timeMs * 0.02) + 1) * 0.12);
      shadowWidth = 35;
      break;
    }
    case "relieved": {
      const progress = clamp(elapsed / CHICKEN_RELIEVED_DURATION_MS, 0, 1);
      const settle = Math.sin(progress * Math.PI);
      spriteName = progress < 0.82 ? "relieved" : "idle";
      drawY += settle * 2;
      rotation = Math.sin(progress * Math.PI * 2) * 0.018;
      scaleX -= settle * 0.03;
      scaleY += settle * 0.025;
      break;
    }
    case "stolen": {
      const progress = clamp(elapsed / CHICKEN_STOLEN_DURATION_MS, 0, 1);
      drawX += Math.sin(progress * 20) * 4 * (1 - progress);
      drawY -= progress * 78;
      rotation = -0.18 - progress * 0.24;
      scaleX -= progress * 0.08;
      scaleY += progress * 0.06;
      shadowWidth *= 1 - progress * 0.55;
      shadowHeight *= 1 - progress * 0.55;
      shadowOffsetY -= progress * 4;
      alpha -= progress * 0.18;
      break;
    }
    case "idle":
    default: {
      scaleX += idleBob * 0.014;
      scaleY -= idleBob * 0.014;
      break;
    }
  }

  if (flockShake) {
    const shake = Math.sin(timeMs * 0.044 + chicken.x * 0.07);
    drawX += shake * 2.6;
    drawY += Math.cos(timeMs * 0.036 + chicken.x * 0.03) * 1.2;
    rotation += shake * 0.026;
    scaleX += Math.sin(timeMs * 0.052 + chicken.x * 0.01) * 0.012;
    scaleY += Math.cos(timeMs * 0.049 + chicken.x * 0.02) * 0.014;
  }

  const spriteImage = getChickenSprite(spriteName);
  if (!spriteImage) {
    drawChickenFallback(ctx, chicken, timeMs);
    return;
  }

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.globalAlpha = alpha;

  if (warningGlow > 0) {
    ctx.fillStyle = `rgba(201, 68, 43, ${warningGlow.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(0, 6, 46, 28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(spriteImage, CHICKEN_SPRITE_X, CHICKEN_SPRITE_Y, CHICKEN_SPRITE_WIDTH, CHICKEN_SPRITE_HEIGHT);

  if (chicken.threatenedByFox && chicken.animation.name !== "stolen") {
    drawChickenThreatBadge(ctx);
  }

  ctx.restore();
}

function getFoxAnimationDuration(name: FoxAnimationName) {
  switch (name) {
    case "appear":
      return FOX_APPEAR_DURATION_MS;
    case "lickLips":
      return FOX_LICK_DURATION_MS;
    case "steal":
      return FOX_STEAL_DURATION_MS;
    case "carryUp":
      return FOX_CARRY_UP_DURATION_MS;
    case "hit":
      return FOX_HIT_DURATION_MS;
    case "retreat":
      return FOX_RETREAT_DURATION_MS;
    case "hover":
    default:
      return 1_000;
  }
}

function drawFoxTimer(ctx: CanvasRenderingContext2D, fox: Fox, state: GameState, x: number, y: number) {
  if (!fox.active) {
    return;
  }

  const timerMs = Math.max(0, fox.attackAt - state.nowMs);
  const timerProgress = clamp(timerMs / FOX_ATTACK_DELAY_MS, 0, 1);

  ctx.save();
  ctx.translate(x, y);
  fillRoundRect(ctx, -58, -12, 116, 22, 11, "rgba(93, 30, 16, 0.92)");
  fillRoundRect(ctx, -54, -8, 108 * timerProgress, 14, 7, "#ffd56d");
  ctx.fillStyle = "#fff8ef";
  ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`FOX ${Math.ceil(timerMs / 1000)}s`, 0, -18);
  ctx.restore();
}

function drawFoxFallback(ctx: CanvasRenderingContext2D, fox: Fox, state: GameState) {
  const sway = Math.sin(state.nowMs * 0.006) * 6;

  ctx.save();
  ctx.translate(fox.x + sway, fox.y);

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 42, 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#df6a2b";
  ctx.beginPath();
  ctx.ellipse(0, 0, 40, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fbd5bf";
  ctx.beginPath();
  ctx.ellipse(18, 4, 14, 10, 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f6efe8";
  ctx.beginPath();
  ctx.moveTo(-18, -18);
  ctx.lineTo(-6, -42);
  ctx.lineTo(6, -18);
  ctx.closePath();
  ctx.moveTo(0, -18);
  ctx.lineTo(14, -42);
  ctx.lineTo(28, -18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#4d2d1d";
  ctx.beginPath();
  ctx.arc(16, -3, 3, 0, Math.PI * 2);
  ctx.arc(2, -3, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffca6b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-32, 6);
  ctx.quadraticCurveTo(-62, 10, -72, -14);
  ctx.quadraticCurveTo(-56, -10, -42, 6);
  ctx.stroke();

  drawFoxTimer(ctx, fox, state, 0, -66);
  ctx.restore();
}

function drawFox(ctx: CanvasRenderingContext2D, fox: Fox, state: GameState) {
  const spriteName = fox.animation.name;
  const sprite = getFoxSprite(spriteName);
  if (!sprite) {
    drawFoxFallback(ctx, fox, state);
    return;
  }

  const elapsed = state.nowMs - fox.animation.startedAt;
  const progress = clamp(elapsed / getFoxAnimationDuration(spriteName), 0, 1);
  const pulse = Math.sin(state.nowMs * 0.007);
  let drawX = fox.x;
  let drawY = fox.y;
  let rotation = 0;
  let alpha = 1;
  let scaleX = 1;
  let scaleY = 1;

  switch (spriteName) {
    case "appear":
      drawY -= (1 - progress) * 128;
      alpha = 0.18 + progress * 0.82;
      scaleY = 0.92 + progress * 0.08;
      break;
    case "lickLips":
      drawX += Math.sin(progress * Math.PI * 2) * 3;
      drawY += Math.sin(progress * Math.PI) * 5;
      rotation = -0.04 * Math.sin(progress * Math.PI);
      break;
    case "hover":
      drawX += pulse * 5;
      drawY += Math.cos(state.nowMs * 0.006) * 4;
      rotation = pulse * 0.018;
      break;
    case "steal":
      drawY += Math.sin(progress * Math.PI) * 38;
      drawX += Math.sin(progress * Math.PI * 2) * 2;
      scaleX = 1 + Math.sin(progress * Math.PI) * 0.04;
      scaleY = 1 - Math.sin(progress * Math.PI) * 0.03;
      break;
    case "carryUp":
      drawY -= progress * 150;
      drawX += Math.sin(progress * Math.PI * 3) * 8;
      rotation = -0.08 * progress;
      alpha = 1 - progress * 0.2;
      break;
    case "hit":
      drawX += Math.sin(state.nowMs * 0.08) * 7 * (1 - progress);
      drawY -= Math.sin(progress * Math.PI) * 10;
      rotation = -0.14 * Math.sin(progress * Math.PI);
      scaleX = 1 + Math.sin(progress * Math.PI) * 0.06;
      scaleY = 1 + Math.sin(progress * Math.PI) * 0.04;
      break;
    case "retreat":
      drawY -= progress * 150;
      drawX += Math.sin(progress * Math.PI * 2) * 14;
      rotation = 0.12 * progress;
      alpha = 1 - progress * 0.65;
      break;
    default:
      break;
  }

  const drawWidth = spriteName === "steal" || spriteName === "carryUp" ? FOX_WIDTH * 1.14 : FOX_WIDTH;
  const drawHeight = drawWidth * (sprite.naturalHeight / sprite.naturalWidth);

  ctx.save();
  ctx.translate(drawX, drawY);

  if (spriteName !== "carryUp" && spriteName !== "retreat" && spriteName !== "appear") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, drawHeight * 0.38, FOX_WIDTH * 0.36, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = alpha;
  ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();

  drawFoxTimer(ctx, fox, state, drawX, drawY - FOX_HEIGHT * 0.63);
}

function drawEggFallback(ctx: CanvasRenderingContext2D, egg: Egg, isThrown = false) {
  ctx.save();
  ctx.translate(egg.x, egg.y);
  ctx.fillStyle = isThrown ? "#ffe4ad" : "#fffdf8";
  ctx.beginPath();
  ctx.ellipse(0, 0, egg.radius * 0.86, egg.radius * 1.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isThrown ? "#b8692f" : "#d6cfbf";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawEgg(ctx: CanvasRenderingContext2D, egg: Egg, nowMs: number, isThrown = false) {
  if (!isThrown) {
    const elapsed = nowMs - egg.spawnedAt;
    const phase = Math.floor(elapsed / 120) % 3;
    const spriteName: FallingEggSpriteName = phase === 1 ? "left" : phase === 2 ? "right" : "center";
    const sprite = getFallingEggSprite(spriteName);

    if (!sprite) {
      drawEggFallback(ctx, egg, false);
      return;
    }

    const drawWidth = 31;
    const drawHeight = drawWidth * (sprite.naturalHeight / sprite.naturalWidth);
    const wobble = spriteName === "left" ? -0.08 : spriteName === "right" ? 0.08 : 0;
    const bob = Math.sin(elapsed * 0.012 + egg.x * 0.01) * 0.8;

    ctx.save();
    ctx.translate(egg.x, egg.y + bob);
    ctx.rotate(wobble);
    ctx.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
    return;
  }

  const elapsed = nowMs - egg.spawnedAt;
  const spriteName: EggSpriteName =
    elapsed < THROWN_EGG_LAUNCH_DURATION_MS
      ? "throwStart"
      : egg.y < THROWN_EGG_MISS_EXIT_Y
        ? "missExit"
        : "flyingLoop";

  const sprite = getEggSprite(spriteName);
  if (!sprite) {
    drawEggFallback(ctx, egg, true);
    return;
  }

  const baseSize = spriteName === "throwStart" ? 56 : 52;
  const aspect = sprite.naturalHeight / sprite.naturalWidth;
  const drawWidth = baseSize;
  const drawHeight = drawWidth * aspect;
  const wobble = Math.sin(elapsed * 0.024 + egg.x * 0.02);
  const launchStretch = spriteName === "throwStart" ? 1 + (1 - clamp(elapsed / THROWN_EGG_LAUNCH_DURATION_MS, 0, 1)) * 0.12 : 1;
  const riseSqueeze = spriteName === "throwStart" ? 1 - (1 - clamp(elapsed / THROWN_EGG_LAUNCH_DURATION_MS, 0, 1)) * 0.06 : 1;

  ctx.save();
  ctx.translate(egg.x, egg.y);
  ctx.rotate(wobble * 0.11);
  ctx.scale(riseSqueeze, launchStretch);
  ctx.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function drawEggEffect(ctx: CanvasRenderingContext2D, effect: EggVisualEffect, nowMs: number) {
  if (effect.kind === "depositDrop") {
    const progress = clamp((nowMs - effect.startedAt) / effect.durationMs, 0, 1);
    const flightX = effect.x + (effect.targetX - effect.x) * progress;
    const flightY = effect.y + (effect.targetY - effect.y) * (progress * progress);
    const sprite = getFallingEggSprite("center");
    const fadeOut = progress > 0.84 ? 1 - (progress - 0.84) / 0.16 : 1;
    const landProgress = clamp((progress - 0.76) / 0.24, 0, 1);
    const squashX = 1 + landProgress * 0.16;
    const squashY = 1 - landProgress * 0.18;
    const rotation = Math.sin(progress * Math.PI * 1.1) * 0.04;

    ctx.save();
    ctx.globalAlpha = fadeOut;
    ctx.fillStyle = `rgba(74, 41, 21, ${(0.06 + progress * 0.14) * fadeOut})`;
    ctx.beginPath();
    ctx.ellipse(effect.targetX, effect.targetY + 16, 8 + progress * 8, 3 + progress * 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(flightX, flightY);
    ctx.rotate(rotation);
    ctx.scale(squashX, squashY);
    if (sprite) {
      const drawWidth = 22;
      const drawHeight = drawWidth * (sprite.naturalHeight / sprite.naturalWidth);
      ctx.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    } else {
      ctx.fillStyle = "#fff8ef";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6.2, 8.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d8cfbc";
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  const sprite = getEggSprite("hit");
  if (!sprite) {
    return;
  }

  const progress = clamp((nowMs - effect.startedAt) / effect.durationMs, 0, 1);
  const baseWidth = 96 + progress * 16;
  const drawHeight = baseWidth * (sprite.naturalHeight / sprite.naturalWidth);

  ctx.save();
  ctx.translate(effect.x, effect.y);
  ctx.globalAlpha = 1 - progress * 0.82;
  ctx.scale(1 + progress * 0.08, 1 + progress * 0.08);
  ctx.drawImage(sprite, -baseWidth / 2, -drawHeight / 2, baseWidth, drawHeight);
  ctx.restore();
}

function drawPuddle(ctx: CanvasRenderingContext2D, puddle: EggPuddle, nowMs: number) {
  const visibleFrom = puddle.slippedAt ?? puddle.createdAt;
  const visibleDuration = Math.max(1, puddle.expiresAt - visibleFrom);
  const lifeProgress = clamp((puddle.expiresAt - nowMs) / visibleDuration, 0, 1);
  const sprite = getBrokenEggSprite();

  if (sprite) {
    const drawWidth = puddle.radius * 2;
    const drawHeight = drawWidth * (sprite.naturalHeight / sprite.naturalWidth);

    ctx.save();
    ctx.globalAlpha = 0.18 + lifeProgress * 0.82;
    ctx.drawImage(sprite, puddle.x - drawWidth / 2, puddle.y + 16 - drawHeight, drawWidth, drawHeight);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.22 + lifeProgress * 0.78;
  ctx.fillStyle = "#fff7eb";
  ctx.beginPath();
  ctx.ellipse(puddle.x, puddle.y + 10, puddle.radius, puddle.radius * 0.42, 0, 0, Math.PI * 2);
  ctx.ellipse(puddle.x - puddle.radius * 0.45, puddle.y + 12, puddle.radius * 0.4, puddle.radius * 0.22, -0.3, 0, Math.PI * 2);
  ctx.ellipse(puddle.x + puddle.radius * 0.42, puddle.y + 7, puddle.radius * 0.34, puddle.radius * 0.18, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7b733";
  ctx.beginPath();
  ctx.ellipse(puddle.x + 4, puddle.y + 8, puddle.radius * 0.24, puddle.radius * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

type CollectorEggLayout = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

const COLLECTOR_EGG_LAYOUTS: Record<CollectorFillState, CollectorEggLayout[]> = {
  collector_empty: [],
  collector_low: [
    { x: -26, y: 22, scale: 0.92, rotation: -0.2 },
    { x: 0, y: 24, scale: 1, rotation: -0.02 },
    { x: 27, y: 22, scale: 0.9, rotation: 0.2 },
  ],
  collector_medium: [
    { x: -34, y: 26, scale: 0.92, rotation: -0.24 },
    { x: -10, y: 23, scale: 1, rotation: -0.08 },
    { x: 15, y: 24, scale: 0.98, rotation: 0.1 },
    { x: 38, y: 26, scale: 0.9, rotation: 0.24 },
    { x: 4, y: 12, scale: 0.96, rotation: 0.02 },
  ],
  collector_high: [
    { x: -38, y: 28, scale: 0.92, rotation: -0.26 },
    { x: -16, y: 24, scale: 0.98, rotation: -0.12 },
    { x: 8, y: 24, scale: 1, rotation: 0.04 },
    { x: 30, y: 26, scale: 0.94, rotation: 0.18 },
    { x: -26, y: 11, scale: 0.9, rotation: -0.1 },
    { x: -1, y: 10, scale: 0.98, rotation: 0.04 },
    { x: 24, y: 11, scale: 0.9, rotation: 0.16 },
  ],
  collector_full: [
    { x: -42, y: 29, scale: 0.92, rotation: -0.28 },
    { x: -20, y: 25, scale: 0.98, rotation: -0.15 },
    { x: 3, y: 24, scale: 1, rotation: 0.02 },
    { x: 27, y: 24, scale: 0.96, rotation: 0.16 },
    { x: 48, y: 28, scale: 0.88, rotation: 0.28 },
    { x: -31, y: 11, scale: 0.92, rotation: -0.16 },
    { x: -6, y: 9, scale: 0.98, rotation: -0.03 },
    { x: 19, y: 9, scale: 0.96, rotation: 0.12 },
    { x: 45, y: 11, scale: 0.9, rotation: 0.2 },
    { x: -15, y: -6, scale: 0.86, rotation: -0.1 },
    { x: 13, y: -8, scale: 0.88, rotation: 0.08 },
  ],
};

function drawCollectorEgg(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, rotation: number, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  const sprite = getFallingEggSprite("center");
  if (sprite) {
    const drawWidth = 24;
    const drawHeight = drawWidth * (sprite.naturalHeight / sprite.naturalWidth);
    ctx.shadowColor = "rgba(111, 63, 23, 0.16)";
    ctx.shadowBlur = 5;
    ctx.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = "#fff7ec";
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d6b889";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.beginPath();
    ctx.ellipse(-2.6, -4.1, 2.6, 3.8, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCollectorInteriorEggs(
  ctx: CanvasRenderingContext2D,
  fillState: CollectorFillState,
  nowMs: number,
  alpha: number,
) {
  const eggs = COLLECTOR_EGG_LAYOUTS[fillState];
  if (eggs.length === 0 || alpha <= 0) {
    return;
  }

  eggs
    .slice()
    .sort((left, right) => left.y - right.y)
    .forEach((egg, index) => {
      const fullWiggle = fillState === "collector_full" && egg.y < 12 ? Math.sin(nowMs * 0.006 + index * 0.8) * 1.2 : 0;
      drawCollectorEgg(ctx, egg.x, egg.y + fullWiggle, egg.scale, egg.rotation, alpha);
    });
}

function traceCollectorBodyPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-78, 52);
  ctx.quadraticCurveTo(-92, 0, -68, -42);
  ctx.quadraticCurveTo(0, -54, 68, -42);
  ctx.quadraticCurveTo(92, 0, 78, 52);
  ctx.quadraticCurveTo(0, 64, -78, 52);
  ctx.closePath();
}

function traceCollectorFrontWallPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-84, 58);
  ctx.quadraticCurveTo(-74, -6, -62, -18);
  ctx.quadraticCurveTo(0, -4, 62, -18);
  ctx.quadraticCurveTo(74, -6, 84, 58);
  ctx.quadraticCurveTo(0, 72, -84, 58);
  ctx.closePath();
}

function traceCollectorInteriorPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-58, -31);
  ctx.quadraticCurveTo(0, -49, 58, -31);
  ctx.lineTo(48, 26);
  ctx.quadraticCurveTo(0, 38, -48, 26);
  ctx.closePath();
}

function drawCollectorWeave(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.lineCap = "round";

  for (let index = 0; index < 6; index += 1) {
    const y = top + 9 + index * 10;
    ctx.beginPath();
    ctx.moveTo(left + 8, y);
    ctx.quadraticCurveTo(left + width * 0.5, y - 5, left + width - 8, y + 1);
    ctx.strokeStyle = index % 2 === 0 ? "rgba(255, 198, 111, 0.28)" : "rgba(112, 54, 18, 0.26)";
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  for (let index = 0; index < 7; index += 1) {
    const x = left + 18 + index * 20;
    ctx.beginPath();
    ctx.moveTo(x, top + 4);
    ctx.quadraticCurveTo(x + (index % 2 === 0 ? 5 : -5), top + height * 0.55, x, top + height - 2);
    ctx.strokeStyle = index % 2 === 0 ? "rgba(255, 215, 136, 0.2)" : "rgba(121, 57, 21, 0.22)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  ctx.restore();
}

function drawCollectorPost(ctx: CanvasRenderingContext2D, x: number, yOffset: number, pulse: number) {
  ctx.save();
  ctx.translate(x, yOffset);

  const postGradient = ctx.createLinearGradient(0, -54, 0, 58);
  postGradient.addColorStop(0, "#d28735");
  postGradient.addColorStop(0.52, "#9f5620");
  postGradient.addColorStop(1, "#764117");

  ctx.beginPath();
  ctx.moveTo(-13, 54);
  ctx.quadraticCurveTo(-17, 6, -14, -38);
  ctx.quadraticCurveTo(-8, -58 - pulse * 3, 0, -60 - pulse * 3);
  ctx.quadraticCurveTo(8, -58 - pulse * 3, 14, -38);
  ctx.quadraticCurveTo(17, 6, 13, 54);
  ctx.quadraticCurveTo(0, 62, -13, 54);
  ctx.closePath();
  ctx.fillStyle = postGradient;
  ctx.fill();
  ctx.strokeStyle = "#6b3815";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 213, 126, 0.18)";
  ctx.beginPath();
  ctx.moveTo(-5, 46);
  ctx.quadraticCurveTo(2, 6, 3, -44);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255, 216, 132, 0.18)";
  ctx.stroke();
  ctx.restore();
}

function drawCollectorRim(ctx: CanvasRenderingContext2D, pulse: number) {
  ctx.save();
  ctx.lineCap = "round";

  const outerRim = ctx.createLinearGradient(0, -54, 0, -8);
  outerRim.addColorStop(0, "#ffd082");
  outerRim.addColorStop(0.48, "#e2a14a");
  outerRim.addColorStop(1, "#9b541f");

  ctx.beginPath();
  ctx.ellipse(0, -30 - pulse * 1.3, 79, 26, 0, Math.PI * 1.02, Math.PI * 1.98);
  ctx.lineWidth = 28;
  ctx.strokeStyle = outerRim;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, -30 - pulse * 1.3, 79, 26, 0, Math.PI * 1.02, Math.PI * 1.98);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "#7a4218";
  ctx.stroke();

  for (let index = 0; index < 11; index += 1) {
    const ratio = index / 10;
    const angle = Math.PI + ratio * Math.PI;
    const x = Math.cos(angle) * 69;
    const y = -30 - pulse * 1.3 + Math.sin(angle) * 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.quadraticCurveTo(-2, 2, -14, 8);
    ctx.moveTo(14, -8);
    ctx.quadraticCurveTo(2, 2, 14, 8);
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = "rgba(255, 233, 166, 0.38)";
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawCollectorBadge(ctx: CanvasRenderingContext2D) {
  const ring = ctx.createLinearGradient(0, 0, 0, 40);
  ring.addColorStop(0, "#fff8dd");
  ring.addColorStop(1, "#efc87d");

  ctx.save();
  ctx.translate(0, 23);
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 24, 0, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#b0682f";
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 1, 19, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fdf3d7";
  ctx.fill();
  ctx.strokeStyle = "rgba(176, 104, 47, 0.56)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#fff8ef";
  ctx.beginPath();
  ctx.ellipse(0, -1, 7, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d7bc90";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.strokeStyle = "#e1ae39";
  ctx.lineWidth = 2.8;
  for (let index = 0; index < 7; index += 1) {
    const offset = -10 + index * 3.4;
    ctx.beginPath();
    ctx.moveTo(offset, 9);
    ctx.quadraticCurveTo(offset * 0.45, 2, offset * 0.08, 12);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCollectorPrompt(ctx: CanvasRenderingContext2D, pulse: number) {
  ctx.save();
  ctx.translate(0, -72 - pulse * 4);
  fillRoundRect(ctx, -26, -18, 52, 36, 18, `rgba(255, 236, 173, ${0.78 + pulse * 0.18})`, "#8d552d");
  ctx.fillStyle = "#8b4f1f";
  ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("↓", 0, 8);
  ctx.restore();
}

function drawCollectorFeedbackLabel(ctx: CanvasRenderingContext2D, feedback: CollectorFeedback, nowMs: number) {
  const progress = clamp((nowMs - feedback.startedAt) / feedback.durationMs, 0, 1);
  const rise = 16 + progress * 22;
  const alpha = 1 - progress;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, -76 - rise);
  ctx.fillStyle = feedback.pointsAwarded >= COMBO_EGG_POINTS ? "#ffe18a" : "#fff5dc";
  ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`+${feedback.pointsAwarded}`, 0, 0);
  ctx.restore();
}

function drawCollectorEggCounter(ctx: CanvasRenderingContext2D, depositedEggs: number, pulse: number) {
  const counterLabel = `x${depositedEggs}`;
  const eggSprite = getFallingEggSprite("center");
  const chipX = 34;
  const chipY = -86 - pulse * 3;
  const chipHeight = 34;

  ctx.save();
  ctx.font = 'bold 19px "Trebuchet MS", sans-serif';
  const textWidth = ctx.measureText(counterLabel).width;
  const chipWidth = Math.max(74, 24 + textWidth + (eggSprite ? 26 : 0));

  fillRoundRect(ctx, chipX, chipY, chipWidth, chipHeight, 16, "rgba(94, 44, 18, 0.94)", "#e8b25b");
  fillRoundRect(ctx, chipX + 2, chipY + 2, chipWidth - 4, 12, 12, "rgba(255, 245, 212, 0.18)");

  if (eggSprite) {
    const drawWidth = 15;
    const drawHeight = drawWidth * (eggSprite.naturalHeight / eggSprite.naturalWidth);
    ctx.drawImage(eggSprite, chipX + 11, chipY + (chipHeight - drawHeight) / 2, drawWidth, drawHeight);
  }

  ctx.fillStyle = "#fff9ee";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(counterLabel, chipX + (eggSprite ? 30 : 14), chipY + chipHeight / 2 + 1);
  ctx.restore();
}

function drawCollector(ctx: CanvasRenderingContext2D, state: GameState) {
  const { collector, farmer, collectorFeedback } = state;
  const nearCollector = isFarmerNearCollector(farmer, collector) && farmer.basketEggs > 0;
  const fillState = getCollectorFillState(state.collectorVisualEggs);
  const feedbackProgress = collectorFeedback
    ? clamp((state.nowMs - collectorFeedback.startedAt) / collectorFeedback.durationMs, 0, 1)
    : 1;
  const bounce = collectorFeedback ? Math.sin(feedbackProgress * Math.PI) * 7 : 0;
  const squash = collectorFeedback ? 1 + Math.sin(feedbackProgress * Math.PI) * 0.028 : 1;
  const stretch = collectorFeedback ? 1 - Math.sin(feedbackProgress * Math.PI) * 0.024 : 1;
  const pulse = nearCollector ? (Math.sin(state.nowMs * 0.009) + 1) * 0.5 : 0;
  const transitionAlpha = collectorFeedback && collectorFeedback.fromState !== collectorFeedback.toState
    ? clamp(feedbackProgress * 1.2, 0, 1)
    : 1;
  const top = collector.y - collector.height / 2;
  const left = collector.x - collector.width / 2;

  if (nearCollector) {
    ctx.save();
    ctx.shadowColor = "rgba(255, 216, 119, 0.52)";
    ctx.shadowBlur = 26 + pulse * 8;
    fillRoundRect(
      ctx,
      left - 10,
      top - 12 - pulse * 2,
      collector.width + 20,
      collector.height + 18 + pulse * 3,
      30,
      "rgba(255, 214, 141, 0.2)",
    );
    ctx.restore();
  }

  ctx.save();
  ctx.translate(collector.x, collector.y + bounce);
  ctx.scale(squash, stretch);

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 62, 78, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  const collectorSprite = getCollectorSprite("basket");
  if (collectorSprite) {
    const drawWidth = collector.width + 12;
    const drawHeight = drawWidth * (collectorSprite.naturalHeight / collectorSprite.naturalWidth);
    const drawY = -drawHeight * 0.34;

    ctx.drawImage(collectorSprite, -drawWidth / 2, drawY, drawWidth, drawHeight);
  } else {
    drawCollectorPost(ctx, -79, 0, pulse);
    drawCollectorPost(ctx, 79, 0, pulse);

    ctx.save();
    traceCollectorBodyPath(ctx);
    ctx.clip();
    const backShell = ctx.createLinearGradient(0, -54, 0, 60);
    backShell.addColorStop(0, "#7b4018");
    backShell.addColorStop(0.45, "#9a5622");
    backShell.addColorStop(1, "#6d3814");
    ctx.fillStyle = backShell;
    ctx.fillRect(-100, -70, 200, 150);
    drawCollectorWeave(ctx, -84, -28, 168, 82);
    ctx.restore();

    ctx.save();
    traceCollectorInteriorPath(ctx);
    ctx.clip();
    const cavity = ctx.createLinearGradient(0, -46, 0, 30);
    cavity.addColorStop(0, "#4f2712");
    cavity.addColorStop(0.38, "#6f3917");
    cavity.addColorStop(1, "#915226");
    ctx.fillStyle = cavity;
    ctx.fillRect(-70, -52, 140, 92);
    drawCollectorWeave(ctx, -58, -30, 116, 58);
    ctx.fillStyle = "rgba(255, 217, 121, 0.18)";
    ctx.beginPath();
    ctx.ellipse(0, -24, 48, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    if (collectorFeedback && collectorFeedback.fromState !== collectorFeedback.toState) {
      drawCollectorInteriorEggs(ctx, collectorFeedback.fromState, state.nowMs, 1 - transitionAlpha);
      drawCollectorInteriorEggs(ctx, collectorFeedback.toState, state.nowMs, transitionAlpha);
    } else {
      drawCollectorInteriorEggs(ctx, fillState, state.nowMs, 1);
    }
    ctx.restore();

    ctx.save();
    traceCollectorFrontWallPath(ctx);
    const frontGradient = ctx.createLinearGradient(0, -18, 0, 62);
    frontGradient.addColorStop(0, "#d88b3b");
    frontGradient.addColorStop(0.42, "#b26328");
    frontGradient.addColorStop(1, "#87461b");
    ctx.fillStyle = frontGradient;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#6e3817";
    ctx.stroke();

    ctx.save();
    traceCollectorFrontWallPath(ctx);
    ctx.clip();
    drawCollectorWeave(ctx, -84, -10, 168, 66);
    ctx.fillStyle = "rgba(255, 242, 214, 0.15)";
    ctx.beginPath();
    ctx.moveTo(-54, -5);
    ctx.quadraticCurveTo(0, -16, 54, -5);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 235, 189, 0.18)";
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    drawCollectorRim(ctx, pulse);
    drawCollectorBadge(ctx);
  }

  drawCollectorEggCounter(ctx, state.stats.depositedEggs, pulse);

  if (nearCollector) {
    drawCollectorPrompt(ctx, pulse);
  }

  if (collectorFeedback) {
    drawCollectorFeedbackLabel(ctx, collectorFeedback, state.nowMs);
  }

  ctx.restore();
}

function drawBasketEggs(ctx: CanvasRenderingContext2D, farmer: Farmer) {
  const visibleEggs = Math.min(6, farmer.basketEggs);
  const basketX = farmer.facing > 0 ? 22 : -22;
  const rows = visibleEggs > 3 ? 2 : 1;

  for (let index = 0; index < visibleEggs; index += 1) {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const offsetX = basketX - 14 + column * 12;
    const offsetY = 4 - row * 10 - (rows === 1 ? 5 : 0);
    ctx.fillStyle = "#fff6ea";
    ctx.beginPath();
    ctx.ellipse(offsetX, offsetY, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (farmer.basketEggs > 6) {
    ctx.fillStyle = "#fff8ef";
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(`x${farmer.basketEggs}`, basketX, -8);
  }
}

function getFarmerSpriteName(farmer: Farmer, nowMs: number): FarmerSpriteName {
  const action =
    farmer.animation && nowMs - farmer.animation.startedAt < farmer.animation.durationMs ? farmer.animation.name : null;

  if (action === "slipFall") {
    return "slipFall";
  }

  if (farmer.isFallen) {
    return "lying";
  }

  if (action) {
    return action;
  }

  if (farmer.isJumping) {
    return "jump";
  }

  if (Math.abs(farmer.vx) > 1) {
    const frameIndex = Math.floor(farmer.walkCycleMs / FARMER_RUN_FRAME_MS) % FARMER_RUN_FRAMES.length;
    return FARMER_RUN_FRAMES[frameIndex];
  }

  return "idle";
}

function isRunSprite(spriteName: FarmerSpriteName) {
  return spriteName === "run01" || spriteName === "run02" || spriteName === "run03" || spriteName === "run04";
}

function getBasketFillSpriteName(basketEggs: number): BasketFillSpriteName {
  if (basketEggs <= 1) {
    return "one";
  }

  if (basketEggs === 2) {
    return "two";
  }

  return "full";
}

function drawOverheadBasketFill(ctx: CanvasRenderingContext2D, farmer: Farmer, spriteName: FarmerSpriteName, baseWidth: number, baseHeight: number) {
  if (farmer.basketEggs <= 0 || spriteName === "slipFall" || spriteName === "lying") {
    return;
  }

  const basketSprite = getBasketFillSprite(getBasketFillSpriteName(farmer.basketEggs));
  if (!basketSprite) {
    return;
  }

  ctx.drawImage(basketSprite, -baseWidth / 2, -baseHeight, baseWidth, baseHeight);
}

function drawFarmerSprite(ctx: CanvasRenderingContext2D, farmer: Farmer, timeMs: number) {
  const spriteName = getFarmerSpriteName(farmer, timeMs);
  const sprite = getFarmerSprite(spriteName);
  if (!sprite) {
    return false;
  }

  const actionProgress =
    farmer.animation && farmer.animation.name === spriteName
      ? clamp((timeMs - farmer.animation.startedAt) / farmer.animation.durationMs, 0, 1)
      : 0;
  const walkPulse = Math.sin(farmer.walkCycleMs * 0.018);
  const idleBob = spriteName === "idle" ? Math.sin(timeMs * 0.0055) * 2 : 0;
  const isRunning = isRunSprite(spriteName);
  const runBob = isRunning ? Math.abs(walkPulse) * 4 : 0;
  const catchBounce = spriteName === "catch" ? Math.sin(actionProgress * Math.PI) * -7 : 0;
  const throwSnap = spriteName === "throw" ? Math.sin(actionProgress * Math.PI) * -5 : 0;
  const recoverRise = spriteName === "recover" ? (1 - actionProgress) * 9 : 0;
  const slipShake = spriteName === "slipFall" ? Math.sin(timeMs * 0.08) * 4 : 0;
  const groundY = farmer.y + FARMER_HEIGHT * 0.52;
  const baseHeight = 225;
  const baseWidth = baseHeight * (sprite.naturalWidth / sprite.naturalHeight);
  const facing = farmer.facing >= 0 ? 1 : -1;
  const squashY = isRunning ? 1 + Math.abs(walkPulse) * 0.025 : 1;
  const squashX = isRunning ? 1 - Math.abs(walkPulse) * 0.018 : 1;
  const tilt =
    isRunning
      ? farmer.facing * -0.06
      : spriteName === "jump"
        ? farmer.facing * -0.08
        : spriteName === "slipFall"
          ? -0.18
          : 0;

  ctx.save();
  ctx.translate(farmer.x, groundY);

  ctx.translate(slipShake, idleBob - runBob + catchBounce + throwSnap + recoverRise);
  ctx.rotate(tilt);
  ctx.scale(facing * squashX, squashY);
  ctx.drawImage(sprite, -baseWidth / 2, -baseHeight, baseWidth, baseHeight);
  drawOverheadBasketFill(ctx, farmer, spriteName, baseWidth, baseHeight);
  ctx.restore();

  return true;
}

function drawFarmer(ctx: CanvasRenderingContext2D, farmer: Farmer, timeMs: number) {
  if (drawFarmerSprite(ctx, farmer, timeMs)) {
    return;
  }

  ctx.save();
  ctx.translate(farmer.x, farmer.y);

  if (farmer.isFallen) {
    ctx.rotate(-0.92);

    fillRoundRect(ctx, -20, 24, 40, 26, 12, "#8d552d");
    ctx.fillStyle = "#f2c184";
    ctx.beginPath();
    ctx.arc(30, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#395b37";
    fillRoundRect(ctx, -24, -12, 56, 38, 16, "#395b37");
    fillRoundRect(ctx, -26, 8, 18, 42, 8, "#2d4152");
    fillRoundRect(ctx, 8, 8, 18, 42, 8, "#2d4152");
    return void ctx.restore();
  }

  const walkSwing = farmer.vx === 0 || farmer.isJumping ? 0 : Math.sin(farmer.walkCycleMs * 0.018) * 9;
  const lift = farmer.isJumping ? -8 : 0;

  ctx.strokeStyle = "#2d4152";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-10, 20 + lift);
  ctx.lineTo(-14 + walkSwing, 54 + lift);
  ctx.moveTo(10, 20 + lift);
  ctx.lineTo(14 - walkSwing, 54 + lift);
  ctx.stroke();

  ctx.strokeStyle = "#7b4620";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-18, -6 + lift);
  ctx.lineTo(-28 - walkSwing * 0.2, 18 + lift);
  ctx.moveTo(18, -6 + lift);
  ctx.lineTo(30 + walkSwing * 0.2, 18 + lift);
  ctx.stroke();

  fillRoundRect(ctx, -24, -30 + lift, 48, 60, 20, "#3f6d3a");
  fillRoundRect(ctx, -24, -44 + lift, 48, 18, 9, "#2f4c28");
  fillRoundRect(ctx, -10, -60 + lift, 20, 20, 8, "#d9a150");
  fillRoundRect(ctx, -18, -68 + lift, 36, 12, 7, "#c37d27");

  ctx.fillStyle = "#f1c083";
  ctx.beginPath();
  ctx.arc(0, -18 + lift, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#5f2f13";
  ctx.beginPath();
  ctx.arc(-5, -20 + lift, 2.3, 0, Math.PI * 2);
  ctx.arc(5, -20 + lift, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#5f2f13";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, -10 + lift);
  ctx.quadraticCurveTo(0, -6 + lift, 6, -10 + lift);
  ctx.stroke();

  ctx.save();
  ctx.translate(farmer.facing > 0 ? 28 : -28, 8 + lift);
  fillRoundRect(ctx, -20, -18, 40, 30, 14, "#b87936", "#6f4421");
  drawBasketEggs(ctx, farmer);
  ctx.restore();

  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.depositCombo.count >= 2 && state.depositCombo.activeUntil > state.nowMs) {
    fillRoundRect(ctx, FIELD_WIDTH / 2 - 114, 96, 228, 46, 23, "rgba(129, 42, 14, 0.88)");
    ctx.fillStyle = "#ffe8b7";
    ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    const comboLabel = state.depositCombo.count >= 5 ? `COMBO x${state.depositCombo.count} · ${COMBO_EGG_POINTS} pts` : `STREAK x${state.depositCombo.count}`;
    ctx.fillText(comboLabel, FIELD_WIDTH / 2, 125);
  }
}

function drawOverlayBlock(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
  rows: string[],
) {
  const panelWidth = 688;
  const panelX = (FIELD_WIDTH - panelWidth) / 2;
  const contentWidth = 588;
  const leftX = panelX + 62;
  const centerX = FIELD_WIDTH / 2;
  const subtitleLineHeight = 22;
  const rowLineHeight = 24;
  const footerLineHeight = 20;
  const rowCardGap = 10;
  const rowCardHeights: number[] = [];

  ctx.save();
  ctx.textBaseline = "top";

  ctx.font = '500 16px "Avenir Next", "Trebuchet MS", sans-serif';
  const subtitleLines = getWrappedTextLines(ctx, subtitle, contentWidth);

  ctx.font = '600 15px "Avenir Next", "Trebuchet MS", sans-serif';
  const rowLineGroups = rows.map((row) => {
    const lines = getWrappedTextLines(ctx, row, contentWidth - 34);
    rowCardHeights.push(lines.length * rowLineHeight + 18);
    return lines;
  });

  ctx.font = '700 13px "Avenir Next", "Trebuchet MS", sans-serif';
  const footerText = "Use the controls below the stage to start, pause, or restart the shift.";
  const footerLines = getWrappedTextLines(ctx, footerText, contentWidth);

  const subtitleHeight = subtitleLines.length * subtitleLineHeight;
  const rowsHeight = rowCardHeights.reduce((total, height) => total + height, 0);
  const rowGroupGaps = Math.max(0, rows.length - 1) * rowCardGap;
  const footerHeight = footerLines.length * footerLineHeight;
  const panelHeight = 190 + subtitleHeight + rowsHeight + rowGroupGaps + footerHeight;
  const panelY = Math.max(84, (FIELD_HEIGHT - panelHeight) / 2);

  ctx.save();
  ctx.fillStyle = "rgba(23, 12, 7, 0.66)";
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  fillRoundRect(ctx, panelX, panelY, panelWidth, panelHeight, 34, "rgba(54, 28, 16, 0.95)", "rgba(255, 221, 166, 0.22)");
  fillRoundRect(ctx, panelX + 18, panelY + 14, panelWidth - 36, 84, 24, "rgba(255, 239, 198, 0.08)");
  ctx.restore();

  ctx.fillStyle = "#fff7e6";
  ctx.font = title.length > 12 ? 'bold 46px "Arial Black", "Avenir Next", sans-serif' : 'bold 50px "Arial Black", "Avenir Next", sans-serif';
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(17, 8, 4, 0.34)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillText(title, centerX, panelY + 38);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = "#f5dfbf";
  ctx.font = '500 16px "Avenir Next", "Trebuchet MS", sans-serif';
  ctx.shadowColor = "rgba(16, 8, 4, 0.18)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  drawWrappedText(ctx, subtitle, centerX, panelY + 106, contentWidth, subtitleLineHeight);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const dividerY = panelY + 106 + subtitleHeight + 18;
  ctx.strokeStyle = "rgba(255, 223, 169, 0.24)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + 58, dividerY);
  ctx.lineTo(panelX + panelWidth - 58, dividerY);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = '700 16px "Avenir Next", "Trebuchet MS", sans-serif';
  let currentY = dividerY + 18;
  rowLineGroups.forEach((lines, groupIndex) => {
    const cardHeight = rowCardHeights[groupIndex];
    fillRoundRect(
      ctx,
      leftX - 16,
      currentY - 6,
      contentWidth + 6,
      cardHeight,
      18,
      "rgba(101, 57, 33, 0.52)",
      "rgba(255, 224, 182, 0.18)",
    );

    ctx.fillStyle = "#fff1d7";
    ctx.shadowColor = "rgba(14, 7, 4, 0.26)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, leftX, currentY + index * rowLineHeight);
    });
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    currentY += cardHeight + rowCardGap;
  });

  ctx.fillStyle = "#ffd072";
  ctx.font = '700 13px "Avenir Next", "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(14, 7, 4, 0.24)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  drawWrappedText(ctx, footerText, centerX, currentY + 6, contentWidth, footerLineHeight);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.restore();
}

function drawOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.status === "start") {
    drawOverlayBlock(
      ctx,
      GAME_TITLE,
      "Catch eggs, bank them, jump over puddles, and keep the hens safe.",
      [
        "1. Catch falling eggs before they hit the floor.",
        "2. Deposit eggs into the crate for 10 points each. From the 5th quick deposit onward, every egg is worth 20 points.",
        "3. Jump over egg puddles. A fall costs half your basket for 1 second.",
        "4. Press Space to throw one egg straight up at any time. When the fox appears, stand under the marked hen to knock it away.",
      ],
    );
    return;
  }

  if (state.status === "paused") {
    drawOverlayBlock(
      ctx,
      "Paused",
      "The coop is holding still. Resume when you're ready for the next scramble.",
      [
        "Left / Right: move the farmer.",
        "Up: jump over fresh egg puddles.",
        "Down: deposit one egg into the collector.",
        "Space: throw one egg straight up.",
      ],
    );
    return;
  }

  if (state.status !== "gameOver") {
    return;
  }

  const reason =
    state.gameOverReason === "brokenEggs"
      ? "Too many eggs were lost on the floor."
      : "The fox managed to take every hen from the roost.";

  drawOverlayBlock(
    ctx,
    "Shift Over",
    reason,
    [
      `Score: ${state.score.toLocaleString()}`,
      `Caught eggs: ${state.stats.caughtEggs}`,
      `Broken eggs: ${state.brokenEggsCount}`,
      `Saved chickens: ${state.stats.foxesRepelled}`,
    ],
  );
}

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  drawBackdrop(ctx, state.nowMs);
  drawRoost(ctx);

  const carriedChickenId =
    state.fox && (state.fox.animation.name === "steal" || state.fox.animation.name === "carryUp")
      ? state.fox.targetChickenId
      : null;
  const coopPanic = Boolean(state.fox?.active);

  state.puddles.forEach((puddle) => drawPuddle(ctx, puddle, state.nowMs));
  state.eggs.forEach((egg) => drawEgg(ctx, egg, state.nowMs));
  drawCollector(ctx, state);
  state.chickens.forEach((chicken) => {
    if (chicken.id !== carriedChickenId) {
      drawChicken(ctx, chicken, state.nowMs, coopPanic);
    }
  });
  state.thrownEggs.forEach((egg) => drawEgg(ctx, egg, state.nowMs, true));
  if (state.fox) {
    drawFox(ctx, state.fox, state);
  }
  state.eggEffects.forEach((effect) => drawEggEffect(ctx, effect, state.nowMs));
  drawFarmer(ctx, state.farmer, state.nowMs);
  drawHud(ctx, state);
  drawOverlay(ctx, state);
}
