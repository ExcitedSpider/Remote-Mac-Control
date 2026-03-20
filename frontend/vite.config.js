import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
      "/api": "http://localhost:3001",
      "/login": "http://localhost:3001",
      "/logout": "http://localhost:3001",
      "/ws": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});
