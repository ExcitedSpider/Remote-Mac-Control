import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function loadEnvPort(): string {
  const envFile = process.env.ENV_FILE || "../local.env";
  try {
    const content = readFileSync(envFile, "utf-8");
    const match = content.match(/^PORT=(\d+)/m);
    if (match) return match[1];
  } catch {}
  return "3443";
}

const backendPort = loadEnvPort();
const backendUrl = `http://localhost:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": backendUrl,
      "/login": backendUrl,
      "/logout": backendUrl,
      "/ws": {
        target: backendUrl,
        ws: true,
      },
    },
  },
});
