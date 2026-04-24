import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: ["lumberjack.up.railway.app", "arcade-vara.up.railway.app"],
  },
});
