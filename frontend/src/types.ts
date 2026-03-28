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
