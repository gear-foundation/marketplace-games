import { BLOCK, WORLD_W, WORLD_H, SURFACE_Y } from '../../config.js';
import { idx } from '../grid.js';

// Seals the world in an unbreakable STONE border so the robot can't walk out.
export function frameWorld(grid) {
  const WALL = 1;
  for (let y = SURFACE_Y; y < WORLD_H; y++) {
    for (let w = 0; w < WALL; w++) {
      grid[idx(w, y)] = BLOCK.STONE;
      grid[idx(WORLD_W - 1 - w, y)] = BLOCK.STONE;
    }
  }
  for (let x = 0; x < WORLD_W; x++) {
    for (let w = 0; w < WALL; w++) grid[idx(x, WORLD_H - 1 - w)] = BLOCK.STONE;
  }
}
