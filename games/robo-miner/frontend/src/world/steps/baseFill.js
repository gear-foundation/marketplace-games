import { BLOCK, WORLD_W, WORLD_H, SURFACE_Y } from '../../config.js';
import { RESOURCES_BY_RARITY, oreRollChance } from '../../config/resources.js';
import { idx } from '../grid.js';

// Per-tile ore roll. Walks resources rarest-first, so a tile inside the
// overlap of gold/silver windows gets the rarer one. Chance per resource
// is gaussian around its peak depth — concentration near peak, thin tails.
function pickOreForDepth(rnd, depth) {
  for (const r of RESOURCES_BY_RARITY) {
    const chance = oreRollChance(depth, r);
    if (chance <= 0) continue;
    if (rnd() < chance) return r.type;
  }
  return BLOCK.DIRT;
}

// Fills sky above SURFACE_Y, and rolls per-tile ore/dirt below it.
export function baseFill(grid, rnd) {
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      grid[idx(x, y)] = y < SURFACE_Y ? BLOCK.SKY : pickOreForDepth(rnd, y - SURFACE_Y);
    }
  }
}
