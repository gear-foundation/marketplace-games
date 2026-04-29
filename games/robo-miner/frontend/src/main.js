import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import * as chain from './chain.js';
import * as wallet from './wallet.js';

// Dev convenience: drop chain + wallet APIs onto window so we can
// poke them from the browser console while testing the on-chain
// integration. Pure debug surface — UI doesn't read from window.
if (typeof window !== 'undefined') {
  window.chain = chain;
  window.wallet = wallet;
}

// Wait until the window has a non-zero size before booting Phaser.
// In iframe / popup contexts the script can run before the host has
// laid out the frame, leaving `window.innerWidth` = 0. Phaser's
// RESIZE scale mode caches that zero and the canvas stays 0×0 even
// after the frame eventually resizes — that's the "black screen on
// deploy" symptom.
function viewportReady() {
  return window.innerWidth > 0 && window.innerHeight > 0;
}

function bootGame() {
  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0a0a0a',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    // Menu boots first; on "Start Digging" it hands off to Game.
    scene: [MenuScene, GameScene],
  };
  // Expose the running game so we can poke it from the console.
  window.game = new Phaser.Game(config);
}

if (viewportReady()) {
  bootGame();
} else {
  // Try in this order: window load, DOMContentLoaded, periodic poll.
  // Whichever fires first with a sized viewport boots the game.
  let booted = false;
  const tryBoot = () => {
    if (booted || !viewportReady()) return;
    booted = true;
    bootGame();
  };
  window.addEventListener('load', tryBoot);
  window.addEventListener('DOMContentLoaded', tryBoot);
  window.addEventListener('resize', tryBoot);
  // Last-resort poll for environments that never fire load/resize when
  // they finally size the iframe (some embedded preview tools).
  const poll = setInterval(() => {
    if (booted) return clearInterval(poll);
    tryBoot();
  }, 50);
}
