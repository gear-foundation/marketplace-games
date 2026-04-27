// Volumes per sound type
const VOL = {
  playerLaser:     0.35,
  enemyLaser:      0.45,
  enemyExplosion:  0.35,
  playerExplosion: 0.70,
  playerHit:       0.65,
  takeBonus:       0.60,
  gameStart:       0.50,
} as const;

type SoundKey = keyof typeof VOL;

const sources: Record<SoundKey, HTMLAudioElement> = {
  playerLaser:     new Audio("/player-laser.mp3"),
  enemyLaser:      new Audio("/enemy-laser.mp3"),
  enemyExplosion:  new Audio("/enemy-explosion.mp3"),
  playerExplosion: new Audio("/player-explosion.mp3"),
  playerHit:       new Audio("/player-hit.mp3"),
  takeBonus:       new Audio("/take-bonus.mp3"),
  gameStart:       new Audio("/game-start.mp3"),
};

// Pre-set volumes and preload hints
for (const key of Object.keys(sources) as SoundKey[]) {
  sources[key].volume = VOL[key];
  sources[key].preload = "auto";
}

// ─── Background music ─────────────────────────────────────────────────────────

const bgMusic = new Audio("/nebula-blaster.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.35;
bgMusic.preload = "auto";

const victoryMusic = new Audio("/victory.mp3");
victoryMusic.volume = 0.55;
victoryMusic.preload = "auto";

export function startBgMusic() {
  victoryMusic.pause();
  victoryMusic.currentTime = 0;
  bgMusic.currentTime = 0;
  bgMusic.play().catch(() => {});
}

export function stopBgMusic() {
  bgMusic.pause();
  bgMusic.currentTime = 0;
}

export function playVictory() {
  bgMusic.pause();
  victoryMusic.currentTime = 0;
  victoryMusic.play().catch(() => {});
}

// Player laser fires up to 5×/s so we pool 6 clones to allow overlap
const LASER_POOL_SIZE = 6;
const laserPool: HTMLAudioElement[] = Array.from({ length: LASER_POOL_SIZE }, () => {
  const a = sources.playerLaser.cloneNode() as HTMLAudioElement;
  a.volume = VOL.playerLaser;
  return a;
});
let laserPoolIdx = 0;

function play(key: SoundKey) {
  const a = sources[key].cloneNode() as HTMLAudioElement;
  a.volume = VOL[key];
  a.play().catch(() => {/* autoplay blocked — silent */});
}

export function sfxPlayerLaser() {
  const a = laserPool[laserPoolIdx % LASER_POOL_SIZE];
  laserPoolIdx++;
  a.currentTime = 0;
  a.play().catch(() => {});
}

export function sfxEnemyLaser()      { play("enemyLaser"); }
export function sfxEnemyExplosion()  { play("enemyExplosion"); }
export function sfxPlayerExplosion() { play("playerExplosion"); }
export function sfxPlayerHit()       { play("playerHit"); }
export function sfxTakeBonus()       { play("takeBonus"); }
export function sfxGameStart()       { play("gameStart"); }
