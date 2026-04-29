import { defineConfig } from 'vite';

const allowedHosts = [
  'robo-miner-production.up.railway.app',
  ...(process.env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
];

export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    allowedHosts,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
  },
  json: {
    stringify: true,
  },
});
