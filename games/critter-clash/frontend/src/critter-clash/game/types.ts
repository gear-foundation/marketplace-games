export type PetClass = "tank" | "damage" | "fast" | "balanced";

export type Critter = {
  id: string;
  name: string;
  class: PetClass;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  speed: number;
  spriteKey: string;
  item?: Item;
};

export type EnemyType = "normal" | "elite" | "boss";

export type Enemy = Critter & {
  enemyType: EnemyType;
};

export type ItemType = "apple" | "claw" | "boots";

export type Item = {
  id: ItemType;
  name: string;
  description: string;
};

export type Reward =
  | { type: "new_pet"; pet: Critter }
  | { type: "upgrade_pet"; petId: string }
  | { type: "item"; item: Item }
  | { type: "heal"; amount: number };

export type Biome = "forest" | "snow" | "desert" | "jungle" | "ancient";

export type Phase = "intro" | "choose_starter" | "battle" | "reward" | "summary";

export type BattleEvent = {
  id: string;
  attackerSide: "player" | "enemy";
  attackerId: string;
  targetId: string;
  damage: number;
  targetDied: boolean;
};

export type RunStats = {
  waveReached: number;
  highestWaveReached: number;
  enemiesDefeated: number;
  bossesDefeated: number;
};

export type GameState = {
  phase: Phase;
  wave: number;
  biome: Biome;
  playerTeam: Critter[];
  enemyTeam: Enemy[];
  starterOptions: Critter[];
  selectedStarterIds: Array<string | null>;
  rewardOptions: Reward[];
  battleLog: BattleEvent[];
  roundTurnOrderIds: string[];
  battleRound: number;
  battleRoundSize: number;
  roundPauseUntilMs: number | null;
  deathPauseUntilMs: number | null;
  score: number;
  isAutoBattling: boolean;
  battleTurnDelayMs: number;
  runStats: RunStats;
};
