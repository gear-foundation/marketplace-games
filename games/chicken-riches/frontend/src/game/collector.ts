import type { CollectorFillState } from "./types";

export const MAX_COLLECTOR_VISUAL_EGGS = 9;

export function getCollectorFillState(visualEggs: number): CollectorFillState {
  if (visualEggs <= 0) {
    return "collector_empty";
  }

  if (visualEggs <= 2) {
    return "collector_low";
  }

  if (visualEggs <= 5) {
    return "collector_medium";
  }

  if (visualEggs <= 8) {
    return "collector_high";
  }

  return "collector_full";
}
