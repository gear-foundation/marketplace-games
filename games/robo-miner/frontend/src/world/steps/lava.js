// Lava pools at the deepest layers. Visually red wavy bands (drawn in
// GameScene); mechanically unbreakable + damaging to the player on contact.
//
// We place a handful of pool centers in the bottom band and stamp wide,
// shallow puddles (more horizontal than vertical) so they read as pools,
// not columns. Lava only replaces DIRT/ore — never SKY (so it doesn't
// plug existing caves) and never STONE (so the stone silhouette stays
// intact).

import { BLOCK, WORLD_W, WORLD_H, SURFACE_Y } from '../../config.js';
import { idx } from '../grid.js';

const LAVA_START_DEPTH = 200;

function tryPlaceLava(grid, x, y) {
  if (x < 1 || x >= WORLD_W - 1 || y <= SURFACE_Y || y >= WORLD_H - 1) return;
  const t = grid[idx(x, y)];
  if (t === BLOCK.SKY || t === BLOCK.STONE || t === BLOCK.DIAMOND) return;
  grid[idx(x, y)] = BLOCK.LAVA;
}

function stampPuddle(grid, rnd, cx, cy, rx, ry) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (rnd() < 0.85) tryPlaceLava(grid, x, y);
    }
  }
}

export function placeLava(grid, rnd) {
  const poolCount = 5;
  for (let i = 0; i < poolCount; i++) {
    const depth = LAVA_START_DEPTH + Math.floor(rnd() * (WORLD_H - SURFACE_Y - LAVA_START_DEPTH - 4));
    const cy = SURFACE_Y + depth;
    const cx = 6 + Math.floor(rnd() * (WORLD_W - 12));
    const rx = 4 + Math.floor(rnd() * 5);
    const ry = 1 + Math.floor(rnd() * 2);
    stampPuddle(grid, rnd, cx, cy, rx, ry);
  }
}
