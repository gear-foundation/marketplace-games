export type Side = "left" | "right";
export type BranchSide = Side | "none";
export type RunStatus = "ready" | "playing" | "ended";

export type ChopEffect = {
  side: Side;
  startedAt: number;
};

export type RunSummary = {
  runId: string;
  height: number;
  logs: number;
  combo: number;
  durationMs: number;
};

export type SpriteSource = HTMLCanvasElement | HTMLImageElement;

export type LumberjackRuntime = {
  branches: BranchSide[];
  chopEffect: ChopEffect | null;
  side: Side;
  logs: number;
  combo: number;
  energy: number;
  startTime: number;
  lastFrame: number;
  lastChopAt: number;
  status: RunStatus;
};

export type LumberjackAssets = {
  idle: { image: SpriteSource | null; ready: boolean };
  prepare: { image: SpriteSource | null; ready: boolean };
  chop: { image: SpriteSource | null; ready: boolean };
  dead: { image: SpriteSource | null; ready: boolean };
  tree: { image: HTMLImageElement | null; ready: boolean };
  branch: { image: HTMLImageElement | null; ready: boolean };
  grass: { image: SpriteSource | null; ready: boolean };
  chips: { images: HTMLImageElement[]; ready: boolean };
};

type PlayerPose = "idle" | "prepare" | "chop" | "dead";

export const CANVAS_WIDTH = 420;
export const CANVAS_HEIGHT = 620;
export const CHOP_LOCK_MS = 110;
export const RUN_DURATION_MS = 60_000;

const TREE_X = CANVAS_WIDTH / 2;
const TREE_WIDTH = 78;
const SEGMENT_HEIGHT = 64;
const TREE_VERTICAL_OFFSET = 14;
const TREE_ROW_START_Y = 476 + TREE_VERTICAL_OFFSET;
const TREE_BRANCH_Y_OFFSET = 18;
const TREE_IMPACT_Y = 478 + TREE_VERTICAL_OFFSET;
const GROUND_Y = 546;
const PLAYER_Y = 540;
const PLAYER_OFFSET = 155;
const LUMBERJACK_DRAW_X = -91;
const LUMBERJACK_DRAW_Y = -200;
const LUMBERJACK_DRAW_WIDTH = 260;
const LUMBERJACK_DRAW_HEIGHT = 276;
const PLAYER_HITBOX_LEFT_X = LUMBERJACK_DRAW_X + 6;
const PLAYER_HITBOX_RIGHT_X = -144;
const PLAYER_HITBOX_Y = PLAYER_Y + LUMBERJACK_DRAW_Y + 10;
const PLAYER_HITBOX_WIDTH = 138;
const PLAYER_HITBOX_HEIGHT = 220;
const BRANCH_DRAW_WIDTH = 154;
const BRANCH_DRAW_HEIGHT = 62;
const BRANCH_DRAW_Y = -31;
const BRANCH_BASE_OVERLAP = 8;
const BRANCH_FLY_WIDTH = 128;
const BRANCH_FLY_HEIGHT = 52;
const GRASS_DRAW_WIDTH = CANVAS_WIDTH + 40;
const GRASS_DRAW_HEIGHT = 148;
const GRASS_BOTTOM_OVERDRAW = 18;
const CHIP_COUNT = 6;
// The player was moved lower on the stage, so the first dangerous branch row
// is now closer to the stump. Keeping three safe rows makes collisions miss.
const SAFE_BRANCH_ROWS = 2;
const CHOP_EFFECT_MS = 180;

