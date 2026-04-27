import { CANVAS_W, type GameState, spawnEnemy } from "./entities";

function randRot() {
  return (0.3 + Math.random() * 1.8) * (Math.random() < 0.5 ? 1 : -1);
}

function spawnInterval(tSeconds: number): number {
  return Math.max(1.5 - 0.15 * tSeconds, 0.3);
}

function wave(tSeconds: number): { asteroid: number; drone: number; splitter: number } {
  if (tSeconds < 10) return { asteroid: 1, drone: 0, splitter: 0 };
  if (tSeconds < 30) return { asteroid: 0.65, drone: 0.35, splitter: 0 };
  return { asteroid: 0.45, drone: 0.30, splitter: 0.25 };
}

function pick<T>(weights: { value: T; weight: number }[]): T {
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let roll = Math.random() * total;
  for (const w of weights) {
    roll -= w.weight;
    if (roll <= 0) return w.value;
  }
  return weights[weights.length - 1].value;
}

export function tickSpawner(state: GameState, dt: number) {
  if (state.status !== "playing") return;

  state.spawnAccum += dt;
  const aliveCount = state.enemies.filter(e => e.alive).length;
  const crowdFactor = 1 + aliveCount * 0.05; // +5% per alive enemy, so 10 enemies → 1.5×, 20 → 2×
  const interval = spawnInterval(state.time) * crowdFactor;
  if (state.spawnAccum < interval) return;
  state.spawnAccum -= interval;

  const w = wave(state.time);
  const type = pick([
    { value: "asteroid" as const, weight: w.asteroid },
    { value: "drone" as const, weight: w.drone },
    { value: "splitter" as const, weight: w.splitter },
  ]);

  const margin = 30;
  const x = margin + Math.random() * (CANVAS_W - margin * 2);
  const baseSpeed = 80 + state.time * 1.2;

  switch (type) {
    case "asteroid":
      spawnEnemy(state, "asteroid", x, -20, (Math.random() - 0.5) * 40, baseSpeed, 1, randRot());
      break;
    case "drone":
      spawnEnemy(state, "drone", x, -20, (Math.random() - 0.5) * 30, baseSpeed * 0.7, 2);
      break;
    case "splitter":
      spawnEnemy(state, "splitter", x, -20, (Math.random() - 0.5) * 30, baseSpeed * 0.85, 2);
      break;
  }
}
