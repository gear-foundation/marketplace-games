export const BABY_FISH_BITE_FRAME_SOURCES = [
  "/fish/baby_fish_eat_01_deep_sharp.webp",
  "/fish/baby_fish_eat_02_deep_sharp.webp",
  "/fish/baby_fish_eat_03_deep_sharp.webp",
  "/fish/baby_fish_eat_04_deep_sharp.webp",
  "/fish/baby_fish_eat_05_deep_sharp.webp",
];

export const LEVEL2_FISH_BITE_FRAME_SOURCES = [
  "/fish/level2_fish_eat_01.webp",
  "/fish/level2_fish_eat_02.webp",
  "/fish/level2_fish_eat_03.webp",
  "/fish/level2_fish_eat_04.webp",
  "/fish/level2_fish_eat_05.webp",
];

export const LEVEL2_FISH_HURT_FRAME_SOURCES = [
  "/fish/level2_fish_hurt_01.webp",
  "/fish/level2_fish_hurt_02.webp",
  "/fish/level2_fish_hurt_03.webp",
  "/fish/level2_fish_hurt_04.webp",
  "/fish/level2_fish_hurt_05.webp",
];

export const LEVEL3_FISH_BITE_FRAME_SOURCES = [
  "/fish/level3_fish_eat_01.webp",
  "/fish/level3_fish_eat_02.webp",
  "/fish/level3_fish_eat_03.webp",
  "/fish/level3_fish_eat_04.webp",
  "/fish/level3_fish_eat_05.webp",
];

export const LEVEL3_FISH_HURT_FRAME_SOURCES = [
  "/fish/level3_fish_hurt_01.webp",
  "/fish/level3_fish_hurt_02.webp",
  "/fish/level3_fish_hurt_03.webp",
  "/fish/level3_fish_hurt_04.webp",
  "/fish/level3_fish_hurt_05.webp",
];

export const LEVEL4_FISH_BITE_FRAME_SOURCES = [
  "/fish/level4_fish_eat_01.webp",
  "/fish/level4_fish_eat_02.webp",
  "/fish/level4_fish_eat_03.webp",
  "/fish/level4_fish_eat_04.webp",
  "/fish/level4_fish_eat_05.webp",
];

export const LEVEL4_FISH_HURT_FRAME_SOURCES = [
  "/fish/level4_fish_hurt_01.webp",
  "/fish/level4_fish_hurt_02.webp",
  "/fish/level4_fish_hurt_03.webp",
  "/fish/level4_fish_hurt_04.webp",
  "/fish/level4_fish_hurt_05.webp",
];

export const LEVEL5_FISH_BITE_FRAME_SOURCES = [
  "/fish/level5_fish_eat_01.webp",
  "/fish/level5_fish_eat_02.webp",
  "/fish/level5_fish_eat_03.webp",
  "/fish/level5_fish_eat_04.webp",
  "/fish/level5_fish_eat_05.webp",
];

export const LEVEL5_FISH_HURT_FRAME_SOURCES = [
  "/fish/level5_fish_hurt_01.webp",
  "/fish/level5_fish_hurt_02.webp",
  "/fish/level5_fish_hurt_03.webp",
  "/fish/level5_fish_hurt_04.webp",
  "/fish/level5_fish_hurt_05.webp",
];

export const LEVEL6_FISH_BITE_FRAME_SOURCES = [
  "/fish/level6_fish_eat_01.webp",
  "/fish/level6_fish_eat_02.webp",
  "/fish/level6_fish_eat_03.webp",
  "/fish/level6_fish_eat_04.webp",
  "/fish/level6_fish_eat_05.webp",
];

export const LEVEL6_FISH_HURT_FRAME_SOURCES = [
  "/fish/level6_fish_hurt_01.webp",
  "/fish/level6_fish_hurt_02.webp",
  "/fish/level6_fish_hurt_03.webp",
  "/fish/level6_fish_hurt_04.webp",
  "/fish/level6_fish_hurt_05.webp",
];

export const LEVEL7_FISH_BITE_FRAME_SOURCES = [
  "/fish/level7_fish_eat_01.webp",
  "/fish/level7_fish_eat_02.webp",
  "/fish/level7_fish_eat_03.webp",
  "/fish/level7_fish_eat_04.webp",
  "/fish/level7_fish_eat_05.webp",
];

export const LEVEL7_FISH_HURT_FRAME_SOURCES = [
  "/fish/level7_fish_hurt_01.webp",
  "/fish/level7_fish_hurt_02.webp",
  "/fish/level7_fish_hurt_03.webp",
  "/fish/level7_fish_hurt_04.webp",
  "/fish/level7_fish_hurt_05.webp",
];

export const LEVEL8_FISH_BITE_FRAME_SOURCES = [
  "/fish/level8_fish_eat_01.webp",
  "/fish/level8_fish_eat_02.webp",
  "/fish/level8_fish_eat_03.webp",
  "/fish/level8_fish_eat_04.webp",
  "/fish/level8_fish_eat_05.webp",
];

export const BABY_FISH_REACTION_FRAME_SOURCES = [
  "/fish/baby_fish_reaction_01.webp",
  "/fish/baby_fish_reaction_02.webp",
  "/fish/baby_fish_reaction_03.webp",
];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
    image.src = src;
  });
}

export function loadBabyFishBiteFrames() {
  return Promise.all(BABY_FISH_BITE_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel2FishBiteFrames() {
  return Promise.all(LEVEL2_FISH_BITE_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel2FishHurtFrames() {
  return Promise.all(LEVEL2_FISH_HURT_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel3FishBiteFrames() {
  return Promise.all(LEVEL3_FISH_BITE_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel3FishHurtFrames() {
  return Promise.all(LEVEL3_FISH_HURT_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel4FishBiteFrames() {
  return Promise.all(LEVEL4_FISH_BITE_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel4FishHurtFrames() {
  return Promise.all(LEVEL4_FISH_HURT_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel5FishBiteFrames() {
  return Promise.all(LEVEL5_FISH_BITE_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel5FishHurtFrames() {
  return Promise.all(LEVEL5_FISH_HURT_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel6FishBiteFrames() {
  return Promise.all(LEVEL6_FISH_BITE_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel6FishHurtFrames() {
  return Promise.all(LEVEL6_FISH_HURT_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel7FishBiteFrames() {
  return Promise.all(LEVEL7_FISH_BITE_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel7FishHurtFrames() {
  return Promise.all(LEVEL7_FISH_HURT_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadLevel8FishBiteFrames() {
  return Promise.all(LEVEL8_FISH_BITE_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadBabyFishReactionFrames() {
  return Promise.all(BABY_FISH_REACTION_FRAME_SOURCES.map((src) => loadImage(src)));
}

export function loadBackgroundImage() {
  return loadImage("/background.webp");
}

export function loadPlanktonImage() {
  return loadImage("/plankton_cutout_sharp.webp");
}

export function loadBabyFishImage() {
  return loadImage("/baby_fish_enemy_sharp.webp");
}
