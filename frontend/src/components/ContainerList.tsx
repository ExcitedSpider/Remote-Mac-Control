import useContainerStats from "../hooks/useContainerStats";
import type { ContainerWithStats } from "../types";

function shortenImage(image: string): string {
  const stripped = image.replace(/^localhost\//, "");
  if (stripped.length > 50) return stripped.slice(0, 47) + "...";
  return stripped;
}

function StatValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="container-stat">
      <span className="container-stat-label">{label}</span>
      <span className="container-stat-value">{value}</span>
    </div>
  );
}

function ContainerRow({ container }: { container: ContainerWithStats }) {
  const { stats } = container;

  return (
    <div className="container-row">
      <div className="container-main">
        <span className={`container-state container-state-${container.state}`} />
        <span className="container-name">{container.name}</span>
        <span className="container-status-tag">{container.status}</span>
      </div>
      <div className="container-image" title={container.image}>
        {shortenImage(container.image)}
      </div>
      {stats && (
        <div className="container-stats-row">
          <StatValue
            label="CPU"
            value={stats.cpuPercent !== null ? `${stats.cpuPercent}%` : "—"}
          />
          <StatValue
            label="MEM"
            value={`${stats.memoryUsageMB}/${stats.memoryLimitMB} MB`}
          />
          <StatValue label="PIDs" value={String(stats.pids)} />
        </div>
      )}
    </div>
  );
}

export default function ContainerList() {
  const { containers, wsStatus } = useContainerStats(true);
  const connected = wsStatus === "connected";

  return (
    <div className="containers-panel">
      <div className="header">
        <h1>Containers</h1>
        <div className="containers-header-right">
          <span className="container-count">{containers.length} running</span>
          <span className={`ws-indicator ${connected ? "ws-connected" : ""}`} title={wsStatus} />
        </div>
      </div>

      {wsStatus === "connecting" && containers.length === 0 && (
        <div className="metric-card metric-placeholder">Connecting...</div>
      )}

      {connected && containers.length === 0 && (
        <div className="metric-card metric-placeholder">No running containers</div>
      )}

      {containers.length > 0 && (
        <div className="container-list">
          {containers.map((c) => (
            <ContainerRow key={c.id} container={c} />
          ))}
        </div>
      )}
    </div>
  );
}
