import useTunnelHealth from "../hooks/useTunnelHealth";
import type { IngressRoute } from "../types";

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "#0f9d58",
  degraded: "#fb0",
  down: "#f44",
  unknown: "#555",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className="tunnel-status-dot"
      style={{ background: STATUS_COLORS[status] || "#555" }}
      title={status}
    />
  );
}

function RouteRow({ route }: { route: IngressRoute }) {
  return (
    <div className="tunnel-route">
      <span className="tunnel-route-hostname">
        {route.hostname || "(catch-all)"}
      </span>
      <span className="tunnel-route-arrow">&rarr;</span>
      <span className="tunnel-route-service">{route.service}</span>
      {route.portOpen !== null && (
        <span
          className="tunnel-port-dot"
          style={{ background: route.portOpen ? "#0f9d58" : "#f44" }}
          title={route.portOpen ? `port ${route.port} open` : `port ${route.port} closed`}
        />
      )}
    </div>
  );
}

function StatValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="container-stat">
      <span className="container-stat-label">{label}</span>
      <span className="container-stat-value">{value}</span>
    </div>
  );
}

export default function TunnelHealth() {
  const { health, wsStatus } = useTunnelHealth(true);
  const connected = wsStatus === "connected";

  return (
    <div className="tunnel-panel">
      <div className="header">
        <h1>Tunnel</h1>
        <div className="tunnel-header-right">
          {health && (
            <>
              <span className="tunnel-status-label">{health.overallStatus}</span>
              <StatusDot status={health.overallStatus} />
            </>
          )}
          {!health && (
            <span className={`ws-indicator ${connected ? "ws-connected" : ""}`} title={wsStatus} />
          )}
        </div>
      </div>

      {wsStatus === "connecting" && !health && (
        <div className="metric-card metric-placeholder">Connecting...</div>
      )}

      {health && (
        <>
          {health.ingress.length > 0 && (
            <div className="tunnel-routes">
              <div className="tunnel-section-label">Routes</div>
              {health.ingress.map((route, i) => (
                <RouteRow key={i} route={route} />
              ))}
            </div>
          )}

          <div className="tunnel-stats">
            <StatValue
              label="Conn"
              value={String(health.ready.readyConnections)}
            />
            {health.metrics.activeEdgeLocations.length > 0 && (
              <StatValue
                label="Edge"
                value={health.metrics.activeEdgeLocations.join(", ")}
              />
            )}
            {health.metrics.uptimeSeconds != null && (
              <StatValue
                label="Uptime"
                value={formatUptime(health.metrics.uptimeSeconds)}
              />
            )}
            {health.metrics.totalRequests != null && (
              <StatValue
                label="Reqs"
                value={formatNumber(health.metrics.totalRequests)}
              />
            )}
            {health.metrics.version && (
              <StatValue label="Ver" value={health.metrics.version} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