export function makeRunId() {
  return `lumber-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function randomBranch(logs: number, recentBranches: BranchSide[], runProgress = 0): BranchSide {
  if (logs < 2) return "none";
  const lastBranch = recentBranches[recentBranches.length - 1] ?? "none";

  // Keep one empty spacer row after every branch so the player never gets
  // trapped by left/right branches stacked too tightly near the stump.
  if (lastBranch !== "none") return "none";

  const clampedProgress = Math.max(0, Math.min(1, runProgress));
  const noneChance = clampedProgress < 1 / 3 ? 0.18 : clampedProgress < 2 / 3 ? 0.13 : 0.08;
  const roll = Math.random();
  if (roll < noneChance) return "none";
  return Math.random() < 0.5 ? "left" : "right";
}

export function createBranches(): BranchSide[] {
  return ["none", "none", "none", "none", "right", "none", "left", "none", "right", "none", "left", "none"];
}

export function createInitialRuntime(): LumberjackRuntime {
  return {
    branches: createBranches(),
    chopEffect: null,
    side: "left",
    logs: 0,
    combo: 0,
    energy: 1,
    startTime: 0,
    lastFrame: 0,
    lastChopAt: 0,
    status: "ready",
  };
}

export function createEmptyAssets(): LumberjackAssets {
  return {
    idle: { image: null, ready: false },
    prepare: { image: null, ready: false },
    chop: { image: null, ready: false },
    dead: { image: null, ready: false },
    tree: { image: null, ready: false },
    branch: { image: null, ready: false },
    grass: { image: null, ready: false },
    chips: { images: [], ready: false },
  };
}

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export function hasBranchCollision(branches: BranchSide[], side: Side) {
  const playerX = side === "left" ? TREE_X - PLAYER_OFFSET : TREE_X + PLAYER_OFFSET;
  const playerBounds =
    side === "left"
      ? {
          x: playerX + PLAYER_HITBOX_LEFT_X,
          y: PLAYER_HITBOX_Y,
          width: PLAYER_HITBOX_WIDTH,
          height: PLAYER_HITBOX_HEIGHT,
        }
      : {
          x: playerX + PLAYER_HITBOX_RIGHT_X,
          y: PLAYER_HITBOX_Y,
          width: PLAYER_HITBOX_WIDTH,
          height: PLAYER_HITBOX_HEIGHT,
        };

  return branches.some((branch, index) => {
    if (index < SAFE_BRANCH_ROWS || branch !== side) return false;

    const branchY = TREE_ROW_START_Y - index * SEGMENT_HEIGHT + TREE_BRANCH_Y_OFFSET;
    const branchBounds =
      branch === "left"
        ? {
            x: TREE_X - TREE_WIDTH / 2 - BRANCH_DRAW_WIDTH + BRANCH_BASE_OVERLAP,
            y: branchY - 18,
            width: BRANCH_DRAW_WIDTH - 12,
            height: 36,
          }
        : {
            x: TREE_X + TREE_WIDTH / 2 - BRANCH_BASE_OVERLAP,
            y: branchY - 18,
            width: BRANCH_DRAW_WIDTH - 12,
            height: 36,
          };

    return rectanglesOverlap(playerBounds, branchBounds);
  });
}

function drawBranch(ctx: CanvasRenderingContext2D, branch: Side, branchY: number, assets: LumberjackAssets) {
  if (assets.branch.ready && assets.branch.image) {
    if (branch === "left") {
      ctx.save();
      ctx.translate(TREE_X - TREE_WIDTH / 2 + BRANCH_BASE_OVERLAP, branchY + BRANCH_DRAW_Y);
      ctx.scale(-1, 1);
      ctx.drawImage(assets.branch.image, 0, 0, BRANCH_DRAW_WIDTH, BRANCH_DRAW_HEIGHT);
      ctx.restore();
      return;
    }

    ctx.drawImage(
      assets.branch.image,
      TREE_X + TREE_WIDTH / 2 - BRANCH_BASE_OVERLAP,
      branchY + BRANCH_DRAW_Y,
      BRANCH_DRAW_WIDTH,
      BRANCH_DRAW_HEIGHT,
    );
    return;
  }

  ctx.fillStyle = "#070b13";
  if (branch === "left") {
    ctx.beginPath();
    ctx.roundRect(TREE_X - TREE_WIDTH / 2 - 118, branchY - 6, 120, 38, 18);
    ctx.fill();
    ctx.fillStyle = "#8b4b17";
    ctx.beginPath();
    ctx.roundRect(TREE_X - TREE_WIDTH / 2 - 108, branchY + 2, 96, 23, 12);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.roundRect(TREE_X + TREE_WIDTH / 2 - 2, branchY - 6, 120, 38, 18);
  ctx.fill();
  ctx.fillStyle = "#8b4b17";
  ctx.beginPath();
  ctx.roundRect(TREE_X + TREE_WIDTH / 2 + 12, branchY + 2, 96, 23, 12);
  ctx.fill();
}

function isBackdropPixel(data: Uint8ClampedArray, pixelIndex: number) {
  const offset = pixelIndex * 4;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const a = data[offset + 3];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  return a > 0 && min >= 200 && max - min <= 48;
}

export function removeWhiteBackdrop(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return image;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixelIndex = y * width + x;
    if (visited[pixelIndex] || !isBackdropPixel(data, pixelIndex)) return;
    visited[pixelIndex] = 1;
    queue[tail] = pixelIndex;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const pixelIndex = queue[head];
    head += 1;

    const offset = pixelIndex * 4;
    data[offset + 3] = 0;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function trimTransparentBounds(source: SpriteSource) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return source;

  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return source;
  }

  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;
  if (trimmedWidth === width && trimmedHeight === height) {
    return source;
  }

  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;

  const trimmedCtx = trimmedCanvas.getContext("2d");
  if (!trimmedCtx) return source;

  trimmedCtx.drawImage(canvas, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
  return trimmedCanvas;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  runtime: LumberjackRuntime,
  now: number,
  assets: LumberjackAssets,
) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const sky = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  sky.addColorStop(0, "#dbe7ff");
  sky.addColorStop(0.5, "#dfe7ff");
  sky.addColorStop(1, "#d6f0ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "rgba(129, 140, 248, 0.14)";
  ctx.beginPath();
  ctx.ellipse(92, 156, 92, 38, -0.2, 0, Math.PI * 2);
  ctx.ellipse(330, 104, 72, 28, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d6e4ff";
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
  ctx.fillStyle = "#bcd3ff";
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 5);

  const chopProgress = runtime.chopEffect ? Math.min(1, (now - runtime.chopEffect.startedAt) / CHOP_EFFECT_MS) : 1;
  const treeDrop = runtime.chopEffect && chopProgress < 1 ? (1 - chopProgress) * 18 : 0;

  const trunkTopY = -4 + TREE_VERTICAL_OFFSET + treeDrop;
  const trunkBottomY = GROUND_Y + 16 + treeDrop;
  const trunkHeight = trunkBottomY - trunkTopY;

  ctx.fillStyle = "#8d5727";
  ctx.fillRect(TREE_X - TREE_WIDTH / 2, trunkTopY, TREE_WIDTH, trunkHeight);
  ctx.fillStyle = "rgba(255, 214, 153, 0.16)";
  ctx.fillRect(TREE_X - 12, trunkTopY, 8, trunkHeight);
  ctx.fillStyle = "rgba(63, 31, 10, 0.12)";
  ctx.fillRect(TREE_X + 18, trunkTopY, 8, trunkHeight);

  if (assets.tree.ready && assets.tree.image) {
    ctx.drawImage(assets.tree.image, TREE_X - 78, trunkTopY - 14, 156, 646);
  }

  for (let index = 0; index < 9; index += 1) {
    const y = TREE_ROW_START_Y - index * SEGMENT_HEIGHT + treeDrop;
    const shade = index % 2 === 0 ? "#8b5e34" : "#98683c";

    if (!assets.tree.ready || !assets.tree.image) {
      if (!(index === 0 && runtime.chopEffect && chopProgress < 1)) {
        ctx.fillStyle = shade;
        ctx.fillRect(TREE_X - TREE_WIDTH / 2, y, TREE_WIDTH, SEGMENT_HEIGHT + 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(TREE_X - TREE_WIDTH / 2 + 10, y + 6, 9, SEGMENT_HEIGHT - 12);
        ctx.fillStyle = "rgba(55, 26, 9, 0.16)";
        ctx.fillRect(TREE_X + TREE_WIDTH / 2 - 18, y + 4, 8, SEGMENT_HEIGHT - 8);
      }
    }

    const branch = index < SAFE_BRANCH_ROWS ? "none" : runtime.branches[index];
    if (branch !== "none") {
      drawBranch(ctx, branch, y + TREE_BRANCH_Y_OFFSET, assets);
    }
  }

  const grassTop = GROUND_Y - 6;
  const grassDrawY = CANVAS_HEIGHT - GRASS_DRAW_HEIGHT + GRASS_BOTTOM_OVERDRAW;
  if (assets.grass.ready && assets.grass.image) {
    ctx.drawImage(assets.grass.image, -20, grassDrawY, GRASS_DRAW_WIDTH, GRASS_DRAW_HEIGHT);
  } else {
    const grassGradient = ctx.createLinearGradient(0, grassTop, 0, CANVAS_HEIGHT);
    grassGradient.addColorStop(0, "#6ee7b7");
    grassGradient.addColorStop(1, "#16a34a");
    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, grassTop, CANVAS_WIDTH, CANVAS_HEIGHT - grassTop);

    ctx.fillStyle = "#22c55e";
    for (let x = -10; x < CANVAS_WIDTH + 18; x += 16) {
      const bladeHeight = 10 + ((x / 16) % 3) * 4;
      ctx.beginPath();
      ctx.moveTo(x, grassTop + 14);
      ctx.lineTo(x + 8, grassTop - bladeHeight);
      ctx.lineTo(x + 16, grassTop + 14);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "rgba(21, 128, 61, 0.22)";
    ctx.fillRect(0, grassTop + 10, CANVAS_WIDTH, CANVAS_HEIGHT - grassTop - 10);
  }

  if (runtime.chopEffect && chopProgress < 1) {
    const direction = runtime.chopEffect.side === "left" ? -1 : 1;
    const impactStrength = 1 - chopProgress;
    const flyX = TREE_X + direction * (TREE_WIDTH / 2 + 24 + chopProgress * 138);
    const flyY = TREE_IMPACT_Y + 14 - chopProgress * 54 + Math.sin(chopProgress * Math.PI) * 10;

    ctx.save();
    ctx.translate(flyX, flyY);
    ctx.rotate(direction * (-0.2 - chopProgress * 1.55));
    ctx.scale(1 - chopProgress * 0.14, 1 - chopProgress * 0.14);
    if (assets.branch.ready && assets.branch.image) {
      if (direction < 0) ctx.scale(-1, 1);
      ctx.drawImage(assets.branch.image, -BRANCH_FLY_WIDTH / 2, -BRANCH_FLY_HEIGHT / 2, BRANCH_FLY_WIDTH, BRANCH_FLY_HEIGHT);
    } else {
      ctx.fillStyle = "#8b5e34";
      ctx.fillRect(-46, -18, 92, 36);
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(-34, -11, 54, 6);
      ctx.strokeStyle = "rgba(55, 26, 9, 0.32)";
      ctx.lineWidth = 3;
      ctx.strokeRect(-46, -18, 92, 36);
    }
    ctx.restore();

    const hitX = TREE_X + direction * (TREE_WIDTH / 2 + 4);
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.78 * impactStrength})`;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hitX - direction * 4, TREE_IMPACT_Y);
    ctx.lineTo(hitX + direction * (24 + impactStrength * 12), TREE_IMPACT_Y - 26 - impactStrength * 12);
    ctx.stroke();

    ctx.strokeStyle = "rgba(250, 204, 21, 0.88)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (let index = 0; index < 5; index += 1) {
      const sparkY = TREE_IMPACT_Y + 2 + index * 9;
      ctx.beginPath();
      ctx.moveTo(hitX, sparkY);
      ctx.lineTo(hitX + direction * (22 + index * 4), sparkY - 10 + index * 2);
      ctx.stroke();
    }

    for (let index = 0; index < CHIP_COUNT; index += 1) {
      const spread = index - (CHIP_COUNT - 1) / 2;
      const chipX = hitX + direction * (18 + chopProgress * 82 + index * 8);
      const chipY = TREE_IMPACT_Y + 10 - chopProgress * (34 + index * 4) + Math.abs(spread) * 6;
      const chipRotation = direction * (-0.34 - chopProgress * 1.45 + spread * 0.12);
      const chipScale = 1 - chopProgress * 0.38;

      ctx.save();
      ctx.translate(chipX, chipY);
      ctx.rotate(chipRotation);
      ctx.scale(chipScale, chipScale);
      if (assets.chips.ready && assets.chips.images.length > 0) {
        const chipImage = assets.chips.images[index % assets.chips.images.length];
        ctx.drawImage(chipImage, -14, -10, 28, 20);
      } else {
        ctx.fillStyle = index % 2 === 0 ? "#c97a27" : "#9d541a";
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-2, -7);
        ctx.lineTo(9, -1);
        ctx.lineTo(4, 8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  const playerX = runtime.side === "left" ? TREE_X - PLAYER_OFFSET : TREE_X + PLAYER_OFFSET;
  let playerPose: PlayerPose = "idle";
  if (runtime.status === "ended") {
    playerPose = "dead";
  } else if (runtime.chopEffect && chopProgress < 1 && runtime.chopEffect.side === runtime.side) {
    playerPose = chopProgress < 0.28 ? "prepare" : "chop";
  }

  ctx.save();
  ctx.translate(playerX, PLAYER_Y);
  const facingDirection = runtime.side === "left" ? -1 : 1;
  if (playerPose === "idle") {
    ctx.translate(0, Math.sin(now / 180) * 1.8);
  } else if (playerPose === "prepare") {
    const prepareProgress = chopProgress / 0.28;
    ctx.translate(-facingDirection * (7 * (1 - prepareProgress)), -2 * prepareProgress);
    ctx.rotate(-facingDirection * (0.07 * (1 - prepareProgress)));
  } else if (playerPose === "chop") {
    const chopSwingProgress = (chopProgress - 0.28) / 0.72;
    const impactStrength = 1 - chopSwingProgress;
    ctx.translate(facingDirection * (6 * Math.sin(chopSwingProgress * Math.PI)), 3 * impactStrength);
    ctx.rotate(facingDirection * (0.08 * impactStrength));
  } else if (playerPose === "dead") {
    ctx.translate(facingDirection * 4, 12);
  }

  const lumberjackImage =
    playerPose === "dead" && assets.dead.ready && assets.dead.image
      ? assets.dead.image
      : playerPose === "chop" && assets.chop.ready && assets.chop.image
      ? assets.chop.image
      : playerPose === "prepare" && assets.prepare.ready && assets.prepare.image
        ? assets.prepare.image
        : assets.idle.ready && assets.idle.image
          ? assets.idle.image
          : null;

  if (lumberjackImage) {
    if (runtime.side === "right") ctx.scale(-1, 1);
    ctx.drawImage(lumberjackImage, LUMBERJACK_DRAW_X, LUMBERJACK_DRAW_Y, LUMBERJACK_DRAW_WIDTH, LUMBERJACK_DRAW_HEIGHT);
  } else {
    if (runtime.side === "right") ctx.scale(-1, 1);
    ctx.fillStyle = "#172033";
    ctx.fillRect(-18, 18, 36, 12);
    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.roundRect(-25, -45, 50, 58, 14);
    ctx.fill();
    ctx.fillStyle = "#f8d7b4";
    ctx.beginPath();
    ctx.arc(0, -62, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-18, -88, 36, 14);
    ctx.fillRect(-10, -102, 20, 18);

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(22, -28);
    ctx.lineTo(72, -54);
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(70, -70);
    ctx.lineTo(104, -56);
    ctx.lineTo(74, -36);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(15, 23, 42, 0.12)";
  ctx.fillRect(24, 88, CANVAS_WIDTH - 48, 14);
  ctx.fillStyle = runtime.energy > 0.28 ? "#22c55e" : "#ef4444";
  ctx.fillRect(24, 88, (CANVAS_WIDTH - 48) * runtime.energy, 14);

  if (runtime.status !== "playing") {
    ctx.fillStyle = "rgba(15, 23, 42, 0.58)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 38px Trebuchet MS, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(runtime.status === "ready" ? "Lumberjack" : "Run Complete", CANVAS_WIDTH / 2, 292);
    ctx.font = "700 16px Trebuchet MS, system-ui";
    ctx.fillText("Tap left or right to chop", CANVAS_WIDTH / 2, 328);
  }
}
