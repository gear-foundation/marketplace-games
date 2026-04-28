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

new Phaser.Game(config);
