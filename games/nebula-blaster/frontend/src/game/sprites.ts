const PATHS = {
  playerShip:  "/player-ship.webp",
  asteroid:    "/asteroid.webp",
  chunk:       "/chunk.webp",
  drone:       "/enemy-drone.webp",
  splitter:    "/splitter.webp",
  bonusFire:   "/bonus-fire.webp",
  health:      "/health.webp",
  shield:      "/shield.webp",
} as const;

type SpriteKey = keyof typeof PATHS;

const images: Partial<Record<SpriteKey, HTMLImageElement>> = {};

function load(key: SpriteKey) {
  const img = new Image();
  img.src = PATHS[key];
  images[key] = img;
}

for (const key of Object.keys(PATHS) as SpriteKey[]) {
  load(key);
}

export function getSprite(key: SpriteKey): HTMLImageElement | undefined {
  return images[key];
}

/** Draw a sprite centred at (x, y) with given width and height. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  key: SpriteKey,
  x: number,
  y: number,
  w: number,
  h: number,
  angle = 0,
) {
  const img = images[key];
  if (!img || !img.complete || img.naturalWidth === 0) return false;
  ctx.save();
  ctx.translate(x, y);
  if (angle !== 0) ctx.rotate(angle);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}
