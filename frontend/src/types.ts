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
