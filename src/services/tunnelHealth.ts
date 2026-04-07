import https from "node:https";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { log } from "../logger.js";

const CERT_PATH = path.join(os.homedir(), ".cloudflared", "cert.pem");

export interface IngressRoute {
  hostname: string | null;
  service: string;
  port: number | null;
  portOpen: boolean | null;
}

export interface TunnelConnection {
  colo: string;
  originIp: string;
  openedAt: string;
}

export interface TunnelInfo {
  id: string;
  name: string;
  status: string; // "healthy" | "down" | "degraded" | "inactive" | "unknown" | etc.
  configSource: "local" | "cloudflare";
  remoteConfig: boolean;
  connections: TunnelConnection[];
  ingress: IngressRoute[];
}

export interface TunnelHealth {
  apiAvailable: boolean;
  apiError: string | null;
  tunnels: TunnelInfo[];
  timestamp: number;
}

// --- Cache ---
let cached: TunnelHealth | null = null;
let cacheTime = 0;
const CACHE_TTL = 10_000;

// --- Credential loading ---

interface ApiCreds {
  accountId: string;
  apiToken: string;
}

let cachedCreds: ApiCreds | null = null;

function loadCredentials(): ApiCreds | null {
  if (cachedCreds) return cachedCreds;

  // Env vars take priority
  if (process.env.CF_API_TOKEN && process.env.CF_ACCOUNT_ID) {
    cachedCreds = {
      accountId: process.env.CF_ACCOUNT_ID,
      apiToken: process.env.CF_API_TOKEN,
    };
    return cachedCreds;
  }

  // Fall back to ~/.cloudflared/cert.pem
  try {
    const text = fs.readFileSync(CERT_PATH, "utf8");
    const match = text.match(/-----BEGIN ARGO TUNNEL TOKEN-----\s*([\s\S]*?)\s*-----END ARGO TUNNEL TOKEN-----/);
    const b64 = (match ? match[1] : text).replace(/\s+/g, "");
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    // The decoded JSON may be truncated; recover via partial parse
    const accountMatch = decoded.match(/"accountID":"([^"]+)"/);
    const tokenMatch = decoded.match(/"apiToken":"([^"]+)"/);
    if (accountMatch && tokenMatch) {
      cachedCreds = { accountId: accountMatch[1], apiToken: tokenMatch[1] };
      return cachedCreds;
    }
  } catch (err) {
    log.warn(`Could not read cloudflared cert: ${(err as Error).message}`);
  }

  return null;
}

// --- HTTPS helper ---

function apiGet<T>(url: string, token: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`API ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            if (!json.success) {
              reject(new Error(`API error: ${JSON.stringify(json.errors)}`));
              return;
            }
            resolve(json.result as T);
          } catch (err) {
            reject(new Error(`Invalid JSON: ${(err as Error).message}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("API request timeout")));
  });
}

// --- Cloudflare API types ---

interface CfTunnel {
  id: string;
  name: string;
  status: string;
  remote_config: boolean;
  config_src: "local" | "cloudflare";
  connections: Array<{
    colo_name: string;
    origin_ip: string;
    opened_at: string;
  }>;
}

interface CfTunnelConfig {
  tunnel_id: string;
  config: {
    ingress?: Array<{
      hostname?: string;
      service: string;
    }>;
  };
}

// --- API calls ---

async function fetchTunnelList(creds: ApiCreds): Promise<CfTunnel[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/cfd_tunnel?is_deleted=false`;
  return apiGet<CfTunnel[]>(url, creds.apiToken);
}

async function fetchTunnelConfig(creds: ApiCreds, tunnelId: string): Promise<CfTunnelConfig> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/cfd_tunnel/${tunnelId}/configurations`;
  return apiGet<CfTunnelConfig>(url, creds.apiToken);
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

function extractPort(service: string): number | null {
  // Matches host:port in services like "http://localhost:3000", "ssh://localhost:2222", "tcp://localhost:5432"
  const match = service.match(/:\/\/[^:/]+:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function buildIngress(rawIngress: CfTunnelConfig["config"]["ingress"]): Promise<IngressRoute[]> {
  if (!rawIngress) return [];
  const routes: IngressRoute[] = rawIngress.map((entry) => ({
    hostname: entry.hostname ?? null,
    service: entry.service,
    port: extractPort(entry.service),
    portOpen: null,
  }));

  return Promise.all(
    routes.map(async (route) => {
      if (route.port === null) return route;
      const portOpen = await checkPort(route.port);
      return { ...route, portOpen };
    })
  );
}

// --- Public API ---

export async function getTunnelHealth(): Promise<TunnelHealth> {
  const now = Date.now();
  if (cached && now - cacheTime < CACHE_TTL) return cached;

  const creds = loadCredentials();
  if (!creds) {
    const result: TunnelHealth = {
      apiAvailable: false,
      apiError: "No Cloudflare credentials (set CF_API_TOKEN/CF_ACCOUNT_ID or ensure ~/.cloudflared/cert.pem exists)",
      tunnels: [],
      timestamp: now,
    };
    cached = result;
    cacheTime = now;
    return result;
  }

  try {
    const tunnels = await fetchTunnelList(creds);

    const tunnelInfos = await Promise.all(
      tunnels.map(async (t): Promise<TunnelInfo> => {
        let ingress: IngressRoute[] = [];
        try {
          const config = await fetchTunnelConfig(creds, t.id);
          ingress = await buildIngress(config.config.ingress);
        } catch (err) {
          log.warn(`Failed to fetch config for tunnel ${t.name}: ${(err as Error).message}`);
        }

        return {
          id: t.id,
          name: t.name,
          status: t.status,
          configSource: t.config_src,
          remoteConfig: t.remote_config,
          connections: t.connections.map((c) => ({
            colo: c.colo_name,
            originIp: c.origin_ip,
            openedAt: c.opened_at,
          })),
          ingress,
        };
      })
    );

    const result: TunnelHealth = {
      apiAvailable: true,
      apiError: null,
      tunnels: tunnelInfos,
      timestamp: now,
    };
    cached = result;
    cacheTime = now;
    return result;
  } catch (err) {
    const result: TunnelHealth = {
      apiAvailable: false,
      apiError: (err as Error).message,
      tunnels: [],
      timestamp: now,
    };
    cached = result;
    cacheTime = now;
    return result;
  }
}
