const BEST_SCORE_KEY = "vara-arcade-2048-best-score";

export function loadBestScore(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    if (!raw) {
      return 0;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(Math.max(0, Math.floor(score))));
  } catch {
    // Ignore storage errors so the game stays playable in private mode.
  }
}
