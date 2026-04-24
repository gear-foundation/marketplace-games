import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const allowedHosts = [
  "lumberjack.up.railway.app",
  "lamberjack-vara.up.railway.app",
  "arcade-vara.up.railway.app",
  ...(process.env.VITE_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
];

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts,
  },
});
