import { BLOCK, BLOCK_DATA, WORLD_W, WORLD_H } from '../config.js';

export function idx(x, y) {
  return y * WORLD_W + x;
}

export function inBounds(x, y) {
  return x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H;
}

export function getBlock(world, x, y) {
  if (!inBounds(x, y)) return BLOCK.STONE;
  return world.grid[idx(x, y)];
}

export function setBlock(world, x, y, type) {
  if (!inBounds(x, y)) return;
  world.grid[idx(x, y)] = type;
}

export function isSolid(type) {
  return BLOCK_DATA[type]?.solid === true;
}

export function isClimbable(type) {
  return BLOCK_DATA[type]?.climbable === true;
}
