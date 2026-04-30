let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!audioContext) {
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    audioContext = Context ? new Context() : null;
  }

  if (audioContext?.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType, gainValue: number, sweep = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  if (sweep !== 0) {
    oscillator.frequency.linearRampToValueAtTime(Math.max(40, frequency + sweep), ctx.currentTime + duration);
  }
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, gainValue: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

export function sfxPistol() {
  playTone(420, 0.08, "square", 0.05, -180);
}

export function sfxMachineGun() {
  playTone(520, 0.05, "square", 0.035, -220);
}

export function sfxShotgun() {
  playNoise(0.12, 0.08);
  playTone(180, 0.16, "sawtooth", 0.045, -100);
}

export function sfxRocketLaunch() {
  playTone(120, 0.24, "sawtooth", 0.05, 260);
}

export function sfxExplosion() {
  playNoise(0.25, 0.1);
  playTone(80, 0.3, "triangle", 0.05, -40);
}

export function sfxAcid() {
  playTone(260, 0.18, "sawtooth", 0.03, -120);
}

export function sfxHit() {
  playTone(160, 0.08, "triangle", 0.045, -60);
}

export function sfxPickup() {
  playTone(680, 0.12, "triangle", 0.04, 180);
}

export function sfxWeaponUpgrade() {
  playTone(520, 0.08, "square", 0.03, 120);
  playTone(720, 0.14, "triangle", 0.035, 180);
}

export function sfxGameOver() {
  playTone(220, 0.35, "sawtooth", 0.05, -180);
}
