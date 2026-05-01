import type { Level, ProgressState } from "./types";

const STORAGE_KEY = "robo-save-eny-progress";

export const DEFAULT_PROGRESS: ProgressState = {
  unlockedLevel: 1,
  completedLevels: {},
  settings: {
    sound: true,
    music: true,
  },
};

export function loadProgress(): ProgressState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as ProgressState;

    return {
      unlockedLevel: Math.max(1, Number(parsed.unlockedLevel) || 1),
      completedLevels: parsed.completedLevels && typeof parsed.completedLevels === "object" ? parsed.completedLevels : {},
      settings: {
        sound: parsed.settings?.sound ?? true,
        music: parsed.settings?.music ?? true,
      },
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveProgress(progress: ProgressState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function calculateLevelScore(level: Level, moves: number) {
  const targetMoves = Math.max(1, level.meta?.solutionSteps ?? moves);
  const efficiency = Math.max(0, targetMoves * 80 - moves * 30);
  return level.id * 10_000 + efficiency + 1_000;
}

export function recordLevelCompletion(progress: ProgressState, level: Level, moves: number) {
  const score = calculateLevelScore(level, moves);
  const key = String(level.id);
  const previous = progress.completedLevels[key];
  const bestMoves = previous ? Math.min(previous.bestMoves, moves) : moves;
  const bestScore = previous ? Math.max(previous.bestScore, score) : score;

  return {
    progress: {
      ...progress,
      unlockedLevel: Math.max(progress.unlockedLevel, level.id + 1),
      completedLevels: {
        ...progress.completedLevels,
        [key]: {
          bestMoves,
          bestScore,
        },
      },
    },
    score,
  };
}
