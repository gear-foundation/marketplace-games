export const FIELD_WIDTH = 980;
export const FIELD_HEIGHT = 620;
export const MIN_FISH_SIZE = 1;
export const MAX_FISH_SIZE = 8;
export const FISH_VISUAL_SIZES: Record<number, { width: number; height: number }> = {
  1: { width: 50, height: 35 },
  2: { width: 70, height: 48 },
  3: { width: 95, height: 65 },
  4: { width: 125, height: 85 },
  5: { width: 160, height: 110 },
  6: { width: 210, height: 140 },
  7: { width: 270, height: 170 },
  8: { width: 340, height: 210 },
};
export const PLAYER_START_SIZE = 1;
export const PLAYER_START_SATURATION = 50;
export type GameStartPreset = "default" | "test-size-5"| "test-size-6" | "test-size-7";

// Switch this preset while balancing or checking late-game mechanics locally.
export const GAME_START_PRESET: GameStartPreset = "default";

function resolveGameStartConfig(preset: GameStartPreset) {
  switch (preset) {
    case "test-size-5":
      return {
        preset,
        size: 5,
        saturation: 50,
        growthProgress: 0,
      };
    case "test-size-6":
      return {
        preset,
        size: 6,
        saturation: 50,
        growthProgress: 0,
      };
    case "test-size-7":
      return {
        preset,
        size: 7,
        saturation: 50,
        growthProgress: 0,
      };
    default:
      return {
        preset,
        size: PLAYER_START_SIZE,
        saturation: PLAYER_START_SATURATION,
        growthProgress: 0,
      };
  }
}

export const GAME_START_CONFIG = resolveGameStartConfig(GAME_START_PRESET);

export const IS_TEST_START_MODE = ((preset: GameStartPreset) => preset !== "default")(GAME_START_PRESET);
export const PLAYER_GROWTH_THRESHOLD = 100;
export const PLAYER_SATURATION_AFTER_GROWTH = 50;
export const PLAYER_GROWTH_PULSE_MS = 1500;
export const PLAYER_GROWTH_PULSE_SCALE = 0.5;
export const PLAYER_GROWTH_PULSE_SWAP_AT = 0.8;
export const GROWTH_REQUIREMENT_BY_SIZE: Record<number, number> = {
  1: 90,
  2: 135,
  3: 195,
  4: 275,
  5: 460,
  6: 650,
  7: 880,
  8: 1100,
};
export const ENEMY_SPEED_BY_SIZE: Record<number, number> = {
  1: 135,
  2: 120,
  3: 108,
  4: 96,
  5: 84,
  6: 72,
  7: 62,
  8: 54,
};
export const PLAYER_SPEED = 280;
export const PLAYER_SPEED_BY_SIZE: Record<number, number> = {
  1: 285,
  2: 255,
  3: 230,
  4: 205,
  5: 175,
  6: 145,
  7: 120,
  8: 100,
};
export const PLAYER_KEYBOARD_ACCELERATION = 1;
export const PLAYER_BITE_FRAME_DURATION_MS = 72;
export const PLAYER_BITE_ANIMATION_MS = 360;
export const PLAYER_HURT_FRAME_DURATION_MS = 90;
export const PLAYER_VISUAL_SATURATION_CHANGE_PER_SECOND = 18;
export const BABY_FISH_REACTION_FRAME_DURATION_MS = 130;
export const BABY_FISH_REACTION_ANIMATION_MS = 390;
export const GAME_OVER_OVERLAY_DELAY_MS = 900;
export const PLANKTON_POINTS = 8;
export const PLANKTON_SPAWN_INTERVAL_MS = 520;
export const PLANKTON_MAX_COUNT = 22;
export const SATURATION_DRAIN_PER_SECOND = 2.25;
export const SATURATION_DRAIN_MULTIPLIER_BY_SIZE: Record<number, number> = {
  1: 1,
  2: 1.2,
  3: 1.3,
  4: 1.4,
  5: 1.4,
  6: 1.45,
  7: 1.5,
  8: 1.55 ,
};
export const SPAWN_INTERVAL_MS_START = 960;
export const SPAWN_INTERVAL_MS_MIN = 360;
export const SPAWN_INTERVAL_DECAY = 0.0055;
export const HIGH_LEVEL_ENEMY_SPAWN_INTERVAL_MULTIPLIER = 1.25;
export const MAX_LEVEL_8_ENEMIES = 2;
export const ENEMY_PADDING = 70;
export const PLAYER_PADDING = 36;
export const MAX_FRAME_DELTA_MS = 48;
export const TARGET_FRAME_INTERVAL_MS = 1000 / 30;
export const CANVAS_PIXEL_RATIO_CAP = 1.5;
export const HOOK_UNLOCK_TIME_MS = 45000;
export const HOOK_UNLOCK_SIZE = 5;
export const HOOK_INITIAL_COOLDOWN_MS = 3200;
export const HOOK_COOLDOWN_MS_MIN = 14000;
export const HOOK_COOLDOWN_MS_MAX = 24000;
export const HOOK_WARNING_MS = 1500;
export const HOOK_DROP_MS = 1450;
export const HOOK_HOLD_MS = 1700;
export const HOOK_RISE_MS = 1250;
export const HOOK_MARGIN_X = 90;
export const HOOK_START_Y = -92;
export const HOOK_TARGET_Y_MIN = FIELD_HEIGHT * 0.42;
export const HOOK_TARGET_Y_MAX = FIELD_HEIGHT * 0.58;
export const HOOK_SWING_AMPLITUDE = 18;
export const HOOK_SWING_SPEED = 0.006;
export const HOOK_METAL_WIDTH = 64;
export const HOOK_METAL_HEIGHT = 110;
