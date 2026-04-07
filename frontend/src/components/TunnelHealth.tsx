import useTunnelHealth from "../hooks/useTunnelHealth";
import type { IngressRoute, TunnelInfo } from "../types";

const STATUS_COLORS: Record<string, string> = {
  healthy: "#0f9d58",
  degraded: "#fb0",
  down: "#f44",
  inactive: "#888",
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

function TunnelCard({ tunnel }: { tunnel: TunnelInfo }) {
  const colos = tunnel.connections.map((c) => c.colo);
  const coloSummary = colos.length > 0 ? Array.from(new Set(colos)).join(", ") : "no connections";

  return (
    <div className="tunnel-card">
      <div className="tunnel-card-header">
        <div className="tunnel-card-title">
          <StatusDot status={tunnel.status} />
          <span className="tunnel-card-name">{tunnel.name}</span>
          <span className="tunnel-card-source">{tunnel.configSource}</span>
        </div>
        <div className="tunnel-card-conns">
          {tunnel.connections.length} conn · {coloSummary}
        </div>
      </div>

      {tunnel.ingress.length > 0 && (
        <div className="tunnel-routes">
          {tunnel.ingress.map((route, i) => (
            <RouteRow key={i} route={route} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TunnelHealth() {
  const { health, wsStatus } = useTunnelHealth(true);
  const connected = wsStatus === "connected";

  return (
    <div className="tunnel-panel">
      <div className="header">
        <h1>Tunnels</h1>
        <div className="tunnel-header-right">
          {health && <span className="tunnel-status-label">{health.tunnels.length} tunnels</span>}
          <span className={`ws-indicator ${connected ? "ws-connected" : ""}`} title={wsStatus} />
        </div>
      </div>

      {wsStatus === "connecting" && !health && (
        <div className="metric-card metric-placeholder">Connecting...</div>
      )}

      {health && !health.apiAvailable && (
        <div className="metric-card metric-placeholder" style={{ color: "#f44" }}>
          {health.apiError || "Cloudflare API unavailable"}
        </div>
      )}

      {health && health.apiAvailable && health.tunnels.length === 0 && (
        <div className="metric-card metric-placeholder">No tunnels found</div>
      )}

      {health && health.tunnels.length > 0 && (
        <div className="tunnel-cards">
          {health.tunnels.map((t) => (
            <TunnelCard key={t.id} tunnel={t} />
          ))}
        </div>
      )}
    </div>
  );
}
