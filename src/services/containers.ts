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
