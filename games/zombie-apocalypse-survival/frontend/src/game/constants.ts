import type { WeaponType } from "./types";

export const CANVAS_W = 1280;
export const CANVAS_H = 720;

export const WEAPON_LABELS: Record<WeaponType, string> = {
  pistol: "Pistol",
  machine_gun: "Machine Gun",
  shotgun: "Shotgun",
  bazooka: "Bazooka",
};
