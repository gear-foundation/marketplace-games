import { BLOCK, WORLD_W, WORLD_H, SURFACE_Y } from '../../config.js';
import { idx } from '../grid.js';
import { carvePocket } from './caves.js';

// Places the unique DIAMOND near the bottom, with a small cave pocket
// nearby so the radar has a reachable target on the final approach.
export function placeDiamond(grid, rnd) {
  const WALL = 1;
  const dx = WALL + 1 + Math.floor(rnd() * (WORLD_W - WALL * 2 - 2));
  const dy = SURFACE_Y + 225 + Math.floor(rnd() * 18);
  const safeY = Math.min(dy, WORLD_H - 3);
  carvePocket(
    grid,
    rnd,
    Math.max(4, Math.min(WORLD_W - 5, dx + (rnd() < 0.5 ? -4 : 4))),
    safeY,
    5,
    3,
  );
  grid[idx(dx, safeY)] = BLOCK.DIAMOND;
  return { x: dx, y: safeY };
}
