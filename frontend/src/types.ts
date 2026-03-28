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
