export interface ServiceStatus {
  enabled: boolean;
  raw?: string;
  error?: string;
}

export interface AllStatus {
  ssh: ServiceStatus;
  fileSharing: ServiceStatus;
}

export interface SystemMetricsData {
  cpu: {
    usagePercent: number | null;
    coreCount: number;
  };
  memory: {
    totalMB: number;
    freeMB: number;
    usedMB: number;
    usagePercent: number;
  };
  timestamp: number;
}

export interface MetricsHistoryEntry {
  time: string;
  cpu: number | null;
  memory: number;
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
  status: string;
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
