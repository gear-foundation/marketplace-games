// World generation pipeline.
//
// Order matters. Each step gets the shared grid (Uint8Array) plus the seeded
// RNG, and returns any artifacts later steps need (pocket list, diamond
// position, chest list, etc). Stub steps (pois/chests/clues/signals) are
// already wired so adding content later is a one-file change.
//
// Stages roughly follow the design doc section 14:
//   1. base fill        → raw per-tile ore rolls + sky above surface
//   2. barriers         → unbreakable STONE clusters
//   3. caves            → elliptical pockets + passages (returns pocket list)
//   4. veins            → clustered ore walkers, biased toward pockets
//   5. diamond          → single end-game target near the bottom
//   6. POIs             → stub (vaults, miner rooms, ...)
//   7. chests           → stub (entity list, not grid blocks)
//   8. clues            → stub (predecessor hints)
//   9. signals          → stub (precomputed radar data)
//  10. frame            → seal world with unbreakable border
//  11. validate         → reachability / budget checks

import { WORLD_W, WORLD_H } from '../config.js';
import { makeRng } from './rng.js';
import { baseFill } from './steps/baseFill.js';
import { placeBarriers, carveFaultLine } from './steps/barriers.js';
import { carveCaves } from './steps/caves.js';
import { placeOreVeins } from './steps/veins.js';
import { sealSomeVeins } from './steps/sealVeins.js';
import { placeDiamond } from './steps/diamond.js';
import { placePOIs } from './steps/pois.js';
import { placeChests } from './steps/chests.js';
import { placeClues } from './steps/clues.js';
import { placeSignals } from './steps/signals.js';
import { placeLava } from './steps/lava.js';
import { placeWater } from './steps/water.js';
import { frameWorld } from './steps/frame.js';
import { validate } from './steps/validate.js';

export function generateWorld(seed = Date.now()) {
  const rnd = makeRng(seed);
  const grid = new Uint8Array(WORLD_W * WORLD_H);

  baseFill(grid, rnd);
  placeBarriers(grid, rnd);
  const pockets = carveCaves(grid, rnd);
  placeOreVeins(grid, rnd, pockets);
  sealSomeVeins(grid, rnd);
  const diamondPos = placeDiamond(grid, rnd);
  // Re-carve a fault toward the diamond so the sealing pass can't strand it.
  carveFaultLine(grid, rnd, diamondPos.x);

  const ctx = { pockets, diamondPos };
  const { chests, chestsAt } = placeChests(grid, rnd, { ...ctx });
  // POIs come AFTER chests so vault contents (premium chests inside a
  // stone shell) can register into the chestsAt map directly.
  const pois = placePOIs(grid, rnd, { ...ctx, chests, chestsAt });
  placeClues(grid, rnd, { ...ctx, pois, chests });
  const signals = placeSignals(grid, rnd, { ...ctx, pois, chests });

  placeLava(grid, rnd);
  placeWater(grid, rnd, pockets);

  frameWorld(grid);

  const world = { grid, seed, diamondPos, pockets, pois, chests, chestsAt, signals };
  world.validation = validate(world, ctx);
  if (!world.validation.ok) {
    // For MVP-0 we only log. Next step: regenerate with a new seed.
    // eslint-disable-next-line no-console
    console.warn('[world] validation warnings:', world.validation.warnings);
  }
  return world;
}
