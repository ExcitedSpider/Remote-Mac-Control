import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { log } from "../logger.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

const METRICS_BASE = process.env.CLOUDFLARED_METRICS_URL || "http://localhost:20241";

export interface IngressRoute {
  hostname: string | null;
  service: string;
  port: number | null;
  portOpen: boolean | null;
}

export interface TunnelHealth {
  processRunning: boolean;
  ready: {
    reachable: boolean;
    readyConnections: number;
    connectorId: string | null;
  };
  metrics: {
    reachable: boolean;
    version: string | null;
    uptimeSeconds: number | null;
    haConnections: number | null;
    totalRequests: number | null;
    requestErrors: number | null;
    activeEdgeLocations: string[];
  };
  ingress: IngressRoute[];
  overallStatus: "healthy" | "degraded" | "down" | "unknown";
  timestamp: number;
}

// --- Cache ---
let cached: TunnelHealth | null = null;
let cacheTime = 0;
const CACHE_TTL = 5000;

// --- Process check ---

async function isProcessRunning(): Promise<boolean> {
  try {
    await execFileAsync("/usr/bin/pgrep", ["-x", "cloudflared"], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// --- HTTP helper ---

function httpGet(url: string, timeout = 3000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Request timeout"));
    });
  });
}

// --- Ready check ---

async function checkReady(): Promise<TunnelHealth["ready"]> {
  try {
    const { status, body } = await httpGet(`${METRICS_BASE}/ready`);
    if (status === 200) {
      const json = JSON.parse(body);
      return {
        reachable: true,
        readyConnections: json.readyConnections ?? 0,
        connectorId: json.connectorId ?? null,
      };
    }
    return { reachable: true, readyConnections: 0, connectorId: null };
  } catch {
    return { reachable: false, readyConnections: 0, connectorId: null };
  }
}

// --- Metrics parsing ---

function extractMetric(text: string, name: string): number | null {
  const match = text.match(new RegExp(`^${name}\\s+(\\S+)`, "m"));
  return match ? parseFloat(match[1]) : null;
}

function extractVersion(text: string): string | null {
  const match = text.match(/^build_info\{[^}]*version="([^"]+)"/m);
  return match ? match[1] : null;
}

function extractEdgeLocations(text: string): string[] {
  const locations: string[] = [];
  const regex = /^cloudflared_tunnel_server_locations\{[^}]*location="([^"]+)"[^}]*\}\s+1/gm;
  let match;
  while ((match = regex.exec(text)) !== null) {
    locations.push(match[1]);
  }
  return locations;
}

async function checkMetrics(): Promise<TunnelHealth["metrics"]> {
  const empty: TunnelHealth["metrics"] = {
    reachable: false,
    version: null,
    uptimeSeconds: null,
    haConnections: null,
    totalRequests: null,
    requestErrors: null,
    activeEdgeLocations: [],
  };

  try {
    const { status, body } = await httpGet(`${METRICS_BASE}/metrics`);
    if (status !== 200) return empty;

    const startTime = extractMetric(body, "process_start_time_seconds");
    return {
      reachable: true,
      version: extractVersion(body),
      uptimeSeconds: startTime ? Math.floor(Date.now() / 1000 - startTime) : null,
      haConnections: extractMetric(body, "cloudflared_tunnel_ha_connections"),
      totalRequests: extractMetric(body, "cloudflared_tunnel_total_requests"),
      requestErrors: extractMetric(body, "cloudflared_tunnel_request_errors"),
      activeEdgeLocations: extractEdgeLocations(body),
    };
  } catch {
    return empty;
  }
}

// --- Ingress parsing ---

function parseIngressConfig(): IngressRoute[] {
  try {
    const configPath = path.join(PROJECT_ROOT, "cloudflared-config.yml");
    const text = fs.readFileSync(configPath, "utf8");

    const routes: IngressRoute[] = [];
    const lines = text.split("\n");
    let inIngress = false;
    let currentHostname: string | null = null;

    for (const line of lines) {
      if (/^ingress:/.test(line)) {
        inIngress = true;
        continue;
      }
      if (!inIngress) continue;

      // Non-indented line means ingress block ended
      if (/^\S/.test(line) && line.trim()) break;

      const hostnameMatch = line.match(/^\s+-\s+hostname:\s+(.+)/);
      if (hostnameMatch) {
        currentHostname = hostnameMatch[1].trim();
        continue;
      }

      const serviceMatch = line.match(/^\s+service:\s+(.+)/);
      if (serviceMatch) {
        const service = serviceMatch[1].trim();
        const portMatch = service.match(/localhost:(\d+)/);
        routes.push({
          hostname: currentHostname,
          service,
          port: portMatch ? parseInt(portMatch[1], 10) : null,
          portOpen: null, // filled in later
        });
        currentHostname = null;
        continue;
      }

      // Catch-all entry: "- service: ..."
      const catchAllMatch = line.match(/^\s+-\s+service:\s+(.+)/);
      if (catchAllMatch) {
        const service = catchAllMatch[1].trim();
        routes.push({ hostname: null, service, port: null, portOpen: null });
        currentHostname = null;
      }
    }

    return routes;
  } catch (err) {
    log.warn(`Failed to parse cloudflared config: ${(err as Error).message}`);
    return [];
  }
}

// --- Port liveness ---

function checkPort(port: number, timeout = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(timeout, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function checkIngressPorts(routes: IngressRoute[]): Promise<IngressRoute[]> {
  return Promise.all(
    routes.map(async (route) => {
      if (route.port === null) return route;
      const portOpen = await checkPort(route.port);
      return { ...route, portOpen };
    })
  );
}

// --- Overall status ---

function computeStatus(
  processRunning: boolean,
  ready: TunnelHealth["ready"],
): TunnelHealth["overallStatus"] {
  if (!processRunning) return "down";
  if (!ready.reachable) return "unknown";
  if (ready.readyConnections === 0) return "down";
  if (ready.readyConnections < 2) return "degraded";
  return "healthy";
}

// --- Public API ---

export async function getTunnelHealth(): Promise<TunnelHealth> {
  const now = Date.now();
  if (cached && now - cacheTime < CACHE_TTL) return cached;

  const [processRunning, ready, metrics] = await Promise.all([
    isProcessRunning(),
    checkReady(),
    checkMetrics(),
  ]);

  const ingressRaw = parseIngressConfig();
  const ingress = await checkIngressPorts(ingressRaw);
  const overallStatus = computeStatus(processRunning, ready);

  const result: TunnelHealth = {
    processRunning,
    ready,
    metrics,
    ingress,
    overallStatus,
    timestamp: now,
  };

  cached = result;
  cacheTime = now;
  return result;
}
