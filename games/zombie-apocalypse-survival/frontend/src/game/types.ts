export type GameStatus = "menu" | "playing" | "paused" | "game_over";
export type WeaponType = "pistol" | "machine_gun" | "shotgun" | "bazooka";

export type GameEndPayload = {
  score: number;
  durationMs: number;
  survivalSeconds: number;
  kills: number;
  weapon: WeaponType;
  reason: "death";
};

export type HudData = {
  status: GameStatus;
  health: number;
  maxHealth: number;
  weapon: WeaponType;
  kills: number;
  score: number;
  time: number;
  shieldTime: number;
  speedTime: number;
  stunTime: number;
  shotgunCharge: number;
  shotgunCharged: boolean;
  banner: string;
  bannerTimer: number;
  result: GameEndPayload | null;
};
