const SPRITE_BASE_PATH = "/critter-sprites";

const AVAILABLE_SPRITES = new Set([
  "capybara",
  "shiba",
  "frog",
  "raccoon",
  "penguin",
  "cat",
  "duck",
  "corgi",
  "owl",
  "axolotl",
  "seal",
  "red-panda",
  "otter",
  "hamster",
  "sloth",
  "alpaca",
  "pigeon",
  "goat",
]);

export function resolveSpriteKey(spriteKey: string): string {
  if (AVAILABLE_SPRITES.has(spriteKey)) {
    return spriteKey;
  }
  return "capybara";
}

export function getSpriteUrl(spriteKey: string): string {
  return `${SPRITE_BASE_PATH}/${resolveSpriteKey(spriteKey)}.webp`;
}
