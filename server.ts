import "node:process";
import { loadEnvFile } from "node:process";
try { loadEnvFile(process.env.ENV_FILE || ".env"); } catch {}

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { cloudflareAccess } from "./src/middleware/cloudflareAccess.js";
import { appPassword } from "./src/middleware/appPassword.js";
import remoteRoutes from "./src/routes/remote.js";
import containerRoutes from "./src/routes/containers.js";
import { log } from "./src/logger.js";
import { setupMetricsWebSocket } from "./src/ws/metricsSocket.js";

process.on("uncaughtException", (err: Error) => {
  log.error(`Uncaught exception: ${err.stack || err.message}`);
  process.exit(1);
});
process.on("unhandledRejection", (err: unknown) => {
  const message = err instanceof Error ? err.stack || err.message : String(err);
  log.error(`Unhandled rejection: ${message}`);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set("trust proxy", true);

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Attach real client IP from Cloudflare headers
app.use((req, _res, next) => {
  req.clientIp = (req.headers["cf-connecting-ip"] as string) || req.ip || "";
  next();
});

// Static UI (served before auth so assets are always accessible)
app.use(express.static(path.join(__dirname, "public")));

// App password (guards API + login/logout)
app.use(appPassword());

// Cloudflare Access auth on all /api routes
app.use("/api", cloudflareAccess());

// API routes
app.use("/api", remoteRoutes);
app.use("/api", containerRoutes);

// --- Start server ---
const PORT = parseInt(process.env.PORT || "3443", 10);
const USE_HTTPS = process.env.USE_HTTPS !== "false";

if (USE_HTTPS) {
  const certDir = path.join(__dirname, "certs");
  const keyPath = path.join(certDir, "key.pem");
  const certPath = path.join(certDir, "cert.pem");

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    log.error(
      "TLS certs not found. Generate them first:\n" +
        "  npm run generate-certs\n" +
        "Or set USE_HTTPS=false to run plain HTTP (e.g. behind cloudflared)."
    );
    process.exit(1);
  }

  const server = https.createServer(
    {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    },
    app
  );
  setupMetricsWebSocket(server);

  server.listen(PORT, () => {
    log.info(`HTTPS server running on https://localhost:${PORT}`);
  });
} else {
  const server = http.createServer(app);
  setupMetricsWebSocket(server);
  server.listen(PORT, () => {
    log.info(`HTTP server running on http://localhost:${PORT}`);
  });
}
