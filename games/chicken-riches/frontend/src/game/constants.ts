export const GAME_TITLE = "Chicken Riches";

export const FIELD_WIDTH = 980;
export const FIELD_HEIGHT = 620;
export const FLOOR_Y = 530;
export const ROOST_Y = 176;
export const CHICKEN_Y = 120;

export const MAX_CHICKENS = 5;
export const CHICKEN_POSITIONS = [132, 304, 490, 676, 848];
export const CHICKEN_WIDTH = 82;
export const CHICKEN_HEIGHT = 58;
export const CHICKEN_SIZE = 44;
export const CHICKEN_IDLE_CYCLE_MS = 1_500;
export const CHICKEN_LAY_DURATION_MS = 620;
export const CHICKEN_LAY_TELL_MS = 180;
export const CHICKEN_LAY_EVENT_MS = 360;
export const CHICKEN_SCARED_START_DURATION_MS = 280;
export const CHICKEN_RELIEVED_DURATION_MS = 420;
export const CHICKEN_STOLEN_DURATION_MS = 680;

export const MAX_BASKET_EGGS = 10;
export const MAX_BROKEN_EGGS = 15;

export const FARMER_WIDTH = 86;
export const FARMER_HEIGHT = 112;
export const FARMER_GROUND_Y = FLOOR_Y - FARMER_HEIGHT / 2 + 30;
export const FARMER_SPEED = 368;
export const FARMER_JUMP_SPEED = 560;
export const FARMER_GRAVITY = 1_480;
export const FARMER_FEET_RADIUS = 24;
export const FARMER_CATCH_DURATION_MS = 220;
export const FARMER_DEPOSIT_DURATION_MS = 300;
export const DEPOSIT_EGG_DROP_DURATION_MS = 260;
export const FARMER_THROW_DURATION_MS = 280;
export const FARMER_SLIP_DURATION_MS = 360;
export const FARMER_RECOVER_DURATION_MS = 360;

export const COLLECTOR_WIDTH = 176;
export const COLLECTOR_HEIGHT = 96;
export const COLLECTOR_Y = FLOOR_Y + 70;
export const COLLECTOR_INTERACT_DISTANCE = 58;
export const COLLECTOR_RECEIVE_DURATION_MS = 280;

export const EGG_RADIUS = 10;
export const THROWN_EGG_RADIUS = 9;
export const THROWN_EGG_SPEED = 560;
export const THROWN_EGG_LAUNCH_DURATION_MS = 140;
export const THROWN_EGG_HIT_EFFECT_DURATION_MS = 280;
export const THROWN_EGG_MISS_EXIT_Y = 96;
export const EGG_CATCH_WIDTH = 98;
export const EGG_CATCH_HEIGHT = 40;
export const EGG_CATCH_OFFSET_X = 0;
export const EGG_CATCH_OFFSET_Y = -136;

export const PUDDLE_LIFETIME_MS = 5_000;
export const PUDDLE_RADIUS = CHICKEN_SIZE;
export const FARMER_FALL_DURATION_MS = 1_000;

export const FOX_WIDTH = 160;
export const FOX_HEIGHT = 170;
export const FOX_OFFSET_Y = 84;
export const FOX_ATTACK_DELAY_MS = 5_000;
export const FOX_APPEAR_DURATION_MS = 420;
export const FOX_LICK_DURATION_MS = 650;
export const FOX_STEAL_DURATION_MS = 420;
export const FOX_CARRY_UP_DURATION_MS = 620;
export const FOX_HIT_DURATION_MS = 280;
export const FOX_RETREAT_DURATION_MS = 420;
export const MIN_EGGS_BETWEEN_FOXES = 20;
export const THROW_ALIGNMENT_X = 78;

export const EGG_POINTS = 10;
export const COMBO_EGG_POINTS = 20;
export const FOX_REPEL_POINTS = 100;
export const CHICKEN_LOST_PENALTY = 200;
export const COMBO_WINDOW_MS = 1_500;

export const INITIAL_EGG_SPAWN_INTERVAL_MS = 1_800;
export const MIN_EGG_SPAWN_INTERVAL_MS = 500;
export const INITIAL_EGG_FALL_SPEED = 180;
export const MAX_EGG_FALL_SPEED = 420;
export const DIFFICULTY_INCREASE_EVERY_MS = 15_000;
export const EARLY_SEQUENCE_WINDOW_MS = 16_000;

export const HUD_UPDATE_INTERVAL_MS = 120;
export const TARGET_FRAME_INTERVAL_MS = 1000 / 60;
export const MAX_FRAME_DELTA_MS = 42;
export const CANVAS_PIXEL_RATIO_CAP = 2;
