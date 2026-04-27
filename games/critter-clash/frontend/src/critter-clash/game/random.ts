export function createSeededRandom(seed = Date.now()): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function randomPick<T>(list: T[], random: () => number): T {
  return list[Math.floor(random() * list.length)];
}
