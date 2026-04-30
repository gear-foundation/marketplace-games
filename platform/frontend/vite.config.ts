import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = (
    env.VITE_BACKEND_URL || "https://arcade-vara-production.up.railway.app"
  ).replace(/\/+$/, "");
  const allowedHosts = [
    "vara-games.up.railway.app",
    ...((env.VITE_ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean)),
  ];

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    preview: {
      allowedHosts,
    },
  };
});
