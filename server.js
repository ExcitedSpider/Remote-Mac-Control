import "node:process";
import { loadEnvFile } from "node:process";
try { loadEnvFile(); } catch {}

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { cloudflareAccess } from "./src/middleware/cloudflareAccess.js";
import remoteRoutes from "./src/routes/remote.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Cloudflare Access auth on all /api routes
app.use("/api", cloudflareAccess());

// API routes
app.use("/api", remoteRoutes);

// Static UI
app.use(express.static(path.join(__dirname, "public")));

// --- Start server ---
const PORT = parseInt(process.env.PORT || "3443", 10);
const USE_HTTPS = process.env.USE_HTTPS !== "false";

if (USE_HTTPS) {
  const certDir = path.join(__dirname, "certs");
  const keyPath = path.join(certDir, "key.pem");
  const certPath = path.join(certDir, "cert.pem");

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error(
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

  server.listen(PORT, () => {
    console.log(`HTTPS server running on https://localhost:${PORT}`);
  });
} else {
  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`HTTP server running on http://localhost:${PORT}`);
  });
}
