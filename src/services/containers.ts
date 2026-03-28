import http from "node:http";
import { execSync } from "node:child_process";
import { log } from "../logger.js";

export interface ContainerPort {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

export interface ContainerInfo {
  Id: string;
  Names: string[];
  Image: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: ContainerPort[];
}

export interface ContainerStats {
  cpuPercent: number | null;
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryPercent: number;
  pids: number;
}

export interface ContainerWithStats {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  stats: ContainerStats | null;
}

interface RawStats {
  cpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
    online_cpus: number;
  };
  memory_stats: {
    usage: number;
    limit: number;
  };
  pids_stats: {
    current: number;
  };
}

// Track previous CPU readings per container for delta calculation
const prevCpu = new Map<string, { total: number; system: number }>();

let cachedSocketPath: string | null = null;

function getSocketPath(): string {
  if (process.env.PODMAN_SOCKET) return process.env.PODMAN_SOCKET;
  if (cachedSocketPath) return cachedSocketPath;

  try {
    const json = execSync("podman machine inspect", { encoding: "utf8", timeout: 5000 });
    const info = JSON.parse(json);
    const socketPath = info[0]?.ConnectionInfo?.PodmanSocket?.Path;
    if (socketPath) {
      cachedSocketPath = socketPath;
      return socketPath;
    }
  } catch {}

  throw new Error("Could not find podman socket. Set PODMAN_SOCKET env var.");
}

function podmanGet<T>(path: string): Promise<T> {
  const socketPath = getSocketPath();
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath, path, method: "GET" }, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Podman API ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from podman API: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error("Podman API request timeout"));
    });
    req.end();
  });
}

export async function listContainers(): Promise<ContainerInfo[]> {
  try {
    return await podmanGet<ContainerInfo[]>("/containers/json?all=false");
  } catch (err) {
    log.error(`Failed to list containers: ${(err as Error).message}`);
    throw err;
  }
}

function computeStats(id: string, raw: RawStats): ContainerStats {
  const prev = prevCpu.get(id);
  const current = {
    total: raw.cpu_stats.cpu_usage.total_usage,
    system: raw.cpu_stats.system_cpu_usage,
  };
  prevCpu.set(id, current);

  let cpuPercent: number | null = null;
  if (prev) {
    const cpuDelta = current.total - prev.total;
    const sysDelta = current.system - prev.system;
    cpuPercent = sysDelta > 0
      ? Math.round((cpuDelta / sysDelta) * raw.cpu_stats.online_cpus * 100 * 10) / 10
      : 0;
  }

  const usage = raw.memory_stats.usage;
  const limit = raw.memory_stats.limit;

  return {
    cpuPercent,
    memoryUsageMB: Math.round(usage / 1024 / 1024),
    memoryLimitMB: Math.round(limit / 1024 / 1024),
    memoryPercent: limit > 0 ? Math.round((usage / limit) * 1000) / 10 : 0,
    pids: raw.pids_stats.current,
  };
}

export async function listContainersWithStats(): Promise<ContainerWithStats[]> {
  const containers = await listContainers();

  const results = await Promise.allSettled(
    containers.map(async (c): Promise<ContainerWithStats> => {
      const name = c.Names[0]?.replace(/^\//, "") || c.Id.slice(0, 12);
      try {
        const raw = await podmanGet<RawStats>(
          `/containers/${c.Id}/stats?stream=false&one-shot=true`
        );
        return {
          id: c.Id,
          name,
          image: c.Image,
          state: c.State,
          status: c.Status,
          created: c.Created,
          stats: computeStats(c.Id, raw),
        };
      } catch {
        return {
          id: c.Id,
          name,
          image: c.Image,
          state: c.State,
          status: c.Status,
          created: c.Created,
          stats: null,
        };
      }
    })
  );

  // Prune stale CPU cache entries for stopped containers
  const activeIds = new Set(containers.map((c) => c.Id));
  for (const id of prevCpu.keys()) {
    if (!activeIds.has(id)) prevCpu.delete(id);
  }

  return results.map((r) => (r.status === "fulfilled" ? r.value : (r as never)));
}
